#!/usr/bin/env python3
"""다원의 뒷모습을 잘라 앞모습(me.png)과 **겹쳐도 되는 한 장**으로 만든다.

첫 방문 안내에서 「탐험하기」를 고르면 다원이 돌아서서 제자리로 걸어간다.
그때 앞모습과 뒷모습이 0.16초 크로스페이드로 갈리는데, 두 장이 **같은 캔버스에
같은 기준으로 얹혀 있지 않으면 돌아설 때 키가 튀거나 발이 어긋난다.**

그래서 여기서 하는 일은 세 가지뿐이다.

  ① 알파 상자로 바짝 자른다 — 올려 주신 원본(1212x1298)은 둘레가 거의 다 빈칸이다
  ② **높이를 앞모습에 맞춘다**(지금 558px). 가로세로 비가 거의 같아서
     (앞 423/558=0.758, 뒤 661/895=0.738) 억지로 늘이지 않고 높이만 맞추면 된다
  ③ 앞모습과 같은 캔버스에 **가로 가운데·아래 맞춤**으로 얹는다 — 발이 같은 줄에 서야 한다

크기를 여기 박아 두지 않고 **앞모습에서 읽어 온다.** 앞모습이 커지면(2026-08-27에
98x130 → 423x558로 다시 떴다) 뒷모습도 따라 커져야 하는데, 두 곳에 적어 두면 한쪽만
고쳐져 돌아설 때 키가 튄다. 그러니 앞모습을 다시 뜬 뒤에는 **이것도 다시 돌린다**:

    python3 tools/cut_me.py && python3 tools/cut_me_back.py

맞았는지는 두 장을 반씩 겹쳐 보면 안다. 머리·옷깃·치맛단·발이 같은 줄에 오면 된다.

    python3 tools/cut_me_back.py

원본(me-back.png)은 저장소 루트에 있다. 다원님이 GitHub 웹으로 올리는 자리가
거기라서다 — **지우지 않고 `.assetsignore`로 배포에서만 뺀다**(town-background.png와
같은 규칙). 루트에 둔 채로 두면 `/me-back.png`로 452KB가 그대로 배포된다.
"""
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'me-back.png')
FRONT = os.path.join(ROOT, 'assets', 'sprites', 'cut', 'me.png')
OUT = os.path.join(ROOT, 'assets', 'sprites', 'cut', 'me-back.png')

COLORS = 64        # cut_me.py와 같은 값 — 두 장의 색감이 갈리면 크로스페이드에서 보인다


def bbox(im):
    """알파가 있는 자리만. 8은 가장자리의 거의 투명한 픽셀을 빼려는 문턱값이다."""
    return im.getchannel('A').point(lambda p: 255 if p > 8 else 0).getbbox()


def main():
    if not os.path.exists(SRC):
        sys.exit(f'원본이 없다: {SRC}\n'
                 '배포 브랜치에 올라와 있다 — git fetch 뒤 꺼내 온다.')

    front = Image.open(FRONT).convert('RGBA')
    W, H = front.size                      # 앞모습이 기준이다 (지금 423 x 558)

    back = Image.open(SRC).convert('RGBA')
    back = back.crop(bbox(back))
    w = round(back.width * H / back.height)
    back = back.resize((w, H), Image.LANCZOS)

    canvas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    canvas.paste(back, ((W - w) // 2, 0), back)   # 아래 맞춤 = 높이가 같으니 y는 0
    # 앞모습과 같은 이유로 색을 64개로 줄인다(`cut_me.py`의 「색은 64개로 줄인다」).
    # 안 줄이면 169KB — 크로스페이드로 잠깐 스치는 그림 한 장에 낼 값이 아니다.
    canvas.quantize(colors=COLORS, method=Image.FASTOCTREE, dither=Image.NONE) \
          .save(OUT, optimize=True)

    print(f'{os.path.relpath(OUT, ROOT)}  {W}x{H}  {os.path.getsize(OUT) // 1024}KB')
    print(f'  앞모습 {front.size} 과 같은 캔버스 · 같은 밑변')


if __name__ == '__main__':
    main()
