# DADA TOWN 픽셀 시안 발주 명세

이미지 생성 AI로 뽑아올 에셋 목록. **배경 1장 + 스프라이트 7개**가 전부다.
밤 버전은 지금 뽑지 않는다 — 낮 배경이 확정된 뒤 그 이미지를 img2img(이미지 변형)로 넣어야 같은 구도가 유지되기 때문.

---

## A. 마을 배경 (낮) — 필수 1장

### 요구사항

| 항목 | 스펙 |
|---|---|
| 구도 | 탑뷰(위에서 내려다본), 기존 참고 시안과 동일한 스타일 |
| 크기 | 가로 2048px 이상, 가로:세로 ≈ 4:3 (히어로 배치용) |
| 필수 건물 7종 | 🏦 은행 · 🏫 학교 · ☕ 카페 · 🏢 회사(사무 빌딩) · 🏠 집 2채 · 🌳 공원(분수) · ✈️ 공항(관제탑+활주로, 모서리 배치) |
| 도로 | 모든 건물을 잇는 격자 도로. **끊기지 않는 순환 루프**여야 함 — 자동차 애니메이션이 이 위를 돈다 |
| 빈 부지 | "공사 중" 팻말이 있는 공터 2~3곳 — 서비스가 순차 추가될 자리 |
| 장식 | 나무·꽃·강+다리·횡단보도 자유롭게 |

### 반드시 지킬 것 (수락 기준)

1. **배경에 움직일 것들이 박혀 있으면 안 됨** — 도로 위 자동차 ❌, 새 ❌, 구름 ❌, 사람 ❌ (전부 스프라이트로 따로 얹어 움직인다. 주차장에 서 있는 차 정도는 OK)
2. **간판에 글자 금지** — 텍스트 대신 심볼(달러, 책, 커피잔)로. AI 글자 깨짐 방지 + 라벨은 웹에서 HTML로 또렷하게 오버레이(호버 강조·다국어도 쉬움)
3. 건물끼리 붙지 않게 — 핫스팟과 팝오버가 들어갈 여백 필요
4. 건물이 화면 가장자리에 잘리지 않게
5. 도로가 실제로 루프를 이루는지 눈으로 따라가 볼 것

### 프롬프트 (복붙용)

```
Top-down pixel art town map, 2D game style, clean 16-bit pixel art,
bright cheerful colors. The town contains: a bank with stone columns,
a school with a red roof and small playground, a cozy cafe with striped
awning, a modern glass office building, two small houses with gardens,
a park with a fountain and benches, and an airport with a control tower
and runway in one corner. A river with a stone bridge runs along one edge.
Gray roads with white dashed lines connect all buildings and form closed
loops, with crosswalks at intersections. Include 2-3 empty lots with
wooden construction signs. Lots of trees, flowers and greenery between
blocks. IMPORTANT: no cars on the roads, no birds, no clouds, no people,
no text or letters anywhere — building signs use symbols only (dollar
sign, open book, coffee cup). 4:3 landscape composition, every building
fully visible with clear spacing between buildings.
```

## B. 스프라이트 — 각각 1장씩, 총 7개

전부 **배경과 같은 픽셀 스타일**로, 단색(흰색) 배경에 요청. 투명 처리는 코드 작업 때 해결 가능.
자동차·비행기는 **오른쪽을 향한 탑뷰 1방향만** — 격자 도로라 회전은 90도 단위 CSS로 처리한다.

| # | 에셋 | 스펙 |
|---|---|---|
| 1~3 | 자동차 3대 (노랑·파랑·빨강) | 탑뷰, 오른쪽 향함, 정사각 캔버스, 차 크기 약 64px |
| 4 | 새 (날개 올림 프레임) | 작게, 옆모습 또는 탑뷰 실루엣 |
| 5 | 새 (날개 내림 프레임) | 4와 동일 구도 — 2프레임 번갈아 날갯짓 |
| 6 | 비행기 | 탑뷰, 오른쪽 향함 — 활주로 이륙용, 배경 공항과 같은 톤 |
| 7 | 구름 1~2개 | 배경과 같은 스타일, 흘러가는 용 |

### 프롬프트 예시 (자동차 — 색만 바꿔 3회)

```
Single pixel art sprite of a small yellow car, top-down view, facing
right, 16-bit game style, centered on a plain white background,
no shadow, no other objects.
```

### 프롬프트 예시 (새 — "wings up" / "wings down" 두 번)

```
Single pixel art sprite of a tiny white bird flying, wings up,
side view facing right, 16-bit game style, plain white background,
no other objects.
```

### 프롬프트 예시 (비행기)

```
Single pixel art sprite of a small white passenger airplane with blue
accents, top-down view, facing right, 16-bit game style, plain white
background, no shadow, no other objects.
```

### 프롬프트 예시 (구름)

```
Single pixel art sprite of a fluffy white cloud, 16-bit game style,
plain white background, no other objects.
```

## C. 나중에 뽑을 것 (지금 금지)

- **밤 버전 배경** (v3 밤 마을 다크모드) — 낮 배경 확정 후, 그 이미지를 img2img로 넣고 "same layout, night time, lit windows, street lamps on" 요청. 새로 생성하면 구도가 달라져서 핫스팟 좌표가 전부 어긋난다.
- OG 이미지·파비콘 — 별도 시안 불필요. 배경에서 크롭해서 쓴다.

## 스타일 일관성 팁

- 배경을 먼저 확정하고, 스프라이트는 같은 세션/같은 스타일 문구("16-bit game style")로 뽑으면 톤이 붙는다.
- 스프라이트 색이 배경과 안 맞으면 코드에서 보정 가능하니 구도(방향·여백)가 우선이다.
