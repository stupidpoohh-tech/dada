#!/usr/bin/env python3
"""지도에서 건물 실루엣만 오려낸 마스크를 만든다.

건물이 상시로 뾰잉거릴 때 움직이는 범위를 사각형으로 잡으면, 학교처럼 지붕 위
양옆에 나무가 걸치거나 미술관처럼 몸통이 상자에 잘리는 곳이 생긴다. 다각형을
손으로 찍어도 계단처럼 어긋나는 자리가 남는다. 그래서 지도 픽셀을 직접 훑어
건물만 남긴 마스크를 뽑는다.

방법: 지정한 상자 안에서 잔디·나무·모래·도로 같은 '배경' 색을 표시하고,
상자 테두리에서 배경을 따라 물을 채운다. 물이 닿지 못한 덩어리 중 가장 큰 것이
건물이다. 잔가지 구멍은 메우고, 가장자리는 한 픽셀 넓혀 톱니를 줄인다.

    python3 tools/cut_buildings.py

출력: assets/map/mask-<id>.png (지도 원본 크기, 흑백 — 흰 곳만 움직인다)
      그리고 services.json에 넣을 building 상자를 찍어준다.
"""

import sys
from collections import deque

import numpy as np
from PIL import Image

MAP = 'assets/map/town-web.jpg'
OUT = 'assets/map/mask-%s.png'

# 상자는 건물이 확실히 들어가고 테두리는 배경(잔디·길)에 닿도록 넉넉히 잡는다.
# [left, top, right, bottom] — 지도 기준 %
BOXES = {
    # 위쪽은 담장, 아래쪽은 가로등·계단을 빼려고 바짝 자른다. 아래를 자르는 건
    # 안전하다 — 변형 기준점이 상자 밑변이라 거기서는 아무것도 움직이지 않는다.
    'museum': [9.5, 4.2, 27.0, 21.6],
    'school': [42.0, 1.2, 66.3, 24.8],
}


def is_background(rgb):
    """잔디·나무·덤불·모래·도로·하늘이면 True. 건물 몸통이면 False."""
    r, g, b = rgb[..., 0].astype(int), rgb[..., 1].astype(int), rgb[..., 2].astype(int)

    green = (g > r + 8) & (g > b + 20) & (g > 90)              # 잔디·나무·덤불
    # 누런 덤불 (담장 옆). g >= r - 25 조건이 없으면 학교의 주황 기와까지 먹는다
    olive = (g >= b + 25) & (g > 90) & (r < 230) & (g >= r - 25)
    sand = (r > 195) & (g > 175) & (b < 175) & (r - b > 45)     # 운동장 모래·흙길
    # 아스팔트. b > g + 5가 없으면 미술관 유리벽(청록, b≈g)까지 도로로 본다
    road = (b - r >= 14) & (b - r <= 55) & (r >= 130) & (r <= 210) & (b > g + 5)
    pink = (r > 165) & (r - g >= 18) & (b + 8 >= g)             # 벚꽃 (그늘진 곳까지)
    return green | olive | sand | road | pink


def flood_from_border(bg):
    """상자 테두리에서 배경을 따라 채운다. 4방향이면 대각선 틈으로 새지 않는다."""
    h, w = bg.shape
    seen = np.zeros_like(bg)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if bg[y, x] and not seen[y, x]:
                seen[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if bg[y, x] and not seen[y, x]:
                seen[y, x] = True
                q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and bg[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                q.append((ny, nx))
    return seen


def largest_blob(mask):
    """가장 큰 연결 덩어리만 남긴다 — 건물에서 떨어져 나온 부스러기를 턴다."""
    h, w = mask.shape
    label = np.zeros(mask.shape, dtype=np.int32)
    best, best_n, cur = None, 0, 0
    for sy in range(h):
        for sx in range(w):
            if not mask[sy, sx] or label[sy, sx]:
                continue
            cur += 1
            n = 0
            q = deque([(sy, sx)])
            label[sy, sx] = cur
            while q:
                y, x = q.popleft()
                n += 1
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        ny, nx = y + dy, x + dx
                        if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not label[ny, nx]:
                            label[ny, nx] = cur
                            q.append((ny, nx))
            if n > best_n:
                best, best_n = cur, n
    return (label == best) if best else mask


def fill_holes(mask):
    """건물 안쪽에 뚫린 구멍(창문 하이라이트 등)을 메운다."""
    return ~flood_from_border(~mask)


def dilate(mask, r=1):
    """가장자리를 한 픽셀 넓혀 톱니를 줄인다. np.roll은 반대편으로 감기므로
    (아래 줄이 맨 윗줄에 붙는다) 0으로 덧대고 잘라 쓴다."""
    h, w = mask.shape
    pad = np.zeros((h + 2 * r, w + 2 * r), dtype=bool)
    pad[r:r + h, r:r + w] = mask
    out = np.zeros_like(mask)
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            out |= pad[r + dy:r + dy + h, r + dx:r + dx + w]
    return out


def main():
    im = Image.open(MAP).convert('RGB')
    W, H = im.size
    arr = np.asarray(im)

    for name, (x0, y0, x1, y1) in BOXES.items():
        px0, py0 = int(x0 / 100 * W), int(y0 / 100 * H)
        px1, py1 = int(x1 / 100 * W), int(y1 / 100 * H)
        sub = arr[py0:py1, px0:px1]

        bg = is_background(sub)
        outside = flood_from_border(bg)
        blob = fill_holes(largest_blob(~outside))
        blob = dilate(blob, 1)

        ys, xs = np.nonzero(blob)
        bx0, bx1 = (px0 + xs.min()) / W * 100, (px0 + xs.max() + 1) / W * 100
        by0, by1 = (py0 + ys.min()) / H * 100, (py0 + ys.max() + 1) / H * 100

        full = np.zeros((H, W), dtype=np.uint8)
        full[py0:py1, px0:px1] = blob.astype(np.uint8) * 255
        Image.fromarray(full, mode='L').save(OUT % name, optimize=True)

        print(f'{name}: {OUT % name}  채운 픽셀 {int(blob.sum()):,}')
        print(f'  "building": [{bx0:.2f}, {by0:.2f}, {bx1 - bx0:.2f}, {by1 - by0:.2f}]')


if __name__ == '__main__':
    sys.exit(main())
