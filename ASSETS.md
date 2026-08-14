# DADA TOWN 픽셀 시안 발주 명세

이미지 생성 AI로 뽑아올 에셋 목록.
**배경 2장(PC 가로 · 모바일 세로) + 스프라이트 7개.**

> ⚠️ 구역이 9개 + 공항으로 확정되면서 이전 명세(건물 7종)는 폐기되었습니다. 아래 최신본으로 생성해 주세요.

---

## 공통: 마을에 들어갈 건물 10종

두 배경 모두 아래 10개가 **전부** 들어가야 합니다. 배치만 다릅니다.

| # | 건물 | 형태 | 상징 (간판 대신 쓸 심볼) |
|---|---|---|---|
| 1 | 학교 | 빨간 지붕 학교 + 작은 운동장 | 펼친 책 |
| 2 | 미술관 | 흰 벽의 현대식 미술관, 유리 입구 | 액자 |
| 3 | 회사 | 유리창 오피스 빌딩 | 서류·모니터 |
| 4 | 성균관 | **한옥** — 기와지붕, 나무 기둥, 흙마당 | 등불 |
| 5 | 은행 | 돌기둥 있는 고전 양식 | 달러 기호 |
| 6 | 우체국 | 빨간 우체통이 앞에 있는 작은 건물 | 편지봉투 |
| 7 | 카페 | 줄무늬 차양 + 야외 테이블 | 커피잔 |
| 8 | 세모집 | **삼각지붕이 뚜렷한 집** — 마을에서 가장 특징적으로 | 삼각형 |
| 9 | 작업실 | **언덕 위** 작은 스튜디오, 창문 큰 오두막 | 연필 |
| 10 | 공항 | 관제탑 + 활주로, 모서리 배치 | 비행기 |

**성균관(한옥)과 세모집, 언덕 위 작업실이 이 마을의 개성입니다.** 특히 한옥은 다른 서양식 건물들 사이에서 눈에 띄어야 하고, 작업실은 언덕 위에 있어 마을이 내려다보이는 위치여야 합니다.

## 반드시 지킬 것 (수락 기준)

받으신 뒤 아래 5가지로 검수해 주세요. 하나라도 어긋나면 구현 단계에서 문제가 됩니다.

1. **움직일 것들이 배경에 박혀 있으면 안 됨** — 도로 위 자동차 ❌, 새 ❌, 구름 ❌, 사람 ❌. 전부 스프라이트로 따로 얹어 움직입니다. (주차장에 세워둔 차는 괜찮음)
2. **글자 금지** — 간판에 텍스트 대신 심볼만. AI가 만든 글자는 거의 깨지고, 구역 이름은 웹에서 HTML로 또렷하게 올립니다(호버 강조·다국어도 그쪽이 쉬움).
3. **도로가 끊기지 않는 순환 루프** — 자동차가 이 위를 계속 돕니다. 눈으로 한 바퀴 따라가 보세요.
4. **건물끼리 붙지 않게** — 핫스팟과 팝오버가 들어갈 여백이 필요합니다.
5. **10개 건물이 모두 잘리지 않고 보일 것**

---

## A. PC용 배경 (가로) — 1장

- 크기: 가로 2400px 이상, **4:3 가로 구도**
- 10개 건물을 격자 도로로 연결, 강과 다리는 한쪽 가장자리
- 빈 공터 2~3곳에 "공사 중" 나무 팻말 — 항목이 순차 추가될 자리

```
Top-down pixel art town map, 2D game style, clean 16-bit pixel art,
bright cheerful colors, 4:3 landscape composition.

The town contains exactly these buildings, all clearly separated:
a school with a red roof and small playground, a modern white art
museum with a glass entrance, a glass office building, a traditional
Korean hanok with a curved tiled roof and wooden pillars and a dirt
courtyard, a classical bank with stone columns, a small post office
with a red mailbox in front, a cozy cafe with a striped awning and
outdoor tables, a distinctive house with a steep triangular roof,
a small artist studio cabin with large windows standing on a green
hill overlooking the town, and an airport with a control tower and
runway in one corner.

A river with a stone bridge runs along one edge. Gray roads with white
dashed lines connect all buildings and form closed loops, with
crosswalks at intersections. Include 2-3 empty lots with wooden
construction signs. Trees, flowers and greenery between blocks.

IMPORTANT: no cars on the roads, no birds, no clouds, no people, and
absolutely no text or letters anywhere. Building signs use simple
symbols only (open book, picture frame, dollar sign, envelope, coffee
cup, lantern, pencil, airplane). Every building fully visible with
clear spacing between them.
```

## B. 모바일용 배경 (세로) — 1장

- 크기: 세로 2400px 이상, **3:4 세로 구도**
- **같은 마을, 다른 배치.** 건물 10종은 동일하게 유지하되 세로로 흐르게 재배치
- 세로 화면에서도 건물이 손가락으로 누를 만한 크기여야 하므로, 가로 버전보다 건물을 **크고 여유 있게**

```
Top-down pixel art town map, 2D game style, clean 16-bit pixel art,
bright cheerful colors, 3:4 vertical portrait composition, designed
for a mobile screen.

The same town seen from above, with buildings arranged vertically from
top to bottom. It contains exactly these buildings, all clearly
separated and generously sized: an airport with a control tower and
runway at the top, a school with a red roof and playground, a modern
white art museum with a glass entrance, a glass office building, a
traditional Korean hanok with a curved tiled roof and wooden pillars,
a classical bank with stone columns, a small post office with a red
mailbox, a cozy cafe with a striped awning, a distinctive house with a
steep triangular roof, and a small artist studio cabin with large
windows on a green hill at the bottom.

A river with a stone bridge runs along one side. Gray roads with white
dashed lines connect all buildings and form closed loops. Include 2
empty lots with wooden construction signs. Trees and greenery between
blocks.

IMPORTANT: no cars on the roads, no birds, no clouds, no people, and
absolutely no text or letters anywhere. Building signs use simple
symbols only. Buildings should be large and well spaced, easy to tap
on a phone screen.
```

---

## C. 스프라이트 7개

전부 **흰 배경**으로 받으면 됩니다 — 투명 처리는 구현할 때 합니다.
자동차·비행기는 **오른쪽을 향한 1방향만** 필요합니다. 격자 도로라 회전은 코드에서 90도 단위로 처리합니다.

| # | 에셋 | 비고 |
|---|---|---|
| 1~3 | 자동차 3대 (노랑·파랑·빨강) | 탑뷰, 오른쪽 향함 |
| 4 | 새 — 날개 올린 프레임 | 5번과 같은 구도로 |
| 5 | 새 — 날개 내린 프레임 | 4·5를 번갈아 날갯짓 |
| 6 | 비행기 | 탑뷰, 오른쪽 향함 |
| 7 | 구름 | 1~2개 |

**자동차** (색만 바꿔 3회)
```
Single pixel art sprite of a small yellow car, top-down view, facing
right, 16-bit game style, centered on a plain white background,
no shadow, no other objects.
```

**새** (wings up / wings down 두 번)
```
Single pixel art sprite of a tiny white bird flying, wings up,
side view facing right, 16-bit game style, plain white background,
no other objects.
```

**비행기**
```
Single pixel art sprite of a small white passenger airplane with blue
accents, top-down view, facing right, 16-bit game style, plain white
background, no shadow, no other objects.
```

**구름**
```
Single pixel art sprite of a fluffy white cloud, 16-bit game style,
plain white background, no other objects.
```

---

## D. 나중에 뽑을 것 (지금 생성 금지)

- **밤 버전 배경 2장** (🌙 밤 마을 다크모드) — 낮 배경을 확정한 뒤 **그 이미지를 img2img에 넣고** `same layout, night time, lit windows, street lamps on`으로 변형해야 합니다. 새로 생성하면 구도가 달라져서 건물 핫스팟 좌표가 전부 어긋납니다.
- OG 이미지·파비콘 — 별도 시안 불필요. 가로 배경에서 크롭해 씁니다.

## 스타일 일관성 팁

가로 배경을 먼저 확정하고, 세로 배경과 스프라이트는 **같은 세션에서 같은 스타일 문구**(`16-bit game style`)로 이어서 뽑으면 톤이 붙습니다. 색이 조금 안 맞는 건 구현할 때 보정할 수 있으니, 구도(방향·여백·건물 크기)를 우선으로 봐주세요.
