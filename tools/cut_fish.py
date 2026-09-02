#!/usr/bin/env python3
"""물고기 시트를 잘라 강에 넣을 스프라이트를 만든다.

`cut_sprites.py`의 SHEETS에 한 줄 더하지 않고 따로 둔 이유가 둘 있다.

1. **네 마리가 서로 다른 기울기로 그려져 있다.** bounding box에 맞춰 각자
   축소하면 비스듬한 놈은 상자가 커서 몸이 작아진다 — 같은 강에 나란히
   띄우면 크기가 제각각으로 보인다. 그래서 **몸 길이(대각선)를 재서
   그것을 기준으로 배율을 하나로 잡는다.**
2. 시트 배경이 짙은 남색인데 **물고기 테두리와 눈동자도 같은 계열**이라,
   있고 없고로 자르면 테두리가 갉히거나(여유값을 넓게) 배경 얼룩이 남는다
   (좁게). 여기서는 **바깥쪽만 flood fill로 골라 놓고, 그 안에서 배경색과
   얼마나 다른지에 따라 알파를 0~255로 눕힌다** — 테두리는 살고 가장자리는
   부드럽게 남는다. 눈동자는 바깥과 이어져 있지 않으므로 건드려지지 않는다.
3. **비스듬한 놈끼리는 상자가 겹친다.** 오른쪽 위·아래 두 마리가 8px 겹쳐서
   `merge_overlapping`을 태우면 한 마리로 합쳐지고(넷이 셋이 된다), 상자대로
   잘라내면 옆 물고기의 꼬리가 같이 딸려 온다. 그래서 상자가 아니라
   **연결 요소(몸통 하나)별 마스크로** 떠낸다.

    python3 tools/cut_fish.py

원본 시트(assets/sprites/fish.png)는 .gitignore에 있다 — 배포 저장소에
두지 않는다. 없으면 이력에서 꺼낸다 (README 「편집용 원본」).
"""
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cut_sprites import background_mask, reading_order

SRC = 'assets/sprites/fish.png'
OUT = 'assets/sprites/cut'
# 읽는 순서(윗줄 왼쪽부터)대로. 넷 다 왼쪽을 보고 있어서, 오른쪽으로 헤엄칠 때는
# app.js가 좌우를 뒤집는다 — 뒤집힌 그림을 따로 저장하지 않는다.
NAMES = ['fish-1', 'fish-2', 'fish-3', 'fish-4']
# 몸 길이(주둥이 끝 ~ 꼬리 끝)를 이 픽셀에 맞춘다.
#
# **이 시트에서는 줄이지 않는다.** 다른 스프라이트는 「보이는 크기의 2배」로 줄여
# 두는데, 물고기는 마을에서 제일 큰 놈이 시트에서 173px밖에 안 된다 — 뛰어오르는
# 물고기가 데스크톱에서 29x43px이니 고밀도 화면에서는 이미 2배를 겨우 채운다.
# 여기서 더 줄이면 낚시 표식으로 쓸 만큼 키웠을 때 뭉갠다. 늘리지도 않는다
# (없는 정보를 만들어 내는 것이라 흐려지기만 한다) — 시트 그대로가 상한이다.
BODY_LEN = 173


def soft_alpha(rgb, outside, lo=6, hi=26):
    """바깥으로 판정된 자리의 알파를 배경색과의 거리로 눕힌다.

    테두리 한 겹을 통째로 남기거나 통째로 지우는 대신, 배경색에 가까울수록
    투명하게 만든다. 강물 위에 얹었을 때 **네모난 테두리 자국이 안 남는 것**이
    목적이다 — 있고 없고로만 자르면 물고기 둘레에 남색 실선이 남는다."""
    corner = np.median(np.array([rgb[0, 0], rgb[0, -1], rgb[-1, 0], rgb[-1, -1]],
                                dtype=np.int16), axis=0)
    dist = np.abs(rgb.astype(np.int16) - corner).max(axis=2)
    ramp = np.clip((dist - lo) / (hi - lo), 0, 1) * 255
    return np.where(outside, ramp, 255).astype(np.uint8)


def pieces(mask, min_pixels=400):
    """알파가 있는 영역을 몸통 하나씩(연결 요소) 떼어 (상자, 마스크)로 돌려준다.

    `cut_sprites.components`는 상자만 주는데, 여기서는 겹친 상자에서 옆 물고기를
    지워야 해서 **어느 픽셀이 이 몸통인지**를 알아야 한다."""
    from collections import deque
    h, w = mask.shape
    seen = np.zeros((h, w), dtype=bool)
    out = []
    for sy in range(h):
        for sx in range(w):
            if not mask[sy, sx] or seen[sy, sx]:
                continue
            q = deque([(sy, sx)])
            seen[sy, sx] = True
            here = np.zeros((h, w), dtype=bool)
            here[sy, sx] = True
            y0 = y1 = sy
            x0 = x1 = sx
            n = 0
            while q:
                y, x = q.popleft()
                n += 1
                y0, y1 = min(y0, y), max(y1, y)
                x0, x1 = min(x0, x), max(x1, x)
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        ny, nx = y + dy, x + dx
                        if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                            seen[ny, nx] = True
                            here[ny, nx] = True
                            q.append((ny, nx))
            if n >= min_pixels:
                out.append(((x0, y0, x1 + 1, y1 + 1, n), here))
    return out


def grow(mask, r):
    """마스크를 r픽셀 부풀린다. 몸통 둘레의 옅은 가장자리를 함께 남기기 위한 것."""
    out = mask.copy()
    for _ in range(r):
        g = out.copy()
        g[1:, :] |= out[:-1, :]
        g[:-1, :] |= out[1:, :]
        g[:, 1:] |= out[:, :-1]
        g[:, :-1] |= out[:, 1:]
        out = g
    return out


def body_len(box):
    """상자의 대각선. 기울어진 물고기는 상자가 커지므로 폭이나 높이만으로는
    크기를 맞출 수 없다 — 몸이 상자를 가로지르는 길이가 곧 몸 길이다."""
    x0, y0, x1, y1, _ = box
    return ((x1 - x0) ** 2 + (y1 - y0) ** 2) ** 0.5


def main():
    if not os.path.exists(SRC):
        raise SystemExit(f'{SRC}가 없다 — README 「편집용 원본」 참고')

    rgb = np.array(Image.open(SRC).convert('RGB'))
    bg = background_mask(rgb, tol=26)
    alpha = soft_alpha(rgb, bg)
    # 몸통을 셀 때는 「거의 다 비친 자리」를 배경으로 본다 — 가장자리의 옅은
    # 알파까지 몸으로 세면 그림자 자락을 타고 옆 물고기와 이어져 버린다
    found = pieces(alpha > 64)
    if len(found) != len(NAMES):
        raise SystemExit(f'물고기를 {len(found)}마리 찾았다 — {len(NAMES)}마리여야 한다')
    order = {b: m for b, m in found}
    boxes = reading_order([b for b, _ in found])

    # 넷을 같은 배율로 줄인다. 제일 긴 놈이 BODY_LEN이 되게 잡아, 나머지는
    # 그림에 그려진 크기 차이(같은 무리 안의 큰 놈 · 작은 놈)를 그대로 지킨다.
    scale = BODY_LEN / max(body_len(b) for b in boxes)

    for name, box in zip(NAMES, boxes):
        x0, y0, x1, y1, _ = box
        # 이 몸통만 남긴다 — 상자 안에 들어온 옆 물고기 꼬리는 투명으로 지운다
        # 이 몸통에서 옆으로 번진 자락은 그대로 두되(가장자리가 부드러워야 한다),
        # 상자 안에 들어온 **다른 물고기**는 지운다. 제 몸에서 3px까지만 남긴다
        near = grow(order[box], 3)
        mine = np.where(near, alpha, 0).astype(np.uint8)
        sprite = Image.fromarray(np.dstack([rgb, mine]), 'RGBA').crop((x0, y0, x1, y1))
        w, h = sprite.size
        sprite = sprite.resize((max(1, round(w * scale)), max(1, round(h * scale))),
                               Image.LANCZOS)
        out = f'{OUT}/{name}.png'
        sprite.save(out, optimize=True)
        print(f'{name}.png {sprite.size[0]}x{sprite.size[1]} '
              f'{os.path.getsize(out) // 1024}KB')


if __name__ == '__main__':
    main()
