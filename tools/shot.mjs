/* 마을을 찍어 보는 도구.
 *
 * **매번 새로 쓰지 않기 위해 있는 파일이다.** 고친 것이 눈에 어떻게 보이는지
 * 확인하려면 브라우저를 띄워 찍어야 하는데, 그때마다 같은 스크립트를 다시
 * 쓰다 보면 매번 같은 데서 걸린다 — 크롬 경로, 서버가 떠 있는지, 애니메이션이
 * 매번 다른 자리에서 잡히는지. 그 셋을 여기서 한 번만 처리한다.
 *
 *   node tools/shot.mjs                          폰·데스크톱 두 장
 *   node tools/shot.mjs --phone                  폰만
 *   node tools/shot.mjs --map                    지도만 (페이지 말고)
 *   node tools/shot.mjs --crop 72,68,100,100     지도의 그 %구역만 (세모집 마당)
 *   node tools/shot.mjs --click '#sayHi'         누른 뒤에 찍는다
 *   node tools/shot.mjs --grid --crop 33,0,69,40 %눈금을 얹어 찍는다 (좌표 잴 때)
 *   node tools/shot.mjs --out /tmp/x             파일 이름 앞머리
 *
 * **긴 문서는 한 장에 다 담으려 하지 말고 `--el`로 절씩 찍는다.** 페이지가 수천 px가
 * 되면 크롬이 한 장으로 떠낼 때 **`<img>`만 백지로 나온다** — 글자도 배경도 그림자도
 * 멀쩡하고 그림 자리만 빈칸이라 「경로가 틀렸나」로 한참 헤맸다. 창을 페이지 높이만큼
 * 키워 봐도 같다. 같은 화면에서 그 절만 잘라 찍으면 멀쩡히 나온다.
 * 케이스 스터디(5700px)에서 겪었고, 확인은 `--el '.tiles'` 식으로 한다.
 *
 * `--grid`는 **재는 도구라 늘 큰 화면으로 찍는다.** 폰 해상도에서는 1%가 3px밖에
 * 안 돼 눈금이 뭉개져서, 재려고 얹은 것이 못 읽히면 얹은 뜻이 없다.
 *
 * **서버는 알아서 띄운다.** 8000번이 안 열려 있으면 여기서 띄웠다가 끝날 때
 * 내린다 — 이 저장소에서 검사가 실패한 이유 중 제일 잦은 것이 「서버가 죽어
 * 있었다」였다.
 */
import { chromium, devices } from 'playwright';
import { serve } from './serve.mjs';

const BASE = process.env.BASE || 'http://localhost:8000';
/* 이 컨테이너의 크롬. 그냥 chromium.launch()를 부르면 playwright가 제 폴더에서
   찾다가 「Executable doesn't exist」로 죽는다 — 브라우저는 /opt에 따로 깔려 있다. */
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium';

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const val = (name, d = null) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};

const out = val('--out', '/tmp/shot');
/* 찍을 쪽. 마을 말고 다른 문서가 생기면서 필요해졌다 — 서버는 그대로 띄우고
   열어 볼 주소만 바꾼다 (`--map`·`--crop`은 마을에만 있는 것이라 같이 못 쓴다) */
const target = (u) => (u ? new URL(u, BASE).href : BASE);
const crop = (val('--crop') || '').split(',').map(Number).filter((n) => !Number.isNaN(n));
const click = val('--click');
const grid = flag('--grid');
const scale = Number(val('--scale', 2)) || 2;
const onlyPhone = flag('--phone');
const el = val('--el');
const onlyMap = flag('--map') || crop.length === 4;

/** %눈금을 얹는다. 건물·스프라이트 좌표를 눈으로 재야 할 때 쓴다. */
const GRID = (x0, y0, x1, y1) => `
  const g = document.createElement('div');
  g.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:99';
  let h = '';
  for (let x = Math.ceil(${x0}); x < ${x1}; x++) {
    const on = x % 2 === 0;
    h += '<div style="position:absolute;top:0;bottom:0;left:' + x + '%;width:1px;background:rgba(255,0,0,'
       + (on ? .85 : .25) + ')"></div>';
    // 숫자는 **크롭 안쪽 위**에 붙인다 — 지도 꼭대기에 두면 잘라낸 그림 밖으로 나간다
    if (on) h += '<div style="position:absolute;top:calc(' + ${y0} + '% + 2px);left:calc(' + x + '% + 2px);font:11px/1 monospace;color:red;text-shadow:0 0 3px #fff">' + x + '</div>';
  }
  for (let y = Math.ceil(${y0}); y < ${y1}; y++) {
    const on = y % 2 === 0;
    h += '<div style="position:absolute;left:0;right:0;top:' + y + '%;height:1px;background:rgba(0,0,255,'
       + (on ? .85 : .25) + ')"></div>';
    if (on) h += '<div style="position:absolute;left:calc(' + ${x0} + '% + 2px);top:calc(' + y + '% + 2px);font:11px/1 monospace;color:blue;text-shadow:0 0 3px #fff">' + y + '</div>';
  }
  g.innerHTML = h;
  document.getElementById('map').appendChild(g);
`;

const server = await serve(BASE);
const browser = await chromium.launch({ executablePath: CHROME })
  .catch(() => chromium.launch());   // 로컬에 따로 깔려 있으면 그것을 쓴다

/* 눈금은 잴 때 쓰는 것이라 해상도가 높아야 한다 — 지도를 화면 가득 키운다 */
const TUNE = { viewport: { width: 1600, height: 1400 }, deviceScaleFactor: 2 };
const shots = grid
  ? [['tune', TUNE]]
  : onlyPhone
    ? [['phone', { ...devices['iPhone 13'], deviceScaleFactor: scale }]]
    : [['phone', { ...devices['iPhone 13'], deviceScaleFactor: scale }],
       ['desktop', { viewport: { width: 1440, height: 950 }, deviceScaleFactor: scale }]];

for (const [name, opts] of shots) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  await page.goto(target(val('--url')), { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);

  /* **움직임을 0에 세운다.** 마을은 늘 숨쉬고 흔들리므로, 세우지 않으면 찍을
     때마다 건물 크기가 미세하게 달라 「고치기 전후」를 견줄 수가 없다.

     다만 **스크롤로 굴러가는 것은 건드리지 않는다.** 그것들은 시간이 아니라 스크롤
     위치가 진행도라, 0으로 되감으면 「아직 안 나타난 상태」에 못 박혀 버린다 —
     케이스 스터디를 처음 찍었을 때 절 넷이 백지로 나온 것이 이 때문이었다. */
  await page.evaluate(() => document.getAnimations()
    .filter((a) => a.timeline === document.timeline)
    .forEach((a) => { try { a.pause(); a.currentTime = 0; } catch (_) {} }));

  if (click) { await page.click(click); await page.waitForTimeout(350); }
  if (grid && crop.length === 4) await page.evaluate(GRID(...crop));

  /* 한 절만 찍을 때는 그 자리로 굴려서 지연 로딩 그림을 받아 오게 한다.
     **굴리는 것도 찍는 것도 playwright의 locator로 하면 안 된다.** locator는
     「요소가 멈출 때까지」 기다렸다 움직이는데, 스크롤로 굴러가는 애니메이션이 걸린
     페이지에서는 굴릴 때마다 요소가 조금씩 움직여서 **영영 안 멈춘다** — 실제로
     걸려서 프로세스가 안 끝났다. 그래서 손으로 굴리고 좌표를 재서 그 사각형만 찍는다. */
  let clipBox = null;
  if (el) {
    clipBox = await page.evaluate(async (sel) => {
      const node = document.querySelector(sel);
      if (!node) return null;
      node.scrollIntoView({ block: 'center' });
      /* **src 없는 <img>는 빼고 부른다.** 그런 것에 decode()를 부르면 폰 화면
         흉내(iPhone 13) 중인 크롬이 통째로 죽는다 — 라이트박스가 닫힌 동안 비워 두는
         그림 한 장 때문에 이 도구가 매번 「브라우저가 닫혔다」로 끝났다 */
      await Promise.all([...document.images]
        .filter((i) => i.currentSrc)
        .map((i) => i.decode().catch(() => {})));
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const b = node.getBoundingClientRect();
      return { x: b.x + scrollX, y: b.y + scrollY, width: b.width, height: b.height };
    }, el);
    if (!clipBox) throw new Error(`--el ${el} 를 못 찾았다`);
    await page.waitForTimeout(300);
  }

  const file = `${out}-${name}.png`;
  if (crop.length === 4) {
    const m = await page.locator('#map').boundingBox();
    const [x0, y0, x1, y1] = crop;
    await page.screenshot({ path: file, clip: {
      x: m.x + m.width * x0 / 100, y: m.y + m.height * y0 / 100,
      width: m.width * (x1 - x0) / 100, height: m.height * (y1 - y0) / 100 } });
  } else if (clipBox) {
    /* clip 좌표는 문서 기준이라 fullPage와 같이 줘야 한다. 창 기준으로 주면
       굴려 놓은 만큼 어긋나 「잘라낼 구역이 그림 밖」으로 끝난다 */
    await page.screenshot({ path: file, clip: clipBox, fullPage: true });
  } else if (onlyMap) {
    await page.locator('.map-holder').screenshot({ path: file });
  } else {
    await page.screenshot({ path: file, fullPage: true });
  }
  console.log('  ' + file);
  await ctx.close();
}

await browser.close();
if (server) server.kill();
