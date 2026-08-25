import { chromium } from 'playwright';
import { serve } from './serve.mjs';
const server = await serve('http://localhost:8000');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
for (const [n, vp] of [['PC 1440', { width: 1440, height: 900 }],
                       ['PC 1280', { width: 1280, height: 900 }],
                       ['폰 390 ', { width: 390, height: 844, isMobile: true, hasTouch: true }]]) {
  const p = await b.newPage({ viewport: vp });
  await p.addInitScript(() => {
    window.__s = null;
    new MutationObserver(() => {
      const c = document.querySelector('.onb-char');
      if (c && !window.__s) { const r = c.getBoundingClientRect(); window.__s = r.left + r.width / 2; }
    }).observe(document, { childList: true, subtree: true });
  });
  await p.goto('http://localhost:8000', { waitUntil: 'networkidle' });
  await p.waitForSelector('.onb-bubble', { timeout: 6000 });
  const r = await p.evaluate(() => {
    const c = document.querySelector('.onb-char'); const box = c.getBoundingClientRect();
    return { s: window.__s, e: box.left + box.width / 2, w: box.width, h: box.height,
             dur: parseFloat(getComputedStyle(c).transitionDuration),
             pace: parseFloat(c.style.getPropertyValue('--onb-step')) / 1000 };
  });
  const dist = r.e - r.s, speed = dist / r.dur, cycles = r.dur / r.pace;
  console.log(`${n}  ${Math.round(dist)}px/${r.dur}s  몸폭 ${Math.round(r.w)}  걸음 ${r.pace}s`
    + `  → **발 ${(cycles * 2).toFixed(1)}번**  초당 ${(2 / r.pace).toFixed(1)}번`
    + `  보폭 ${(speed * r.pace / r.w).toFixed(2)}배  들썩임 ${(r.h * .08).toFixed(1)}px`);
  await p.close();
}
await b.close(); if (server) server.kill();
