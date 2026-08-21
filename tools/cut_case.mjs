/* 케이스 스터디에 쓸 그림을 잘라 두 벌로 뽑는다.
 *
 * **왜 파이썬이 아니라 노드인가.** 이 저장소의 다른 자르는 도구(`cut_sprites.py` 등)는
 * Pillow를 쓰는데, 새 컨테이너에는 Pillow도 numpy도 없다. 반면 playwright는
 * `npm install` 한 번이면 늘 있고 크롬이 딸려 온다. **크롬의 canvas가 곧 이미지
 * 편집기다** — 잘라 내기(drawImage 원본 사각형)와 줄이기와 JPEG 인코딩이 다 된다.
 * 도구 하나 때문에 파이썬 의존을 새로 만들지 않는다.
 *
 *   node tools/cut_case.mjs --grid 4.brand-board.png   %눈금을 얹어 찍는다 (좌표 잴 때)
 *   node tools/cut_case.mjs                            아래 CUTS를 전부 뽑는다
 *
 * **두 벌로 뽑는 이유는 첫 로드다.** 격자에 깔리는 것은 긴 변 480px 썸네일이고,
 * 큰 것은 눌렀을 때만 온다. 지금 배포가 3.1MB인데 브랜드 보드 원본 한 장이
 * 1.5MB라, 그대로 깔면 그것 하나로 배포가 절반 늘어난다.
 *
 * 원본(`_material/`)은 .gitignore에 있다. 배포 저장소에 두지 않는다.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';

const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium';
const SRC = process.env.CASE_SRC || '_material';
const OUT = 'assets/case/playgrown';

/* 자를 곳은 **원본 크기가 아니라 %로 적는다.** 원본을 다시 뽑으면 픽셀 수가 달라지는데
   %로 적어 두면 같은 자리가 그대로 잘린다. [x, y, w, h] 모두 원본 폭·높이 기준 %. */
/* **조각은 한 벌씩만 뽑는다** (`thumb: 0`). 원본 보드가 1536px라 조각 하나가
   400~540px밖에 안 되는데, 여기에 480px 썸네일을 또 만들면 같은 그림이 두 번
   들어간다 — 큰 것을 눌러도 더 나올 화소가 없다. 「눌러서 크게」의 값이 실제로
   있는 것은 보드 전체(1536px) 한 장뿐이라 그것만 따로 뽑는다. */
/* **자르지 않는 것이 기본이다.** 처음에는 브랜드 보드를 조각조각 오려 타일로 깔았는데,
   쓰는 사람이 「편집 없이 그대로」를 골랐다(2026-08-21). 그래서 칼럼 · 포지셔닝 ·
   브랜드 보드는 통째로 한 장씩 뽑는다 — `at: [0, 0, 100, 100]`이 그 뜻이다.

   원본이 1510~1536px라 `long: 1600`을 줘도 **한 픽셀도 줄지 않는다.** 바뀌는 것은
   PNG를 JPEG로 다시 담는 것뿐이고, 그것만으로 2.1MB가 200KB대가 된다.
   글씨가 작은 장이라 화질은 0.9로 올렸다(다른 것은 0.82). */
const CUTS = [
  /* **칼럼은 인용 상자를 잘라 내고 위아래를 이어 붙인다.** 인용 부분을 빼기로
     했는데(2026-08-22), 그냥 아래를 잘라 버리면 뜯긴 종이가 가위로 자른 종이가 된다.
     그래서 **본문 띠와 종이의 뜯긴 아랫변 띠를 따로 떠서 세로로 붙인다** —
     `bands`가 그 뜻이다. 덤으로 인터뷰이의 실명·나이도 같이 사라져서
     따로 덮을 것이 없어졌다. */
  { src: '1.column.png', name: 'column', long: 1600, q: 0.9, thumb: 0,
    bands: [[0, 0, 100, 61], [0, 88.2, 100, 10]] },
  { src: '2.positioning-board.png', name: 'positioning', at: [0, 0, 100, 100], long: 1600, q: 0.9, thumb: 0 },
  { src: '4.brand-board.png', name: 'brand-board', at: [0, 0, 100, 100], long: 1600, q: 0.9, thumb: 0 },

  /* 맵 — 조감도 한 장. 존 라벨은 이미지가 아니라 HTML로 얹는다.
     **투명을 살린 PNG는 1.5MB였다.** 대신 바탕을 깔고 JPEG로 뽑으면 1/10이 된다.
     깔 색은 흰색이다 — 종이색(PAPER)을 깔아 봤더니 **조감도 둘레의 옅은 흰 후광이
     그 위에 겹쳐** 네모난 자국이 그대로 드러났다. 원본이 흰 바탕에서 나온 그림이라
     흰색으로 맞추고, 이 그림은 흰 카드 위에 놓는다 (.plan-frame) */
  { src: '6.map.png', name: 'map', at: [11, 9, 78, 80], long: 1500, bg: '#FFFFFF', thumb: 0 },
];

/* 긴 변 기준(px). thumb는 격자에 깔리는 것, full은 눌렀을 때 오는 것.
   원본 보드가 1536px밖에 안 되므로 full을 크게 잡아도 대개 원본 크기 그대로 나온다.
   `thumb: 0`인 조각은 격자에 안 깔리는 것이라 한 벌만 뽑는다. */
const THUMB = 480, FULL = 1400;

const argv = process.argv.slice(2);
const gridOf = argv.includes('--grid') ? argv[argv.indexOf('--grid') + 1] : null;
const sheet = argv.includes('--sheet');

const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

/** 원본을 data: URL로 넘긴다. file:// 로 열면 캔버스가 오염돼 toDataURL이 막힌다. */
const dataUrl = async (file) => {
  const buf = await readFile(path.join(SRC, file));
  return `data:image/png;base64,${buf.toString('base64')}`;
};

if (gridOf) {
  /* 좌표를 눈대중으로 찍지 않기 위한 모드. 지도 좌표를 잴 때 쓰는
     `shot.mjs --grid`와 같은 생각이다 — 5% 눈금, 25%마다 굵게. */
  /* **눈금은 그림에 맞춰야 한다.** 처음엔 body에 얹었는데, body는 창 높이(1000px)고
     그림은 제 비율대로 787px이라 **세로 눈금만 1.27배씩 어긋났다** — 그것으로 잰
     좌표를 그대로 써서 조감도 아래쪽이 잘려 나갔다. 그림을 감싼 상자에 얹는다. */
  await page.setContent(`<style>
    body { margin: 0; }
    .wrap { position: relative; width: 1400px; }
    img { display: block; width: 100%; }
    .g { position: absolute; inset: 0; }
    .g i { position: absolute; background: rgba(255,0,0,.45); }
    .g i.b { background: rgba(0,80,255,.85); }
    .g span { position: absolute; font: 11px/1 monospace; color: #00f; background: #fff; padding: 1px; }
  </style>
  <div class="wrap"><img src="${await dataUrl(gridOf)}"><div class="g" id="g"></div></div>
  <script>
    const g = document.getElementById('g');
    let h = '';
    for (let p = 0; p <= 100; p += 5) {
      const b = p % 25 === 0 ? ' b' : '';
      h += \`<i class="\${b}" style="left:\${p}%;top:0;width:1px;height:100%"></i>\`;
      h += \`<i class="\${b}" style="top:\${p}%;left:0;height:1px;width:100%"></i>\`;
      if (p % 25 === 0) h += \`<span style="left:\${p}%;top:2px">\${p}</span><span style="left:2px;top:\${p}%">\${p}</span>\`;
    }
    g.innerHTML = h;
  </script>`);
  await page.waitForTimeout(300);
  const out = `/tmp/grid-${path.basename(gridOf, '.png')}.png`;
  await page.locator('.wrap').screenshot({ path: out });
  console.log(out);
  await browser.close();
  process.exit(0);
}

if (sheet) {
  /* **잘린 데가 없는지는 한 장에 늘어놓고 봐야 안다.** 한 장씩 열어 보면
     발이 잘렸는지 왕관이 잘렸는지를 매번 따로 확인하게 된다. */
  const files = CUTS.map((c) => `${c.name}.jpg`);
  const tags = await Promise.all(files.map(async (f) => {
    const buf = await readFile(path.join(OUT, f)).catch(() => null);
    if (!buf) return `<figure><b>${f}</b><i>없음</i></figure>`;
    return `<figure><img src="data:image/jpeg;base64,${buf.toString('base64')}"><b>${f}</b></figure>`;
  }));
  await page.setContent(`<style>
    body { margin: 0; padding: 12px; background: #333; font: 12px/1.4 monospace; }
    div { display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-start; }
    figure { margin: 0; background: #fff; padding: 6px; width: 300px; }
    img { display: block; width: 100%; outline: 1px solid #f0f; }
    b { display: block; margin-top: 4px; }
  </style><div>${tags.join('')}</div>`);
  await page.waitForTimeout(300);
  await page.locator('body').screenshot({ path: '/tmp/case-sheet.png' });
  console.log('/tmp/case-sheet.png');
  await browser.close();
  process.exit(0);
}

await mkdir(OUT, { recursive: true });

for (const cut of CUTS) {
  const url = await dataUrl(cut.src);
  const jobs = [['full', cut.long ?? FULL]];
  if (cut.thumb !== 0) jobs.push(['thumb', cut.thumb ?? THUMB]);
  for (const [tag, long] of jobs) {
    const { data, w, h } = await page.evaluate(
      ([url, at, long, png, bg, q, bands]) => new Promise((res, rej) => {
        const img = new Image();
        img.onerror = () => rej(new Error('load'));
        img.onload = () => {
          /* 띠 여럿을 세로로 이어 붙이는 경우와 한 덩어리를 잘라 내는 경우를
             같은 길로 처리한다 — 이어 붙이기는 띠가 여럿인 잘라 내기일 뿐이다 */
          const rects = (bands || [at]).map(([x, y, w2, h2]) => ({
            sx: img.width * x / 100, sy: img.height * y / 100,
            sw: img.width * w2 / 100, sh: img.height * h2 / 100,
          }));
          const sw = Math.max(...rects.map((r) => r.sw));
          const sh = rects.reduce((n, r) => n + r.sh, 0);
          const k = Math.min(1, long / Math.max(sw, sh));   // 원본보다 키우지 않는다
          const c = document.createElement('canvas');
          c.width = Math.round(sw * k); c.height = Math.round(sh * k);
          const g = c.getContext('2d');
          g.imageSmoothingQuality = 'high';
          /* PNG로 뽑는 것은 배경이 비어 있어야 하고, JPEG로 뽑는 것은
             투명이 검게 나오므로 바탕을 먼저 깐다 */
          if (!png) { g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height); }
          let top = 0;
          rects.forEach((r) => {
            g.drawImage(img, r.sx, r.sy, r.sw, r.sh, 0, Math.round(top * k),
                        Math.round(r.sw * k), Math.round(r.sh * k));
            top += r.sh;
          });
          res({
            data: c.toDataURL(png ? 'image/png' : 'image/jpeg', q).split(',')[1],
            w: c.width, h: c.height,
          });
        };
        img.src = url;
      }),
      [url, cut.at || [0, 0, 100, 100], long, !!cut.png, cut.bg || '#F6F3ED', cut.q || 0.82, cut.bands || null],
    );
    const ext = cut.png ? 'png' : 'jpg';
    const file = path.join(OUT, `${cut.name}${tag === 'thumb' ? '-t' : ''}.${ext}`);
    const buf = Buffer.from(data, 'base64');
    await writeFile(file, buf);
    console.log(`${file}  ${w}x${h}  ${(buf.length / 1024).toFixed(0)}KB`);
  }
}

await browser.close();
