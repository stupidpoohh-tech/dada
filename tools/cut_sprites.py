#!/usr/bin/env python3
"""스프라이트 시트에서 배경을 지우고 개별 스프라이트로 잘라낸다.

배경 제거는 전역 임계값이 아니라 가장자리에서 시작하는 flood fill로 한다.
전역 임계값을 쓰면 캐릭터의 검은 머리카락까지 같이 지워지기 때문.
"""
import sys
from collections import deque

import numpy as np
from PIL import Image

OUT_DIR = "assets/sprites/cut"

# 시트별 기대 스프라이트 수, 이름, 출력 크기.
# 출력 크기는 실제 표시 크기의 약 2배 — 고밀도 화면에서도 선명하되 파일은 가볍게.
SHEETS = {
    "cars": ("assets/sprites/cars.png", 3,
             ["car-yellow", "car-blue", "car-red"], ("w", 140)),
    "birds": ("assets/sprites/birds.png", 6,
              ["sparrow-side", "sparrow-front", "sparrow-fly",
               "bluebird-side", "bluebird-front", "bluebird-fly"], ("h", 64)),
    "clouds": ("assets/sprites/clouds.png", 4,
               ["cloud-1", "cloud-2", "cloud-3", "cloud-4"], ("w", 280)),
    "me": ("assets/sprites/me.png", 1, ["me"], ("h", 130)),
    "people": ("assets/sprites/people.png", 8,
               [f"person-{i}" for i in range(1, 9)], ("h", 88)),
    # 세모집 지붕 위 확성기. 한 장짜리라 프레임 맞춤이 필요 없어 여기서 자른다
    # (까마귀·쪽지는 여러 장을 포개야 해서 cut_crow.py · cut_note.py로 따로 나갔다)
    "horn": ("assets/sprites/horn.png", 1, ["horn"], ("w", 120)),
}

# 마을 배경: 원본은 무겁기 때문에 표시 상한(1440px)보다 조금 큰 폭으로 다시 인코딩한다.
MAP_SRC = "assets/map/town.jpg"
MAP_OUT = "assets/map/town-web.jpg"
MAP_WIDTH = 1792


def background_mask(rgb, tol=60):
    """가장자리에서 flood fill 해서 배경 픽셀 마스크를 만든다."""
    h, w, _ = rgb.shape
    corners = [rgb[0, 0], rgb[0, w - 1], rgb[h - 1, 0], rgb[h - 1, w - 1]]
    bg_color = np.median(np.array(corners, dtype=np.int16), axis=0)

    close = (np.abs(rgb.astype(np.int16) - bg_color) <= tol).all(axis=2)

    visited = np.zeros((h, w), dtype=bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if close[y, x] and not visited[y, x]:
                visited[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if close[y, x] and not visited[y, x]:
                visited[y, x] = True
                q.append((y, x))

    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and close[ny, nx] and not visited[ny, nx]:
                visited[ny, nx] = True
                q.append((ny, nx))
    return visited


def components(mask, min_pixels=400):
    """알파가 있는 영역을 연결 요소로 묶어 bounding box 목록을 돌려준다."""
    h, w = mask.shape
    labels = np.zeros((h, w), dtype=np.int32)
    boxes = []
    current = 0
    for sy in range(h):
        for sx in range(w):
            if not mask[sy, sx] or labels[sy, sx]:
                continue
            current += 1
            q = deque([(sy, sx)])
            labels[sy, sx] = current
            y0 = y1 = sy
            x0 = x1 = sx
            count = 0
            while q:
                y, x = q.popleft()
                count += 1
                y0, y1 = min(y0, y), max(y1, y)
                x0, x1 = min(x0, x), max(x1, x)
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        ny, nx = y + dy, x + dx
                        if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not labels[ny, nx]:
                            labels[ny, nx] = current
                            q.append((ny, nx))
            if count >= min_pixels:
                boxes.append((x0, y0, x1 + 1, y1 + 1, count))
    return boxes


def merge_overlapping(boxes, gap=12):
    """가까이 붙은 조각(예: 캐릭터에서 떨어져 나온 팔)을 하나로 합친다."""
    merged = True
    boxes = [list(b) for b in boxes]
    while merged:
        merged = False
        for i in range(len(boxes)):
            for j in range(i + 1, len(boxes)):
                a, b = boxes[i], boxes[j]
                if (a[0] - gap < b[2] and b[0] - gap < a[2]
                        and a[1] - gap < b[3] and b[1] - gap < a[3]):
                    boxes[i] = [min(a[0], b[0]), min(a[1], b[1]),
                                max(a[2], b[2]), max(a[3], b[3]), a[4] + b[4]]
                    boxes.pop(j)
                    merged = True
                    break
            if merged:
                break
    return [tuple(b) for b in boxes]


def reading_order(boxes, row_tol=0.4):
    """위에서 아래, 왼쪽에서 오른쪽 순서로 정렬한다."""
    if not boxes:
        return boxes
    heights = [b[3] - b[1] for b in boxes]
    tol = max(heights) * row_tol
    rows = []
    for box in sorted(boxes, key=lambda b: b[1]):
        for row in rows:
            if abs(row[0][1] - box[1]) <= tol:
                row.append(box)
                break
        else:
            rows.append([box])
    ordered = []
    for row in rows:
        ordered.extend(sorted(row, key=lambda b: b[0]))
    return ordered


def resize_to(img, spec):
    """('w'|'h', 목표값)에 맞춰 비율을 유지하며 축소한다. 이미 작으면 그대로 둔다."""
    axis, target = spec
    w, h = img.size
    scale = target / (w if axis == "w" else h)
    if scale >= 1:
        return img
    return img.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)


def process(key, path, expected, names, size_spec):
    im = Image.open(path)

    # 이미 알파가 살아 있는 파일은 그 알파를 그대로 배경 판정에 쓴다.
    # RGB로 변환해버리면 투명 영역의 RGB 값이 제각각이라 배경을 못 찾는다.
    alpha = None
    if im.mode in ("RGBA", "LA"):
        a = np.array(im.convert("RGBA"))[:, :, 3]
        if a.min() < 250:
            alpha = a

    rgb = np.array(im.convert("RGB"))
    if alpha is not None:
        bg = alpha < 128
    else:
        bg = background_mask(rgb)
    fg = ~bg

    boxes = merge_overlapping(components(fg))
    boxes = reading_order(boxes)

    rgba = np.dstack([rgb, np.where(bg, 0, 255).astype(np.uint8)])
    full = Image.fromarray(rgba, "RGBA")

    import os
    saved = []
    for idx, (x0, y0, x1, y1, _) in enumerate(boxes):
        name = names[idx] if names and idx < len(names) else f"{key}-{idx + 1}"
        out = f"{OUT_DIR}/{name}.png"
        sprite = resize_to(full.crop((x0, y0, x1, y1)), size_spec)
        sprite.save(out, optimize=True)
        saved.append((name, *sprite.size, os.path.getsize(out) // 1024))

    status = "OK" if len(boxes) == expected else f"기대 {expected}개"
    print(f"{key:8s} {len(boxes)}개 [{status}]")
    for name, w, h, kb in saved:
        print(f"           {name}.png {w}x{h} {kb}KB")
    return len(boxes) == expected


def build_map():
    import os
    im = Image.open(MAP_SRC)
    w, h = im.size
    if w > MAP_WIDTH:
        im = im.resize((MAP_WIDTH, round(h * MAP_WIDTH / w)), Image.LANCZOS)
    im.convert("RGB").save(MAP_OUT, quality=82, optimize=True, progressive=True)
    print(f"map      {im.size[0]}x{im.size[1]} {os.path.getsize(MAP_OUT) // 1024}KB "
          f"(원본 {os.path.getsize(MAP_SRC) // 1024}KB)")


def main():
    """있는 시트만 자른다.

    원본 시트는 .gitignore에 있어서(README 「편집용 원본」) 새로 받은 저장소에는
    보통 한두 장만 있다. 예전에는 없는 파일에서 그냥 터졌는데, 그러면 지금 손보려는
    시트 하나 때문에 나머지를 전부 구해 와야 했다. 없는 것은 건너뛴다."""
    import os
    os.makedirs(OUT_DIR, exist_ok=True)
    only = sys.argv[1:]
    ok = True
    for key, (path, expected, names, size_spec) in SHEETS.items():
        if only and key not in only:
            continue
        if not os.path.exists(path):
            print(f"{key:8s} 원본 시트 없음 — 건너뜀 ({path})")
            continue
        ok &= process(key, path, expected, names, size_spec)
    if not only and os.path.exists(MAP_SRC):
        build_map()
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
