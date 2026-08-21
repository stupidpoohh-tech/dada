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
const crop = (val('--crop') || '').split(',').map(Number).filter((n) => !Number.isNaN(n));
const click = val('--click');
const grid = flag('--grid');
const onlyPhone = flag('--phone');
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
    ? [['phone', { ...devices['iPhone 13'] }]]
    : [['phone', { ...devices['iPhone 13'] }],
       ['desktop', { viewport: { width: 1440, height: 950 }, deviceScaleFactor: 2 }]];

for (const [name, opts] of shots) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);

  /* **움직임을 0에 세운다.** 마을은 늘 숨쉬고 흔들리므로, 세우지 않으면 찍을
     때마다 건물 크기가 미세하게 달라 「고치기 전후」를 견줄 수가 없다. */
  await page.evaluate(() => document.getAnimations()
    .forEach((a) => { try { a.pause(); a.currentTime = 0; } catch (_) {} }));

  if (click) { await page.click(click); await page.waitForTimeout(350); }
  if (grid && crop.length === 4) await page.evaluate(GRID(...crop));

  const file = `${out}-${name}.png`;
  if (crop.length === 4) {
    const m = await page.locator('#map').boundingBox();
    const [x0, y0, x1, y1] = crop;
    await page.screenshot({ path: file, clip: {
      x: m.x + m.width * x0 / 100, y: m.y + m.height * y0 / 100,
      width: m.width * (x1 - x0) / 100, height: m.height * (y1 - y0) / 100 } });
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
