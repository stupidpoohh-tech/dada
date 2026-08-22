# DADA TOWN — 먼저 알아야 할 것

이다원의 포트폴리오. 빌드 없는 정적 사이트 + Worker 하나(`/api/word`).

**이 파일은 짧게 유지한다.** 매 세션 통째로 읽히므로 길어지면 그만큼 값이 든다.
설계와 이유는 [README.md](README.md)(58KB)에 있고, 여기에는 **모르면 사고가 나는
것**만 적는다. 자세한 것이 필요하면 README의 해당 절만 찾아 읽는다.

## 브랜치가 둘이다 — 둘 다 밀어야 한다

| 브랜치 | 역할 |
|---|---|
| **개발** — 세션마다 다르다 | 시스템 프롬프트가 지정한 브랜치. 여기서 커밋한다 |
| `claude/portfolio-web-planning-jjx9xd` | **배포 = 저장소 기본 브랜치.** 여기 올라가면 Cloudflare가 자동 배포 |

개발 브랜치에만 올리면 **사이트는 하나도 안 바뀐다.** 실제로 한 번 사고가 났다.
개발 브랜치 이름은 세션마다 새로 생기므로 여기 적어 두지 않는다 — `git branch --show-current`가 그것이다.

```bash
DEV=$(git branch --show-current)
git push -u origin "$DEV"
git fetch origin claude/portfolio-web-planning-jjx9xd
git merge-base --is-ancestor origin/claude/portfolio-web-planning-jjx9xd HEAD \
  && git push origin HEAD:claude/portfolio-web-planning-jjx9xd
```

다원님이 그림 파일을 올리는 곳도 **배포 브랜치**다. 새 파일을 받기로 했으면
먼저 `git fetch` 한다. (채팅 첨부로는 파일이 안 들어온다 — GitHub 웹 업로드로 받는다.)

## 돌려보기

```bash
npm install                      # 처음 한 번
npm test                         # 검사 전부 — 71초
node tests/smoke.mjs 확성기       # 그 절만 — 5초 (이름 조각으로 고른다)
node tools/shot.mjs --phone      # 폰 화면 찍기 (서버는 알아서 띄운다)
```

- **부분 실행으로 고치고, 푸시 전에 `npm test`를 한 번 돌린다.** 부분만 돌고
  넘어가면 남의 절을 깨뜨린 것을 못 본다.
- 로컬 서버는 **반드시 저장소 루트에서** 띄운다. 다른 데서 띄우면 전부 404가 나고
  「검사가 통째로 타임아웃」으로만 보인다.
- **playwright 스크립트는 저장소 안에 둔다.** `/tmp`에 두면 `node_modules`를 못 찾아
  `Cannot find package 'playwright'`가 난다. 웬만하면 `tools/shot.mjs`를 쓴다.
- 크롬 경로는 `/opt/pw-browsers/chromium`. 그냥 `chromium.launch()`를 부르면
  `Executable doesn't exist`로 죽는다.

## 고칠 때 같이 해야 하는 것

- `services.json`을 고쳤으면 **`python3 tools/build_list.py`** — `list.html`·
  `sitemap.xml`이 생성물이다. 잊으면 `npm test`가 잡는다.
- 좌표를 잴 때는 `node tools/shot.mjs --grid --crop 72,68,100,100`
- 마을 말고 다른 쪽을 찍을 때는 `--url`. **긴 문서는 `--el`로 절씩 찍는다** —
  한 장으로 떠내면 `<img>`만 백지로 나온다 (`node tools/shot.mjs --url /case/playgrown.html --el '.plan'`)
- 케이스 스터디 그림을 다시 자를 일이 생기면 `node tools/cut_case.mjs`
  (원본은 `_material/`, gitignore에 있다 — 없으면 배포 브랜치 이력에서 꺼낸다)

## 밟은 적 있는 지뢰

- **지도 위 스프라이트는 `bottom`으로 앉힌다.** `top` + `translateY(-100%)`은 안 된다 —
  그 -100%는 제 높이인데 그림이 오기 전엔 높이가 0이고, **iOS 사파리는 그림이 온 뒤에도
  다시 계산하지 않아** 폰에서만 마을이 통째로 흘러내린다. (app.js의 `upTo`)
- **적는 칸 글자는 16px 아래로 내리지 않는다.** iOS가 커서 들어갈 때 화면을 확대한다.
- **케이스 스터디는 굴릴 수 있는 곳이 하나뿐이어야 한다.** 문서는 100dvh로 못 박고
  굴리는 것은 화면 안에서만 — 마을 머리띠를 그냥 뒀더니 그 높이만큼 밀려 어긋났다.
  `.viewer`를 붙이는 것은 JS라, 없으면 그냥 굴리는 문서로 남는다 (이 되돌림을 깨지 않는다)
- **지도 위 문끼리 판정(44px)이 겹치지 않게.** 우편함과 확성기가 24px 겹쳐
  엉뚱한 것이 열린 적이 있다. `npm test`가 지킨다.
- **저장소 루트가 통째로 배포된다.** 새 파일을 루트에 두면 `/그이름`으로 누구나
  받아간다 — 배포에서 뺄 것은 **`.assetsignore`**에 적는다(지우는 게 아니다).
  잘라 쓴 원본을 루트에 둔 채로 두어, 덮어 둔 개인정보가 그대로 새어 나간 적 있다.
- **컨테이너는 자기 자신에게 질문하지 않는다.** `container-type`을 준 상자에
  제 `padding`을 `cqw`로 주면 바깥(뷰포트)을 기준으로 잡힌다 — 일력 집게와 낱장
  사이가 데스크톱에서만 100px 벌어졌다. 그 단위는 **자식에게만** 쓴다.
- **넘치는 화면을 `align-content: center`로 두지 않는다.** 화면보다 긴 절은 위쪽이
  굴려도 안 닿는 데로 밀려난다 — 표제가 통째로 사라진다. `safe center`를 쓴다.
- **스크롤로 굴러가는 애니메이션이 걸린 쪽은 playwright의 locator로 누르거나
  굴리지 않는다.** locator는 「요소가 멈출 때까지」 기다리는데 굴릴 때마다 조금씩
  움직여서 **영영 안 멈춘다.** `evaluate` 안에서 `element.click()`으로 한다
  (케이스 스터디에서 프로세스가 안 끝난 적 있다).
- 편집용 원본(`assets/sprites/*.png`, `assets/map/town.jpg`)은 `.gitignore`에 있어
  **새 컨테이너에는 없다.** 꺼내는 법은 README 「편집용 원본」.

## 글투

주석·커밋·문서 모두 **한국어**로, **왜 그렇게 했는지**를 적는다. 무엇을 했는지는
코드에 이미 있다. 이 저장소의 주석은 대부분 「한 번 깨졌던 이유」의 기록이다.
