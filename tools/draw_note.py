#!/usr/bin/env python3
"""날개 달린 쪽지 스프라이트 — assets/sprites/cut/note-down · note-mid · note-up

**임시 그림이다.** 받은 시트가 아직 없어 도형으로 지었다. 원본 시트가 들어오면
`cut_crow.py`와 같은 방식으로 잘라 같은 이름 세 장으로 갈아 끼우면 된다 —
크기·자리·박자는 전부 services.json과 CSS가 잡으므로 코드는 안 건드린다.

8배로 그린 뒤 저해상도로 줄이고 팔레트로 스냅한다. 부드러운 실루엣과 또렷한 픽셀을
동시에 얻는 방법이다. 세 장은 같은 캔버스라 갈아 끼울 때 쪽지가 튀지 않는다.

    pip install pillow
    python3 tools/draw_note.py
"""
import math
from PIL import Image, ImageDraw

import pathlib
SP = str(pathlib.Path(__file__).resolve().parent.parent / 'assets/sprites/cut')
LW, LH, K, S = 58, 40, 8, 3
W, H = LW * K, LH * K

PAPER   = (243, 228, 191, 255)
PAPER_D = (228, 208, 162, 255)
EDGE    = (196, 168, 118, 255)
TOP     = (120, 88, 54, 255)
INK     = (170, 133, 80, 255)
WING    = (255, 255, 255, 255)
WING_D  = (226, 236, 247, 255)
WING_L  = (120, 149, 187, 255)
PALETTE = [PAPER, PAPER_D, EDGE, TOP, INK, WING, WING_D, WING_L]

PL, PR, PT, PB = 21, 38, 5, 34     # 종이 상자 (저해상도 단위)
SHOULDER = 15


def shrink(pts, k):
    cx = sum(p[0] for p in pts) / len(pts)
    cy = sum(p[1] for p in pts) / len(pts)
    return [(cx + (x - cx) * k, cy + (y - cy) * k) for x, y in pts]


def wing():
    """오른쪽으로 뻗은 날개.

    테두리는 도형을 채운 뒤 **윤곽선을 따라 한 번 긋는다.** 안쪽으로 줄인 도형을
    덧칠하는 방법은 깃처럼 오목한 모양에서 안쪽이 얇아져 텅 빈 고리가 된다."""
    w, h = 23 * K, 14 * K
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    out = [(.03, .48), (.14, .18), (.40, .05), (.70, .07), (.97, .26),
           (.80, .44), (.90, .56), (.58, .54), (.60, .82),
           (.34, .58), (.28, .86), (.10, .66)]
    P = [(x * w, y * h) for x, y in out]
    d.polygon(P, fill=WING)
    d.line(P + [P[0]], fill=WING_L, width=round(K * 1.0), joint='curve')
    return im


def paper():
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    x0, x1, y0, y1 = PL * K, PR * K, PT * K, PB * K
    wav = lambda t: math.sin(t * math.pi * 1.8 + .5) * (1.1 * K)
    n = 26
    left = [(x0 + wav(i / n), y0 + (y1 - y0) * i / n) for i in range(n + 1)]
    right = [(x1 + wav(i / n + .4), y0 + (y1 - y0) * i / n) for i in range(n, -1, -1)]
    P = left + right
    d.polygon(P, fill=EDGE)
    d.polygon(shrink(P, .93), fill=PAPER)
    # 오른쪽 안쪽 그늘 — 종이가 말려 보인다
    d.line([(p[0] - 1.6 * K, p[1]) for p in right[2:-2]], fill=PAPER_D, width=round(K * 1.3))
    # 윗변 갈색 띠 — 찢어낸 자리
    band = left[:5] + [(x1 + wav(.4), y0), (x1 + wav(.5), y0 + 2.0 * K),
                       (x0 + wav(.16), y0 + 2.6 * K)]
    d.polygon(band, fill=TOP)
    # 글씨 — 물결 네 줄
    for yy in (12, 17, 22, 27):
        pts = [(x0 + 2.6 * K + t * .42 * K, yy * K + math.sin(t * .6) * .45 * K)
               for t in range(25)]
        d.line(pts, fill=INK, width=round(K * .5))
    return im


def frame(angle, tilt, lift):
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    wr = wing().rotate(angle, resample=Image.BICUBIC, expand=True)
    wl = wing().transpose(Image.FLIP_LEFT_RIGHT).rotate(-angle, resample=Image.BICUBIC, expand=True)
    im.alpha_composite(wl, (PL * K - wl.width + round(2.5 * K),
                            (SHOULDER + lift) * K - wl.height // 2))
    im.alpha_composite(wr, (PR * K - round(2.5 * K),
                            (SHOULDER + lift) * K - wr.height // 2))
    im.alpha_composite(paper().rotate(tilt, resample=Image.BICUBIC, center=(26 * K, 19 * K)))
    return im


def snap(im):
    small = im.resize((LW, LH), Image.LANCZOS)
    px = small.load()
    for y in range(LH):
        for x in range(LW):
            r, g, b, a = px[x, y]
            if a < 120:
                px[x, y] = (0, 0, 0, 0); continue
            px[x, y] = min(PALETTE, key=lambda c: (c[0]-r)**2 + (c[1]-g)**2 + (c[2]-b)**2)
    return small


FRAMES = {'note-down': (-44, -3, 3), 'note-mid': (-4, 2, 0), 'note-up': (38, -2, -2)}
for name, (a, t, l) in FRAMES.items():
    snap(frame(a, t, l)).resize((LW * S, LH * S), Image.NEAREST).save(f'{SP}/{name}.png')
print('ok')
