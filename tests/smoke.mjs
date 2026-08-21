/* DADA TOWN 회귀 테스트
 *
 * 여기 있는 항목은 전부 **실제로 한 번씩 깨졌던 것**이다. 추상적인 커버리지가
 * 아니라 "또 이럴까 봐" 남기는 목록이니, 새 버그를 잡으면 여기에 한 줄 더한다.
 *
 *   python3 -m http.server 8000 &
 *   npm test
 */
import { chromium } from 'playwright';
import { serve } from '../tools/serve.mjs';

const BASE = process.env.BASE || 'http://localhost:8000';
/* **서버가 없으면 여기서 띄운다.** 컨테이너가 쉬다 깨면 배경 서버가 먼저 사라지는데,
   그러면 화면에는 ERR_CONNECTION_REFUSED만 떠서 고친 것이 깨진 줄 알고 헤맨다.
   우리가 띄운 것만 마지막에 내린다 — 따로 띄워 둔 서버는 건드리지 않는다. */
const server = await serve(BASE);
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium';

let pass = 0, fail = 0;
const ok = (cond, label, detail = '') => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${detail ? '  → ' + detail : ''}`); }
};
/* **바꾼 곳만 돌릴 수 있다.** 139개를 다 돌리면 72초다 — 한 줄 고칠 때마다
   그걸 물리면 고치는 시간보다 기다리는 시간이 길어진다. 이름 조각을 인자로
   주면 그 절만 돈다 (여러 개 주면 그중 하나라도 걸리는 절).

     node tests/smoke.mjs                 전부
     node tests/smoke.mjs 확성기          「마당의 확성기」만
     node tests/smoke.mjs 한마디 까마귀    둘 다

   푸시 전에는 인자 없이 한 번 돌린다 — 부분만 돌고 넘어가면 남의 절을
   깨뜨린 것을 못 본다. */
const only = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const want = (t) => !only.length || only.some((o) => t.includes(o));
let skipped = 0;
const head = (t) => {
  if (!want(t)) { skipped++; return false; }
  console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 46 - t.length))}`);
  return true;
};

const browser = await chromium.launch({ executablePath: CHROME }).catch(() =>
  chromium.launch());   // 로컬에 브라우저가 따로 깔려 있으면 그것을 쓴다

const errors = [];
const watch = (p) => {
  p.on('pageerror', (e) => errors.push(String(e.message)));
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  return p;
};
const desktop = () => browser.newPage({ viewport: { width: 1280, height: 900 } }).then(watch);
/** 마을을 열고 **날아다니는 쪽지를 첫 길목(빈 땅)에 세워 둔다.**
 *  쪽지는 지도에서 가장 높이 떠 있어 지나가는 자리의 클릭을 받는다 — 실제로도 그게
 *  맞지만, 그러면 「건물을 누른다」 검사가 쪽지가 마침 그 위를 지나느냐에 따라 흔들린다.
 *  움직이는 배경을 한자리에 묶어 두고 상호작용만 보는 것이다. */
const town = async (p, url = BASE) => {
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.waitForSelector('.note-spot', { timeout: 4000 }).catch(() => {});
  await p.evaluate(() => document.getAnimations()
    .filter((a) => (a.animationName || '').startsWith('note-'))
    .forEach((a) => { a.pause(); a.currentTime = 0; }));
};
const phone = () => browser.newPage({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
}).then(watch);

/* ── 1. 책 뷰어 ────────────────────────────────────────────
   아트북과 세모집 카탈로그가 뷰어 한 벌을 나눠 쓴다. 폴더·쪽수·해시·비율이
   권마다 갈아끼워지지 않으면 다른 책의 값이 새어 나온다. */
if (head('책 뷰어')) {
  const p = await desktop();
  await town(p);
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
  await town(p, BASE + '#nope'); await p.waitForTimeout(500);
  ok(await p.locator('#bookOverlay').getAttribute('hidden') !== null, '등록 안 된 해시는 무시한다');
  await p.close();
}

/* ── 2. 목록 카드의 책 해시 ────────────────────────────────
   깨진 적 있음: books 등록이 renderModalList()보다 늦어 카드가 '#'만 물었다. */
if (head('목록 카드')) {
  const p = await desktop();
  await town(p);
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
if (head('캐릭터 판정 영역')) {
  const p = await phone();
  await town(p);
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

  /* **지도 위의 문끼리 판정이 겹치면 안 된다.** 넓힌 판정(::after 44px)은 그림보다
     크므로, 작은 것 둘이 가까이 서면 손가락이 어느 쪽으로 갈지 알 수 없다 —
     세모집 마당에서 확성기를 오른쪽으로 옮긴 뒤 우편함과 24px이 겹쳐, 우편함을
     누르려는데 노래가 나왔다. 지금은 우편함이 길 왼편에 있다.
     쪽지(.note-spot)는 뺀다 — 마을 위를 도는 것이라 무엇과도 잠깐씩 겹친다. */
  const clash = await p.evaluate(() => {
    const rect = (n) => {
      const r = n.getBoundingClientRect();
      const cs = getComputedStyle(n, '::after');
      const w = Math.max(r.width, parseFloat(cs.width) || 0);
      const h = Math.max(r.height, parseFloat(cs.height) || 0);
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      return { n, l: cx - w / 2, r: cx + w / 2, t: cy - h / 2, b: cy + h / 2 };
    };
    const doors = [...document.querySelectorAll('.mbox-spot, .horn-spot, .crow-spot, .me-spot')]
      .map(rect);
    const out = [];
    for (let i = 0; i < doors.length; i++) {
      for (let j = i + 1; j < doors.length; j++) {
        const a = doors[i], c = doors[j];
        const ox = Math.min(a.r, c.r) - Math.max(a.l, c.l);
        const oy = Math.min(a.b, c.b) - Math.max(a.t, c.t);
        if (ox <= 0 || oy <= 0) continue;
        // 얼마나 겹치느냐로 본다. 모서리가 조금 물리는 것과 **판정의 한쪽이
        // 통째로 남의 것에 들어가 있는 것**은 다른 일이다. 작은 쪽의 4분의 1을
        // 넘게 먹으면 손가락이 어디로 갈지 알 수 없다 (옛 우편함×확성기가 38%였다)
        const area = ox * oy;
        const small = Math.min((a.r - a.l) * (a.b - a.t), (c.r - c.l) * (c.b - c.t));
        out.push({
          pair: `${a.n.className.split(' ')[0]}×${c.n.className.split(' ')[0]}`,
          share: area / small,
          detail: `${Math.round(ox)}x${Math.round(oy)}px (${Math.round(area / small * 100)}%)`,
        });
      }
    }
    return out;
  });
  const bad = clash.filter((c) => c.share > 0.25);
  ok(bad.length === 0, '지도 위의 문끼리 판정이 서로를 먹지 않는다',
    bad.map((c) => c.pair + ' ' + c.detail).join(', '));
  // 봐주고 넘어간 것은 숨기지 말고 적어 둔다 — 다음에 늘어나면 눈에 띄어야 한다
  if (clash.length) console.log('     · 모서리만 물린 것: '
    + clash.filter((c) => c.share <= 0.25).map((c) => c.pair + ' ' + c.detail).join(', '));
  await p.close();
}

/* ── 4. 마을 박자 ──────────────────────────────────────────
   깨진 적 있음 ①: 호버·뾰옹이 물러나면 그 요소만 idle이 0부터 다시 시작했다.
   깨진 적 있음 ②: 터치에서 :hover가 눌린 채 남아 그 건물만 얼어붙었다. */
if (head('마을 박자')) {
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
  await town(d);
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
  await town(m);
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
if (head('안내 문구')) {
  const p = await desktop();
  await town(p);
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
if (head('책이 건물에서 날아온다')) {
  const p = await desktop();
  await town(p);
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
if (head('데이터 단일 소스')) {
  const p = await desktop();
  await town(p);
  await p.waitForTimeout(600);
  const data = await p.evaluate(() => fetch('services.json').then((r) => r.json()));
  await p.click('#openList'); await p.waitForTimeout(400);
  const shown = await p.evaluate(() => document.querySelectorAll('#modalBody .card').length);
  ok(shown === data.items.length, `목록 개수가 데이터와 같다 (${shown} / ${data.items.length})`);
  const chip = await p.evaluate(() => document.querySelector('#chips .chip')?.textContent.trim());
  ok(chip === `전체 ${data.items.length}`, `전체 칩 개수가 맞다 (${chip})`);

  // 쪽지가 이미 들고 있는 항목은 구역 패널에도 안 뜬다 (app.js의 byDistrict 필터와 같다)
  const floaterIds = new Set((data.floater?.bundle?.items || []).map((e) => e.id));
  for (const d of data.districts) {
    const n = data.items.filter((i) => i.district === d.id && !floaterIds.has(i.id)).length;
    const label = await p.getAttribute(`button[data-district="${d.id}"]`, 'aria-label');
    const direct = d.direct && data.items.find((i) => i.id === d.direct);
    // "나"는 작업물이 0개여도 프로필이 항상 뜬다 — "준비 중"이 아니다 (app.js와 같은 규칙)
    const want = direct ? `${d.name} — ${direct.name}`
      : n ? `${d.name} — 작업물 ${n}개`
      : d.character ? d.name
      : `${d.name} — 준비 중`;
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

  /* 추천 픽 — **`featured` 숫자가 곧 순서다**(1이 맨 위). 예전에는 `items` 배열
     순서를 따랐는데, 그 배열은 구역별로 묶여 있어 무엇을 먼저 보여줄지와 아무
     상관이 없었다. 데이터에서 기대값을 만들어 견주므로 다음에 순서를 바꿔도
     이 검사는 그대로 산다. */
  await p.click('#closeList'); await p.waitForTimeout(300);
  await p.click('#picksBtn'); await p.waitForTimeout(300);
  const want = data.items.filter((i) => i.featured)
    .sort((a, b) => (+a.featured || 0) - (+b.featured || 0)).map((i) => i.name);
  const got = await p.evaluate(() =>
    [...document.querySelectorAll('#picksBody .card-name')].map((n) => n.firstChild.textContent));
  ok(got.length === want.length && got.every((n, i) => n === want[i]),
    `추천 픽이 featured 숫자 순서대로 뜬다 (${got.length}개)`, got.join(' · '));
  await p.close();
}

/* ── 8. /list 정적 페이지 ──────────────────────────────────
   마을은 JS로 그려져 크롤러에게는 빈 페이지다. 이 페이지가 유일하게
   기계가 읽는 통로이므로, services.json과 어긋나면 바로 잡아야 한다.
   손으로 고칠 수 있는 파일이 아니라 `python3 tools/build_list.py`의 산출물이다. */
if (head('/list 정적 페이지')) {
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
  // 끝 표시는 약력 섹션이다. 「나」 구역에도 항목이 생겨 g-me가 둘이 될 뻔했으므로
  // 약력 쪽 id를 g-profile로 갈라 뒀다 (build_list.py)
  const timeline = src.slice(src.indexOf('id="g-time"'), src.indexOf('id="g-profile"'));
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
  await town(p);
  await p.waitForTimeout(500);
  await p.click('#openList'); await p.waitForTimeout(400);
  ok(await p.locator('.modal-foot a').count() === 1, '목록 모달에서 이 페이지로 가는 링크가 있다');
  await p.close();
}

/* ── 9. 크롤러가 보는 것 ───────────────────────────────────
   JS를 끈 상태가 곧 검색엔진이 보는 화면이다. */
if (head('크롤러 시점')) {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const p = await ctx.newPage();
  await p.goto(BASE + '/list.html', { waitUntil: 'load' });
  const text = (await p.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');
  ok(text.length > 800, `JS 없이도 본문이 충분하다 (${text.length}자)`);
  ok(/고등영어문법/.test(text) && /잔고캘린더/.test(text), 'JS 없이 항목 이름이 보인다');

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
if (head('게임 안내서')) {
  const p = await desktop();
  await p.goto(BASE + '/game/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(900);

  const data = await p.evaluate(() => fetch('data.json').then((r) => r.json()));
  const gates = data.chapters.filter((c) => c.gate).length;

  // 목차에서 시작한다 — 첫 화면은 37편의 리스트가 아니라 챕터를 고르는 화면이다
  ok(await p.locator('.toc-hit').count() === 5, '목차 히트 영역이 다섯이다');

  // 첫 화면에 출처 한 줄. 판권면에만 두면 끝까지 온 사람만 보므로 목차에도 얹는다.
  // 다만 목차 히트 영역 위에 겹치므로 클릭을 먹으면 안 된다.
  const srcline = await p.evaluate(() => {
    const n = document.querySelector('.toc-source');
    return n && { text: n.textContent, pe: getComputedStyle(n).pointerEvents };
  });
  ok(!!srcline && srcline.text.includes('Steam'),
    '목차에 출처 한 줄이 얹혀 있다', JSON.stringify(srcline));
  ok(!!srcline && srcline.pe === 'none', '출처 줄이 목차 클릭을 먹지 않는다');

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

  // 판권면 — 46면을 건드리지 않고 새로 놓는 한 장이다. 인용 서른몇 개의 출처가
  // 여기 한 줄로 모인다. 이 카드에 dataset.page가 붙으면 47면이 되어 버린다.
  // 맺음말 뭉치는 챕터 바에 없다 — 끝까지 온 사람만 만나는 자리라 해시로 들어간다.
  // 쿼리를 하나 붙여야 같은 문서 안의 해시 이동이 아니라 실제로 다시 열린다
  await p.goto(BASE + '/game/?end#outro', { waitUntil: 'networkidle' });
  await p.waitForTimeout(700);
  const colo = await p.evaluate(() => {
    const c = document.querySelector('.card--colophon');
    return c && {
      cards: document.querySelectorAll('.card').length,
      pages: document.querySelectorAll('.card[data-page]').length,
      last: document.querySelector('.card:last-child').className,
      page: c.dataset.page || '',
      text: c.textContent,
    };
  });
  ok(!!colo && colo.cards === 3 && colo.pages === 2 && colo.last.includes('colophon'),
    '맺음말 뒤에 판권면 한 장이 더 있다', JSON.stringify(colo));
  ok(!!colo && !colo.page, '판권면은 원본 면이 아니다 (data-page 없음)');
  ok(!!colo && colo.text.includes('Steam 상점 페이지의 공개 리뷰'),
    '인용 출처가 한 줄로 밝혀져 있다');
  // 표지의 2026.07.08과 마을 카드의 25.02가 여기서 나란히 만난다 — 둘 다 사실이다
  ok(!!colo && colo.text.includes('Ver.3')
     && colo.text.includes('2025.02') && colo.text.includes('2026.07.08'),
    '판본과 두 날짜가 한 줄에 나란히 선다', colo && colo.text.replace(/\s+/g, ' '));

  await p.goto(BASE + '/game/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(600);
  await p.click('.chip[data-chapter="ch1"]'); await p.waitForTimeout(400);

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

/* ── 11. 카페 앞 까마귀 Croww ─────────────────────────────
   PlayGrown 기록은 아직 준비 중이라 갈 문서가 없다. 그렇다고 눌러도 아무 일이 없으면
   문이 아니므로, **읽던 칼럼을 그 자리에서 펴 보이는 버튼**으로 세워 뒀다
   (districts[].mascot.column). 칼럼이 먼저 오고 「준비 중」은 맨 아래에 온다.
   이 마을에는 프레임 애니메이션이 없어서 퍼덕임과 갸웃만 그림 세 장을 번갈아 쓰는데,
   두 장이 겹쳐 보이거나 마을과 박자가 어긋나면 그 자리만 딴 세상이 된다. */
if (head('카페 앞 까마귀')) {
  const p = await desktop();
  await town(p);
  await p.waitForTimeout(900);

  const crow = p.locator('.crow-spot');
  ok(await crow.count() === 1, '카페 앞에 까마귀가 한 마리 있다');

  // 갈 문서는 없지만 펼 칼럼이 있으므로 진짜 버튼이어야 한다
  const idle = await p.evaluate(() => {
    const n = document.querySelector('.crow-spot');
    return { tag: n.tagName, href: n.getAttribute('href'),
             pe: getComputedStyle(n).pointerEvents,
             cur: getComputedStyle(n).cursor };
  });
  ok(idle.tag === 'BUTTON' && !idle.href && idle.pe === 'auto' && idle.cur === 'pointer',
    '칼럼이 걸려 있으면 풍경이 아니라 문이다', JSON.stringify(idle));

  await crow.click();
  const col = await p.evaluate(() => {
    const panel = document.getElementById('panel');
    const notes = [...panel.querySelectorAll('.column-note')];
    const soon = panel.querySelector('.empty');
    const quote = panel.querySelector('.column-quote');
    return {
      shown: !document.getElementById('panelWrap').hidden,
      title: panel.querySelector('.panel-title')?.textContent || '',
      notes: notes.length,
      quoted: !!quote && /Ship It Friday/.test(quote.textContent),
      by: quote?.querySelector('.column-by')?.textContent || '',
      soon: soon?.textContent || '',
      // 순서가 곧 말이다 — 읽을 것이 먼저, 준비 중은 맨 아래
      soonLast: !!soon && panel.lastElementChild === soon,
      expanded: document.querySelector('.crow-spot').getAttribute('aria-expanded'),
    };
  });
  ok(col.shown && /제3의 공간/.test(col.title), '까마귀를 누르면 칼럼이 열린다', col.title);
  ok(col.notes === 4, '칼럼 본문 네 문단이 다 있다', String(col.notes));
  ok(col.quoted && /이승은/.test(col.by), '인용과 말한 사람이 함께 온다', col.by);
  ok(/준비 중/.test(col.soon), '준비 중이라는 말이 함께 있다', col.soon);
  ok(col.soonLast, '칼럼이 먼저 오고 준비 중은 맨 아래다');
  ok(col.expanded === 'true', '열려 있는 동안 까마귀가 그렇다고 말한다', col.expanded);

  // 다시 누르면 닫힌다 — 확성기·쪽지와 같은 규칙
  await crow.click();
  ok(await p.evaluate(() => document.getElementById('panelWrap').hidden),
    '다시 누르면 닫힌다');

  // 한 번에 한 장만 보여야 한다 — 두 장이 함께 뜨면 날개가 유령처럼 겹친다
  const frames = await p.evaluate(() => {
    const read = (t) => {
      document.getAnimations()
        .filter((a) => a.animationName && a.animationName.startsWith('crow'))
        .forEach((a) => { a.pause(); a.currentTime = 2400 * t; });
      return ['.crow-rest', '.crow-flap', '.crow-tilt']
        .map((s) => +getComputedStyle(document.querySelector(s)).opacity);
    };
    return { rest: read(0.1), flap: read(0.46), tilt: read(0.83) };
  });
  ok(String(frames.rest) === '1,0,0' && String(frames.flap) === '0,1,0'
     && String(frames.tilt) === '0,0,1',
    '세 장이 한 번에 한 장씩만 보인다 (가만히 · 퍼덕 · 갸웃)', JSON.stringify(frames));

  // 세 장이 같은 캔버스여야 갈아 끼울 때 새가 튀지 않는다
  const sizes = await p.evaluate(() => ['.crow-rest', '.crow-flap', '.crow-tilt']
    .map((s) => { const i = document.querySelector(s);
      return i.naturalWidth + 'x' + i.naturalHeight; }));
  ok(new Set(sizes).size === 1, '세 장이 같은 크기 캔버스다', sizes.join(' / '));

  // 눌렀던 자리에 커서가 남아 있으면 다시 불러온 뒤에도 그 밑에 새 까마귀가 놓여
  // :hover가 그대로 맞는다 — 퍼덕임(crow-hop)이 걸려 아래 박자 검사가 헛돈다
  await p.mouse.move(0, 0);
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(900);

  // 마을이 타고 있는 박자에 함께 물려 있는가 (건물·사람들·우편함과 같은 startTime)
  const beat = await p.evaluate(() => {
    const g = (n) => document.getAnimations().filter((a) => a.animationName === n);
    const t = (n) => g(n).map((a) => (a.startTime == null ? null : Math.round(+a.startTime)));
    return { crow: t('crow-idle'), frame: t('crow-frame-flap'), folk: t('folk-idle')[0],
             dur: g('crow-idle').map((a) => a.effect.getTiming().duration) };
  });
  ok(beat.crow[0] === beat.folk && beat.frame[0] === beat.folk,
    '까마귀가 마을과 같은 박자에 물려 있다', JSON.stringify(beat));
  ok(beat.dur[0] === 2400, '2.4초 한 박자다', String(beat.dur[0]));
  await p.close();
}

/* ── 12. 세모집 마당의 확성기 ────────────────────────────
   집 테마송이 나오는 자리다. `speaker.song`이 있으면 진짜 버튼이라 눌리고,
   세모집 옆에 서 있으면서도 세모집 클릭을 가로채면 안 된다. */
if (head('마당의 확성기')) {
  const p = await desktop();
  await town(p);
  await p.waitForTimeout(700);

  ok(await p.locator('.horn-spot').count() === 1, '세모집 마당에 확성기가 하나 있다');

  const how = await p.evaluate(() => {
    const n = document.querySelector('.horn-spot');
    const a = document.getAnimations().find((x) => x.animationName === 'horn-idle');
    const folk = document.getAnimations().find((x) => x.animationName === 'folk-idle');
    return {
      live: n.classList.contains('horn-live'),
      pe: getComputedStyle(n).pointerEvents,
      dur: a && a.effect.getTiming().duration,
      beat: a && folk && Math.round(+a.startTime) === Math.round(+folk.startTime),
    };
  });
  ok(how.live && how.pe === 'auto', '노래가 있으니 진짜 문이다', JSON.stringify(how));
  ok(how.dur === 2400 && how.beat, '재생 전에는 마을과 같은 2.4초 한 박자에 물려 있다');

  // 한 박자에 **두 번** 내지른다 — 우편함(좌우 인사)·캐릭터(폴짝)와 겹치지 않는 걸음
  const shove = await p.evaluate(() => {
    const el = document.querySelector('.horn-fig');
    const a = document.getAnimations().find((x) => x.animationName === 'horn-idle');
    const at = (t) => { a.pause(); a.currentTime = t;
      return new DOMMatrix(getComputedStyle(el).transform).e; };
    return [0, 0.17, 0.28, 0.37, 0.6].map((f) => Math.round(at(2400 * f)));
  });
  ok(shove[0] === 0 && shove[1] > 1 && shove[2] === 0 && shove[3] > 1 && shove[4] === 0,
    `한 박자에 두 번 앞으로 내지른다 (${shove.join(' ')})`);

  // 확성기가 옆에 있어도 세모집은 눌려야 한다
  await p.click('.spot[data-district="house"]');
  await p.waitForSelector('#bookOverlay:not([hidden])', { timeout: 4000 });
  ok(true, '확성기가 세모집 클릭을 가로채지 않는다');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(500);

  // 누르면 재생되고 가사 팝업이 뜬다
  await p.click('.horn-spot');
  await p.waitForTimeout(700);
  const panel = await p.evaluate(() => ({
    title: document.querySelector('.panel-title')?.textContent || '',
    audioSrc: document.querySelector('.song-audio')?.getAttribute('src') || '',
    paused: document.querySelector('.song-audio')?.paused,
    sections: document.querySelectorAll('.song-section').length,
    lines: document.querySelectorAll('.song-line').length,
    playingClass: document.querySelector('.horn-spot').classList.contains('horn-playing'),
    expanded: document.querySelector('.horn-spot').getAttribute('aria-expanded'),
  }));
  ok(panel.title.includes('집이 어떻게 세모') && panel.audioSrc.includes('house-theme.mp3'),
    '누르면 노래 패널이 열린다', JSON.stringify(panel));
  ok(panel.paused === false, '누른 손 안에서 바로 재생된다');
  ok(panel.sections === 7 && panel.lines === 24, '가사가 절 단위로 전부 실렸다', JSON.stringify(panel));
  ok(panel.playingClass && panel.expanded === 'true', '재생 중에는 확성기가 더 크게 운다');

  // 재생 중에는 idle이 아니라 별도의 격한 걸음(horn-shout)으로 갈아탄다
  const shoutName = await p.evaluate(() => {
    const fig = document.querySelector('.horn-fig');
    return document.getAnimations().find((a) => a.effect && a.effect.target === fig)?.animationName;
  });
  ok(shoutName === 'horn-shout', `재생 중 걸음이 갈린다 (${shoutName})`);

  /* 깨진 적 있음: 확성기를 마당(지도 오른쪽 끝)으로 옮기자 패널이 오른쪽에 **17px**
     모자란다는 이유로 376px을 건너뛰어 왼쪽에 떨어졌고, 카페를 통째로 덮었다.
     모자란 양과 건너뛰는 거리가 비례하지 않는 게 문제였다 — 오른쪽 절반에 있는 것은
     오른쪽에 붙인다. 가운데 구역(회사·카페)이 가려지면 안 된다. */
  const hides = await p.evaluate(() => {
    const pr = document.getElementById('panel').getBoundingClientRect();
    const out = {};
    document.querySelectorAll('.spot').forEach((s) => {
      const r = s.getBoundingClientRect();
      const ox = Math.max(0, Math.min(r.right, pr.right) - Math.max(r.left, pr.left));
      const oy = Math.max(0, Math.min(r.bottom, pr.bottom) - Math.max(r.top, pr.top));
      out[s.dataset.district] = Math.round(ox * oy / (r.width * r.height) * 100);
    });
    return out;
  });
  ok(hides.cafe === 0 && hides.company === 0 && hides.school === 0,
    '노래 패널이 지도를 건너뛰어 가운데 구역을 덮지 않는다', JSON.stringify(hides));

  /* **패널이 확성기 자신을 덮으면 안 된다.** 소리를 내고 있는 물건이 반쯤 잘려
     보이고, 방금 누른 자리가 손 밑에서 사라져 다시 눌러 닫을 수도 없다.
     확성기를 마당 오른쪽으로 옮기면서 실제로 그렇게 됐다 (그전에도 3px 차이로
     겨우 비껴 있었을 뿐이다) — placePanel이 창 끝까지 밀고 그래도 모자라면
     패널을 조금 좁혀서 비켜 준다. */
  const onDoor = await p.evaluate(() => {
    const pr = document.getElementById('panel').getBoundingClientRect();
    const h = document.querySelector('.horn-spot').getBoundingClientRect();
    return { 겹침: Math.round(Math.max(0, h.right - pr.left)), 패널폭: Math.round(pr.width) };
  });
  ok(onDoor.겹침 === 0, '패널이 확성기 자신을 덮지 않는다', JSON.stringify(onDoor));
  ok(onDoor.패널폭 >= 280, '비켜 주느라 패널이 못 읽을 만큼 좁아지지 않는다',
    String(onDoor.패널폭));

  // 다시 누르면(토글) 닫히고 멈춘다
  await p.click('.horn-spot');
  await p.waitForTimeout(300);
  const closed = await p.evaluate(() => ({
    hidden: document.getElementById('panelWrap').hidden,
    paused: document.querySelector('.song-audio')?.paused,
    playingClass: document.querySelector('.horn-spot').classList.contains('horn-playing'),
  }));
  ok(closed.hidden && closed.paused && !closed.playingClass,
    '다시 누르면 닫히고 노래도 멈춘다', JSON.stringify(closed));

  // 노래를 들으며 다른 구역을 열어도 조용히 멈춘다
  await p.click('.horn-spot');
  await p.waitForTimeout(600);
  await p.click('.spot[data-district="bank"]');
  await p.waitForTimeout(400);
  // 다른 패널을 열면 panel.textContent가 통째로 갈리므로 <audio>가 아예 없어진다 —
  // 없어졌다는 것 자체가 「멈췄다」는 가장 강한 증거다. stopSong()이 먼저 안 불렀다면
  // 이 요소가 사라지는 순간에도 어딘가에서 계속 소리가 났을 것이다.
  const switched = await p.evaluate(() => ({
    audioGone: !document.querySelector('.song-audio'),
    title: document.querySelector('.panel-title')?.textContent,
  }));
  ok(switched.audioGone && switched.title === '🏦 은행',
    '노래를 듣다 다른 구역을 눌러도 조용히 멈추고 그 구역이 열린다', JSON.stringify(switched));
  await p.close();
}

/* ── 13. 날아다니는 쪽지 ──────────────────────────────────
   마을 위를 도는 유일한 것이다 — 구름·새·자동차를 걷어낸 뒤로 「지나가는 것」은
   이것뿐이라, 움직이면 곧 눌러볼 것이라는 뜻이 된다.
   깨진 적 있음: 지도 위 가장 높이 뜬 채로 늘 잡히게 뒀더니 **건물 위를 지날 때
   그 건물의 클릭을 가로챘다** — 미술관을 누르려는데 쪽지가 먹었다.
   지금은 멈춰 선 동안만 잡히고, 머무는 자리는 전부 건물이 없는 빈 땅이다. */
if (head('날아다니는 쪽지')) {
  const p = await desktop();
  await town(p);
  await p.waitForTimeout(900);

  ok(await p.locator('.note-spot').count() === 1, '마을 위에 쪽지가 한 장 떠 있다');

  const how = await p.evaluate(() => {
    const n = document.querySelector('.note-spot');
    const g = (name) => document.getAnimations().find((a) => a.animationName === name);
    // 지도 위 다른 문들(우편함 4 · "나" 5 · 확성기 3)보다 위여야 한다
    const others = ['.mbox-spot', '.me-spot', '.horn-spot']
      .map((s) => document.querySelector(s))
      .filter(Boolean)
      .map((e) => +getComputedStyle(e).zIndex || 0);
    return {
      z: +getComputedStyle(n).zIndex,
      under: Math.max(...others),
      flapDur: g('note-f-up') && g('note-f-up').effect.getTiming().duration,
      hit: parseFloat(getComputedStyle(n, '::after').width),
    };
  });
  ok(how.z > how.under, `마을의 다른 문들보다 위에 뜬다 (쪽지 ${how.z} > ${how.under})`);
  ok(how.hit >= 44, `판정이 터치 기준을 넘는다 (${Math.round(how.hit)}px)`);
  // 마을은 2.4초 한 박자다. 쪽지는 그 박자를 타지 않는다 — 마을 위에 온 것이라서
  ok(how.flapDur > 0 && how.flapDur !== 2400,
    `펄럭임이 마을 박자가 아니다 (${how.flapDur}ms)`);

  // 파장처럼 커졌다 작아진다. 새와 구름은 크기가 변하지 않는다 — 갈리는 신호다
  const pulse = await p.evaluate(() => {
    const el = document.querySelector('.note-fig');
    const a = document.getAnimations().find((x) => x.animationName === 'note-bob');
    if (!a) return null;
    const read = (t) => { a.pause(); a.currentTime = t;
      return new DOMMatrix(getComputedStyle(el).transform).a; };
    const d = a.effect.getTiming().duration;
    return { big: read(d * 0.25), small: read(d * 0.75), dur: d };
  });
  ok(pulse && pulse.big > 1.1 && pulse.small < 0.9,
    `파장처럼 커졌다 작아진다 (${pulse && pulse.big.toFixed(2)} ↔ ${pulse && pulse.small.toFixed(2)})`);
  ok(pulse && pulse.dur !== 2400, `뽀잉 박자가 마을과 다르다 (${pulse && pulse.dur}ms)`);

  // 길목마다 멈춘다 — 같은 좌표가 두 번 연속 찍혀 있으면 그 구간이 「머무름」이다
  const rules = await p.evaluate(() => {
    const out = {};
    for (const s of document.styleSheets) {
      for (const r of s.cssRules) {
        if (r.name === 'note-fly') {
          out[r.name] = [...r.cssRules].map((k) => ({
            at: k.keyText, pos: k.style.left + ',' + k.style.top,
            pe: k.style.pointerEvents,
          }));
        }
      }
    }
    return out;
  });
  const same = rules['note-fly'].filter((k, i, a) => i && k.pos === a[i - 1].pos).length;
  ok(same >= 3, `길목마다 멈춰 선다 (멈춤 ${same}곳)`);

  // 멈춰 서는 자리는 전부 빈 땅이어야 한다 — 건물 위에서 멈추면 그 건물 클릭을 먹는다
  const clash = await p.evaluate(async () => {
    const data = await fetch('services.json').then((r) => r.json());
    const rects = data.districts.filter((d) => d.rect).map((d) => d.rect);
    // 폭은 지도 폭의 %, 높이는 지도 높이의 %다 — 그림 비율(174x120)에 지도 비율을 곱한다
    const w = data.floater.w, h = w * (120 / 174) * (1792 / 1434);
    return data.floater.path.filter((s) => s.stop).filter((s) => {
      const a = { x: s.at[0] - w * 0.6, X: s.at[0] + w * 0.6,      // 판정 상자 120% x 150%
                  y: s.at[1] - h * 0.75, Y: s.at[1] + h * 0.75 };
      return rects.some(([rx, ry, rw, rh]) =>
        a.x < rx + rw && rx < a.X && a.y < ry + rh && ry < a.Y);
    }).map((s) => s.at.join(','));
  });
  ok(clash.length === 0, '멈춰 서는 자리가 구역 위에 없다', clash.join(' / '));

  // **언제든 잡혀야 한다.** 한때 멈춰 있는 동안만 잡히게 해 뒀더니 한 바퀴의 5분의 1만
  // 눌리는 물건이 됐다 — 누르려다 안 눌리는 문은 문이 아니다. 날고 있는 중에도 눌러 본다.
  await p.evaluate(() => document.getAnimations()
    .filter((a) => a.animationName === 'note-fly')
    .forEach((a) => { a.pause(); a.currentTime = 52000 * 0.62; }));   // 두 길목 사이
  await p.waitForTimeout(150);
  ok(await p.evaluate(() =>
    getComputedStyle(document.querySelector('.note-spot')).pointerEvents) === 'auto',
    '날고 있는 중에도 잡힌다');

  await p.locator('.note-spot').click();
  await p.waitForTimeout(500);
  const panel = await p.evaluate(() => ({
    cards: document.querySelectorAll('#panel .card').length,
    links: document.querySelectorAll('#panel a.card').length,
    names: [...document.querySelectorAll('#panel .card-name')].map((n) => n.firstChild.textContent),
    held: getComputedStyle(document.querySelector('.note-spot')).animationPlayState,
  }));
  ok(panel.cards === 3 && panel.names.join(',') === '캘린더,클리어 위크,트래커',
    '세 자리가 한 묶음으로 열린다', JSON.stringify(panel.names));
  ok(/paused/.test(panel.held), '열려 있는 동안 쪽지는 날아가지 않는다', panel.held);
  // 주소가 있는 것만 링크가 된다. 없는 것은 누를 수 없어야 한다 — 죽은 링크를 만들지 않는다
  const withUrl = await p.evaluate(async () => {
    const d = await fetch('services.json').then((r) => r.json());
    return d.floater.bundle.items.filter((e) =>
      e.url || (d.items.find((i) => i.id === e.id) || {}).url).length;
  });
  ok(panel.links === withUrl,
    `주소가 있는 것만 링크가 된다 (${panel.links} / ${withUrl})`);
  await p.close();
}

/* ── 14. 캐시가 어긋나도 지도가 깨지지 않는다 ─────────────
   깨진 적 있음: services.json만 예전 것이 캐시에 남은 채 새 app.js를 만났다.
   프레임 역할 이름이 CSS와 어긋나 세 장이 한꺼번에 뜨고, 그중 사라진 파일 하나가
   404가 나면서 **카페 앞에 브라우저의 물음표 상자가 그대로 섰다.** */
if (head('캐시 어긋남')) {
  const p = await desktop();

  // 데이터는 캐시를 반드시 다시 확인해야 한다 — 코드와 짝이 맞아야 하는 파일이다
  // 브라우저가 실제로 보내는 값은 `max-age=0`이다 (fetch의 cache: 'no-cache'가 그렇게 나간다).
  // 어느 쪽이든 「쓰기 전에 물어본다」는 뜻이고, 그게 없으면 예전 데이터가 조용히 쓰인다.
  const asked = [];
  p.on('request', async (r) => {
    if (/services\.json/.test(r.url())) asked.push((await r.allHeaders())['cache-control'] || '');
  });
  await town(p);
  await p.waitForTimeout(900);
  ok(asked.length === 1 && /no-cache|max-age=0/.test(asked[0]),
    'services.json은 캐시를 다시 확인하고 쓴다', JSON.stringify(asked));

  // 애니메이션이 안 붙어도 겹쳐 보이지 않는다 (기본값이 「첫 장만」이어야 한다)
  const stacked = await p.evaluate(() => {
    document.querySelectorAll('.crow-figure img')
      .forEach((i) => { i.style.animation = 'none'; });
    return [...document.querySelectorAll('.crow-figure img')]
      .map((i) => +getComputedStyle(i).opacity);
  });
  ok(stacked[0] === 1 && stacked.slice(1).every((o) => o === 0),
    '애니메이션이 없어도 프레임은 한 장만 보인다', JSON.stringify(stacked));
  await p.close();
}
if (want('캐시 어긋남')) {
  // 그림 하나가 사라져도 지도에 물음표를 그리지 않는다.
  // 일부러 끊는 것이라 이 페이지는 콘솔 오류 수집에서 뺀다 (watch를 안 건다)
  const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await p.route('**/assets/sprites/cut/crow-side.png', (r) => r.abort());
  await town(p);
  await p.waitForTimeout(900);
  const left = await p.evaluate(() =>
    [...document.querySelectorAll('.crow-figure img')].map((i) => i.className));
  ok(!left.includes('crow-rest') && left.length === 2,
    '못 불러온 스프라이트는 스스로 사라진다', JSON.stringify(left));
  await p.close();
}

/* ── 15. 제작자에게 한마디 ────────────────────────────────
   서버(worker.js) 쪽은 tests/worker.mjs가 따로 본다. 여기서는 **화면이 서버의
   대답을 정직하게 옮기는지**만 본다 — 특히 실패했을 때 성공한 척하지 않는지.
   조용히 고맙다고 하면 방문자는 남겼다고 믿고 나는 못 받는다.

   배치도 함께 지킨다. 푸터에 남는 것은 이름 옆의 👋 하나뿐이고, 적는 칸은 창
   안에 있다 — 나가는 길에 자리를 먹지 않는 것이 요점이라, 푸터에 폼이 다시
   펼쳐지면 여기서 잡힌다. */
if (head('제작자에게 한마디')) {
  const p = await desktop();
  await town(p);
  await p.waitForTimeout(500);

  const foot = await p.evaluate(() => ({
    hi: !!document.getElementById('sayHi'),
    // 푸터에 남는 것은 손짓 하나뿐 — 적는 칸은 창 안에 있어야 한다
    fieldsInFooter: document.querySelectorAll('.site-footer textarea, .site-footer input').length,
    winHidden: document.getElementById('sayModal').hidden,
  }));
  ok(foot.hi && foot.fieldsInFooter === 0, '푸터에는 👋 하나만 있다', JSON.stringify(foot));
  ok(foot.winHidden, '창은 처음부터 열려 있지 않다');

  await p.click('#sayHi');
  await p.waitForTimeout(300);
  const opened = await p.evaluate(() => ({
    shown: !document.getElementById('sayModal').hidden,
    // 창을 열면 곧장 적는 칸이다 — 거쳐야 할 버튼을 앞에 두지 않는다
    text: !!document.getElementById('sayText'),
    fields: [...document.querySelectorAll('#sayForm textarea, #sayForm input[type="text"]')]
      .filter((n) => n.id !== 'sayHp').map((n) => n.id).join(','),
    locked: getComputedStyle(document.body).overflow,
  }));
  ok(opened.shown && opened.text, '👋를 누르면 창이 열리고 곧장 적는 칸이다',
    JSON.stringify(opened));
  ok(opened.fields === 'sayText,sayName,sayReply', '한마디·이름·답장받을곳 세 칸이다',
    opened.fields);
  ok(opened.locked === 'hidden', '창이 열린 동안 뒤가 스크롤되지 않는다', opened.locked);

  /* **글자가 16px보다 작은 칸은 두지 않는다.** iOS 사파리는 그런 칸에 커서가
     들어가면 읽히도록 화면을 통째로 확대한다. 목록의 검색칸까지 함께 지킨다. */
  const small = await p.evaluate(() => [...document.querySelectorAll('input[type="text"], input[type="search"], textarea')]
    .filter((n) => parseFloat(getComputedStyle(n).fontSize) < 16)
    .map((n) => n.id + ':' + getComputedStyle(n).fontSize));
  ok(small.length === 0, '적는 칸의 글자가 16px 아래로 내려가지 않는다 (iOS 확대 방지)',
    small.join(', '));

  // 봇 칸은 사람 눈에 보이면 안 된다 (보이면 사람이 채우고 그 글은 버려진다)
  const hp = await p.evaluate(() => {
    const r = document.getElementById('sayHp').getBoundingClientRect();
    return r.right > 0 && r.left < innerWidth;
  });
  ok(!hp, '봇만 보는 칸은 화면 밖에 있다');

  // Esc로 닫히고, 닫으면 눌렀던 👋로 포커스가 돌아온다
  await p.keyboard.press('Escape');
  await p.waitForTimeout(250);
  const closed = await p.evaluate(() => ({
    hidden: document.getElementById('sayModal').hidden,
    focus: document.activeElement.id,
    unlocked: getComputedStyle(document.body).overflow,
  }));
  ok(closed.hidden && closed.focus === 'sayHi', 'Esc로 닫히고 👋로 돌아온다',
    JSON.stringify(closed));
  ok(closed.unlocked !== 'hidden', '닫으면 스크롤이 풀린다', closed.unlocked);

  await p.click('#sayHi');
  await p.waitForTimeout(250);

  // 빈 채로 누르면 서버까지 가지 않는다
  let calls = 0;
  await p.route('**/api/word', async (route) => { calls++; await route.abort(); });
  await p.click('#sayBtn');
  await p.waitForTimeout(250);
  ok(calls === 0 && /적어/.test(await p.textContent('#sayNote')),
    '빈 채로 누르면 보내지 않고 적어 달라고 한다', await p.textContent('#sayNote'));

  /* **실패를 성공처럼 보이게 하지 않는다.** KV가 아직 안 붙었을 때 서버가 내주는
     503을 그대로 흉내 내고, 화면이 그 말을 옮기는지 본다. */
  await p.unroute('**/api/word');
  await p.route('**/api/word', (route) => route.fulfill({
    status: 503, contentType: 'application/json',
    body: JSON.stringify({ ok: false, error: 'not_configured', message: '아직 받을 준비가 안 됐어요.' }),
  }));
  await p.fill('#sayText', '마을 잘 봤어요');
  await p.click('#sayBtn');
  await p.waitForTimeout(400);
  const failed = await p.evaluate(() => ({
    note: document.getElementById('sayNote').textContent,
    bad: document.getElementById('sayNote').classList.contains('say-bad'),
    kept: !!document.getElementById('sayForm'),
    typed: document.getElementById('sayText').value,
    btnBack: !document.getElementById('sayBtn').disabled,
  }));
  ok(/준비가 안 됐/.test(failed.note) && failed.bad,
    '못 받았으면 서버가 준 말을 그대로 띄운다', JSON.stringify(failed));
  ok(failed.kept && failed.typed === '마을 잘 봤어요' && failed.btnBack,
    '실패하면 적은 것과 버튼이 그대로 남는다', JSON.stringify(failed));

  // 다시 눌러 성공하면 폼을 치우고 고맙다고만 한다
  await p.unroute('**/api/word');
  let sent = null;
  await p.route('**/api/word', async (route) => {
    sent = JSON.parse(route.request().postData() || '{}');
    await route.fulfill({ status: 200, contentType: 'application/json',
                          body: JSON.stringify({ ok: true }) });
  });
  await p.fill('#sayName', '다원');
  await p.fill('#sayReply', 'a@b.c');
  await p.click('#sayBtn');
  await p.waitForTimeout(400);
  const done = await p.evaluate(() => ({
    good: document.getElementById('sayNote').classList.contains('say-good'),
    gone: !document.getElementById('sayForm'),
    stillOpen: !document.getElementById('sayModal').hidden,
  }));
  ok(sent && sent.text === '마을 잘 봤어요' && sent.name === '다원' && sent.reply === 'a@b.c',
    '적은 것이 그대로 서버로 간다', JSON.stringify(sent));
  ok(done.good && done.gone && done.stillOpen,
    '남기면 폼이 사라지고 고맙다는 말만 남는다', JSON.stringify(done));

  // 바깥을 눌러도 닫힌다 (목록 모달과 같은 규칙)
  await p.mouse.click(5, 5);
  await p.waitForTimeout(250);
  ok(await p.evaluate(() => document.getElementById('sayModal').hidden),
    '바깥을 누르면 닫힌다');

  /* 위에서 **일부러** 503을 흉내 냈으므로 브라우저가 "Failed to load resource"를
     콘솔에 한 줄 남긴다. 마지막의 「콘솔 오류 없음」은 그대로 엄격하게 두고,
     내가 만든 이 한 줄만 걷어낸다 — 여기서 안 걷으면 검사를 통째로 느슨하게
     만들어야 하고, 그러면 진짜 404가 섞여 들어와도 모른다. */
  for (let i = errors.length - 1; i >= 0; i--) {
    if (/api\/word/.test(errors[i]) || /status of 503/.test(errors[i])) errors.splice(i, 1);
  }
  await p.close();
}

/* ── 16. 방문 통계 ────────────────────────────────────────
   ga.js는 HOSTS에 적은 도메인에서만 켜진다. 이 가드가 풀리면 여기 검사들이
   매번 바깥 스크립트를 받으러 나가느라 `networkidle`에 기대는 다른 검사들이
   남의 서버 사정에 흔들리고, 내가 고치면서 여닫은 것이 통계에 섞인다.
   마을은 URL이 바뀌지 않으므로 무엇을 봤는지는 커스텀 이벤트로만 남는다 —
   그래서 세 페이지 전부에 붙어 있는지, 부르는 자리가 실제로 부르는지 본다. */
if (head('방문 통계')) {
  const p = await desktop();
  const sent = [];
  await town(p);
  await p.waitForTimeout(600);

  ok(await p.locator('script[src="/ga.js"]').count() === 1, '마을에 ga.js가 붙어 있다');
  ok(await p.evaluate(() => typeof window.dadaTrack) === 'function',
    'localhost에서도 자리는 있다 (부르는 쪽에 조건문을 두지 않는다)');
  ok(await p.evaluate(() => [...document.scripts]
       .some((s) => s.src.includes('googletagmanager'))) === false,
    'localhost에서는 GA를 부르지 않는다');
  ok(await p.evaluate(() => [...document.scripts]
       .some((s) => s.src.includes('cloudflareinsights'))) === false,
    'localhost에서는 Cloudflare 비콘도 부르지 않는다');
  // 측정 ID가 비면 통계가 통째로 멎는데 화면에는 아무 표시도 안 난다
  const gaSrc = await p.evaluate(() => fetch('/ga.js').then((r) => r.text()));
  ok(/var ID = 'G-[A-Z0-9]+'/.test(gaSrc), 'ga.js가 측정 ID를 들고 있다');

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
if (want('방문 통계')) {
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

/* ── PlayGrown 케이스 스터디 ──────────────────────────────
   절마다 형식이 다른 문서라 깨지는 방식도 절마다 다르다. 여기 있는 것은
   전부 짓는 동안 실제로 한 번씩 겪은 것들이다.

   **이 페이지에서는 locator로 누르거나 굴리지 않는다.** 절이 스크롤로 굴러가는
   애니메이션을 달고 있어서, playwright가 「요소가 멈출 때까지」 기다리면 영영
   안 멈춘다 — 굴릴 때마다 조금씩 움직이기 때문이다. 실제로 프로세스가 안 끝났다.
   그래서 누르는 것은 evaluate 안에서 element.click()으로 한다. */
const CASE = '/case/playgrown.html';
if (head('케이스 스터디 — 뼈대')) {
  const p = await desktop();
  await p.goto(BASE + CASE, { waitUntil: 'networkidle' });
  ok(await p.locator('main.case section.room').count() === 4,
    '절이 넷 있다 (재료가 오면 여덟이 되고, 그때 이 숫자를 고친다)');
  ok(await p.locator('.room .room-title').count() === 4,
    '절마다 표제가 같은 자리에 있다');

  /* **그림이 실제로 뜨는지는 눈으로 못 본다.** 경로 하나만 틀려도 자리는 그대로
     남고 그림만 안 오는데, 스크린샷에서는 그것이 「원래 흰 칸」과 구별되지 않는다 */
  await p.evaluate(() => {
    document.querySelectorAll('img[loading="lazy"]').forEach((i) => { i.loading = 'eager'; });
  });
  await p.waitForTimeout(900);
  const dead = await p.evaluate(() => [...document.images]
    .filter((i) => i.getAttribute('src') && !i.naturalWidth)
    .map((i) => i.getAttribute('src')));
  ok(dead.length === 0, '그림이 전부 실제로 뜬다', dead.join(', '));

  /* 라이트박스는 <dialog>다. `display: grid`를 조건 없이 주면 **안 연 상자가
     화면 왼쪽 위에 얹혀 있는다** — 처음 찍었을 때 ✕ 단추가 그렇게 떠 있었다 */
  ok(await p.evaluate(() => {
    const d = document.querySelector('dialog.lightbox');
    return !!d && getComputedStyle(d).display === 'none';
  }), '안 연 라이트박스는 안 보인다');

  ok(await p.evaluate(() => {
    const a = document.querySelector('.tile-zoom');
    a.click();                       // locator로 누르면 안 된다 (위 설명)
    const d = document.querySelector('dialog.lightbox');
    return d.open && !!d.querySelector('img').getAttribute('src');
  }), '타일을 누르면 크게 열린다');
  await p.close();
}

if (head('케이스 스터디 — 조감도')) {
  const p = await desktop();
  await p.goto(BASE + CASE, { waitUntil: 'networkidle' });
  const pins = await p.$$eval('.map-pin', (els) => els.map((e) => ({
    x: parseFloat(e.style.getPropertyValue('--x')),
    y: parseFloat(e.style.getPropertyValue('--y')),
  })));
  ok(pins.length === 5 && pins.length === await p.locator('.zones li').count(),
    '핀과 존 목록의 개수가 같다', `핀 ${pins.length}`);
  /* 좌표는 눈대중이 아니라 원본에서 잰다. 한 번은 눈금을 그림이 아니라 창에
     맞춰 얹는 바람에 세로가 1.27배 어긋나 조감도 아래쪽이 잘려 나갔다 */
  const out = pins.filter((q) => !(q.x > 2 && q.x < 98 && q.y > 2 && q.y < 98));
  ok(out.length === 0, '핀이 조감도 밖으로 안 나간다', JSON.stringify(out));

  /* 지도 위 핀은 눈으로 보여주는 것뿐이라 스크린리더에서 감춰야 한다.
     진짜 내용은 <ol>에 있다 — 크롤러도 스크린리더도 SVG나 핀은 못 읽는다 */
  ok(await p.locator('.map-pin[aria-hidden="true"]').count() === 5,
    '핀은 스크린리더에서 감춰져 있다');
  await p.close();
}

if (head('케이스 스터디 — 폰')) {
  const p = await phone();
  await p.goto(BASE + CASE, { waitUntil: 'networkidle' });
  /* 390px에서는 조감도 이름표가 안 읽힌다. 이름은 바로 아래 목록에 그대로 있으므로
     지도 위에는 번호만 남긴다 (§6이 겪은 문제를 여기서도 겪는다) */
  ok(await p.evaluate(() => getComputedStyle(document.querySelector('.map-pin span')).display === 'none'),
    '폰에서는 지도 위 이름표를 떼고 번호만 남긴다');
  /* 포지셔닝 보드는 좁아지면 자리로 그리던 것을 목록으로 되돌린다.
     안 그러면 원 여덟 개가 서로 겹쳐 글자가 안 읽힌다 */
  ok(await p.evaluate(() => getComputedStyle(document.querySelector('.pos-ring li')).position === 'static'),
    '폰에서는 포지셔닝 원이 목록으로 펴진다');
  await p.close();
}

if (head('케이스 스터디 — JS 없이')) {
  /* 이 문서를 뷰어가 아니라 스크롤 페이지로 정한 이유가 「검색엔진과 스크린리더가
     읽는다」였다. JS를 끈 채로도 본문이 다 있어야 그 이유가 지켜진다 */
  const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(BASE + CASE, { waitUntil: 'domcontentloaded' });
  const text = await p.locator('main.case').innerText();
  ok(text.includes('제3의 공간') && text.includes('어른들의') && text.includes('아트존'),
    'JS 없이도 세 절의 본문이 읽힌다');
  ok(await p.locator('.tile-zoom[href$=".jpg"]').count() >= 6,
    'JS 없으면 확대는 그냥 그림 파일이 열린다 (링크로 두었다)');
  await ctx.close();
}

if (head('케이스 스터디 — 아직 안 걸었다')) {
  /* **절이 다 차기 전에는 아무 데서도 이 문서로 못 들어가야 한다.** 반쪽짜리
     문서가 검색에 남거나 마을에서 열리면 안 된다. noindex를 떼는 날 sitemap과
     services.json에 같이 올리라고, 둘을 여기서 묶어 둔다 */
  const p = await desktop();
  await p.goto(BASE + CASE, { waitUntil: 'domcontentloaded' });
  const hidden = await p.locator('meta[name="robots"][content~="noindex"]').count() === 1;
  const map = await p.evaluate((u) => fetch(u).then((r) => r.text()), BASE + '/sitemap.xml');
  const listed = map.includes('/case/playgrown.html');
  ok(hidden !== listed, 'noindex와 sitemap 등록이 서로 어긋나지 않는다',
    `noindex=${hidden} sitemap=${listed}`);
  const svc = await p.evaluate((u) => fetch(u).then((r) => r.json()), BASE + '/services.json');
  const door = JSON.stringify(svc).includes('/case/playgrown.html');
  ok(hidden !== door, 'noindex인 동안에는 마을에서 문이 안 열린다',
    `noindex=${hidden} services=${door}`);
  await p.close();
}

/* ── 마무리 ─────────────────────────────────────────────── */
if (head('JS 오류')) {
  ok(errors.length === 0, '콘솔 오류 없음', errors.slice(0, 3).join(' / '));
}

await browser.close();
if (server) server.kill();
// 부분만 돌았으면 그렇다고 말한다 — 「통과」라는 말이 전부를 뜻하지 않게
console.log(`\n${fail ? '❌' : '✅'}  통과 ${pass} · 실패 ${fail}`
  + (skipped ? `  (${skipped}개 절 건너뜀 — 푸시 전에는 인자 없이 한 번 돌릴 것)` : '') + '\n');
process.exit(fail ? 1 : 0);
