/* 건물이 **빈 공터 안에 앉았는지** 잰다.
 *
 *   node tools/fit_building.mjs                  건물 전부
 *   node tools/fit_building.mjs library          한 채만
 *   node tools/fit_building.mjs library --sweep  자리·크기를 훑어 제일 깨끗한 것을 찾는다
 *
 * **눈으로만 보이고 화면은 안 깨지는 종류다.** 건물이 나무를 1%쯤 물고 있어도
 * 찍어 보면 그냥 그럴듯해 보이는데, 지도 위에서는 벽이 나무를 베고 지나간 선이 된다
 * (도서관이 처음 들어오던 날 실제로 그랬다 — 2026-10-19).
 *
 * 화면을 찍어 비교하지 않는다. **배경 지도와 건물 그림을 캔버스에 직접 올려** 읽는다 —
 * 찍어서 비교하면 애니메이션 위상·안티앨리어싱 때문에 돌릴 때마다 수가 흔들린다.
 *
 * 세는 법: 건물 그림에서 **알파가 진한 픽셀**만 골라, 그 자리의 배경이 무엇인지 본다.
 *   잔디   비어 있는 땅. 여기 앉아야 한다
 *   나무   나무·울타리·덤불. **여기를 물면 벽이 나무를 베고 지나간 것으로 보인다**
 *   길     아스팔트. 건물이 길 위에 선 것이다
 *   그 밖  돌·흙·꽃. 꽃을 조금 덮는 것은 괜찮다(화단처럼 보인다)
 *
 * 다른 건물들의 실측(2026-10-19): 나무 0.0~1.8% · 길 0.0~0.4%.
 * 깨끗한 쪽(학교·회사·카페)이 0.1% 안쪽이므로 **0.2%를 눈금으로 삼는다.**
 */
import { chromium } from 'playwright';

const BASE = process.env.DADA_BASE || 'http://localhost:8000';
const args = process.argv.slice(2);
const SWEEP = args.includes('--sweep');
const only = args.filter((a) => !a.startsWith('--'))[0] || null;

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });

/** 한 자리에 세워 보고 무엇을 덮는지 돌려준다. 전부 페이지 안에서 한다. */
const measure = await page.evaluate(async () => {
  const data = await fetch('/services.json').then((r) => r.json());
  const bg = new Image();
  bg.src = '/assets/map/town-web.jpg';
  await bg.decode();
  const bc = document.createElement('canvas');
  bc.width = bg.naturalWidth; bc.height = bg.naturalHeight;
  bc.getContext('2d').drawImage(bg, 0, 0);
  const back = bc.getContext('2d').getImageData(0, 0, bc.width, bc.height).data;

  /* 배경 한 픽셀이 무엇인지. 잔디는 초록이 확실히 세고, 나무·울타리는 같은 초록인데
     어둡다. 길은 채도가 거의 없고 푸르스름하다. */
  const kindAt = (x, y) => {
    const i = (y * bc.width + x) * 4;
    const r = back[i], g = back[i + 1], b = back[i + 2];
    if (g > 140 && g - r > 15 && g - b > 35) return 'lawn';
    if (g > 70 && g - r > 18 && g - b > 20) return 'tree';
    if (Math.abs(r - g) < 22 && b - r > 8 && b > 110) return 'road';
    return 'other';
  };

  const sprites = {};
  window.__fit = async (id, at, w) => {
    const d = data.districts.find((x) => x.id === id);
    if (!d || !d.building) return null;
    const src = '/assets/sprites/cut/' + d.building.src;
    if (!sprites[src]) {
      const im = new Image();
      im.src = src;
      await im.decode();
      sprites[src] = im;
    }
    const im = sprites[src];
    const [ax, ay] = at || d.building.at;
    const bw = w || d.building.w;

    // 지도 픽셀로 환산한다 — at[0]은 가운데(.pop이 translateX(-50%)), at[1]은 밑변
    const pw = Math.round(bw / 100 * bc.width);
    const ph = Math.round(pw * im.naturalHeight / im.naturalWidth);
    const px = Math.round((ax / 100) * bc.width - pw / 2);
    const py = Math.round((ay / 100) * bc.height - ph);

    const sc = document.createElement('canvas');
    sc.width = pw; sc.height = ph;
    const g2 = sc.getContext('2d');
    g2.drawImage(im, 0, 0, pw, ph);
    const sd = g2.getImageData(0, 0, pw, ph).data;

    const tally = { lawn: 0, tree: 0, road: 0, other: 0, off: 0 };
    let n = 0;
    for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
      if (sd[(y * pw + x) * 4 + 3] < 128) continue;   // 옅은 테두리는 안 친다
      n++;
      const mx = px + x, my = py + y;
      if (mx < 0 || my < 0 || mx >= bc.width || my >= bc.height) { tally.off++; continue; }
      tally[kindAt(mx, my)]++;
    }
    return { n, tally, box: [px / bc.width * 100, (px + pw) / bc.width * 100,
                            py / bc.height * 100, (py + ph) / bc.height * 100],
             rect: d.rect };
  };
  return true;
});
if (!measure) throw new Error('잴 수 없다');

const pct = (v, n) => (v / n * 100);
const line = (id, r, at, w) => {
  const t = r.tally;
  const head = at ? `at [${at[0]}, ${at[1]}] · w ${w}` : id;
  return `${head.padEnd(26)}잔디 ${pct(t.lawn, r.n).toFixed(1).padStart(5)}%`
       + `  나무 ${pct(t.tree, r.n).toFixed(2).padStart(5)}%`
       + `  길 ${pct(t.road, r.n).toFixed(2).padStart(5)}%`
       + `  그 밖 ${pct(t.other, r.n).toFixed(1).padStart(4)}%`;
};

const ids = await page.evaluate(() => fetch('/services.json').then((r) => r.json())
  .then((d) => d.districts.filter((x) => x.building).map((x) => x.id)));

if (SWEEP) {
  const id = only || 'library';
  const base = await page.evaluate((i) => fetch('/services.json').then((r) => r.json())
    .then((d) => d.districts.find((x) => x.id === i).building), id);
  console.log(`\n── ${id} 훑어보기 (지금: at [${base.at}] · w ${base.w})\n`);
  const rows = [];
  for (const dx of [-2, -1.5, -1, -.5, 0, .5, 1, 1.5]) {
    for (const dy of [-1.5, -1, -.5, 0]) {
      for (const dw of [-1, -.5, 0, .5, 1]) {
        const at = [+(base.at[0] + dx).toFixed(2), +(base.at[1] + dy).toFixed(2)];
        const w = +(base.w + dw).toFixed(2);
        const r = await page.evaluate(([i, a, ww]) => window.__fit(i, a, ww), [id, at, w]);
        rows.push({ at, w, r, bad: pct(r.tally.tree + r.tally.road, r.n) });
      }
    }
  }
  rows.sort((a, b) => a.bad - b.bad || b.w - a.w);
  console.log('나무·길을 가장 안 건드리는 것부터 (같으면 큰 것 먼저)');
  rows.slice(0, 12).forEach((x) => console.log('  ' + line(id, x.r, x.at, x.w)));
} else {
  console.log('');
  for (const id of ids) {
    if (only && id !== only) continue;
    const r = await page.evaluate((i) => window.__fit(i), id);
    const bad = pct(r.tally.tree + r.tally.road, r.n);
    const mark = bad <= 0.2 ? '✅' : (bad <= 1 ? '△ ' : '❌');
    console.log(`${mark} ${line(id, r)}`);
    const [x0, x1, y0, y1] = r.box;
    const [rx, ry, rw, rh] = r.rect;
    if (x0 < rx || x1 > rx + rw || y1 > ry + rh) {
      console.log(`     구역 밖으로 나갔다 — 상자 x ${x0.toFixed(1)}~${x1.toFixed(1)}`
                + ` y ${y0.toFixed(1)}~${y1.toFixed(1)} · rect x ${rx}~${rx + rw} y ${ry}~${ry + rh}`);
    }
  }
  console.log('\n눈금 — 나무+길이 0.2% 안쪽이면 ✅ (학교·회사·카페가 그 수준이다)');
}
await page.close();
await browser.close();
