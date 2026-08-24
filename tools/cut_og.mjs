/* 카톡·슬랙 미리보기에 뜨는 그림(og:image)을 뽑는다.
 *
 * **왜 원본을 그대로 안 거는가.** 다원님이 주는 것은 1.5MB짜리 PNG인데,
 * og:image는 **남의 서버가 대신 받아 가는 그림**이라 무거우면 미리보기가 늦게
 * 뜨거나 아예 안 뜬다. 같은 그림을 JPEG로 다시 담기만 해도 1/7이 된다.
 *
 * 자르는 도구(cut_case.mjs)와 같은 방법이다 — 크롬의 canvas가 곧 이미지 편집기다.
 * 새 컨테이너에 Pillow가 없어도 playwright는 `npm install` 한 번이면 늘 있다.
 *
 *   node tools/cut_og.mjs
 *
 * 원본은 `_material/`에 둔다 (.gitignore). 저장소에는 뽑은 것만 남는다 —
 * 루트에 원본을 둔 채로 두면 `/OG.png`로 그대로 배포된다.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';

const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium';
const SRC = process.env.OG_SRC || '_material/OG.png';
const OUT = 'assets/og/home.jpg';

/* 폭 1200이면 어디서든 넉넉하다. 카톡이 실제로 그리는 크기는 이보다 훨씬 작고,
   **비율은 원본 그대로 둔다** — 1.91:1로 맞추자고 자르면 다원님이 잡은 구도에서
   위아래가 잘려 나간다. 지금 것은 4:3이고 카톡은 카드 안에 맞춰 넣어 준다. */
const WIDE = 1200, Q = 0.9;

const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({ viewport: { width: 1400, height: 1200 } });

const buf = await readFile(SRC);
const out = await page.evaluate(async ([data, wide, q]) => {
  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i); i.onerror = rej; i.src = data;
  });
  const w = Math.min(wide, img.naturalWidth);
  const h = Math.round(img.naturalHeight * (w / img.naturalWidth));
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const cx = cv.getContext('2d');
  /* 카톡 카드는 흰 바탕 위에 놓인다. JPEG는 투명을 모르므로 흰색을 먼저 깐다 —
     안 깔면 투명한 자리가 검게 나온다 */
  cx.fillStyle = '#FFFFFF';
  cx.fillRect(0, 0, w, h);
  cx.imageSmoothingQuality = 'high';
  cx.drawImage(img, 0, 0, w, h);
  return { url: cv.toDataURL('image/jpeg', q), w, h };
}, [`data:image/png;base64,${buf.toString('base64')}`, WIDE, Q]);

await mkdir('assets/og', { recursive: true });
const bytes = Buffer.from(out.url.split(',')[1], 'base64');
await writeFile(OUT, bytes);
console.log(`${OUT}  ${out.w}x${out.h}  ${Math.round(bytes.length / 1024)}KB`);
console.log(`  → index.html과 build_list.py의 og:image·width·height를 이 값으로 맞춘다`);

await browser.close();
