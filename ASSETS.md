# DADA TOWN 픽셀 시안 발주 명세

이미지 생성 AI로 뽑아올 에셋 목록.

> ✅ **PC 가로 배경 1차 시안 수령 완료 (2026-08-14).** 채택하되 아래 §0의 보완만 진행합니다. 재생성 불필요.
> 남은 발주는 **§0 보완 3건 + 모바일 세로 배경 1장 + 스프라이트 6개**입니다.

---

## 0. 수령 현황과 남은 발주

### ✅ 수령 완료 — 전부 채택

| 에셋 | 상태 |
|---|---|
| 마을 배경 (가로) | 자동차 제거본 수령. 도로가 깨끗하게 복원됨 |
| 자동차 3대 (노랑·파랑·빨강) | 옆모습. **이 지도 스타일에 맞음** (아래 참고) |
| 새 6종 (참새·파랑새 각 3포즈) | 앉은 새는 공원·나무에 배치, 나는 새는 하늘에 |
| 구름 4종 | 검은 배경으로 왔지만 오히려 투명 처리가 쉬움 |

**영어 간판(MUSEUM·SCHOOL·COMPANY·CAFE·BANK·PARK)은 유지합니다.** "글자 금지" 규칙은 AI가 글자를 깨뜨리는 것을 막기 위한 예방책이었는데 전부 정확히 렌더링되었으므로 목적이 달성되었습니다. 한글 구역명은 호버 시 HTML 라벨로 띄웁니다.

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

## 🎯 남은 발주 2건

### 1. "나" 캐릭터 (필수)

**🙋 나 구역은 건물이 아니라 사람입니다.** 마을을 돌아다니거나 세모집 앞에 서 있는 픽셀 캐릭터가 곧 "나"이고, 클릭하면 플래너·상태 트래커·불렛저널·약력도가 열립니다.

건물보다 훨씬 좋은 선택입니다 — 살아 움직이는 캐릭터는 첫 방문자의 시선을 자연히 끌어서 **"건물을 눌러보세요" 안내 없이도 클릭을 유도**합니다. 호버하면 걸음을 멈추고 손을 흔들게 만들 수 있고요.

```
A set of pixel art character sprites of the same young person for a
top-down town map game, 16-bit style, bright cheerful colors matching a
sunny town: (1) standing facing the viewer, (2) walking to the right
with the left foot forward, (3) walking to the right with the right
foot forward, (4) standing and waving one hand happily. Simple casual
clothes, small figure. Each pose separated on a plain white background,
no other objects, no text.
```

필요한 4포즈: 서 있기 · 걷기 2프레임 · 손 흔들기. 왼쪽 방향은 CSS로 뒤집어 씁니다.

### 2. 공원의 사람들 (권장)

"사람들" 구역인데 공원이 비어 있습니다. 배경을 고치지 말고 **스프라이트로 얹으면 미세하게 움직이게 만들 수 있어** 오히려 낫습니다. 마을에서 사람이 모여 있는 유일한 곳이라 그 움직임이 구역의 정체성이 됩니다.

```
A set of tiny pixel art people sprites for a top-down town map,
16-bit game style: a person sitting on a bench, a person standing and
waving, two people talking facing each other, a child running, a person
sitting cross-legged on grass. Each figure separated on a plain white
background, no other objects, no text.
```

### 낮은 우선순위 (안 해도 됨)

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
