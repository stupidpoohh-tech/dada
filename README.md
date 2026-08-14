# DADA TOWN

만든 것들이 사는 마을. 앱·문서·영상·공간 작업물을 픽셀 마을 지도로 모아 보여주는 포트폴리오.

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
  "id": "planner",
  "name": "플래너",
  "district": "me",
  "type": "app",
  "url": "https://...",
  "description": "무엇을 어떻게 보는지 한 문장으로.",
  "icon": "🗓",
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

## 건물이 상시로 뾰잉거리는 원리

각 구역의 `.pop`은 **지도 이미지를 한 장 더 깔고 건물 영역만 잘라낸 복제본**이다.
원본과 픽셀이 정확히 겹치므로 그것을 늘였다 줄이면 건물 자체가 움직이는 것처럼 보인다.
0.34초씩 시차를 둬 마을을 한 바퀴 돌듯 번지고, 호버·열린 상태에서는 더 크게 튄다.

두 가지가 중요하다.

- **`background-image`가 아니라 `<img>`를 써야 한다.** 배경이미지는 `<img>`와 리샘플링 방식이
  달라 같은 좌표를 줘도 미세하게 어긋나고, 그러면 건물이 이중으로 보인다.
- **크기·위치는 `%`가 아니라 지도 픽셀로 계산한다** (`syncPops()`). `%`로 두면 반올림이 누적된다.
  창 크기가 바뀌면 다시 부른다.

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

## 아트북 뷰어

별도 페이지가 아니라 **지도와 똑같은 크기의 팝업**으로 지도 위에 얹힌다(`.book-overlay`).
좁은 화면에서는 지도 크기로는 책이 너무 작아지므로 화면 전체를 쓴다.

미술관 구역은 항목이 하나뿐이라 팝오버를 거치지 않고 바로 책이 열린다 —
`services.json`의 `districts[].direct`에 항목 id를 적으면 그 구역이 그렇게 동작한다.
항목 쪽에는 `"open": "artbook"`, `"pages": 11`을 둔다.

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
