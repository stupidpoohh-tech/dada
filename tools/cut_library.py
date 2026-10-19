#!/usr/bin/env python3
"""도서관 건물 한 채를 오려낸다 (`library.png` → `building-library.webp`).

**`cut_buildings.py`를 못 쓴다.** 그쪽은 일곱 채를 한 시트에 늘어놓고 **읽는 순서로**
이름을 배정하는 도구다. 도서관은 나중에 혼자 들어온 그림이라 시트에 자리가 없고,
억지로 끼워 넣으면 순서가 밀려 나머지 여섯 채의 이름이 전부 어긋난다.
그래서 한 장짜리 전용 도구를 따로 둔다 — 채도와 저장 방식은 그쪽 것을 그대로 쓴다.

    python3 tools/cut_library.py

원본(`library.png`)은 다원님이 GitHub 웹으로 올리는 자리가 저장소 루트라 거기 있다.
**루트는 통째로 배포되므로 `.assetsignore`에 적어 둔다** — 1.7MB짜리가 `/library.png`로
그냥 받아져 나가고 있으면 아무도 모른다(`/me-front.png`·`/sign.png`와 같은 함정).

**가로 420px로 줄여서 뽑는다.** 받은 것은 1254px인데 마을에서 쓰는 폭은 지도의 14%쯤
이라 그만큼이 갈 일이 없다. 다른 건물들이 285~544px 사이이므로 같은 또렷함으로 맞춘다.

**채도는 0.55다 — 다른 건물(0.75)보다 더 깎는다.** 책 표지의 붉은색과 금색이라
받은 그대로는 채도가 0.713인데, 마을 일곱 채의 평균은 0.306이고 그중 가장 따뜻한
카페가 0.420이다. 0.75를 곱해도 0.539로 **카페보다 1.3배 높아** 혼자 쨍하게 도드라진다
(실측). 0.55를 곱하면 0.397 — 평균과 카페 사이에 앉아, 따뜻하되 이 마을 것으로 읽힌다.

**밝기는 안 건드린다.** `desaturate`는 V를 그대로 두는데, 이 그림의 밝기(158)가
이미 카페(159)와 같은 자리다. 더 올리면 책 표지의 깊이가 날아간다.
"""
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cut_buildings import desaturate

SRC = 'library.png'
OUT = 'assets/sprites/cut/building-library.webp'
WIDTH = 420
QUALITY = 88
# 채도 배율 — 머리말 참고. 다른 건물(cut_buildings.py)은 0.75다
SATURATION = 0.55


def main():
    if not os.path.exists(SRC):
        print(f'{SRC}가 없다. 배포 브랜치에서 받아 온다 — README 「편집용 원본」.')
        return 1

    im = Image.open(SRC).convert('RGBA')
    box = im.getbbox()                      # 알파가 0인 테두리를 걷는다
    crop = im.crop(box)
    h = round(crop.height * WIDTH / crop.width)
    crop = crop.resize((WIDTH, h), Image.LANCZOS)
    crop = desaturate(crop, SATURATION)     # 배경의 순한 초록 위에서 혼자 쨍하지 않게
    crop.save(OUT, 'WEBP', quality=QUALITY, alpha_quality=QUALITY, method=6)
    print(f'  {os.path.basename(OUT)}  {crop.size[0]}x{crop.size[1]}  '
          f'{os.path.getsize(OUT) // 1024}KB')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
