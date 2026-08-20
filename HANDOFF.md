# 이어받기 (2026-08-20)

새 세션에서 이 저장소를 이어 작업할 때 **먼저 읽을 것.** 설계와 원리는
[README.md](README.md)에 있다 — 여기에는 그것만으로는 알 수 없는 것만 적는다.

---

## 1. 브랜치가 둘이다 — 둘 다 밀어야 한다

이 세션에서 **실제로 한 번 사고가 났던 부분이다.** 작업은 다 해놓고 개발
브랜치에만 올려서, 사이트에는 아무것도 안 바뀐 채로 "적용이 안 됐다"는 말을 들었다.

| 브랜치 | 역할 |
|---|---|
| `claude/dada-portfolio-dev-dde40f` | 개발 — 여기서 작업하고 커밋한다 |
| `claude/portfolio-web-planning-jjx9xd` | **배포** — Cloudflare가 이 브랜치를 본다 |

```bash
git push -u origin claude/dada-portfolio-dev-dde40f
git fetch origin claude/portfolio-web-planning-jjx9xd
git merge-base --is-ancestor origin/claude/portfolio-web-planning-jjx9xd HEAD \
  && git push origin HEAD:claude/portfolio-web-planning-jjx9xd
```

**배포 브랜치는 다원님이 그림 파일을 올리는 곳이기도 하다.** 새 파일을 받기로
했다면 먼저 `git fetch` 후 fast-forward로 받아온 다음에 작업한다.

지금 두 브랜치 모두 `12241df`.

---

## 2. 그림 파일을 주고받는 방법

채팅 첨부로는 잘 안 들어온다. **다원님이 GitHub 웹에서 배포 브랜치에 직접
업로드**하고, 이쪽에서 `git fetch`로 받는다 — 이 세션 내내 그렇게 했다.
업로드된 파일은 저장소 루트에 떨어지므로 알맞은 자리로 옮긴다.

---

## 3. 편집용 원본은 새 컨테이너에 없다

`assets/sprites/*.png`과 `assets/map/town.jpg`는 `.gitignore`에 있다(README
「편집용 원본」). 컨테이너가 새로 뜨면 **이 파일들이 없다.** 스프라이트를 다시
자를 일이 생기면 아래에서 꺼낸다.

```bash
# 건물·우편함·배경 (2026-08 새로 받은 것)
git show e2347b8:buildings.png       > assets/sprites/buildings.png
git show e2347b8:mailbox.png         > assets/sprites/mailbox.png
git show e2347b8:town-background.png > /tmp/town-background.png

# 확성기 · 쪽지 (업로드 당시 이름이 UUID였다)
git show 8f33937:bd0b542d-d101-4d70-936f-ddd6bbaae0ea.png > assets/sprites/horn.png
git show 0ce590a:320da798-569a-41e6-a165-07127d7f1ec1.png > assets/sprites/note.png

# 옛 시트들 + 건물이 박혀 있던 옛 지도
git show 86bfa0a:assets/sprites/people.png > assets/sprites/people.png   # birds·cars·clouds·me 도 같은 커밋
git show 86bfa0a:assets/map/town.jpg       > /tmp/old-town.jpg
```

지금 쓰는 배경 원본(`assets/map/town.jpg`)은 `town-background.png`를 RGB로 눕힌
것이다. 알파가 226~251로 깔려 있지만 의미 있는 투명이 아니라 그냥 평탄화하면 된다.

```python
from PIL import Image
Image.open('/tmp/town-background.png').convert('RGB').save('assets/map/town.jpg', quality=95)
```

**`crow.png`(까마귀 시트)만은 저장소 어디에도 없다.** 저장소 전체 blob을 크기로
훑어봐도 안 나온다 — 까마귀를 다시 자를 일이 생기면 다원님께 다시 받아야 한다.
잘라놓은 세 장(`cut/crow-*.png`)은 커밋돼 있으니 지금 화면은 멀쩡하다.

---

## 4. 돌려보기

```bash
python3 -m http.server 8000 &     # 반드시 저장소 루트에서
npm test                          # 122개
```

- `npm test`는 8000번에 뜬 서버를 쓴다. **다른 디렉터리에서 띄우면 404가 나면서
  테스트가 통째로 타임아웃난다** — 이 세션에서 한 번 겪었다.
- Playwright 스크립트는 `node_modules`를 찾아야 하므로 **저장소 안에** 두고 돌린다.
  (`/tmp`에 두면 `Cannot find package 'playwright'`)
- `services.json`을 고쳤으면 `python3 tools/build_list.py`를 같이 돌린다.

---

## 5. 방금 끝낸 일 (커밋 셋)

| 커밋 | 내용 |
|---|---|
| `4efe3cb` | 건물·우편함을 지도 클론에서 **독립 스프라이트**로 재구성 (`syncPops()`·마스크 제거) |
| `7ec12d7` | **구름·새·자동차 삭제** — canopy·`.sky`·`.road` 레이어도 함께 |
| `12241df` | 건물 크기를 빈 터에 맞춤 · **채도 0.75배** · 확성기를 지붕→마당 |

곁들여 고친 것: 노래 패널이 지도를 건너뛰어 카페를 덮던 `placePanel` 버그
(오른쪽 절반의 앵커는 오른쪽 끝에 붙인다).

---

## 6. 아직 안 물어본 것 · 눈으로 봐줘야 할 것

- **건물 좌표는 자동으로 잰 값이다.** 배경에서 빈 잔디를 재서 그림 비율대로
  가장 큰 자리를 찾은 뒤 몇 개는 손으로 다듬었다. 다원님이 실제 화면에서 보고
  "어느 건물이 어느 쪽으로"라고 짚어주면 그때 미세조정한다.
- **채도 0.75**는 실측(옛 건물 대비 1.34배 → 0.745)과 눈이 만난 값이다.
  더 낮추거나 올리려면 `tools/cut_buildings.py`의 `SATURATION` 한 줄 —
  다만 `buildings.png`를 §3에서 꺼내와야 다시 자를 수 있다.
- **확성기가 마당에 서 있는 크기(w 3.4)** — 지붕에서 내려오며 키운 값이라
  마당에서 커 보이면 줄인다.
- **잔디에 앉은 새 둘**은 남겨뒀다. "새 삭제"에 이것까지 포함이었는지 확인 안 됨.
- 안 쓰는 그림 244KB는 지우지 않고 `.assetsignore`로 배포에서만 뺐다.
  되살리려면 그 줄만 지우면 된다.

---

## 7. 이 파일

일회용이다. 다음 세션이 자리를 잡고 나면 지워도 된다 —
오래 남길 내용은 전부 README.md·PLAN.md 쪽에 이미 들어가 있다.
(`*.md`는 `.assetsignore`에 있어 배포에는 안 올라간다.)
