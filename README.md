# DADA TOWN

만든 것들이 사는 마을. 앱·문서·공간 작업물을 픽셀 마을 지도로 모아 보여주는 포트폴리오.

기획은 [PLAN.md](PLAN.md), 수록 항목은 [ITEMS.md](ITEMS.md), 에셋 명세는 [ASSETS.md](ASSETS.md).

## 구조

```
index.html          마을 페이지
styles.css
app.js
services.json       수록 항목 단일 소스 — 여기만 고치면 지도와 모달이 함께 바뀐다
assets/
  portfolio/art/    아트북 페이지 이미지 p01~p11 + 썸네일 t01~t11
  map/town.jpg      원본 배경 (편집용, 배포에는 안 씀)
  map/town-web.jpg  실제로 쓰는 배경
  sprites/*.png     원본 스프라이트 시트 (편집용)
  sprites/cut/      잘라낸 스프라이트 22개 — 실제로 쓰는 것
tools/cut_sprites.py  시트에서 스프라이트를 잘라내고 배경을 투명 처리
```

## 로컬에서 보기

```
python3 -m http.server 8000
```

`fetch`로 `services.json`을 읽으므로 파일을 직접 열지 말고 서버로 띄워야 한다.

## 항목 추가하기

`services.json`의 `items`에 한 덩어리를 넣으면 끝. 지도 팝오버와 목록 모달에 자동으로 반영된다.

```json
{
  "id": "balance-calendar",
  "name": "잔고 캘린더",
  "district": "bank",
  "type": "app",
  "url": "https://...",
  "description": "무엇을 어떻게 보는지 한 문장으로.",
  "icon": "📅",
  "status": "live"
}
```

- `district` — `museum · school · seonggyungwan · park · company · cafe · bank · house · me`
- `type` — `app`(새 탭) · `doc`(내부 페이지) · `video` · `external`
- `group` — 항목이 많은 구역에서 소제목으로 묶을 때 (예: 학교의 `교실` / `강당`)
- `status` — `live` · `beta` · `demo`
- 설명은 **가치 중심 한 문장**: `{무엇을} {어떻게} {본다/한다}`

## 움직임(애니메이션)

자동차·새·구름·사람들·캐릭터는 항상 움직인다 (사용자 결정으로 OS '동작 줄이기'와 무관하게 상시 재생).
**애니메이션은 모두 `transform` 축약형으로 쓴다.** `scale:` / `translate:` 개별 CSS 속성은
카카오톡 인앱 브라우저 같은 구형 웹뷰에서 무시되어 애니메이션이 통째로 멈춘다.
같은 이유로 좌우 반전·물결·날갯짓처럼 여러 변형이 겹치는 곳은 요소를 나눠 각자 transform을 갖게 한다.

자동차 경로는 `app.js`의 `CAR_ROUTES`에서 도로 구간(%)으로 지정한다 — wrap은 화면을 관통하는 도로,
pingpong은 막힌 도로(끝에서 잠깐 멈췄다 방향 전환). 스프라이트가 왼쪽을 보므로 우향 이동 시 자동으로 뒤집힌다.
`TOP_ROAD`의 y는 지도 픽셀에서 아스팔트 띠를 훑어 얻은 중앙선이다.

**도로에 가지가 드리운 곳은 동선을 피하지 말고 나무를 앞으로 덮는다.** 왼쪽 큰 나무처럼
도로 위까지 가지가 나온 자리는 차를 어디로 옮겨도 겹친다. `services.json`의 `canopy`에
지도 % 다각형을 넣으면 자동차 위 레이어에 같은 지도를 오려 덮어 차가 나무 뒤로 지나간다.
이 레이어는 애니메이션이 없어 원본과 똑같이 그려지므로 이음매가 보이지 않는다.

건물·공원 사람들·"나" 캐릭터는 모두 `folk-idle` 2.4초 한 박자로 움직인다. 하나만 다른 리듬을
주면 마을이 어수선해 보인다.

## 건물이 상시로 뾰잉거리는 원리

각 구역의 `.pop`은 **지도 이미지를 한 장 더 깔고 건물 영역만 잘라낸 복제본**이다.
원본과 픽셀이 정확히 겹치므로 그것을 늘였다 줄이면 건물 자체가 움직이는 것처럼 보인다.
2.4초에 두 번, 위로 늘었다가 옆으로 퍼진다. 호버·열린 상태에서는 더 크게 튄다.

네 가지가 중요하다.

- **`background-image`가 아니라 `<img>`를 써야 한다.** 배경이미지는 `<img>`와 리샘플링 방식이
  달라 같은 좌표를 줘도 미세하게 어긋나고, 그러면 건물이 이중으로 보인다.
- **크기·위치는 `%`가 아니라 지도 픽셀로 계산한다** (`syncPops()`). `%`로 두면 반올림이 누적된다.
  브라우저가 배치 좌표를 1/64px로 끊기 때문에, 마지막에 `.pop`의 실제 좌표를 읽어 그만큼
  복제본을 되민다. 잴 때는 뾰잉 변형을 `transform: none !important`로 잠깐 꺼야 한다 —
  `getBoundingClientRect()`는 변형이 적용된 값을 준다. 창 크기가 바뀌면 다시 부른다.
- **`scale`을 1보다 작게 주면 안 된다.** 복제본이 자기 영역을 못 덮어 뒤의 원본이 드러나고,
  학교 깃발처럼 경계에 걸친 것이 두 개로 보인다. 그래서 발밑을 축으로 늘어나기만 한다.
- **사각형으로 못 오리는 건물은 마스크를 쓴다.** 학교는 지붕 위 양옆에 나무가 걸치고,
  미술관은 좌우 날개가 상자 밖으로 나간다. `python3 tools/cut_buildings.py`를 돌리면
  지도 픽셀을 훑어 `assets/map/mask-<id>.png`를 만들고, 넣을 `building` 상자도 찍어준다.
  `districts[].mask`에 그 경로를 넣으면 복제본에 `mask-image`로 실루엣만 남는다.
  상자 **아래쪽**은 마음껏 잘라도 된다 — 변형 기준점이 밑변이라 거기서는 아무것도 안 움직인다.

건물과 사람들은 같은 2.4초 박자로 함께 움직인다. 각각 다른 시점에 만들어져 수십 ms 어긋나므로
`syncIdle()`이 `startTime`을 맞춰준다 — 박자가 어긋나면 눈에 거슬린다.
이때 **기준값은 `document.timeline.currentTime`이어야 한다.** 다른 애니메이션의 `startTime`을
베끼면 아직 시작 전이라 `null`일 수 있고, `null`을 넣으면 전부 멈춘다.

## 지도 레이어 순서

`.sky`(구름·새)는 `z-index: 6`으로 건물 위를 지난다. 대신 `.map`에 `isolation: isolate`를 줘
그 z-index가 지도 밖(구역 패널·아트북 팝업)까지 넘치지 않게 가둔다.

## 구역 위치 조정하기

주소 뒤에 `?tune`을 붙이면 구역 영역이 붉게 표시되고, 지도를 클릭하면 좌측 하단에 좌표가 뜬다.
그 값을 `services.json`의 `districts[].rect`(`[left, top, width, height]`, 단위 %)나
`character`(`[x, y]`)에 넣으면 된다.

## 스프라이트 다시 자르기

원본 시트를 갈아끼운 뒤:

```
pip install pillow numpy
python3 tools/cut_sprites.py
```

배경 제거는 가장자리에서 시작하는 flood fill이라 캐릭터의 검은 머리카락은 남는다.

## 넘겨보는 책 뷰어

별도 페이지가 아니라 **지도와 똑같은 크기의 팝업**으로 지도 위에 얹힌다(`.book-overlay`).
좁은 화면에서는 지도 크기로는 책이 너무 작아지므로 화면 전체를 쓴다.

**뷰어 한 벌을 여러 권이 나눠 쓴다.** 책마다 다른 것은 폴더·쪽수·해시뿐이고 제목은 항목 이름을 그대로 쓴다.
항목에 `"open": "book"`과 `book` 덩어리를 두면 등록된다.

```json
"open": "book",
"book": { "dir": "assets/portfolio/art/", "pages": 11, "hash": "art" }
```

이미지는 `dir` 아래 `p01.jpg`(본문)와 `t01.jpg`(썸네일) 규칙으로 찾는다.
해시는 `#art` · `#art-5`처럼 쪽번호가 뒤에 붙고, 등록되지 않은 해시는 무시한다.

**책은 그리기 전에 등록해야 한다.** 목록 카드가 책 해시를 `href`로 쓰기 때문에,
`init()`에서 `renderModalList()`·`initPicks()`보다 먼저 `books`를 채운다.
순서가 뒤집히면 카드가 `#`만 물고 렌더되어 클릭해도 아무 일도 안 일어난다.

미술관·세모집처럼 항목이 하나뿐인 구역은 팝오버를 거치지 않고 바로 책이 열린다 —
`districts[].direct`에 항목 id를 적으면 그 구역이 그렇게 동작한다.

넘어가는 장이 책등을 축으로 3D 회전하고(`backface-visibility: hidden`으로 뒷면이 보이면 사라진다),
좌우에 종이 두께를 쌓아 읽은 만큼 왼쪽이 두꺼워진다.
방향키·좌우 클릭·스와이프·하단 썸네일로 이동하고, `#art` / `#art-5` 해시로 특정 쪽을 공유할 수 있다.
원본 PDF는 배포하지 않는다.

페이지를 다시 뽑으려면:

```
pip install pymupdf pillow
python3 -c "
import pymupdf, io
from PIL import Image
d = pymupdf.open('원본.pdf')
for i, p in enumerate(d):
    pix = p.get_pixmap(matrix=pymupdf.Matrix(1600/p.rect.width, 1600/p.rect.width))
    im = Image.open(io.BytesIO(pix.tobytes('png'))).convert('RGB')
    im.save(f'assets/portfolio/art/p{i+1:02d}.jpg', quality=82, optimize=True, progressive=True)
    im.resize((260, round(260*im.height/im.width))).save(f'assets/portfolio/art/t{i+1:02d}.jpg', quality=75)
"
```

쪽수가 바뀌면 `services.json`의 아트북 항목 `pages` 값을 함께 고친다.

## 배포

Cloudflare에 이 저장소를 연결하고, 빌드 명령 없이 루트를 그대로 게시하면 된다.
빌드 과정이 없으므로 설정할 것은 출력 디렉터리(`/`)뿐.

### 링크 미리보기(OG) 주의

`og:image`·`og:url`은 **반드시 절대 URL**이어야 한다. 상대 경로로 두면 링크드인·카카오톡 같은
크롤러가 이미지를 못 찾아 미리보기가 생기지 않는다. 도메인을 바꾸면 아래 두 곳을 함께 고쳐야 한다.

- `index.html` — `og:url`, `og:image`
- `services.json`의 `site.url` (기준값 기록용)

`*.workers.dev` 도메인은 링크 검사기에서 걸러지는 경우가 있다. 공유용으로는 커스텀 도메인을 붙이는 편이
안전하다 (Cloudflare 대시보드 → 프로젝트 → Settings → Domains & Routes → Add custom domain).
