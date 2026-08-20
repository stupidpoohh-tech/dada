#!/usr/bin/env python3
"""건물·우편함 시트에서 스프라이트를 오려낸다.

**이전 버전과 하는 일이 다르다.** 예전에는 건물이 배경 지도 한 장에 그대로
그려져 있어서, 뾰옹거리게 하려면 지도를 한 번 더 깔고 그 자리만 마스크로
오려내는 수밖에 없었다(`assets/map/mask-*.png`). 지금은 건물 없는 배경
(`town-background.png`)과 건물만 따로 그린 시트(`buildings.png`)를 받으므로,
그 시트에서 건물마다 한 장씩 잘라내면 끝이다 — 마스크도, 지도를 두 번 깔아
겹치는 자리를 픽셀 단위로 맞추는 `syncPops()`도 더는 필요 없다.

방법: 알파가 있는 픽셀을 연결 요소로 묶는다(`cut_sprites.py`의 도구를 그대로
쓴다). **시트에 늘어놓은 순서가 곧 마을의 순서와 같다** — 위 줄은 마을 윗줄
(미술관·학교·성균관), 아래 줄은 나머지(회사·카페·은행·세모집). 그래서 이름을
따로 인식할 필요 없이 읽는 순서대로 배정한다.

    python3 tools/cut_buildings.py

원본 시트(assets/sprites/buildings.png · mailbox.png)는 다른 시트와 마찬가지로
.gitignore에 있다. 출력은 assets/sprites/cut/building-<구역 id>.webp ·
assets/sprites/cut/mailbox.webp.

**webp로 뽑는다.** 부드러운 그러데이션이 많은 그림이라(AI로 그린 채색이지 납작한
색면이 아니다) PNG로 뽑으면 건물 한 채에 150~270KB, 우편함 한 장에 260KB씩
붙는다 — 이 여덟 장만으로 배포 전체 무게가 두 배 가까이 뛴다. 같은 그림을
webp로 뽑으면 20~30KB대로 줄어든다(실측). 게임 안내서 슬라이드
(`game/pages/*.webp`)에서 이미 쓰던 선택이라 이 저장소에 새로 들이는 형식은 아니다.
"""
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cut_sprites import components, merge_overlapping, reading_order

OUT = 'assets/sprites/cut'

# 건물 시트에 늘어놓은 순서 — 위 줄(미술관·학교·성균관) 다음 아래 줄(회사·카페·은행·세모집).
# 공원은 건물이 없는 구역이라 시트에도 없다.
BUILDING_SRC = 'assets/sprites/buildings.png'
BUILDING_NAMES = ['museum', 'school', 'seonggyungwan', 'company', 'cafe', 'bank', 'house']

MAILBOX_SRC = 'assets/sprites/mailbox.png'


def cut(src, min_pixels=800):
    """알파가 있는 픽셀을 연결 요소로 묶어 읽는 순서(위→아래, 왼쪽→오른쪽)로 돌려준다."""
    im = Image.open(src).convert('RGBA')
    alpha = np.array(im)[:, :, 3]
    fg = alpha > 40   # 배경이 진짜 투명이라 색이 아니라 알파로 곧장 가른다
    boxes = reading_order(merge_overlapping(components(fg, min_pixels=min_pixels)))
    return im, boxes


def save_webp(im, box, path, quality=88):
    x0, y0, x1, y1, _ = box
    crop = im.crop((x0, y0, x1, y1))
    crop.save(path, 'WEBP', quality=quality, alpha_quality=quality, method=6)
    print(f'  {os.path.basename(path)}  {crop.size[0]}x{crop.size[1]}  '
          f'{os.path.getsize(path) // 1024}KB')


def main():
    ok = True

    im, boxes = cut(BUILDING_SRC)
    if len(boxes) != len(BUILDING_NAMES):
        print(f'건물 {len(boxes)}개를 찾았다 (기대 {len(BUILDING_NAMES)}개). 시트를 확인한다.')
        ok = False
    else:
        for name, box in zip(BUILDING_NAMES, boxes):
            save_webp(im, box, f'{OUT}/building-{name}.webp')
        print(f'건물 {len(BUILDING_NAMES)}채 — 읽는 순서 그대로 배정했다')

    im, boxes = cut(MAILBOX_SRC)
    if len(boxes) != 1:
        print(f'우편함 {len(boxes)}개를 찾았다 (기대 1개). 시트를 확인한다.')
        ok = False
    else:
        save_webp(im, boxes[0], f'{OUT}/mailbox.webp')

    return 0 if ok else 1


if __name__ == '__main__':
    raise SystemExit(main())
