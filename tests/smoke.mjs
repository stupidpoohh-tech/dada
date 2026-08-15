/* DADA TOWN 회귀 테스트
 *
 * 여기 있는 항목은 전부 **실제로 한 번씩 깨졌던 것**이다. 추상적인 커버리지가
 * 아니라 "또 이럴까 봐" 남기는 목록이니, 새 버그를 잡으면 여기에 한 줄 더한다.
 *
 *   python3 -m http.server 8000 &
 *   npm test
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://localhost:8000';
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium';

let pass = 0, fail = 0;
const ok = (cond, label, detail = '') => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${detail ? '  → ' + detail : ''}`); }
};
const head = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 46 - t.length))}`);

const browser = await chromium.launch({ executablePath: CHROME }).catch(() =>
  chromium.launch());   // 로컬에 브라우저가 따로 깔려 있으면 그것을 쓴다

const errors = [];
const watch = (p) => {
  p.on('pageerror', (e) => errors.push(String(e.message)));
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  return p;
};
const desktop = () => browser.newPage({ viewport: { width: 1280, height: 900 } }).then(watch);
const phone = () => browser.newPage({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
}).then(watch);

/* ── 1. 책 뷰어 ────────────────────────────────────────────
   아트북과 세모집 카탈로그가 뷰어 한 벌을 나눠 쓴다. 폴더·쪽수·해시·비율이
   권마다 갈아끼워지지 않으면 다른 책의 값이 새어 나온다. */
head('책 뷰어');
{
  const p = await desktop();
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.waitForTimeout(600);

  await p.click('.spot[data-district="museum"]');
  await p.waitForSelector('#bookOverlay:not([hidden])', { timeout: 4000 });
  await p.waitForTimeout(700);
  ok(await p.textContent('#bkTotal') === '11', '아트북 11쪽');
  ok(await p.locator('#bkStrip .thumb').count() === 11, '썸네일 11개');

  await p.click('#bkNext'); await p.waitForTimeout(900);
  ok(await p.evaluate(() => location.hash) === '#art-2', '넘기면 해시가 따라간다');
  ok(await p.evaluate(() => { const i = document.getElementById('bkImg');
    return i.complete && i.naturalWidth > 0; }), '페이지 이미지가 실제로 뜬다');

  // 세모집으로 갈아타기 — 이전 책 값이 남으면 여기서 걸린다
  await p.keyboard.press('Escape'); await p.waitForTimeout(700);
  await p.click('.spot[data-district="house"]');
  await p.waitForSelector('#bookOverlay:not([hidden])', { timeout: 4000 });
  await p.waitForTimeout(800);
  const sw = await p.evaluate(() => ({
    title: document.getElementById('bkTitle').textContent,
    total: document.getElementById('bkTotal').textContent,
    thumbs: document.querySelectorAll('#bkStrip .thumb').length,
    src: document.getElementById('bkImg').src,
    full: document.getElementById('bookOverlay').classList.contains('full'),
    flat: document.getElementById('bk').classList.contains('flat'),
  }));
  ok(sw.total === '6' && sw.thumbs === 6, '카탈로그로 갈아타면 쪽수·썸네일이 바뀐다', JSON.stringify(sw));
  ok(sw.src.includes('/house/'), '이미지 폴더도 바뀐다', sw.src);
  ok(sw.full, '세로 책은 화면 전체를 쓴다 (.full)');
  ok(sw.flat, '카탈로그는 브로슈어로 그린다 (.flat)');

  // 아트북으로 되돌아가면 가로 설정이 복구돼야 한다
  await p.evaluate(() => { location.hash = '#art-3'; }); await p.waitForTimeout(900);
  const back = await p.evaluate(() => ({
    total: document.getElementById('bkTotal').textContent,
    full: document.getElementById('bookOverlay').classList.contains('full'),
    flat: document.getElementById('bk').classList.contains('flat'),
  }));
  ok(back.total === '11' && !back.full && !back.flat, '아트북으로 돌아오면 설정이 복구된다', JSON.stringify(back));

  await p.keyboard.press('Escape'); await p.waitForTimeout(700);
  await p.goto(BASE + '#nope', { waitUntil: 'networkidle' }); await p.waitForTimeout(500);
  ok(await p.locator('#bookOverlay').getAttribute('hidden') !== null, '등록 안 된 해시는 무시한다');
  await p.close();
}

/* ── 2. 목록 카드의 책 해시 ────────────────────────────────
   깨진 적 있음: books 등록이 renderModalList()보다 늦어 카드가 '#'만 물었다. */
head('목록 카드');
{
  const p = await desktop();
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  await p.click('#openList'); await p.waitForTimeout(400);
  const hrefs = await p.evaluate(() =>
    [...document.querySelectorAll('#modalBody .card')].map((a) => a.getAttribute('href')));
  ok(!hrefs.includes('#'), '책 카드가 빈 해시를 물지 않는다', hrefs.filter((h) => h === '#').length + '개가 빈 해시');
  ok(hrefs.some((h) => h === '#art') && hrefs.some((h) => h === '#house'), '두 책 모두 해시를 갖는다');
  await p.close();
}

/* ── 3. "나" 캐릭터 판정 영역 ──────────────────────────────
   깨진 적 있음: 버튼 자체가 folk-idle로 흔들려 누를 자리도 같이 움직였다.
   폰에서 21x25px에 세로로 7.5px씩 뛰니 조금만 빗나가도 안 눌렸다. */
head('캐릭터 판정 영역');
{
  const p = await phone();
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.waitForTimeout(900);

  const drift = await p.evaluate(async () => {
    const b = document.querySelector('.me-spot');
    const xs = [], ys = [];
    for (let i = 0; i < 24; i++) {
      const r = b.getBoundingClientRect(); xs.push(r.left); ys.push(r.top);
      await new Promise((r2) => requestAnimationFrame(r2));
    }
    return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  });
  ok(drift < 0.5, '버튼 상자는 흔들리지 않는다 (그림만 움직인다)', drift.toFixed(2) + 'px 흔들림');

  const hit = await p.evaluate(() => {
    const cs = getComputedStyle(document.querySelector('.me-spot'), '::after');
    return [parseFloat(cs.width), parseFloat(cs.height)];
  });
  ok(hit[0] >= 44 && hit[1] >= 44, `판정 영역이 터치 기준 44px 이상 (${hit[0]}x${hit[1]})`);

  const box = await p.locator('.me-spot').boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  for (const [dx, dy, label] of [[-24, 0, '왼쪽으로'], [24, 0, '오른쪽으로'], [0, -26, '위로'], [0, 26, '아래로']]) {
    await p.evaluate(() => { const w = document.getElementById('panelWrap'); if (w) w.hidden = true; });
    await p.mouse.click(cx + dx, cy + dy);
    await p.waitForTimeout(250);
    const opened = await p.evaluate(() =>
      document.querySelector('.me-spot').getAttribute('aria-expanded') === 'true');
    ok(opened, `중심에서 ${label} 빗나가도 열린다`);
    if (opened) { await p.click('.panel-close').catch(() => {}); await p.waitForTimeout(200); }
  }
  await p.close();
}

/* ── 4. 마을 박자 ──────────────────────────────────────────
   깨진 적 있음 ①: 호버·뾰옹이 물러나면 그 요소만 idle이 0부터 다시 시작했다.
   깨진 적 있음 ②: 터치에서 :hover가 눌린 채 남아 그 건물만 얼어붙었다. */
head('마을 박자');
{
  const beat = (p) => p.evaluate(() => {
    const a = document.getAnimations().filter((x) =>
      ['bldg-idle', 'folk-idle', 'me-idle'].includes(x.animationName));
    const st = a.map((x) => x.startTime).filter((v) => v != null).map(Number);
    return {
      n: a.length,
      spread: st.length ? Math.round(Math.max(...st) - Math.min(...st)) : -1,
      frozen: a.filter((x) => x.playState !== 'running').length,
    };
  });

  const d = await desktop();
  await d.goto(BASE, { waitUntil: 'networkidle' });
  await d.waitForTimeout(900);
  ok((await beat(d)).spread === 0, '처음부터 한 박자');

  await d.click('.spot[data-district="bank"]'); await d.waitForTimeout(700);
  await d.click('.panel-close'); await d.mouse.move(5, 5); await d.waitForTimeout(500);
  let b = await beat(d);
  ok(b.spread === 0, '팝오버를 열었다 닫아도 박자가 유지된다', b.spread + 'ms 어긋남');

  await d.hover('.spot[data-district="school"]'); await d.waitForTimeout(400);
  await d.mouse.move(5, 5); await d.waitForTimeout(500);
  b = await beat(d);
  ok(b.spread === 0, '호버가 풀려도 박자가 유지된다', b.spread + 'ms 어긋남');
  await d.close();

  const m = await phone();
  await m.goto(BASE, { waitUntil: 'networkidle' });
  await m.waitForTimeout(900);
  for (const id of ['bank', 'school', 'company']) {
    await m.tap(`.spot[data-district="${id}"]`); await m.waitForTimeout(400);
    await m.tap('.panel-close'); await m.waitForTimeout(500);
  }
  b = await beat(m);
  ok(b.spread === 0, '터치로 여러 번 여닫아도 박자가 유지된다', b.spread + 'ms 어긋남');
  ok(b.frozen === 0, '터치 뒤에 얼어붙은 건물이 없다 (sticky :hover)', b.frozen + '개 멈춤');
  await m.close();
}

/* ── 5. 안내 문구 ──────────────────────────────────────────
   깨진 적 있음: 한 번 무언가를 열면 gone이 붙은 채 영영 돌아오지 않았다.
   대비도 한 번 깨졌다 — 눈에 띄게 하려다 1.64:1까지 떨어뜨렸다. */
head('안내 문구');
{
  const p = await desktop();
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.waitForTimeout(600);
  const shown = () => p.evaluate(() => !document.getElementById('hint').classList.contains('gone'));

  ok(await shown(), '처음에 보인다');
  for (const [open, close, label] of [
    [() => p.click('.spot[data-district="bank"]'), () => p.click('.panel-close'), '구역 팝오버'],
    [() => p.click('.spot[data-district="house"]'), () => p.keyboard.press('Escape'), '카탈로그'],
    [() => p.click('#openList'), () => p.click('#closeList'), '목록 모달'],
    [() => p.click('.me-spot'), () => p.click('.panel-close'), '캐릭터'],
  ]) {
    await open(); await p.waitForTimeout(800);
    ok(!(await shown()), `${label} — 열면 숨는다`);
    await close(); await p.waitForTimeout(800);
    ok(await shown(), `${label} — 닫으면 다시 나온다`);
  }

  // 흐리게 깜빡이면 안 읽힌다. 숨쉬기 최저점에서도 WCAG AA(4.5:1)를 지켜야 한다.
  const contrast = await p.evaluate(() => {
    const h = getComputedStyle(document.getElementById('hint'));
    const rgb = h.color.match(/[\d.]+/g).map(Number);
    const min = 0.92;                                   // hint-breathe 최저 투명도
    const mixed = rgb.slice(0, 3).map((v) => v * min + 255 * (1 - min));
    const lum = (c) => {
      const s = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
      return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];
    };
    return (1.05) / (lum(mixed) + 0.05);
  });
  ok(contrast >= 4.5, `안내 문구 대비가 AA를 넘는다 (${contrast.toFixed(2)}:1)`);
  await p.close();
}

/* ── 6. 책이 건물에서 날아온다 ─────────────────────────────
   깨진 적 있음 ①: 닫을 때 쓴 변형이 fill로 남아 다음에 잴 때 출발점이 어긋났다.
   깨진 적 있음 ②: 큰 페이지를 처음 그리느라 프레임이 멈춰 비행 구간이 먹혔다. */
head('책이 건물에서 날아온다');
{
  const p = await desktop();
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.waitForTimeout(900);

  const fly = async (district) => {
    const src = await p.locator(`.spot[data-district="${district}"]`).boundingBox();
    await p.click(`.spot[data-district="${district}"]`);
    const path = await p.evaluate(async () => {
      const bk = document.getElementById('bk'); const o = []; const t0 = performance.now();
      while (performance.now() - t0 < 620) {
        const r = bk.getBoundingClientRect();
        o.push({ t: performance.now() - t0, cx: r.left + r.width / 2, cy: r.top + r.height / 2 });
        await new Promise((x) => requestAnimationFrame(x));
      }
      return o;
    });
    await p.keyboard.press('Escape'); await p.waitForTimeout(750);
    return { src, path };
  };

  await fly('house');                       // 첫 열기로 그림을 데운다
  const { src, path } = await fly('house');
  const start = path[0], end = path[path.length - 1];
  const off = Math.hypot(start.cx - (src.x + src.width / 2), start.cy - (src.y + src.height / 2));
  ok(off < 60, `건물 중심에서 출발한다 (${off.toFixed(0)}px 차이)`);

  // 원래 버그는 큰 페이지를 처음 그리느라 130ms 통째로 멈춘 것이었다.
  // 느린 기계에서 한두 프레임 튀는 것까지 잡으면 실없이 빨개지므로 그 크기로 가른다.
  const worst = path.reduce((m, f, i) => i ? Math.max(m, f.t - path[i - 1].t) : m, 0);
  ok(worst < 80, '비행 중 프레임이 통째로 멈추지 않는다', `가장 긴 공백 ${worst.toFixed(0)}ms`);

  const dist = Math.hypot(end.cx - start.cx, end.cy - start.cy);
  const mid = path.reduce((a, c) => Math.abs(c.t - 160) < Math.abs(a.t - 160) ? c : a);
  const midProg = Math.hypot(mid.cx - start.cx, mid.cy - start.cy) / dist;
  ok(midProg > 0.2 && midProg < 0.85,
    `중간(160ms)에 실제로 이동 중이다 (${Math.round(midProg * 100)}%)`);

  const settled = await p.evaluate(() => {
    const t = getComputedStyle(document.getElementById('bk')).transform;
    return t === 'none' || t === 'matrix(1, 0, 0, 1, 0, 0)';
  });
  ok(settled, '닫은 뒤 변형이 남지 않는다');
  await p.close();
}

/* ── 7. 데이터와 화면이 어긋나지 않는가 ────────────────────
   services.json만 고치면 지도·목록·칩이 함께 바뀌어야 한다. */
head('데이터 단일 소스');
{
  const p = await desktop();
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.waitForTimeout(600);
  const data = await p.evaluate(() => fetch('services.json').then((r) => r.json()));
  await p.click('#openList'); await p.waitForTimeout(400);
  const shown = await p.evaluate(() => document.querySelectorAll('#modalBody .card').length);
  ok(shown === data.items.length, `목록 개수가 데이터와 같다 (${shown} / ${data.items.length})`);
  const chip = await p.evaluate(() => document.querySelector('#chips .chip')?.textContent.trim());
  ok(chip === `전체 ${data.items.length}`, `전체 칩 개수가 맞다 (${chip})`);

  for (const d of data.districts) {
    const n = data.items.filter((i) => i.district === d.id).length;
    const label = await p.getAttribute(`[data-district="${d.id}"]`, 'aria-label');
    const want = n ? `${d.name} — 작업물 ${n}개` : `${d.name} — 준비 중`;
    if (label !== want) ok(false, `${d.name} 구역 라벨`, `${label} ≠ ${want}`);
  }
  ok(true, '구역 라벨이 전부 데이터와 맞다');

  // 「지어진 순서」 — 속도가 이 사이트의 주장 중 하나라 날짜가 빠지면 주장이 무너진다
  const undated = data.items.filter((i) => !/^\d{4}-\d{2}$/.test(i.date || ''));
  ok(undated.length === 0, '모든 항목에 만든 시기(YYYY-MM)가 있다',
    undated.map((i) => i.id).join(', ') + ' 빠짐');

  await p.click('#views .view-btn:nth-child(2)'); await p.waitForTimeout(200);
  const dates = await p.evaluate(() =>
    [...document.querySelectorAll('#modalBody .card-date')].map((n) => n.textContent));
  ok(dates.length === data.items.length, `지어진 순서에 전부 나온다 (${dates.length} / ${data.items.length})`);
  ok(dates.every((d, n) => n === 0 || dates[n - 1] <= d), '오래된 것부터 차례로 놓인다');

  const months = await p.evaluate(() =>
    [...document.querySelectorAll('#modalBody .group-title')].length);
  ok(months === new Set(data.items.map((i) => i.date)).size, `달 묶음 수가 맞다 (${months})`);
  await p.close();
}

/* ── 8. /list 정적 페이지 ──────────────────────────────────
   마을은 JS로 그려져 크롤러에게는 빈 페이지다. 이 페이지가 유일하게
   기계가 읽는 통로이므로, services.json과 어긋나면 바로 잡아야 한다.
   손으로 고칠 수 있는 파일이 아니라 `python3 tools/build_list.py`의 산출물이다. */
head('/list 정적 페이지');
{
  const p = await desktop();
  const res = await p.goto(BASE + '/list.html', { waitUntil: 'load' });
  ok(res && res.ok(), 'list.html이 열린다');

  const data = await p.evaluate(() => fetch('/services.json').then((r) => r.json()));

  // JS 없이도 읽혀야 의미가 있다 — 소스 HTML 자체를 본다
  const src = await res.text();
  // 줄바꿈이 든 설명은 `<br>`로 나뉘어 박히므로 줄 단위로 견준다
  const missing = data.items.filter((i) =>
    !src.includes(i.name) || i.description.split('\n').some((line) => !src.includes(line)));
  ok(missing.length === 0, '모든 항목의 이름과 설명이 HTML에 박혀 있다',
    missing.map((i) => i.id).join(', ') + ' 빠짐 → tools/build_list.py를 다시 돌리세요');

  ok(src.includes(data.profile.name) && src.includes(data.profile.email),
    '약력과 연락처도 HTML에 있다');

  // 모달의 「지어진 순서」와 같은 것을 크롤러·스크린리더도 읽을 수 있어야 한다
  const timeline = src.slice(src.indexOf('id="g-time"'), src.indexOf('id="g-me"'));
  const noTime = data.items.filter((i) => !timeline.includes(i.name));
  ok(src.includes('id="g-time"') && noTime.length === 0,
    '지어진 순서 섹션에 항목이 전부 있다', noTime.map((i) => i.id).join(', ') + ' 빠짐');

  const heads = await p.evaluate(() =>
    [...document.querySelectorAll('.doc-item h3')].length);
  ok(heads === data.items.length + 1, `항목 수가 맞다 (${heads - 1} / ${data.items.length})`);

  // 링크가 전부 살아 있는가
  const dead = await p.evaluate(() =>
    [...document.querySelectorAll('.doc-item h3 a')]
      .map((a) => a.getAttribute('href'))
      .filter((h) => !h || h === '#' || h === '/'));
  ok(dead.length === 0, '죽은 링크가 없다', dead.join(', '));

  // 마을에서 이 페이지로 가는 길
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  await p.click('#openList'); await p.waitForTimeout(400);
  ok(await p.locator('.modal-foot a').count() === 1, '목록 모달에서 이 페이지로 가는 링크가 있다');
  await p.close();
}

/* ── 9. 크롤러가 보는 것 ───────────────────────────────────
   JS를 끈 상태가 곧 검색엔진이 보는 화면이다. */
head('크롤러 시점');
{
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const p = await ctx.newPage();
  await p.goto(BASE + '/list.html', { waitUntil: 'load' });
  const text = (await p.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');
  ok(text.length > 800, `JS 없이도 본문이 충분하다 (${text.length}자)`);
  ok(/고교 영문법 65/.test(text) && /잔고캘린더/.test(text), 'JS 없이 항목 이름이 보인다');

  const r = await p.goto(BASE + '/robots.txt', { waitUntil: 'load' });
  ok(r && r.ok() && (await r.text()).includes('Sitemap:'), 'robots.txt가 sitemap을 가리킨다');
  const s = await p.goto(BASE + '/sitemap.xml', { waitUntil: 'load' });
  const xml = s ? await s.text() : '';
  ok(s && s.ok() && xml.includes('/list.html'), 'sitemap에 list.html이 있다');
  await ctx.close();
}

/* ── 마무리 ─────────────────────────────────────────────── */
head('JS 오류');
ok(errors.length === 0, '콘솔 오류 없음', errors.slice(0, 3).join(' / '));

await browser.close();
console.log(`\n${fail ? '❌' : '✅'}  통과 ${pass} · 실패 ${fail}\n`);
process.exit(fail ? 1 : 0);
