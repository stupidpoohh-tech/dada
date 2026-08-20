#!/usr/bin/env python3
"""까마귀 Croww 스프라이트를 만든다 — assets/sprites/cut/crow-side.png · crow-flap.png

Playgrown의 마스코트다. 다른 스프라이트는 그려진 시트에서 잘라 오지만(cut_sprites.py)
이건 원본 시트가 레포에 없어 도형으로 짓는다. 저해상도(38x30)로 그린 뒤 3배로 확대해
마을의 다른 새(78x64 남짓)와 같은 눈금에 맞춘다 — 확대는 NEAREST라 픽셀이 뭉개지지 않는다.

비율은 참조 시트를 따랐다 — 둥근 머리, 짧은 쐐기 부리, 뒤로 쓸리는 꼬리, 정수리 깃 한 가닥.
두 장인 이유는 날갯짓 때문이다. 이 마을에는 프레임 애니메이션이 없어서(CSS transform만
쓴다) 퍼덕임은 두 장을 번갈아 보여 만든다 — styles.css의 crow-frame.

    pip install pillow
    python3 tools/draw_crow.py
"""
import pathlib
from PIL import Image, ImageDraw

W, H, S = 38, 30, 3
OUT   = (26, 26, 30, 255)
BODY  = (48, 48, 54, 255)
LIGHT = (60, 60, 67, 255)
WING  = (35, 35, 40, 255)
WINGD = (29, 29, 34, 255)
BEAK  = (112, 112, 118, 255)
BEAKD = (84, 84, 90, 255)
EYE   = (245, 240, 229, 255)
FOOT  = (70, 70, 75, 255)
SP = str(pathlib.Path(__file__).resolve().parent.parent / 'assets/sprites/cut')


def draw(flap=False):
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    # 다리 — 몸통보다 먼저 깔아 발목이 배 밑으로 들어가게
    for x in (15, 19):
        d.rectangle([x, 20, x + 1, 25], fill=FOOT)
    d.rectangle([13, 26, 16, 26], fill=FOOT)
    d.rectangle([18, 26, 21, 26], fill=FOOT)

    # 꼬리 — 뒤로 쓸리며 끝이 계단으로 갈라진다
    d.polygon([(22, 12), (36, 15), (37, 17), (35, 18), (22, 19)], fill=WINGD)
    d.polygon([(23, 13), (33, 16), (23, 18)], fill=WING)

    # 몸통 — 통통한 타원
    d.ellipse([9, 9, 26, 23], fill=BODY)
    # 가슴 하이라이트
    d.ellipse([10, 12, 18, 21], fill=LIGHT)

    # 머리 — 몸통 위에 얹힌 동그라미
    d.ellipse([7, 3, 19, 15], fill=BODY)
    d.ellipse([8, 5, 15, 12], fill=LIGHT)
    # 정수리 깃 한 가닥
    d.polygon([(12, 3), (13, 0), (15, 3)], fill=BODY)

    if flap:
        # 편 날개 — 등 위로 두 겹, 끝을 계단으로
        d.polygon([(17, 12), (27, 2), (31, 4), (22, 15)], fill=WING)
        d.polygon([(30, 3), (34, 5), (30, 6)], fill=WING)
        d.polygon([(18, 14), (28, 7), (31, 10), (22, 17)], fill=WINGD)
    else:
        # 접은 날개 — 몸통에 붙어 뒤로 뾰족해진다
        d.polygon([(14, 12), (25, 14), (28, 18), (22, 21), (14, 19)], fill=WING)
        d.line([(17, 15), (25, 17)], fill=WINGD)
        d.line([(16, 18), (24, 19)], fill=WINGD)

    # 부리 — 짧은 쐐기
    d.polygon([(10, 8), (2, 11), (10, 13)], fill=BEAK)
    d.polygon([(10, 11), (3, 11), (10, 13)], fill=BEAKD)
    # 눈
    d.ellipse([10, 6, 13, 9], fill=EYE)
    return im


def outline(im):
    """알파를 한 겹 부풀려 어두운 테두리를 두른다 — 지도 위에서 형체가 서게."""
    a = im.split()[3]
    out = im.copy(); o = out.load()
    for y in range(H):
        for x in range(W):
            if a.getpixel((x, y)) > 0:
                continue
            if any(0 <= x + dx < W and 0 <= y + dy < H and a.getpixel((x + dx, y + dy)) > 0
                   for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                o[x, y] = OUT
    return out


for name, flap in (('crow-side', False), ('crow-flap', True)):
    im = outline(draw(flap))
    im.resize((W * S, H * S), Image.NEAREST).save(f'{SP}/{name}.png')
print('ok')
