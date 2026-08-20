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

  // 세모집으로 갈아타기 — 이전 책 값이 남으면 여기서 걸린다.
  // 세모집에 항목이 둘이지만 건물은 소개서를 바로 연다 (안내서는 우편함이 연다)
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
      ['bldg-idle', 'folk-idle', 'me-idle', 'mbox-idle'].includes(x.animationName));
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

  // 세모집은 항목이 둘이 되면서 팝오버가 먼저 뜬다. 이 검사는 「건물에서 바로
  // 날아오르는가」를 보는 것이므로 아직 direct로 바로 열리는 미술관으로 잰다.
  await fly('museum');                      // 첫 열기로 그림을 데운다
  const { src, path } = await fly('museum');
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

  // 우편함 — 구역과 별개의 문. 건물은 소개서를 열고 우편함은 게임 안내서를 연다.
  // 링크 상자는 가만히 있어야 한다 (그림만 뛴다 — "나" 캐릭터와 같은 규칙).
  const mba = p.locator('.mbox-spot');
  ok(await mba.count() === 1, '우편함이 자기 문(링크)을 가진다');
  ok(await mba.getAttribute('href') === '/game/', '우편함이 게임 안내서로 간다');

  const drift = await p.evaluate(async () => {
    const a = document.querySelector('.mbox-spot');
    const xs = [], ys = [];
    for (let i = 0; i < 24; i++) {
      const r = a.getBoundingClientRect(); xs.push(r.left); ys.push(r.top);
      await new Promise((r2) => requestAnimationFrame(r2));
    }
    return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  });
  ok(drift < 0.5, '우편함 링크 상자는 흔들리지 않는다', drift.toFixed(2) + 'px');

  const hitBox = await p.evaluate(() => {
    const cs = getComputedStyle(document.querySelector('.mbox-spot'), '::after');
    return [parseFloat(cs.width), parseFloat(cs.height)];
  });
  ok(hitBox[0] >= 44 && hitBox[1] >= 44,
    `우편함 판정이 터치 기준 44px 이상 (${hitBox[0].toFixed(0)}x${hitBox[1].toFixed(0)})`);

  // 누르면 겉장이 날아오르고 /game/ 표지에서 이어진다
  await p.click('.mbox-spot');
  await p.waitForURL('**/game/?from=town', { timeout: 4000 });
  await p.waitForTimeout(700);
  const atCover = await p.evaluate(() =>
    document.getElementById('deck').scrollTop === 0);
  ok(atCover, '우편함으로 열면 표지에서 시작한다 (?from=town)');
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
    const label = await p.getAttribute(`button[data-district="${d.id}"]`, 'aria-label');
    const direct = d.direct && data.items.find((i) => i.id === d.direct);
    const want = direct ? `${d.name} — ${direct.name}`
      : n ? `${d.name} — 작업물 ${n}개` : `${d.name} — 준비 중`;
    if (label !== want) ok(false, `${d.name} 구역 라벨`, `${label} ≠ ${want}`);
  }
  ok(true, '구역 라벨이 전부 데이터와 맞다');

  // 만든 순서 — 속도가 이 사이트의 주장 중 하나라 날짜가 빠지면 주장이 무너진다
  const undated = data.items.filter((i) => !/^\d{4}-\d{2}$/.test(i.date || ''));
  ok(undated.length === 0, '모든 항목에 만든 시기(YYYY-MM)가 있다',
    undated.map((i) => i.id).join(', ') + ' 빠짐');

  const dates = await p.evaluate(() =>
    [...document.querySelectorAll('#modalBody .card-date')].map((n) => n.textContent));
  ok(dates.length === data.items.length, `날짜가 전부 나온다 (${dates.length} / ${data.items.length})`);
  ok(dates.every((d, n) => n === 0 || dates[n - 1] >= d), '최근 것부터 차례로 놓인다');

  const months = await p.evaluate(() =>
    [...document.querySelectorAll('#modalBody .group-title')].length);
  ok(months === new Set(data.items.map((i) => i.date)).size, `달 묶음 수가 맞다 (${months})`);

  // 보기 전환 토글은 없앴다 — 목록은 언제나 만든 순서다
  const toggles = await p.evaluate(() => document.querySelectorAll('.view-btn, #views').length);
  ok(toggles === 0, '보기 전환 토글이 없다');
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
  // 줄바꿈이 든 설명은 `<br>`로 나뉘어 박히므로 줄 단위로 견준다 (지금은 쓰는 항목이 없다)
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
    '만든 순서 섹션에 항목이 전부 있다', noTime.map((i) => i.id).join(', ') + ' 빠짐');

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

/* ── 10. 게임 안내서 (/game/) ──────────────────────────────
   깨진 적 있음 ①: 간지 카드를 position: sticky로 두고 그것을 그대로 스냅 대상으로
   삼았더니, 붙어 있는 동안 스냅 위치가 스크롤을 따라 움직여 mandatory 스냅이
   엉뚱한 면으로 끌어당겼다. 챕터 1을 눌렀는데 목차로 가는 식이었다.
   깨진 적 있음 ②: 46면을 한 줄로 이어 두고 챕터 이동을 smooth 스크롤로 했더니
   사이의 스무 장이 전부 지나가느라 화면이 파바박 튀었다. 지금은 챕터마다 따로
   놓인 카드 뭉치라, 한 번에 한 뭉치만 화면에 올라간다. */
head('게임 안내서');
{
  const p = await desktop();
  await p.goto(BASE + '/game/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(900);

  const data = await p.evaluate(() => fetch('data.json').then((r) => r.json()));
  const gates = data.chapters.filter((c) => c.gate).length;

  // 목차에서 시작한다 — 첫 화면은 37편의 리스트가 아니라 챕터를 고르는 화면이다
  ok(await p.locator('.toc-hit').count() === 5, '목차 히트 영역이 다섯이다');

  // 42는 다섯 번째 챕터가 아니다 — 순번을 다시 매기지 않았는지 본다
  const labels = await p.evaluate(() =>
    [...document.querySelectorAll('.chip')].map((b) => b.firstChild.textContent.trim()));
  ok(labels.join(',') === '1,2,3,4,42', `챕터 번호가 1·2·3·4·42다 (${labels.join(',')})`);

  // 4와 42 사이 간격이 다른 간격의 3배를 넘는가 — 이 페이지의 시그니처다
  const gap = await p.evaluate(() => {
    const chips = [...document.querySelectorAll('.chip')].map((b) => b.getBoundingClientRect());
    return { wide: Math.round(chips[4].left - chips[3].right),
             norm: Math.round(Math.min(chips[1].left - chips[0].right,
                                       chips[2].left - chips[1].right)) };
  });
  ok(gap.wide >= gap.norm * 3, `4와 42 사이가 넉넉히 벌어져 있다 (${gap.wide}px vs ${gap.norm}px)`);

  // 목차 히트 영역이 원본 이미지의 글자 행과 맞는가 (실측 28.5/40.8/53.4/65.6/80.0%)
  const rows = await p.evaluate(() => {
    const img = document.querySelector('.toc-frame img').getBoundingClientRect();
    return [...document.querySelectorAll('.toc-hit')].map((h) => {
      const r = h.getBoundingClientRect();
      return (r.top + r.height / 2 - img.top) / img.height * 100;
    });
  });
  const wantRows = [28.5, 40.8, 53.4, 65.6, 80.0];
  const worst = Math.max(...rows.map((v, i) => Math.abs(v - wantRows[i])));
  ok(worst < 1.5, `목차 히트 영역이 글자 행에 맞는다 (최대 ${worst.toFixed(1)}%p 어긋남)`);

  // 챕터마다 따로 놓인 뭉치다. 누르면 그 뭉치만 올라오고 간지가 첫 장이다.
  let total = 2;                                    // 표지·목차
  for (const ch of data.chapters) {
    await p.click(`.chip[data-chapter="${ch.id}"]`);
    await p.waitForTimeout(450);
    const st = await p.evaluate(() => ({
      cards: document.querySelectorAll('.card').length,
      first: document.querySelector('.card').className,
      top: Math.round(document.getElementById('deck').scrollTop),
      cur: document.querySelector('.chip[aria-current="true"]')?.dataset.chapter,
      bgs: document.querySelectorAll('.chapter-bg').length,
    }));
    const want = 1 + ch.pages.length + (ch.gate ? 1 : 0);
    if (st.cards !== want || st.top !== 0 || st.cur !== ch.id
        || !st.first.includes('card--divider') || st.bgs !== 1) {
      ok(false, `챕터 ${ch.label} 뭉치가 홀로 올라온다`, JSON.stringify(st) + ` want=${want}`);
      break;
    }
    total += st.cards;
  }
  ok(true, '챕터마다 그 뭉치만 올라오고 간지에서 시작한다');
  ok(total + 2 === 50, `모든 뭉치를 합치면 46면 + 문 4장 = 50장 (${total + 2})`);

  // 문은 1·2·3·4 뒤에만. 42 뒤에는 붙이지 않는다
  ok(await p.locator('.card--gate').count() === 0, '챕터 42 뒤에는 문이 없다');
  await p.click('.chip[data-chapter="ch1"]'); await p.waitForTimeout(400);
  ok(await p.locator('.card--gate').count() === 1, `문이 챕터마다 하나씩 (총 ${gates}개)`);

  // 간지는 스냅 대상이되 스티키가 아니어야 한다
  const pos = await p.evaluate(() => ({
    divider: getComputedStyle(document.querySelector('.card--divider')).position,
    bg: getComputedStyle(document.querySelector('.chapter-bg')).position,
  }));
  ok(pos.divider !== 'sticky' && pos.bg === 'sticky',
    '붙는 것과 걸리는 것이 갈려 있다', JSON.stringify(pos));

  // 문을 누르면 다음 뭉치로 넘어간다
  await p.evaluate(() => {
    const d = document.getElementById('deck');
    d.style.scrollBehavior = 'auto';
    d.scrollTop = d.scrollHeight;
  });
  await p.waitForTimeout(300);
  await p.click('.card--gate');
  await p.waitForTimeout(450);
  ok(await p.evaluate(() =>
    document.querySelector('.chip[aria-current="true"]')?.dataset.chapter) === 'ch2',
    '문을 누르면 다음 챕터 뭉치로 넘어간다');
  await p.close();
}

/* ── 11. 방문 통계 ────────────────────────────────────────
   ga.js는 HOSTS에 적은 도메인에서만 켜진다. 이 가드가 풀리면 여기 검사들이
   매번 바깥 스크립트를 받으러 나가느라 `networkidle`에 기대는 다른 검사들이
   남의 서버 사정에 흔들리고, 내가 고치면서 여닫은 것이 통계에 섞인다.
   마을은 URL이 바뀌지 않으므로 무엇을 봤는지는 커스텀 이벤트로만 남는다 —
   그래서 세 페이지 전부에 붙어 있는지, 부르는 자리가 실제로 부르는지 본다. */
head('방문 통계');
{
  const p = await desktop();
  const sent = [];
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.waitForTimeout(600);

  ok(await p.locator('script[src="/ga.js"]').count() === 1, '마을에 ga.js가 붙어 있다');
  ok(await p.evaluate(() => typeof window.dadaTrack) === 'function',
    'localhost에서도 자리는 있다 (부르는 쪽에 조건문을 두지 않는다)');
  ok(await p.evaluate(() => [...document.scripts]
       .some((s) => s.src.includes('googletagmanager'))) === false,
    'localhost에서는 GA를 부르지 않는다');

  // 부르는 자리가 실제로 부르는지 — 함수를 갈아 끼우고 눌러 본다
  await p.evaluate(() => { window.dadaTrack = (n, q) => window.__ga.push([n, q]); });
  await p.evaluate(() => { window.__ga = []; });
  await p.click('.spot[data-district="school"]'); await p.waitForTimeout(400);
  await p.click('#openList'); await p.waitForTimeout(300);
  await p.click('#closeList'); await p.waitForTimeout(200);
  await p.click('.mbox-spot'); await p.waitForTimeout(300);
  sent.push(...await p.evaluate(() => window.__ga));
  const names = sent.map(([n]) => n);
  ok(names.includes('district_open') && names.includes('list_open')
     && names.includes('mailbox_open'),
    '구역·목록·우편함이 각자 신호를 보낸다', names.join(','));
  const dis = sent.find(([n]) => n === 'district_open');
  ok(dis && dis[1].district === 'school' && dis[1].items === 4,
    '무엇을 열었는지가 함께 간다', JSON.stringify(dis));
  await p.close();
}
{
  const p = await desktop();
  await p.goto(BASE + '/game/', { waitUntil: 'networkidle' });
  ok(await p.locator('script[src="/ga.js"]').count() === 1, '안내서에도 ga.js가 붙어 있다');
  await p.evaluate(() => { window.__ga = []; window.dadaTrack = (n, q) => window.__ga.push([n, q]); });
  await p.click('.chip[data-chapter="ch3"]'); await p.waitForTimeout(400);
  const g = await p.evaluate(() => window.__ga);
  ok(g.some(([n, q]) => n === 'guide_chapter' && q.chapter === 'ch3'),
    '안내서는 어느 챕터를 골랐는지 보낸다', JSON.stringify(g));
  await p.goto(BASE + '/list.html', { waitUntil: 'domcontentloaded' });
  ok(await p.locator('script[src="/ga.js"]').count() === 1,
    '/list.html에도 붙어 있다 (build_list.py 템플릿)');
  await p.close();
}

/* ── 마무리 ─────────────────────────────────────────────── */
head('JS 오류');
ok(errors.length === 0, '콘솔 오류 없음', errors.slice(0, 3).join(' / '));

await browser.close();
console.log(`\n${fail ? '❌' : '✅'}  통과 ${pass} · 실패 ${fail}\n`);
process.exit(fail ? 1 : 0);
