#!/usr/bin/env python3
"""날개 달린 쪽지 시트를 잘라 마을에 쓸 프레임을 만든다.

`cut_sprites.py`를 그대로 못 쓰는 이유는 `cut_crow.py`와 같다 — 그 스크립트는
스프라이트마다 자기 bounding box에 맞춰 따로 축소하는데, **번갈아 보여주는
프레임은 장끼리 눈금과 자리가 어긋나면 안 된다.** 날개를 크게 편 장은 상자가 더
크므로 각자 높이를 맞추면 쪽지가 장마다 커졌다 작아진다.

**기준점은 종이다.** 날개는 장마다 자리가 크게 바뀌지만 종이는 거의 그대로다.
종이만 골라내는 방법은 색이다 — 종이는 크림색(R이 B보다 확실히 높다)이고
날개는 흰색(R·G·B가 나란히 높다)이라 `R - B`로 갈린다.

    pip install pillow numpy
    python3 tools/cut_note.py

원본 시트(assets/sprites/note.png)는 다른 시트와 마찬가지로 .gitignore에 있다.
"""
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cut_sprites import background_mask, components, merge_overlapping, reading_order

SRC = 'assets/sprites/note.png'
OUT = 'assets/sprites/cut'
# 시트 읽는 순서 — 윗줄 왼쪽부터
NAMES = ['note-1', 'note-2', 'note-3', 'note-4', 'note-5', 'note-6']
# 마을에 쓰는 세 장 (아래 FRAMES에서 어느 자세를 쓸지 고른다)
FRAMES = {'note-down': 'note-2', 'note-mid': 'note-6', 'note-up': 'note-3'}
PAPER_H = 92          # 종이 높이(px)를 이 값에 맞춘다. 배율은 전 장이 같다


def paper_mask(sprite):
    """종이 픽셀만. 크림색은 R이 B보다 확실히 높고, 흰 날개는 그렇지 않다."""
    a = np.array(sprite)
    rgb, alpha = a[:, :, :3].astype(np.int16), a[:, :, 3]
    return (alpha > 8) & (rgb[:, :, 0] - rgb[:, :, 2] > 28) & (rgb[:, :, 0] > 150)


def main():
    im = Image.open(SRC)
    rgb = np.array(im.convert('RGB'))
    bg = background_mask(rgb)
    boxes = reading_order(merge_overlapping(components(~bg)))
    if len(boxes) != len(NAMES):
        print(f'스프라이트 {len(boxes)}개를 찾았다 (기대 {len(NAMES)}개). 시트를 확인한다.')
        return 1

    full = Image.fromarray(np.dstack([rgb, np.where(bg, 0, 255).astype(np.uint8)]), 'RGBA')
    cut = {n: full.crop(b[:4]) for n, b in zip(NAMES, boxes)}

    # 배율은 첫 장의 종이 높이 하나로 정하고 전부에 같은 값을 쓴다
    ys = np.where(paper_mask(cut[NAMES[0]]).any(axis=1))[0]
    scale = PAPER_H / (ys.max() - ys.min() + 1)
    for n, s in cut.items():
        cut[n] = s.resize((max(1, round(s.width * scale)), max(1, round(s.height * scale))),
                          Image.LANCZOS)

    # 종이 한가운데를 포개 놓는다 — 날개만 바뀌고 쪽지는 제자리에 있어야 한다
    anchors = {}
    for role, n in FRAMES.items():
        m = paper_mask(cut[n])
        if not m.any():
            print(f'{n}: 종이를 못 찾았다 — 시트 색이 바뀌었는지 확인한다.')
            return 1
        yy, xx = np.where(m)
        anchors[role] = (round(xx.mean()), round(yy.mean()))

    left = max(a[0] for a in anchors.values())
    top = max(a[1] for a in anchors.values())
    W = left + max(cut[FRAMES[r]].width - anchors[r][0] for r in FRAMES)
    H = top + max(cut[FRAMES[r]].height - anchors[r][1] for r in FRAMES)

    for role, n in FRAMES.items():
        canvas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        canvas.paste(cut[n], (left - anchors[role][0], top - anchors[role][1]))
        path = f'{OUT}/{role}.png'
        canvas.save(path, optimize=True)
        print(f'  {role}.png  ({n})  {W}x{H}  {os.path.getsize(path) // 1024}KB')
    print(f'쪽지 프레임 {len(FRAMES)}장 — 모두 {W}x{H} 한 캔버스, 같은 배율·같은 기준점')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
