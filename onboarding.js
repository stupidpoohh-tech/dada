/* DADA TOWN — 첫 방문 안내 · 투어가이드
 *
 * 처음 온 사람에게 **다원이 마을 밖에서 걸어 들어와** 인사하고, 앞으로 어떻게
 * 볼지를 고르게 한다. 고른 뒤에는 둘 중 하나다 — 그냥 마을(=원래 사이트)이거나,
 * 같은 지도 위에서 세 곳만 짚어 주는 투어다. **다른 페이지로 보내지 않는다.**
 *
 * 왜 파일이 따로인가
 *   app.js는 마을을 그리는 곳이고 여기는 마을 위에 잠깐 얹히는 겹이다. 섞어 두면
 *   나중에 안내를 걷어낼 때 마을까지 들춰야 한다. 여기서 마을에 하는 일은
 *   **이미 있는 문을 대신 눌러 주는 것**뿐이다(`door.click()`) — 그래서 항목을
 *   어떻게 여는지(책·외부 링크·구역 패널)를 이 파일은 하나도 몰라도 된다.
 *
 * app.js와 닿는 곳은 딱 하나
 *   `dada:ready` — 마을을 다 그린 뒤 app.js가 services.json을 실어 보낸다.
 *   (늦게 붙어도 되도록 `window.dadaTown.data`도 같이 본다)
 *
 * 언제 뜨는가
 *   첫 방문에만. 본 적이 있으면 그냥 마을이다. 주소에 `?intro`를 붙이면 언제든
 *   다시 뜬다 — 「다시 안내받기」 단추를 나중에 어디에 달든 이 주소만 열면 된다.
 */
(() => {
  'use strict';

  /* ── 투어가 데려갈 세 곳 ────────────────────
     **여기 세 줄이 투어의 전부다.** 이름·설명·주소는 적지 않는다 — id로
     services.json에서 찾아 쓴다. 한 군데에만 적혀 있어야 어긋나지 않는다.

     `door`는 지도 위에서 무엇을 밝힐지다. 안 적으면 그 항목이 사는 구역의
     건물이 문이다. 카페에는 항목이 둘(아니그래서·PlayGrown)인데 PlayGrown은
     까마귀가 따로 물고 있어서 그것만 적어 준다 — 안 그러면 2번과 3번이
     같은 건물을 두 번 밝힌다. */
  const TOUR = [
    { item: 'sindorang-demo' },
    { item: 'playgrown', door: '.crow-spot' },
    { item: 'anih' },
  ];

  const LINES = [
    '안녕하세요! 다원하는 다원이에요.',
    '저는 기획하고, 설계하고, 직접 만드는 사람이에요.',
    '여기는 제가 만든 것들이 사는 Dada Town이에요.',
  ];
  const CHOICE = ['천천히 마을을 구경해도 좋고,', '대표 프로젝트부터 빠르게 볼 수도 있어요.'];

  /* **이름을 바꿨다.** 예전에는 `dada.onboarded`에 「다녀갔다」를 적었는데,
     그 칸이 이미 '1'로 남아 있는 브라우저가 있다(먼저 올라간 판을 본 사람들).
     같은 칸을 끄는 스위치로 재활용하면 **그 사람들에게는 영영 안 뜬다** —
     다원님 폰이 그중 하나다. 뜻이 달라졌으니 칸도 새로 판다. */
  const OFF = 'dada.introOff';
  /* **마을을 떠났다 돌아오면 투어를 잇는다.** 투어의 셋 중 PlayGrown만 같은 탭으로
     간다(케이스 스터디). 거기서 다 보든 뒤로가기를 하든 「돌아가기」를 누르든
     전부 `/`로 오는데, 그때 투어가 없고 다원이 처음부터 다시 인사했다(2026-08-25).
     떠나기 직전에 몇 번째였는지를 적어 두고, 돌아오면 그 자리에서 잇는다.
     **sessionStorage다** — 탭을 닫으면 사라져야 한다. 다음에 새로 온 사람에게
     남의 투어 자리가 이어지면 안 된다. */
  const RESUME = 'dada.tourAt';
  /* ── 걸음 ──────────────────────────────────
     **걷는 시간도 걸음 박자도 거리에서 나온다.** 둘 다 고정이었던 적이 있다
     (1.5초 · 0.34초). 그런데 다원이 가는 거리는 화면마다 다르다 — 폰에서는
     200px 남짓인데 1440px 데스크톱에서는 600px이 넘는다. 같은 시간에 세 배를
     가니 **한 걸음에 몸폭의 두 배씩** 나아갔고, 그게 「슝 날아가면서 통통거린다」로
     보였다(2026-08-25. 폰은 멀쩡한데 PC만 이상하다고 한 것이 이것이다).

     그래서 둘 다 거리에서 뽑는다.
       ① 시간 = 거리 / SPEED    — 어느 화면에서나 비슷한 속도로 걷는다
       ② 박자 = 한 주기에 몸폭의 STRIDE배만 가도록 — 빨리 갈수록 발을 빨리 놓는다
     폰(200px·몸폭 72px)을 넣으면 **1.5초·0.34초가 그대로 나온다** — 다원님이
     좋다고 한 그 값이다. 여기를 손댈 때는 그 두 값이 유지되는지부터 본다. */
  const SPEED = 210;                 // px/s — 걷는 것으로 보이는 속도
  const STRIDE = 0.62;               // 한 주기(발 두 번)에 가는 거리 ÷ 몸폭

  /** 거리와 몸폭에서 「몇 초에 갈까 · 발을 얼마나 빨리 놓을까」를 정한다.
   *  `lo`~`hi`는 시간의 아래위 한계다 — 너무 짧으면 순간이동이고, 너무 길면
   *  말풍선이 뜨기까지 하염없이 기다리게 된다. */
  function gait(dist, w, lo, hi) {
    const ms = Math.min(Math.max(Math.round(dist / SPEED * 1000), lo), hi);
    // 속도(px/ms) = dist/ms 이므로, 한 주기에 STRIDE*w 를 가려면 이만큼 걸린다
    const pace = Math.min(Math.max(Math.round(STRIDE * w * ms / dist), 200), 340);
    return { ms, pace };
  }
  const SPR = 'assets/sprites/cut/';
  const FRONT = 'me.png';
  /* 뒷모습. 「탐험하기」를 고르면 다원이 **돌아서서** 제자리로 걸어간다.
     앞모습과 **같은 캔버스(98x130)·같은 밑변**이라 겹쳐 놓고 크로스페이드만 하면
     된다 — `tools/cut_me_back.py`가 그렇게 맞춰 떠낸다. 비워 두면 앞모습 그대로
     물러난다(그림이 없다고 연출이 멈추지는 않게). */
  const BACK = 'me-back.png';

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const narrow = () => matchMedia('(max-width: 699px)').matches;
  const track = (name, params) => { if (window.dadaTrack) window.dadaTrack(name, params); };

  let data = null;
  let phase = 'off';                 // off · entering · intro · choice · tour
  let line = 0, at = 0;              // 몇 번째 대사 · 몇 번째 투어
  let scrim, layer, ch, bubble, card, walkMs = 1500;
  let dims = [], ring = null;
  let onMapClick = null;

  /* ── 뜰 자리인가 ──────────────────────────
     **올 때마다 뜬다.** 한때 첫 방문에만 뜨게 하고 localStorage에 다녀갔다고
     적었는데, 다원님이 뒤집었다(2026-08-25) — 새로고침해도 다시 나와야 한다.
     그래서 **여기서는 아무것도 적지 않는다.** 뒤로가기로 돌아와도, 새로 열어도,
     매번 처음처럼 인사한다.

     끄는 문은 남겨 뒀다(`OFF`). 지금은 그것을 켜는 UI가 없고 회귀 테스트만
     쓴다 — 검사 페이지 서른몇 개가 매번 안내 덮개를 누르지 않도록.
     「다시 보지 않기」를 붙이기로 하면 이 한 칸에 '1'만 넣으면 된다.

     안 뜨는 자리는 셋이다.
       ?intro   — 반대로 **언제나** 뜬다 (「다시 안내받기」가 붙을 자리)
       ?tune    — 좌표 재는 중이라 방해하지 않는다
       #해시    — 공유받은 책을 열러 온 사람이다. 볼 것을 정하고 왔다 */
  function wanted() {
    const q = new URLSearchParams(location.search);
    if (q.has('intro')) return true;
    if (q.has('tune') || location.hash) return false;
    try { return !localStorage.getItem(OFF); } catch (e) { return true; }
  }

  /* ── 자리 재기 ────────────────────────────
     다원과 말풍선은 **지도에서 잰다.** 겹 자체는 `position: fixed`(뷰포트)라
     지도 밖으로 걸어 나갈 수 있고, 그 안에서 자리만 지도를 따라간다.
     굴리거나 창 크기가 바뀌면 다시 잰다. */
  function place() {
    if (phase === 'off' || !layer) return;
    const map = document.getElementById('map');
    if (!map) return;
    const m = map.getBoundingClientRect();
    const small = narrow();

    /* **넓은 화면에서는 다원이 더 커야 한다.** 크기 자체가 예쁘고 말고의 문제가
       아니라 **걸음이 그것으로 정해져서**다. 다원은 화면 밖에서 지도 안까지
       걸어오는데, 몸이 작으면 그 거리가 제 몸길이의 여섯 배가 넘는다. 보폭을
       몸에 맞춰 두면(STRIDE) 그만큼 발을 자주 놓아야 해서 초당 아홉 번씩
       들썩였다 — 걷는 게 아니라 떠는 것으로 보였다(「두두두두 둔탁하다」,
       2026-08-25). 폰에서는 두세 배뿐이라 처음부터 멀쩡했다.
       0.24로 키우면 넓은 화면에서도 건너는 거리가 제 몸의 네 배쯤이 되고,
       걸음 박자가 폰과 같은 0.34초로 떨어진다. */
    const w = small ? Math.min(88, Math.max(62, m.width * 0.20))
                    : Math.min(200, Math.max(120, m.width * 0.24));
    const h = w * 130 / 98;                       // me.png 원래 비율
    const cx = m.left + m.width * (small ? 0.20 : 0.15);
    const cb = innerHeight - m.bottom + m.height * (small ? 0.04 : 0.02);

    if (ch && ch.isConnected) {          // 투어 중이면 다원은 이미 걸어 나갔다
      ch.dataset.home = String(Math.round(cx));
      ch.style.width = Math.round(w) + 'px';
      ch.style.bottom = Math.round(cb) + 'px';
      if (ch.dataset.walked) ch.style.left = Math.round(cx) + 'px';
    }

    if (bubble) {
      bubble.style.setProperty('--onb-by', Math.round(cb + h * (small ? 1 : .6) + (small ? 12 : 0)) + 'px');
      bubble.style.setProperty('--onb-bx', small ? '' : Math.round(cx + w * 0.44) + 'px');
    }
    /* 투어 중이라면 밝힌 자리도 다시 잰다 — 창 크기가 바뀌면 지도가 줄어드는데
       그늘과 테두리는 지도 픽셀로 박혀 있어서, 다시 안 재면 엉뚱한 곳이 밝다 */
    if (card) {
      const cur = phase === 'tour' && stops()[at];
      if (cur) spotlight(cur.door);
      placeCard(m);
    }
  }

  /* 뷰포트 왼쪽 **바깥**. 다원 폭까지 빼서 몸이 완전히 나가 있게 한다 —
     조금이라도 걸쳐 있으면 「밖에서 들어온다」가 아니라 「끝에서 미끄러진다」가 된다. */
  const outside = () => -(Math.round(parseFloat(ch.style.width) || 120) + 40);

  /* ── 다원이 들어온다 ──────────────────────── */
  function enter() {
    phase = 'entering';
    document.body.classList.add('dada-onboarding');
    track('intro_start', {});

    place();
    const from = outside();
    const g = gait(Math.abs(+ch.dataset.home - from), parseFloat(ch.style.width), 1500, 2200);
    walkMs = g.ms;
    ch.style.setProperty('--onb-dur', g.ms + 'ms');
    ch.style.setProperty('--onb-step', g.pace + 'ms');
    ch.style.left = from + 'px';
    ch.classList.add('walking');

    // 한 프레임 뒤에 목적지를 준다 — 같은 프레임에 두 값을 넣으면 브라우저가
    // 마지막 것만 보고 전환 없이 순간이동한다
    requestAnimationFrame(() => requestAnimationFrame(() => {
      ch.dataset.walked = '1';
      ch.style.left = ch.dataset.home + 'px';
    }));

    const arrive = () => {
      if (phase !== 'entering') return;
      ch.classList.remove('walking');
      ch.classList.add('landed');
      /* **착지 뒤에는 선 채로 숨쉰다.** 예전에는 여기서 끝이었는데, 착지 동작이
         `both`라 마지막 프레임에 얼어붙어 말풍선이 세 번 넘어가는 동안 내내
         목석처럼 서 있었다. 착지가 끝나는 자리에서 숨쉬기로 갈아탄다. */
      setTimeout(() => {
        if (phase === 'off') return;
        ch.classList.remove('landed');
        ch.classList.add('idle');
      }, reduced() ? 0 : 520);
      say(0);
    };
    ch.addEventListener('transitionend', (e) => { if (e.propertyName === 'left') arrive(); }, { once: true });
    // 전환이 아예 안 걸리는 경우(탭이 뒤에 있어 rAF가 안 돌았다)를 위한 보험
    setTimeout(arrive, walkMs + 260);
  }

  /* ── 말풍선 ────────────────────────────────
     대사는 한 줄씩. 자동으로 넘어가지 않는다 — 「다음」을 누르거나 아무 데나
     누르면 넘어간다. 읽는 속도는 사람마다 다르다. */
  function say(i) {
    phase = 'intro';
    line = i;
    const last = i === LINES.length - 1;
    fill([LINES[i]], (act) => {
      const next = el('button', 'onb-btn go', last ? '반가워!' : '다음');
      next.type = 'button';
      next.addEventListener('click', advance);
      act.appendChild(next);
      /* **마지막 줄에는 건너뛰기를 안 붙인다.** 세 줄을 다 읽은 사람에게
         「건너뛸래요?」는 이미 늦은 말이다 — 건너뛸 것이 남아 있지 않다.
         그 자리에 남는 단추는 인사를 받는 말 하나여야 한다. */
      if (!last) {
        const skip = el('button', 'onb-skip', '안내 건너뛰기');
        skip.type = 'button';
        skip.addEventListener('click', () => finish('skip'));
        act.appendChild(skip);
      }
      return next;
    });
  }

  function advance() {
    if (phase !== 'intro') return;
    if (line < LINES.length - 1) say(line + 1);
    else choose();
  }

  /* ── 갈림길 ────────────────────────────────
     **두 버튼의 위계는 같다.** 어느 쪽이 옳은 선택이라고 말하지 않는다. */
  function choose() {
    phase = 'choice';
    scrim.classList.add('quiet');       // 여기서는 아무 데나 눌러 넘기지 않는다
    fill(CHOICE, (act) => {
      act.classList.add('stack');
      const a = el('button', 'onb-btn', '탐험하기');
      a.type = 'button';
      a.addEventListener('click', () => finish('explore'));
      const b = el('button', 'onb-btn', '투어가이드 받을래요');
      b.type = 'button';
      b.addEventListener('click', startTour);
      act.append(a, b);
      return a;
    });
  }

  /** 말풍선 속을 갈아 끼운다. 상자는 그대로 두고 글과 단추만 바꾼다 —
   *  대사마다 새로 만들면 말풍선이 매번 뽀용 하고 다시 뜬다(과하다). */
  function fill(lines, buttons) {
    if (!bubble) {
      bubble = el('div', 'onb-bubble');
      bubble.setAttribute('role', 'dialog');
      bubble.setAttribute('aria-label', '다원의 인사');
      /* **읽어 주는 자리는 살아남는 요소에 건다.** 대사마다 새 div를 만들어
         거기에 aria-live를 걸면, 스크린리더가 그 자리를 알기도 전에 내용이 이미
         들어 있어 아무 말도 안 한다 — 말풍선은 처음 한 번만 만들고 속만 간다. */
      bubble.setAttribute('aria-live', 'polite');
      layer.appendChild(bubble);
    }
    bubble.textContent = '';
    const body = el('div', 'onb-body');
    lines.forEach((t) => body.appendChild(el('p', 'onb-line', t)));
    bubble.appendChild(body);
    const act = el('div', 'onb-act');
    const focusMe = buttons(act);
    bubble.appendChild(act);
    place();
    beat();
    focusMe.focus({ preventScroll: true });
  }

  /** 말이 바뀔 때마다 한 번 끄덕인다 — 말풍선만 갈리고 사람은 가만있으면
   *  글자만 바뀌는 판때기가 된다. 클래스를 뗐다 붙이는 사이에 리플로우를 한 번
   *  일으켜야 애니메이션이 **처음부터** 다시 돈다 (마을의 folks-pop과 같은 수). */
  function beat() {
    if (!ch || !ch.isConnected) return;
    ch.classList.remove('beat');
    void ch.offsetWidth;
    ch.classList.add('beat');
  }

  /* ── 안내를 접는다 ────────────────────────
     **마을 조작은 다원이 사라지기를 기다리지 않는다** — 걸어가는 동안에도 이미
     누를 수 있다(12항: 애니메이션이 상호작용을 막지 않는다). 다원은 그동안
     `pointer-events: none`이라 지나가며 무엇을 가리지도 않는다. */
  function finish(how, then) {
    if (phase === 'off') return;
    track('intro_choice', { choice: how });
    phase = 'off';
    if (scrim) { scrim.remove(); scrim = null; }
    if (bubble) { bubble.remove(); bubble = null; }

    const done = () => {
      if (ch) ch.remove();
      document.body.classList.remove('dada-onboarding');
      if (then) then();
    };

    /* **「탐험하기」를 고른 사람에게만 제자리로 돌아가는 것을 보여준다.**
       투어는 지도가 곧바로 필요하고, 「건너뛰기」는 「그만 보고 싶다」는 뜻이라
       둘 다 1.2초를 더 붙들면 안 된다 — 그쪽은 아래 짧은 갈음으로 끝낸다. */
    if (how === 'explore' && goHome(done)) return;

    /* 나갈 때도 **페이드는 남긴다.** 사라지는 것을 못 보면 「없어졌다」가 아니라
       「끊겼다」로 읽힌다. 줄여 달라고 한 사람에게서 빼는 것은 옆으로 걸어가는
       것뿐이다 — 자리 이동이 없으면 흐려지는 것만으로도 충분히 읽힌다. */
    if (!reduced()) {
      ch.style.setProperty('--onb-dur', '.5s');
      ch.style.left = Math.round(parseFloat(ch.style.left) + parseFloat(ch.style.width) * 0.7) + 'px';
    }
    ch.classList.add('gone');
    setTimeout(done, 520);
  }

  /** 다원이 **제자리로 걸어 돌아간다.**
   *
   *  마중 나온 이야기를 마중 나온 자리에서 끝내면 「사라졌다」로 읽힌다. 지도 위
   *  "나"(services.json의 `character`)가 원래 서 있던 그 자리로 뒤뚱뒤뚱 걸어가서,
   *  거기서 **겹쳐 바뀐다** — 그래야 지도 위의 그 캐릭터가 왜 거기 있는지도 말이 된다.
   *
   *  목적지는 좌표로 적지 않고 **`.me-spot`을 실제로 재서** 쓴다. 안내 중에는
   *  `visibility: hidden`이지만 자리는 그대로 차지하고 있어 잴 수 있다. 좌표를
   *  베껴 두면 다원님이 `character`를 옮겼을 때 여기만 옛 자리에 남는다.
   *  **버튼을 재는 것도 이유가 있다** — 흔들리는 것은 안쪽 `.me-figure`고 버튼은
   *  가만히 있다(styles.css). 안쪽을 재면 착지점이 숨쉬기 박자만큼 흔들린다.
   *
   *  가로로 가면서 **위로 조금 오르고 작아진다.** 멀어지는 것처럼 보이려면 그래야
   *  하고, 도착했을 때 크기가 지도 위 "나"와 같아야 겹쳐 바뀌는 것이 티가 안 난다.
   *
   *  잴 것이 없으면(캐릭터 구역이 없는 데이터) `false`를 돌려 짧은 갈음으로 보낸다. */
  function goHome(done) {
    const spot = document.querySelector('.me-spot');
    if (!spot) return false;
    const r = spot.getBoundingClientRect();
    if (!r.width || !r.height) return false;

    // 돌아가는 길도 같은 규칙으로 잰다 — 여기도 화면마다 거리가 두 배 넘게 다르다
    const g = gait(Math.abs(r.left + r.width / 2 - parseFloat(ch.style.left)),
                   parseFloat(ch.style.width), 900, 1600);
    const ms = g.ms;
    ch.classList.remove('idle', 'beat');
    if (BACK) ch.classList.add('away');        // 돌아선다 (뒷모습으로 빠르게 바뀐다)
    ch.classList.add('home', 'walking');       // 뒤뚱뒤뚱은 들어올 때와 같은 것을 쓴다
    ch.style.setProperty('--onb-dur', ms + 'ms');
    ch.style.setProperty('--onb-step', g.pace + 'ms');
    // 한 프레임 뒤에 목적지를 준다 — 같은 프레임에 두 값을 넣으면 전환 없이 순간이동한다
    requestAnimationFrame(() => {
      ch.style.left = Math.round(r.left + r.width / 2) + 'px';
      ch.style.bottom = Math.round(innerHeight - r.bottom) + 'px';
      ch.style.width = Math.round(r.width) + 'px';
    });

    setTimeout(() => {
      /* 도착 — 여기서 **겹쳐 바꾼다.** 지도 위 "나"를 먼저 켜고(같은 자리·같은 크기)
         안내 쪽을 흐린다. 순서가 반대면 한 프레임 동안 아무도 없는 자리가 생겨
         깜빡인 것처럼 보인다. */
      document.body.classList.remove('dada-onboarding');
      ch.classList.add('gone');
      setTimeout(done, 260);
    }, ms);
    return true;
  }

  /* ── 투어 ──────────────────────────────────
     같은 지도 위에서 벌어진다. 지도만 그늘지고 추천 대상만 밝다 —
     화면 전체를 어둡게 하지도, 다른 테마를 꺼내지도 않는다. */
  function stops() {
    return TOUR.map((t) => {
      const item = data.items.find((x) => x.id === t.item);
      if (!item) return null;
      const sel = t.door || `[data-district="${item.district}"]`;
      const door = document.querySelector(sel);
      return door ? { item, door } : null;
    }).filter(Boolean);
  }

  function startTour() {
    const list = stops();
    if (!list.length) return finish('explore');
    finish('tour', () => beginTour(0));
  }

  /** 투어를 편다. 인사를 거쳐서 올 수도 있고(startTour), 케이스 스터디를 보고
   *  돌아와 그 자리에서 이어 붙일 수도 있다(boot). 뒤쪽에는 다원도 덮개도 없다. */
  function beginTour(from) {
    {
      clearResume();          // 여기까지 왔으면 이어 붙인 것이다 — 한 번만 잇는다
      document.body.classList.add('dada-touring');
      phase = 'tour';
      at = 0;
      const map = document.getElementById('map');
      dims = ['t', 'r', 'b', 'l'].map((side) => {
        const d = el('div', 'onb-dim');
        d.dataset.side = side;
        d.addEventListener('click', (e) => e.stopPropagation());
        map.appendChild(d);
        return d;
      });
      ring = el('div', 'onb-ring');
      map.appendChild(ring);

      card = el('div', 'onb-tour');
      card.setAttribute('role', 'dialog');
      card.setAttribute('aria-label', '투어가이드');
      card.setAttribute('aria-live', 'polite');   // 말풍선과 같은 이유로 여기 건다
      layer.appendChild(card);

      /* 밝혀 둔 것을 **직접** 눌러도 된다. 그때는 투어를 먼저 걷어야 한다 —
         안 그러면 구역 패널이 그늘 밑에서 열린다(실제로 그렇게 만들어 봤다). */
      onMapClick = (e) => {
        const cur = stops()[at];
        if (cur && cur.door.contains(e.target)) endTour('target');
      };
      map.addEventListener('click', onMapClick, true);

      track('tour_start', { from: from + 1 });
      step(from);
    }
  }

  function step(i) {
    const list = stops();
    at = Math.max(0, Math.min(i, list.length - 1));
    const { item, door } = list[at];
    spotlight(door);

    card.textContent = '';
    const head = el('div', 'onb-tour-head');
    head.appendChild(el('span', 'onb-count', `${at + 1} / ${list.length}`));
    const x = el('button', 'icon-btn onb-tour-close', '✕');
    x.type = 'button';
    x.setAttribute('aria-label', '투어 종료');
    x.addEventListener('click', () => endTour('close'));
    head.appendChild(x);
    card.appendChild(head);

    const body = el('div', null);
    body.appendChild(el('p', 'onb-tour-name', item.name));
    body.appendChild(el('p', 'onb-tour-desc', item.description || ''));
    card.appendChild(body);

    const act = el('div', 'onb-tour-act');
    const prev = el('button', 'onb-btn', '이전');
    prev.type = 'button';
    prev.disabled = at === 0;
    prev.addEventListener('click', () => step(at - 1));
    act.appendChild(prev);

    const open = el('button', 'onb-btn go', '열어보기');
    open.type = 'button';
    open.addEventListener('click', () => {
      track('tour_open', { item: item.id, step: at + 1 });
      /* **문이 아니라 그 항목을 연다.** 예전에는 지도 위 문을 대신 눌렀는데
         (`door.click()`), 회사 건물은 **구역 패널**을 여는 문이라 「사업팀
         운영보드」를 누른 사람에게 회사 목록이 떴다. 투어가 가리키는 것은
         구역이 아니라 항목이므로, 항목을 여는 문(app.js의 `openItem`)으로 간다.

         **그리고 투어를 끝내지 않는다.** 셋 중 둘은 새 탭으로 열려서, 보고
         돌아오면 투어가 그 자리에 있어야 한다 — 예전에는 열자마자 끝나서
         돌아왔을 때 아무것도 없었다. 이 페이지를 떠나는 것(같은 탭 이동·책)
         일 때만 끝낸다. 살아 있을 자리가 없어서다. */
      const town = window.dadaTown;
      const res = town && town.open ? town.open(item.id, 'tour') : null;
      if (!res) { endTour('open'); door.click(); return; }   // 못 열면 문이라도 두드린다
      if (res.stays) return;                     // 새 탭 — 투어는 그대로 두고 기다린다
      if (res.leaves) {
        /* 같은 탭으로 떠난다. **투어를 접지 않고 자리를 적어 둔다** — 돌아오면
           그 자리에서 잇는다. 화면은 곧 넘어가므로 그대로 두는 편이 덜 깜빡인다. */
        try { sessionStorage.setItem(RESUME, String(at)); } catch (e) { /* 시크릿 창 */ }
        return;
      }
      endTour('open');                           // 책처럼 지도를 통째로 덮는 것
    });
    act.appendChild(open);

    act.appendChild(el('span', 'spacer'));

    const next = el('button', 'onb-btn', at === list.length - 1 ? '마치기' : '다음');
    next.type = 'button';
    next.addEventListener('click', () => (at === list.length - 1 ? endTour('done') : step(at + 1)));
    act.appendChild(next);
    card.appendChild(act);

    place();
    next.focus({ preventScroll: true });
    track('tour_step', { step: at + 1, item: item.id });
  }

  /** 추천 대상만 남기고 지도를 덮는다. 덮개가 **넉 장**인 이유는 onboarding.css 참고
   *  (가운데는 애초에 덮인 적이 없어야 그냥 눌린다).
   *  구멍은 판정 영역(버튼 전체)이 아니라 **눈에 보이는 그림**에 맞춘다 — 회사 구역
   *  상자는 지도의 18×34%나 돼서, 그대로 뚫으면 무엇을 가리키는지 알 수 없다. */
  function spotlight(door) {
    const map = document.getElementById('map');
    const m = map.getBoundingClientRect();
    const vis = door.querySelector('.pop, .crow-figure, .me-figure, .mbox, .horn-fig') || door;
    const r = vis.getBoundingClientRect();
    const PAD = 10;
    const x = Math.max(0, r.left - m.left - PAD);
    const y = Math.max(0, r.top - m.top - PAD);
    const w = Math.min(m.width - x, r.width + PAD * 2);
    const h = Math.min(m.height - y, r.height + PAD * 2);
    const px = (v) => Math.round(v) + 'px';

    const box = {
      t: { left: 0, top: 0, width: m.width, height: y },
      b: { left: 0, top: y + h, width: m.width, height: Math.max(0, m.height - y - h) },
      l: { left: 0, top: y, width: x, height: h },
      r: { left: x + w, top: y, width: Math.max(0, m.width - x - w), height: h },
    };
    dims.forEach((d) => Object.assign(d.style, {
      left: px(box[d.dataset.side].left), top: px(box[d.dataset.side].top),
      width: px(box[d.dataset.side].width), height: px(box[d.dataset.side].height),
    }));
    Object.assign(ring.style, { left: px(x), top: px(y), width: px(w), height: px(h) });
    card.dataset.cy = String((y + h / 2) / m.height);
  }

  /** 투어 카드는 **추천 대상이 없는 쪽**에 붙는다. 폰에서는 아래 시트라 CSS가 맡는다. */
  function placeCard(m) {
    if (narrow()) {
      // 폰에서는 아래 시트다. 자리는 CSS가 잡으므로 인라인으로 넣어 둔 것을 지운다
      card.style.top = card.style.bottom = card.style.left = card.style.right = '';
      return;
    }
    // 좌우를 지도에 맞춰 두면 `margin-inline: auto`가 그 안에서 가운데 놓는다
    card.style.left = Math.round(m.left) + 'px';
    card.style.right = Math.round(innerWidth - m.right) + 'px';
    const top = parseFloat(card.dataset.cy || '.6') > .5;
    if (top) { card.style.top = Math.round(m.top + 14) + 'px'; card.style.bottom = ''; }
    else { card.style.bottom = Math.round(innerHeight - m.bottom + 14) + 'px'; card.style.top = ''; }
  }

  /** 투어를 걷는다. 셋을 다 봐야만 나갈 수 있게 하지 않는다 — 언제든 여기로 온다. */
  function endTour(how) {
    if (phase !== 'tour') return;
    phase = 'off';
    track('tour_end', { how, step: at + 1 });
    const map = document.getElementById('map');
    if (onMapClick) { map.removeEventListener('click', onMapClick, true); onMapClick = null; }
    // 투어를 접었으면 「돌아올 자리」도 지운다 — 안 지우면 다음에 들어올 때 되살아난다
    clearResume();
    dims.forEach((d) => d.remove()); dims = [];
    if (ring) { ring.remove(); ring = null; }
    if (card) { card.remove(); card = null; }
    document.body.classList.remove('dada-touring');
  }

  /* ── 붙이기 ────────────────────────────────
     겹은 `.map-holder`가 아니라 화면 전체를 덮는다(`position: fixed`).
     `.map` 안에 두면 `overflow: hidden`에 잘려 **밖에서 걸어 들어오는 것 자체가
     안 보이고**, `.map-holder`에 두면 지도 왼쪽 여백까지밖에 못 나간다. */
  /** @param greet 인사부터 하는가. 투어만 이어 붙일 때는 덮개도 다원도 없다 */
  function build(greet) {
    layer = el('div', 'onb');
    document.body.appendChild(layer);
    if (greet) greeter();
    wire();
  }

  function greeter() {
    scrim = el('div', 'onb-scrim');
    scrim.addEventListener('click', () => { if (phase === 'intro') advance(); });
    document.body.appendChild(scrim);

    ch = el('div', 'onb-char');
    /* 껍질이 셋인 이유. **한 요소에 애니메이션 둘을 걸 수 없다** — 나중 것이 앞
       것을 지운다. 그래서 하는 일마다 제 껍질을 준다(확성기의 .horn-zoom과 같다).
         .onb-char  가로 이동 (transition)        — 걸어 들어오고 나간다
         .onb-step  걸음 · 착지 · 숨쉬기 (무한)   — 서로 갈아드는 상태 하나
         .onb-beat  말이 바뀔 때 한 번 끄덕임     — 숨쉬기를 끊지 않고 겹친다 */
    const step2 = el('span', 'onb-step');
    const beatBox = el('span', 'onb-beat');
    const img = new Image();
    img.className = 'onb-front';
    img.src = SPR + FRONT;
    img.alt = '';                      // 옆의 말풍선이 이미 누구인지 말한다
    beatBox.appendChild(img);
    // 뒷모습은 앞모습 **위에 겹쳐** 둔다. 자리를 나눠 쓰면 돌아설 때 키가 튄다
    if (BACK) {
      const back = new Image();
      back.className = 'onb-back';
      back.src = SPR + BACK;
      back.alt = '';
      beatBox.appendChild(back);
    }
    step2.appendChild(beatBox);
    ch.appendChild(step2);
    layer.appendChild(ch);
  }

  function wire() {
    let t = null;
    const relayout = () => { cancelAnimationFrame(t); t = requestAnimationFrame(place); };
    addEventListener('resize', relayout);
    addEventListener('scroll', relayout, { passive: true });

    /* **뒤로 가기가 페이지를 통째로 되살릴 때**(bfcache)는 스크립트가 다시 돌지
       않는다 — boot()도 안 불린다. 그때 화면에 투어가 없는데 「돌아올 자리」만
       남아 있으면, 여기서 이어 붙인다. 되살아난 화면에 투어가 이미 있으면
       그것이 곧 이어진 것이므로 자리만 지운다. */
    addEventListener('pageshow', (e) => {
      if (!e.persisted || !data) return;
      const back = resumeAt();
      if (back === null) return;
      if (phase === 'tour') { clearResume(); return; }
      if (!stopsReady()) { clearResume(); return; }
      if (!layer) build(false);
      beginTour(back);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (phase === 'tour') endTour('esc');
      else if (phase !== 'off') finish('skip');
    });
    // 안내가 떠 있는 동안에는 탭이 말풍선 안에서만 돈다 — 뒤의 지도로 새면
    // 무엇에 포커스가 갔는지 보이지 않는다(덮개가 가로막고 있어서 눌리지도 않는다)
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab' || !bubble || phase === 'off') return;
      const its = bubble.querySelectorAll('button');
      if (!its.length) return;
      const first = its[0], last = its[its.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  /** 떠나기 전에 적어 둔 투어 자리를 읽는다. 값이 없거나 이상하면 `null`.
   *
   *  **읽으면서 지우지 않는다.** 한때 그랬는데, 읽고 나서 「그런데 문이 하나도
   *  안 그려져 있네」로 되돌아가는 길(stopsReady가 false)이 있어서 그때 자리가
   *  조용히 날아갔다 — 돌아왔는데 투어가 없고 인사가 다시 나오는 꼴이다.
   *  **정말 이어 붙인 뒤에** 지운다(clearResume). */
  function resumeAt() {
    let v = null;
    try { v = sessionStorage.getItem(RESUME); } catch (e) { /* 시크릿 창 */ }
    const n = v === null ? null : parseInt(v, 10);
    return Number.isInteger(n) && n >= 0 ? n : null;
  }
  const clearResume = () => {
    try { sessionStorage.removeItem(RESUME); } catch (e) { /* 시크릿 창 */ }
  };

  function boot(d) {
    if (phase !== 'off' || !d) return;
    data = d;

    /* **케이스 스터디를 보고 돌아온 길이면 인사를 건너뛴다.** 방금 인사를 듣고
       투어를 고른 사람에게 처음부터 다시 인사하면, 안내가 아니라 벽이 된다. */
    const back = resumeAt();
    if (back !== null && stopsReady()) { build(false); beginTour(back); return; }
    if (back !== null) clearResume();   // 이어 붙일 수 없는 자리였다 — 남겨 두면 계속 걸린다

    if (!wanted()) return;
    build(true);
    enter();
  }

  const stopsReady = () => stops().length > 0;

  document.addEventListener('dada:ready', (e) => boot(e.detail && e.detail.data), { once: true });
  if (window.dadaTown && window.dadaTown.data) boot(window.dadaTown.data);
})();
