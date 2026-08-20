#!/usr/bin/env python3
"""까마귀 Croww 시트를 잘라 마을에 쓸 스프라이트를 만든다.

`cut_sprites.py`를 그대로 못 쓰는 이유가 하나 있다. 그 스크립트는 스프라이트마다
자기 bounding box에 맞춰 따로 축소하는데, **까마귀는 여러 장을 번갈아 보여주는
프레임이라 장끼리 눈금과 자리가 어긋나면 안 된다.** 날개를 편 장은 상자가 더 크므로
각자 높이를 맞추면 몸통 크기가 장마다 달라지고, 바꿔 끼울 때 새가 커졌다 작아진다.

그래서 여기서는 **배율을 하나로 쓰고, 같은 크기 캔버스에 같은 기준점으로 얹는다.**
기준점은 부리 끝(가장 왼쪽 픽셀)과 눈높이다 — 앉은 장과 나는 장은 발이 서로 다른
자리에 있어서(나는 장은 다리가 뒤로 접힌다) 발을 기준으로 삼을 수 없다.

    python3 tools/cut_crow.py

원본 시트(assets/sprites/crow.png)는 .gitignore에 있다. 배포 저장소에 두지 않는다.
"""
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cut_sprites import background_mask, components, merge_overlapping, reading_order

SRC = 'assets/sprites/crow.png'
OUT = 'assets/sprites/cut'
# 시트 읽는 순서 — 윗줄 왼쪽부터
NAMES = ['crow-side', 'crow-front', 'crow-fly',
         'crow-back', 'crow-front-tilt', 'crow-look']
# 마을에 쓰는 것만 같은 캔버스에 얹는다 (프레임끼리 자리가 맞아야 하는 것들)
FRAMES = ['crow-side', 'crow-fly', 'crow-look']   # 기본 · 퍼덕 · 갸웃
BODY_H = 96          # 앉은 장의 몸 높이(px)를 이 값에 맞춘다. 나머지는 같은 배율


def anchor(sprite):
    """눈의 한가운데. 두 장을 겹칠 때 이 점을 포갠다.

    부리 끝을 기준으로 삼아 봤더니 장마다 부리가 몸에서 나온 정도가 달라
    갈아 끼울 때 몸이 옆으로 미끄러졌다. **눈은 어느 장에서나 같은 것**이라
    여기에 맞추면 머리가 제자리에 있고 나머지(날개 · 꼬리 · 자세)만 바뀐다.

    눈은 온몸에서 유일하게 밝은 크림색이라 색으로 바로 찾을 수 있다."""
    a = np.array(sprite)
    eye = (a[:, :, 3] > 8) & (a[:, :, :3].min(axis=2) > 170)
    if not eye.any():
        raise SystemExit('눈을 못 찾았다 — 시트 색이 바뀌었는지 확인한다')
    ys, xs = np.where(eye)
    return int(round(xs.mean())), int(round(ys.mean()))


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

    # 배율은 앉은 장 하나로 정하고 전부에 같은 값을 쓴다
    scale = BODY_H / cut['crow-side'].size[1]
    for n, s in cut.items():
        cut[n] = s.resize((max(1, round(s.width * scale)), max(1, round(s.height * scale))),
                          Image.LANCZOS)

    # 프레임들을 같은 캔버스에 같은 기준점으로 얹는다
    anchors = {n: anchor(cut[n]) for n in FRAMES}
    left = max(a[0] for a in anchors.values())
    top = max(a[1] for a in anchors.values())
    W = left + max(cut[n].width - anchors[n][0] for n in FRAMES)
    H = top + max(cut[n].height - anchors[n][1] for n in FRAMES)

    # 실제로 쓰는 장만 저장한다 — cut/ 은 「지금 쓰는 것」만 두는 자리다.
    # 시트에는 앞모습·뒷모습·앞갸웃도 있다. 쓸 일이 생기면 FRAMES에 이름을 더한다.
    for n in FRAMES:
        canvas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        canvas.paste(cut[n], (left - anchors[n][0], top - anchors[n][1]))
        canvas.save(f'{OUT}/{n}.png', optimize=True)
        print(f'  {n}.png {W}x{H} {os.path.getsize(f"{OUT}/{n}.png") // 1024}KB')
    print(f'까마귀 프레임 {len(FRAMES)}장 — 모두 {W}x{H} 한 캔버스, 같은 배율·같은 기준점')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
