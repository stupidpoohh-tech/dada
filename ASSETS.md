# DADA TOWN 픽셀 시안 발주 명세

이미지 생성 AI로 뽑아올 에셋 목록.

> ✅ **PC 가로 배경 1차 시안 수령 완료 (2026-08-14).** 채택하되 아래 §0의 보완만 진행합니다. 재생성 불필요.
> 남은 발주는 **§0 보완 3건 + 모바일 세로 배경 1장 + 스프라이트 6개**입니다.

---

## 0. 수령 현황

### ✅ 에셋 수령 완료 — 발주 종료

| 에셋 | 상태 |
|---|---|
| 마을 배경 (가로) | 자동차 제거본 수령. 도로가 깨끗하게 복원됨 |
| 자동차 3대 (노랑·파랑·빨강) | 옆모습. **이 지도 스타일에 맞음** (아래 참고) |
| 새 6종 (참새·파랑새 각 3포즈) | 앉은 새는 공원·나무에 배치, 나는 새는 하늘에 |
| 구름 4종 | 검은 배경으로 왔지만 오히려 투명 처리가 쉬움 |
| **"나" 캐릭터** | 파란 머리·파란 옷, 손 흔드는 포즈 1종 |
| **공원 사람들 8종** | 2행 4열 시트. 마을 톤과 잘 맞음 |

더 발주할 에셋은 없습니다. 남은 것은 파일을 레포에 넣는 일뿐입니다(§0-1).

**영어 간판(MUSEUM·SCHOOL·COMPANY·CAFE·BANK·PARK)은 유지합니다.** "글자 금지" 규칙은 AI가 글자를 깨뜨리는 것을 막기 위한 예방책이었는데 전부 정확히 렌더링되었으므로 목적이 달성되었습니다. 한글 구역명은 호버 시 HTML 라벨로 띄웁니다.

### 0-1. 레포에 넣을 파일 (다음 작업)

구현을 시작하려면 파일이 레포에 있어야 합니다. 아래 경로로 넣어주세요 — 검은 배경 제거(투명 처리)와 스프라이트 시트 분리는 구현할 때 스크립트로 처리합니다.

```
assets/
  map/town.png              ← 마을 배경 (자동차 제거본)
  sprites/car-yellow.png
  sprites/car-blue.png
  sprites/car-red.png
  sprites/birds.png         ← 6종 시트 그대로
  sprites/clouds.png        ← 4종 시트 그대로
  sprites/me.png            ← "나" 캐릭터
  sprites/people.png        ← 공원 사람들 8종 시트 그대로
```

시트(새·구름·사람들)는 잘라서 넣지 않아도 됩니다. 통짜로 두고 CSS `background-position`으로 잘라 쓰는 편이 파일 수도 적고 요청도 줄어듭니다.

### "나" 캐릭터 — 스타일과 배치

**스타일이 마을·공원 사람들과 다릅니다.** 픽셀이 더 굵고 둥근 마스코트 톤인데, 이건 문제가 아니라 이점입니다 — 주인공이 배경 인물들과 똑같이 생기면 안 되고, 스타일이 다르면 "저 사람이 이 마을 주인"이라는 게 한눈에 읽힙니다.

다만 완전히 다른 세계에서 온 것처럼 보이지 않게 **공원 사람들보다 1.2배 정도만 크게** 잡습니다.

**포즈가 손 흔드는 것 하나뿐이므로 걷지 않고 세모집 앞에 서 있습니다.** 걸으면서 손 흔드는 것은 어색하고, 상시 손 흔드는 포즈가 오히려 클릭 유도에 강합니다. CSS로 위아래 미세하게 통통 튀게(bob) 만들면 살아 있어 보입니다. 나중에 걷기 프레임이 생기면 이동으로 바꿀 수 있습니다.

### 공원 사람들 — 배치

8종 중 **5~6명만** 공원에 배치합니다(전부 넣으면 붐빕니다). 벤치·분수 주변·미끄럼틀 근처에 나눠 두고, 각자 다른 위상(phase)으로 미세하게 bob 시키면 모여서 웅성거리는 느낌이 납니다. 서 있는 포즈뿐이라 걷게 하지 않습니다.

첫 번째로 받은 후드 소년 단독 이미지는 8종 시트의 1번과 같은 인물이므로 별도로 쓰지 않습니다.

### ❌ 모바일 세로 배경 — 발주 취소

**필요 없습니다.** 가로 배경 1장으로 PC·모바일을 모두 커버합니다.

이 지도는 블록이 3열로 나뉘어 있어서, 모바일 화면 폭(390px)에 맞춰 축소해도 블록 하나가 약 130px, 가장 작은 한옥도 **약 60px**로 터치 기준(44px)을 넉넉히 넘습니다. 320px 화면에서도 50px 수준이라 문제없습니다.

대신 모바일은 **지도를 상단에 고정하고 하단에 카드 리스트**를 두는 구성으로 갑니다 — 지도 292px + 카드 영역 490px. 바텀시트가 지도를 덮는 문제도 사라지고, 지도를 탭하면 아래 리스트가 해당 구역으로 이동하는 편이 조작도 자연스럽습니다.

### 구현 시 주의 — 자동차는 가로 도로에만

받은 자동차가 **옆모습**인데, 이 마을은 건물 정면이 보이는 유사 등각 스타일이라 시점이 오히려 잘 맞습니다(원래 배경에 있던 차들도 같은 시점이었습니다).

다만 옆모습이라 **세로 도로를 달리면 어색**합니다. 자동차는 가로 도로에만 배치하고, 왼쪽으로 갈 때는 CSS `transform: scaleX(-1)`로 뒤집습니다. 이 지도에는 가로 도로가 여러 줄 있어 충분합니다.

### 구현 시 주의 — 새 날갯짓

날개를 내린 프레임이 없고 올린 프레임만 있습니다. 추가 발주 없이 **나는 프레임 하나에 CSS로 위아래 미세 진동(bob)과 `scaleY` 수축을 걸면** 날갯짓처럼 보입니다. 앉은 자세 2종은 공원 벤치와 나무에 정적으로 배치합니다.

---

## 나중에 여유가 생기면 (안 해도 됨)

- **"나" 걷기 프레임 2종** — 생기면 세모집 앞 정지 대신 마을을 걸어다니게 바꿀 수 있습니다. 지금은 손 흔들며 서 있는 것으로 충분합니다.
- **세모집** — 우하단 파란 지붕 집이 역할은 하지만 "삼각지붕"이 두드러지지 않습니다. 여유가 생기면 지붕만 더 뾰족한 버전으로 교체.
- **공사 중 빈 공터** — 별도 팻말 없이도 녹지 블록이 남아 있어 나중에 채울 수 있습니다.
- **해상도** — 권장 2400px보다 작지만 `image-rendering: pixelated`로 렌더링하므로 실사용에 무리 없습니다.

---

## 참고: 아래는 1차 발주에 쓴 전체 명세

기록용으로 남겨둡니다. §A(PC 가로)와 §C(스프라이트)는 수령 완료, **§B(모바일 세로)는 발주 취소**되었습니다.

---

## 공통: 마을에 들어갈 구역 9종

두 배경 모두 아래 9개가 **전부** 들어가야 합니다. 배치만 다릅니다.

| # | 구역 | 형태 | 상징 (간판 대신 쓸 심볼) |
|---|---|---|---|
| 1 | 학교 | 빨간 지붕 학교 + 작은 운동장 | 펼친 책 |
| 2 | 미술관 | 흰 벽의 현대식 미술관, 유리 입구 | 액자 |
| 3 | 회사 | 유리창 오피스 빌딩 | 서류·모니터 |
| 4 | 성균관 | **한옥** — 기와지붕, 나무 기둥, 흙마당 | 등불 |
| 5 | 은행 | 돌기둥 있는 고전 양식 | 달러 기호 |
| 6 | 사람들 | **공원** — 분수·벤치 주위에 **사람들이 모여 있는** 모습 | (심볼 없음, 사람들 자체가 표식) |
| 7 | 카페 | 줄무늬 차양 + 야외 테이블 | 커피잔 |
| 8 | 세모집 | **삼각지붕이 뚜렷한 집** — 마을에서 가장 특징적으로 | 삼각형 |
| 9 | 작업실 | **언덕 위** 작은 스튜디오, 창문 큰 오두막 | 연필 |

**성균관(한옥)·세모집·언덕 위 작업실이 이 마을의 개성입니다.** 한옥은 다른 서양식 건물들 사이에서 눈에 띄어야 하고, 작업실은 언덕 위에서 마을이 내려다보이는 위치여야 합니다.

**공원의 사람들은 배경에 그려 넣습니다.** 마을에서 사람이 등장하는 유일한 곳이라 시선이 자연히 머뭅니다 — 6~10명 정도가 분수와 벤치 주위에 앉거나 서서 모여 있는 모습으로.

## 반드시 지킬 것 (수락 기준)

받으신 뒤 아래 5가지로 검수해 주세요. 하나라도 어긋나면 구현 단계에서 문제가 됩니다.

1. **움직일 것들이 배경에 박혀 있으면 안 됨** — 도로 위 자동차 ❌, 새 ❌, 구름 ❌. 전부 스프라이트로 따로 얹어 움직입니다. (주차장에 세워둔 차는 괜찮음)
2. **사람은 공원에만** — 길거리 행인이나 다른 건물 앞 사람은 넣지 않습니다. 공원의 모임이 특별해 보여야 하니까요.
3. **글자 금지** — 간판에 텍스트 대신 심볼만. AI가 만든 글자는 거의 깨지고, 구역 이름은 웹에서 HTML로 또렷하게 올립니다(호버 강조·다국어도 그쪽이 쉬움).
4. **도로가 끊기지 않는 순환 루프** — 자동차가 이 위를 계속 돕니다. 눈으로 한 바퀴 따라가 보세요.
5. **9개 구역이 모두 잘리지 않고 보이고, 서로 붙지 않을 것** — 핫스팟과 팝오버가 들어갈 여백이 필요합니다.

---

## A. PC용 배경 (가로) — 1장

- 크기: 가로 2400px 이상, **4:3 가로 구도**
- 9개 구역을 격자 도로로 연결, 강과 다리는 한쪽 가장자리
- 빈 공터 2~3곳에 "공사 중" 나무 팻말 — 항목이 순차 추가될 자리

```
Top-down pixel art town map, 2D game style, clean 16-bit pixel art,
bright cheerful colors, 4:3 landscape composition.

The town contains exactly these nine places, all clearly separated:
a school with a red roof and small playground, a modern white art
museum with a glass entrance, a glass office building, a traditional
Korean hanok with a curved tiled roof and wooden pillars and a dirt
courtyard, a classical bank with stone columns, a green park with a
fountain and benches where a small group of about eight people is
gathered sitting and standing together, a cozy cafe with a striped
awning and outdoor tables, a distinctive house with a steep triangular
roof, and a small artist studio cabin with large windows standing on a
green hill overlooking the town.

A river with a stone bridge runs along one edge. Gray roads with white
dashed lines connect all places and form closed loops, with crosswalks
at intersections. Include 2-3 empty lots with wooden construction
signs. Trees, flowers and greenery between blocks.

IMPORTANT: no airport, no airplane. No cars on the roads, no birds,
no clouds. The ONLY people in the whole image are the group gathered
in the park — no pedestrians on streets or near other buildings.
Absolutely no text or letters anywhere; signs use simple symbols only
(open book, picture frame, dollar sign, coffee cup, lantern, pencil).
Every place fully visible with clear spacing between them.
```

## B. 모바일용 배경 (세로) — 1장

- 크기: 세로 2400px 이상, **3:4 세로 구도**
- **같은 마을, 다른 배치.** 구역 9종은 동일하게 유지하되 세로로 흐르게 재배치
- 세로 화면에서도 손가락으로 누를 만한 크기여야 하므로, 가로 버전보다 **크고 여유 있게**

```
Top-down pixel art town map, 2D game style, clean 16-bit pixel art,
bright cheerful colors, 3:4 vertical portrait composition, designed
for a mobile screen.

The same town seen from above, with places arranged vertically from top
to bottom. It contains exactly these nine places, all clearly separated
and generously sized: a school with a red roof and playground, a modern
white art museum with a glass entrance, a glass office building, a
traditional Korean hanok with a curved tiled roof and wooden pillars, a
classical bank with stone columns, a green park with a fountain and
benches where a small group of about eight people is gathered sitting
and standing together, a cozy cafe with a striped awning, a distinctive
house with a steep triangular roof, and a small artist studio cabin
with large windows on a green hill at the bottom.

A river with a stone bridge runs along one side. Gray roads with white
dashed lines connect all places and form closed loops. Include 2 empty
lots with wooden construction signs. Trees and greenery between blocks.

IMPORTANT: no airport, no airplane. No cars on the roads, no birds, no
clouds. The ONLY people in the whole image are the group gathered in
the park — no pedestrians elsewhere. Absolutely no text or letters
anywhere; signs use simple symbols only. Places should be large and
well spaced, easy to tap on a phone screen.
```

---

## C. 스프라이트 6개

전부 **흰 배경**으로 받으면 됩니다 — 투명 처리는 구현할 때 합니다.
자동차는 **오른쪽을 향한 1방향만** 필요합니다. 격자 도로라 회전은 코드에서 90도 단위로 처리합니다.

| # | 에셋 | 비고 |
|---|---|---|
| 1~3 | 자동차 3대 (노랑·파랑·빨강) | 탑뷰, 오른쪽 향함 |
| 4 | 새 — 날개 올린 프레임 | 5번과 같은 구도로 |
| 5 | 새 — 날개 내린 프레임 | 4·5를 번갈아 날갯짓 |
| 6 | 구름 | 1~2개 |

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
