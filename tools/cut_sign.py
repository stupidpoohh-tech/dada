#!/usr/bin/env python3
"""마을 나가는 길의 표지판을 잘라 스프라이트로 만든다.

다른 스프라이트와 같은 규칙이다 — **밑변이 땅에 닿는 그림 한 장.** 지도 위의
것들은 전부 `bottom`으로 앉히므로(app.js의 `upTo`) 아래 여백이 있으면 그만큼
공중에 뜬다. 그래서 알파 상자로 바짝 자른다.

가로 폭을 기준으로 줄인다. 지도 폭의 몇 %로 세울지는 services.json이 정하고
(`districts[].sign.w`), 여기서는 그 크기에 모자라지 않을 만큼만 남긴다 —
레티나에서 흐려지지 않게 쓰일 폭의 두 배쯤으로 둔다.

    python3 tools/cut_sign.py

원본(sign.png)은 저장소 루트에 있다. 다원님이 GitHub 웹으로 올리는 자리가
거기라서다 — **지우지 않고 `.assetsignore`로 배포에서만 뺀다**(town-background.png와
같은 규칙). 루트에 둔 채로 두면 `/sign.png`로 원본이 그대로 배포된다.
"""
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'sign.png')
OUT = os.path.join(ROOT, 'assets', 'sprites', 'cut', 'sign.png')
WIDE = 220          # 쓰일 폭(지도의 약 6%)의 두 배쯤


def main():
    if not os.path.exists(SRC):
        sys.exit(f'원본이 없다: {SRC}\n배포 브랜치 이력에서 꺼내 온다.')
    im = Image.open(SRC).convert('RGBA')
    im = im.crop(im.getchannel('A').point(lambda p: 255 if p > 8 else 0).getbbox())
    h = round(im.height * WIDE / im.width)
    im = im.resize((WIDE, h), Image.LANCZOS)
    im.save(OUT, optimize=True)
    print(f'{os.path.relpath(OUT, ROOT)}  {WIDE}x{h}  {os.path.getsize(OUT) // 1024}KB')


if __name__ == '__main__':
    main()
