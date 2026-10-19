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

**채도는 다른 건물과 같은 0.75다.** 처음 받은 그림(2026-10-19 오전)은 받은 그대로
채도가 0.713이라 0.75를 곱해도 카페(0.420)보다 1.3배 높아 혼자 쨍했고, 그래서
0.55까지 깎아야 했다. **지금 그림은 애초에 0.457이다** — 0.75를 곱하면 0.345로
마을 평균(0.306)과 카페 사이에 저절로 앉는다. 그림이 바뀌면 이 수를 다시 잰다
(`tools/_tone.py` 같은 것을 두지 않는다 — 아래 「재는 법」 그대로 한 번 돌리면 된다).

**밝기는 안 건드린다.** `desaturate`는 V를 그대로 두는데 이 그림은 170.7로 마을
평균(177)과 거의 같은 자리다.

**알파 32를 넘는 것만 내용으로 친다.** `getbbox()`는 알파가 0만 아니면 내용으로 보는데,
이 그림에는 눈에 안 보이는 옅은 테두리가 사방에 깔려 있어서 그대로 쓰면 1018x952짜리가
1234x1245로 잡힌다. **그만큼 투명한 여백을 끼고 앉으므로 자리를 아무리 맞춰도
어긋난다** — 건물은 작아 보이는데 판정과 밑변은 엉뚱한 데 가 있다.

### 재는 법 (그림이 바뀌면)

    python3 - <<'EOF'
    from PIL import Image; import numpy as np, sys
    sys.path.insert(0, 'tools'); from cut_buildings import desaturate
    im = Image.open('library.png').convert('RGBA')
    al = np.array(im)[:, :, 3]; ys, xs = np.where(al > 32)
    im = im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    a = np.array(desaturate(im, 0.75)).astype(np.float32)
    px = a[:, :, :3][a[:, :, 3] > 128]
    v = px.max(axis=1)
    print('채도', (np.where(v > 0, (v - px.min(axis=1)) / np.maximum(v, 1), 0)).mean())
    EOF

마을 일곱 채는 평균 0.306, 가장 따뜻한 카페가 0.420이다. 그 사이면 맞다.
"""
import os
import sys

import numpy as np

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cut_buildings import desaturate

SRC = 'library.png'
OUT = 'assets/sprites/cut/building-library.webp'
WIDTH = 420
QUALITY = 88
ALPHA = 32            # 이보다 옅은 것은 테두리의 잔상으로 본다
# 채도 배율 — 머리말 참고. 지금 그림은 다른 건물과 같은 0.75로 맞는다
SATURATION = 0.75


def main():
    if not os.path.exists(SRC):
        print(f'{SRC}가 없다. 배포 브랜치에서 받아 온다 — README 「편집용 원본」.')
        return 1

    im = Image.open(SRC).convert('RGBA')
    # **알파 32를 넘는 것만 내용으로 친다** — 머리말 참고. `getbbox()`를 쓰면
    # 눈에 안 보이는 옅은 테두리까지 끌어안아 투명한 여백을 끼고 앉는다
    al = np.array(im)[:, :, 3]
    ys, xs = np.where(al > ALPHA)
    if not len(xs):
        print(f'{SRC}에 그려진 것이 없다.')
        return 1
    crop = im.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))
    h = round(crop.height * WIDTH / crop.width)
    crop = crop.resize((WIDTH, h), Image.LANCZOS)
    crop = desaturate(crop, SATURATION)     # 배경의 순한 초록 위에서 혼자 쨍하지 않게
    crop.save(OUT, 'WEBP', quality=QUALITY, alpha_quality=QUALITY, method=6)
    print(f'  {os.path.basename(OUT)}  {crop.size[0]}x{crop.size[1]}  '
          f'{os.path.getsize(OUT) // 1024}KB')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
