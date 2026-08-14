# DADA TOWN

만든 것들이 사는 마을. 앱·문서·영상·공간 작업물을 픽셀 마을 지도로 모아 보여주는 포트폴리오.

기획은 [PLAN.md](PLAN.md), 수록 항목은 [ITEMS.md](ITEMS.md), 에셋 명세는 [ASSETS.md](ASSETS.md).

## 구조

```
index.html          마을 페이지
styles.css
app.js
services.json       수록 항목 단일 소스 — 여기만 고치면 지도와 모달이 함께 바뀐다
docs/
  art-portfolio.html  아트북 뷰어 (미술관 → 아트 포트폴리오)
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

`docs/art-portfolio.html`. PDF를 그대로 띄우지 않고 페이지를 이미지로 뽑아 책장 넘기듯 본다.
넘어가는 장이 책등을 축으로 3D 회전하고(`backface-visibility: hidden`으로 뒷면이 보이면 사라진다),
방향키·좌우 클릭·스와이프·하단 썸네일로 이동한다. 원본 PDF는 배포하지 않는다.

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

쪽수가 바뀌면 `docs/art-portfolio.html`의 `const N` 값을 함께 고친다.

## 배포

Cloudflare Pages에 이 저장소를 연결하고, 빌드 명령 없이 루트를 그대로 게시하면 된다.
빌드 과정이 없으므로 설정할 것은 출력 디렉터리(`/`)뿐.
