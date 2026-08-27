#!/usr/bin/env python3
"""다원의 앞모습(me.png)을 원본에서 다시 떠낸다.

**왜 다시 뜨나.** 예전 me.png는 98x130이었다. 지도 위 "나"(폭 5.4%, 1440px 화면에서
78px)에는 넉넉했지만, 첫 방문 안내에서 다원은 **폭 200px**까지 커진다
(`onboarding.js`의 `place()`). 98px짜리를 200px로 늘리니 뭉갰다.

**얼마나 크게 뜨나 — 423x558.** 두 가지가 이 숫자를 정한다.

  ① 안내에서 200px, 고밀도 화면이면 400px이 필요하다 → 폭 423px이면 덮는다.
  ② 원본은 **한 칸이 13px쯤인 픽셀 그림**이다. 칸을 세어 보면 47x62칸이고
     (아래 `grid_report()`가 그걸 재서 알려 준다), 423 = 47x9 · 558 = 62x9이라
     **한 칸이 정확히 9px**로 떨어진다. 칸이 고르지 않게 떨어지면 어떤 칸은 9px,
     어떤 칸은 10px이 되어 격자가 물결친다. 목표 크기를 아무 값으로나 잡지 말 것.

`image-rendering: pixelated`은 쓰지 않는다 — 지도 위 "나"는 78px로 **줄여서** 쓰는데
거기서 pixelated는 칸을 통째로 버려 들썩일 때마다 모양이 튄다. 브라우저가 매끄럽게
줄이도록 두고, 대신 **줄일 거리가 남을 만큼 크게** 떠 두는 쪽이 양쪽 다 산다.

**색은 64개로 줄인다.** 받은 원본은 손실 압축을 거쳐 와서 평평해야 할 면에 34,000색이
깔려 있다. 눈에 보이는 색은 스무 남짓이라 64색으로 줄이면 그 잡티가 사라지고 파일이
181KB → 19KB가 된다. 예전 98x130짜리와 같은 무게로 4.3배 큰 그림을 준다.

    python3 tools/cut_me.py

원본(me-front.png)은 저장소 루트에 있다 — 다원님이 GitHub 웹으로 올리는 자리가
거기라서다. `me-back.png`와 같은 규칙으로 **지우지 않고 `.assetsignore`로 배포에서만
뺀다**(안 그러면 `/me-front.png`로 936KB가 그대로 배포된다).

앞모습을 다시 뜨면 **뒷모습도 다시 떠야 한다** — `cut_me_back.py`가 앞모습의 캔버스를
그대로 받아 쓰기 때문이다. 순서대로:

    python3 tools/cut_me.py && python3 tools/cut_me_back.py
"""
import os
import sys
from collections import deque

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'me-front.png')
OUT = os.path.join(ROOT, 'assets', 'sprites', 'cut', 'me.png')

GRID = (47, 62)     # 원본 픽셀 그림의 칸 수 (아래 grid_report()로 잰 값)
SCALE = 9           # 한 칸을 몇 px으로 뜰까 — 47x9=423 ≥ 400(200px x 2배 화면)
COLORS = 64         # 남길 색 수

# 검은 배경으로 판정할 밝기(R+G+B). 머리카락이 (28,28,28)=84부터라 그 아래에서
# 고른다. 압축 잡티로 배경에 40 언저리가 흩어져 있어 0으로 잡으면 테두리가 남는다.
BG_LUM = 50


def flood_background(rgb):
    """가장자리에서 시작해 이어진 검은 칸만 배경으로 친다.

    밝기 문턱만으로 자르면 **머리카락이 같이 지워진다** — 검은 머리와 검은 배경이
    같은 값대라서다. 가장자리에서 번져 들어가면 머리는 배경과 이어져 있지 않으므로
    살아남는다(`cut_sprites.py`도 같은 이유로 같은 방법을 쓴다).
    """
    dark = rgb.astype(np.int16).sum(axis=2) <= BG_LUM
    h, w = dark.shape
    seen = np.zeros_like(dark)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if dark[y, x] and not seen[y, x]:
                seen[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if dark[y, x] and not seen[y, x]:
                seen[y, x] = True
                q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and dark[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                q.append((ny, nx))
    return seen


def cutout(im):
    """배경을 지우고 알파 상자로 바짝 자른다.

    알파가 이미 살아 있는 원본(뒷모습처럼)은 그것을 그대로 믿는다. RGB로 바꿔
    버리면 투명한 자리의 색이 제각각이라 배경을 못 찾는다.
    """
    if im.mode in ('RGBA', 'LA'):
        a = np.array(im.convert('RGBA'))[:, :, 3]
        if a.min() < 250:
            im = im.convert('RGBA')
            return im.crop(im.getchannel('A').point(lambda p: 255 if p > 8 else 0).getbbox())

    rgb = np.array(im.convert('RGB'))
    alpha = np.where(flood_background(rgb), 0, 255).astype(np.uint8)
    out = Image.fromarray(np.dstack([rgb, alpha]), 'RGBA')
    return out.crop(out.getchannel('A').point(lambda p: 255 if p > 8 else 0).getbbox())


def grid_report(im, want):
    """원본의 칸 수를 다시 재서 알려 준다. 새 원본을 받았을 때 GRID를 고칠지 판단하는 자리.

    칸 수 n으로 줄였다가 그대로 다시 늘렸을 때 원본과 가장 덜 어긋나는 n이 진짜 칸
    수다. n을 키우면 오차는 계속 줄기 때문에 **가장 작은 값이 아니라 홀로 푹 꺼진
    자리**를 찾는다 — 양옆보다 뚜렷이 낮은 n.
    """
    a = np.array(im.convert('RGB')).astype(float)
    errs = {}
    for n in range(30, 72):
        m = round(n * im.height / im.width)
        small = im.convert('RGB').resize((n, m), Image.BOX)
        errs[n] = np.abs(np.array(small.resize(im.size, Image.NEAREST)).astype(float) - a).mean()
    dips = [n for n in range(31, 71)
            if errs[n] < errs[n - 1] - 1 and errs[n] < errs[n + 1] - 1]
    best = min(dips, key=lambda n: errs[n]) if dips else None
    if best and best != want[0]:
        print(f'  ⚠ 칸 수가 {best}칸으로 읽힌다 (GRID={want[0]}칸으로 뜨는 중) — '
              f'새 원본이면 GRID·SCALE을 다시 잡을 것')
    else:
        print(f'  칸 {want[0]}x{want[1]} · 한 칸 {SCALE}px')


def main():
    if not os.path.exists(SRC):
        sys.exit(f'원본이 없다: {SRC}\n'
                 '다원님이 GitHub 웹으로 저장소 루트에 올리는 자리다.')

    art = cutout(Image.open(SRC))
    size = (GRID[0] * SCALE, GRID[1] * SCALE)

    # 줄이기 전에 색을 줄이면 잡티가 남은 채로 굳는다 — 순서를 바꾸지 말 것.
    big = art.resize(size, Image.LANCZOS)
    # FASTOCTREE는 알파를 네 번째 채널로 같이 묶어서 반투명 테두리가 살아남는다.
    # MEDIANCUT은 RGBA를 받지 못해 테두리가 계단이 된다.
    big.quantize(colors=COLORS, method=Image.FASTOCTREE, dither=Image.NONE) \
       .save(OUT, optimize=True)

    print(f'{os.path.relpath(OUT, ROOT)}  {size[0]}x{size[1]}  '
          f'{os.path.getsize(OUT) // 1024}KB  (원본 {art.width}x{art.height})')
    grid_report(art, GRID)
    print('  다음: python3 tools/cut_me_back.py — 뒷모습을 같은 캔버스로 다시 뜬다')


if __name__ == '__main__':
    main()
