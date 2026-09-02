#!/usr/bin/env python3
"""물고기 시트를 잘라 강에 넣을 **프레임 세 장**을 만든다.

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
4. 시트의 네 자세는 한 마리의 **자세 넷**이지 물고기 넷이 아니다. 마을에서는
   헤엄칠 때 옆모습, 솟구칠 때 곧추선 모습, 꼭대기에서 기운 모습으로 갈아
   끼우므로 — 까마귀와 같은 규칙이다 — **같은 크기 캔버스에 같은 기준점으로**
   얹어야 갈아 끼울 때 물고기가 튀지 않는다.

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
# CSS가 좌우를 뒤집는다 — 뒤집힌 그림을 따로 저장하지 않는다.
NAMES = ['fish-side', 'fish-tilt', 'fish-slant', 'fish-up']
# 마을이 실제로 갈아 끼우는 세 장만 저장한다 (`cut/`은 「지금 쓰는 것」만 두는 자리다).
# 남는 fish-slant는 기운 정도가 fish-tilt와 겹쳐서 쓰지 않는다 — 쓸 일이 생기면
# 여기 이름을 더하면 그 장도 같은 캔버스로 나온다.
FRAMES = ['fish-side', 'fish-tilt', 'fish-up']
# 몸 길이(주둥이 끝 ~ 꼬리 끝)를 이 픽셀에 맞춘다.
#
# **이 시트에서는 줄이지 않는다.** 다른 스프라이트는 「보이는 크기의 2배」로 줄여
# 두는데, 물고기는 제일 큰 자세가 시트에서 173px밖에 안 된다 — 마을에 서는 크기가
# 데스크톱에서 51x52px(까마귀와 같다)이니 고밀도 화면에서는 이미 2배를 겨우 채운다.
# 여기서 더 줄이면 뭉개고, 늘려 봐야 없는 정보를 만드는 것이라 흐려지기만 한다.
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
        raise SystemExit(f'자세를 {len(found)}개 찾았다 — {len(NAMES)}개여야 한다')
    order = {b: m for b, m in found}
    boxes = reading_order([b for b, _ in found])

    # 넷을 같은 배율로 줄인다. 제일 긴 자세가 BODY_LEN이 되게 잡아, 나머지는
    # 그림에 그려진 크기 차이를 그대로 지킨다
    scale = BODY_LEN / max(body_len(b) for b in boxes)

    cut = {}
    for name, box in zip(NAMES, boxes):
        x0, y0, x1, y1, _ = box
        # 이 몸통에서 옆으로 번진 자락은 그대로 두되(가장자리가 부드러워야 한다),
        # 상자 안에 들어온 **다른 자세**는 지운다. 제 몸에서 3px까지만 남긴다
        mine = np.where(grow(order[box], 3), alpha, 0).astype(np.uint8)
        sp = Image.fromarray(np.dstack([rgb, mine]), 'RGBA').crop((x0, y0, x1, y1))
        w, h = sp.size
        cut[name] = sp.resize((max(1, round(w * scale)), max(1, round(h * scale))),
                              Image.LANCZOS)

    """기준점은 **밑변 가운데**다.

    까마귀는 눈에 맞췄는데(어느 장에서나 같은 것이라서), 물고기는 자세가 바뀌는
    이유 자체가 다르다 — 헤엄치던 놈이 몸을 세우는 것이라 **꼬리는 물에 있고
    머리가 올라간다.** 그러니 포개야 할 것은 눈이 아니라 물에 닿는 자리다.
    밑변을 맞추면 갈아 끼우는 순간 물낯이 안 흔들리고, 가로 가운데를 맞추면
    몸이 옆으로 미끄러지지 않는다."""
    anchors = {n: (centroid_x(cut[n]), cut[n].height) for n in FRAMES}
    left = max(a[0] for a in anchors.values())
    W = left + max(cut[n].width - anchors[n][0] for n in FRAMES)
    H = max(cut[n].height for n in FRAMES)

    for n in FRAMES:
        canvas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        canvas.paste(cut[n], (left - anchors[n][0], H - cut[n].height))
        out = f'{OUT}/{n}.png'
        canvas.save(out, optimize=True)
        print(f'  {n}.png {W}x{H} {os.path.getsize(out) // 1024}KB')
    print(f'물고기 자세 {len(FRAMES)}장 — 모두 {W}x{H} 한 캔버스, 같은 배율·같은 밑변')


def centroid_x(sprite):
    """몸통의 가로 한가운데. 꼬리 끝 한 점으로 잡으면 자세마다 꼬리가 몸에서
    나온 정도가 달라 갈아 끼울 때 몸이 옆으로 미끄러진다."""
    a = np.array(sprite)
    xs = np.where(a[:, :, 3] > 40)[1]
    return int(round(xs.mean()))


if __name__ == '__main__':
    main()
