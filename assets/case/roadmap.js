/* PlayGrown — 문제해결 로드맵 (얹은 층)
 *
 * **아래 아홉 장은 하나도 안 건드린다.** 이 파일이 하는 일은 그 아홉을 여섯
 * 생각 단계로 묶고, 축을 끌어 단계를 고르면 뷰어에게 「그 장을 펴라」고 시키는
 * 것뿐이다. 산출물을 여기서 다시 그리지 않는다 — 이미 문서 안에 있다.
 *
 * 그래서 이 파일이 없어도 문서는 원래대로 아홉 장 넘겨보기로 남는다.
 * 있으면 위계가 뒤집힌다: **먼저 사고축, 그다음 증거.**
 *
 * 뷰어와 닿는 곳은 둘뿐이다 (playgrown.js가 내준다)
 *   window.dadaCase.go(i)   — 그 장을 편다
 *   `case:panel` 이벤트      — 화살표·쓸기로 장이 바뀌면 여기가 따라간다
 */
(() => {
  'use strict';

  /* ── 여섯 단계 ──────────────────────────────
     **프로젝트마다 이 배열만 갈아 끼우면 같은 UI를 다시 쓴다.** `panels`는
     문서 안 화면의 앵커 id다 — 순서를 바꾸거나 옮기려면 여기 한 줄이면 된다.
     아홉 장이 하나도 남지 않고 여섯 단계에 들어간다(2+1+3+1+1+1). */
  const ROADMAP = [
    { id: 'problem', icon: '🔍', label: '문제', sub: '왜 시작했는가',
      line: '집도 직장도 아닌 곳이 사라지고 있다는 이야기에서 시작했어요.',
      panels: ['r-research', 'r-position'] },
    { id: 'role', icon: '🙋', label: '역할', sub: '내가 맡은 일',
      line: '기획 · 브랜딩 · 공간 · 마케팅 · 현장 운영을 전부 맡았어요.',
      panels: ['r-cover'] },
    { id: 'process', icon: '🛠', label: '과정', sub: '어떻게 풀었는가',
      line: '18일 동안 브랜드와 공간을 만들고 하루를 열 준비를 했어요.',
      panels: ['r-days', 'r-brand', 'r-space'] },
    { id: 'result', icon: '📊', label: '결과', sub: '무엇이 나왔는가',
      line: '2025년 7월 18일, 성수 북카페에서 네 시간을 열었어요.',
      panels: ['r-pilot'] },
    { id: 'learn', icon: '💡', label: '판단 / 배운 점', sub: '어떤 판단을 내렸나',
      line: '좋아하는 것과 사업을 하는 것은 다르다는 것을 배웠어요.',
      panels: ['r-note'] },
    { id: 'live', icon: '▶', label: '실제 서비스', sub: '지금 볼 수 있는 것',
      line: '성수에 붙였던 전단을 숏츠로도 만들었어요. 지금도 볼 수 있어요.',
      panels: ['r-promo'] },
  ];

  /* 지금 보고 있는 프로젝트가 무엇인지 — 로드맵보다 낮은 위계의 한 줄 띠 */
  const SUMMARY = {
    name: 'PlayGrown',
    line: '어른의 놀이가 자라는 곳',
    tags: ['#커뮤니티', '#오프라인', '#파일럿', '#공간기획'],
    thumb: '/assets/case/playgrown/map.jpg',
    link: { href: '/#playgrown', text: '마을에서 보기' },
  };

  const ME = '/assets/sprites/cut/me.png';

  const case_ = window.dadaCase;
  if (!case_ || !case_.go) return;          // 뷰어가 없으면(JS 꺼짐) 얹지 않는다

  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  /* 앵커 id를 화면 번호로 바꾼다. **문서에 없는 id는 조용히 버린다** —
     화면을 하나 지웠을 때 로드맵이 통째로 죽는 것보다 그 단계가 한 칸 줄어드는
     편이 낫다. 단계가 통째로 비면 그 단계 자체를 뺀다. */
  const STAGES = ROADMAP
    .map((s) => ({ ...s, at: s.panels.map((id) => case_.ids.indexOf(id)).filter((i) => i >= 0) }))
    .filter((s) => s.at.length);
  if (!STAGES.length) return;

  let stage = 0;                 // 지금 단계
  let rail, steps = [], lineEl, ofEl, nudgePrev, nudgeNext;
  let settle = null, quietUntil = 0;

  /** 화면 번호가 어느 단계에 드는가. 어디에도 없으면 -1 */
  const stageOf = (at) => STAGES.findIndex((s) => s.at.indexOf(at) >= 0);

  /* ── 넘기는 차례 ────────────────────────────
     **로드맵이 곧 차례다.** 여섯 단계를 펴 놓으면 아홉 장의 새 순서가 나온다.
     문서 순서(표지·리서치·포지셔닝·18일·브랜드·영상·공간·파일럿·노트)와 다르다 —
     표지는 「역할」이고 영상은 「실제 서비스」라 뒤로 간다.

     이것을 안 알려 주면 화살표가 문서 순서로 넘어가서, 과정(18일·브랜드·공간)에서
     오른쪽을 누르면 영상으로 새 버린다. 실제로 그랬다 — 검사가 「아홉 장 중
     일곱에만 닿는다」로 잡았다. 뷰어가 `window.dadaCaseOrder`를 물어본다. */
  const ORDER = STAGES.reduce((a, s) => a.concat(s.at), []);
  window.dadaCaseOrder = (at, d) => {
    const i = ORDER.indexOf(at);
    if (i < 0) return at + d;                    // 차례 밖의 장이면 문서 순서대로
    const to = i + d;
    /* 양 끝에서는 **범위 밖 값을 그대로 돌려준다** — 그래야 뷰어가 원래대로
       마을로 내보낸다(그 판단은 뷰어에 남겨 둔다) */
    if (to < 0) return -1;
    if (to >= ORDER.length) return case_.count;
    return ORDER[to];
  };

  function build() {
    const box = el('div', 'rm');
    box.id = 'rm';

    /* 첫 줄 — 마을로 나가는 고리와 안내말.
       **고리는 새로 만들지 않고 원래 것을 옮겨 온다.** 그것은 `position: fixed`로
       왼쪽 위에 떠 있었는데, 레일이 그 자리를 차지하면서 글자끼리 겹쳤다.
       같은 요소를 옮기면 링크도 검사도 그대로 산다. */
    const top = el('div', 'rm-top');
    const back = document.querySelector('.doc-back');
    if (back) top.appendChild(back);
    top.appendChild(el('p', 'rm-hint', '축을 드래그해서 전체 흐름을 살펴보세요'));
    box.appendChild(top);

    const wrap = el('div', 'rm-railwrap');
    nudgePrev = el('button', 'rm-nudge rm-nudge--prev', '←');
    nudgeNext = el('button', 'rm-nudge rm-nudge--next', '→');
    [nudgePrev, nudgeNext].forEach((b) => { b.type = 'button'; });
    nudgePrev.setAttribute('aria-label', '이전 단계');
    nudgeNext.setAttribute('aria-label', '다음 단계');
    nudgePrev.addEventListener('click', () => toStage(stage - 1));
    nudgeNext.addEventListener('click', () => toStage(stage + 1));

    rail = el('div', 'rm-rail');
    rail.id = 'rmRail';
    rail.setAttribute('role', 'tablist');
    rail.setAttribute('aria-label', '문제해결 로드맵');

    steps = STAGES.map((s, i) => {
      const b = el('button', 'rm-step');
      b.type = 'button';
      b.id = 'rm-' + s.id;
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', 'false');
      b.setAttribute('aria-label', `${i + 1}. ${s.label} — ${s.sub}`);
      const me = el('span', 'rm-me');
      const img = new Image();
      img.src = ME;
      img.alt = '';
      me.appendChild(img);
      b.append(me, el('span', 'rm-dot', s.icon), el('span', 'rm-lab', s.label),
               el('span', 'rm-sub', s.sub));
      b.addEventListener('click', () => toStage(i));
      rail.appendChild(b);
      return b;
    });

    wrap.append(nudgePrev, rail, nudgeNext);
    box.appendChild(wrap);

    lineEl = el('p', 'rm-line');
    lineEl.setAttribute('aria-live', 'polite');
    box.appendChild(lineEl);

    box.appendChild(summaryStrip());
    document.body.insertBefore(box, document.querySelector('.case'));
    document.body.classList.add('rm-on');
  }

  function summaryStrip() {
    const s = el('div', 'rm-sum');
    const im = new Image();
    im.className = 'rm-sum-thumb';
    im.src = SUMMARY.thumb;
    im.alt = '';
    im.addEventListener('error', () => im.remove(), { once: true });
    s.appendChild(im);
    s.appendChild(el('b', null, SUMMARY.name));
    s.appendChild(el('span', 'rm-sum-line', SUMMARY.line));
    s.appendChild(el('span', 'rm-sum-tags', SUMMARY.tags.join(' ')));
    const a = el('a', null, SUMMARY.link.text);
    a.href = SUMMARY.link.href;
    s.appendChild(a);
    return s;
  }

  /* ── 축 끌기 ────────────────────────────────
     손가락·트랙패드·관성은 브라우저의 `overflow-x` + `scroll-snap`이 이미 다 한다.
     여기서 손으로 만드는 것은 **마우스로 끄는 것** 하나뿐이다. 끄는 동안에는
     스냅을 꺼 둔다 — 켜 둔 채로 scrollLeft를 밀면 브라우저가 매 프레임 되당겨
     축이 손을 따라오지 않는다. */
  function wireDrag() {
    let id = null, x0 = 0, left0 = 0, moved = 0;

    rail.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') return;       // 손가락은 브라우저에 맡긴다
      id = e.pointerId; x0 = e.clientX; left0 = rail.scrollLeft; moved = 0;
      rail.classList.add('dragging');
      rail.setPointerCapture(id);
    });
    rail.addEventListener('pointermove', (e) => {
      if (id === null || e.pointerId !== id) return;
      const dx = e.clientX - x0;
      moved = Math.max(moved, Math.abs(dx));
      rail.scrollLeft = left0 - dx;
    });
    const release = (e) => {
      if (id === null || (e && e.pointerId !== id)) return;
      try { rail.releasePointerCapture(id); } catch (err) { /* 이미 놓였다 */ }
      id = null;
      rail.classList.remove('dragging');           // 스냅이 다시 켜지며 가까운 칸으로 붙는다
      /* 스냅이 붙기를 기다렸다가 가장 가까운 칸을 고른다. 끌자마자 고르면
         아직 손이 놓인 자리라 한 칸 전 것이 뽑힌다 */
      setTimeout(nearest, reduced() ? 0 : 140);
    };
    rail.addEventListener('pointerup', release);
    rail.addEventListener('pointercancel', release);

    /* 굴러가는 것이 멎으면 가운데 온 칸이 곧 지금 단계다 — 손가락·트랙패드도
       이 길로 들어온다. `scrollend`가 없는 브라우저를 위해 지연으로도 받는다 */
    rail.addEventListener('scroll', () => {
      /* **내가 민 굴림은 끝날 때까지 안 듣는다.** 정해진 시간으로 막았더니
         부드러운 굴림이 아직 가는 중에 창이 닫혀서, 아직 안 닿은 자리로 가장
         가까운 칸을 뽑고 옆 단계로 튀었다 — 화면까지 같이 갈려서 「눌렀는데
         다른 단계가 켜진다」가 됐다. 굴림이 멎고 나서 푼다: 이벤트가 올 때마다
         창을 조금씩 미뤄 두면 마지막 이벤트로부터 0.14초 뒤에 닫힌다. */
      if (Date.now() < quietUntil) { quietUntil = Date.now() + 140; return; }
      clearTimeout(settle);
      settle = setTimeout(nearest, 130);
    }, { passive: true });

    /* **여기서 쓸고 누른 것이 아래 화면까지 내려가면 안 된다.** 뷰어는 창 전체의
       쓸기·화살표를 듣고 있어서, 축을 쓸면 단계도 바뀌고 장도 넘어간다 */
    ['touchstart', 'touchend', 'touchmove'].forEach((t) =>
      rail.addEventListener(t, (e) => e.stopPropagation(), { passive: true }));

    rail.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft'
        && e.key !== 'Home' && e.key !== 'End') return;
      e.stopPropagation();                          // 아래 화면이 같이 넘어가지 않게
      e.preventDefault();
      const to = e.key === 'Home' ? 0
        : e.key === 'End' ? STAGES.length - 1
        : stage + (e.key === 'ArrowRight' ? 1 : -1);
      toStage(to);
      /* **초점을 옮기면서 화면을 굴리지 않는다.** 그냥 focus()하면 브라우저가
         그 칸을 「보이는 데까지만」 끌어다 놓는데, 그게 방금 시작한 가운데 맞추기와
         싸워서 엉뚱한 칸이 가운데에 선다 (End를 눌렀는데 다른 단계가 켜졌다) */
      steps[Math.min(Math.max(to, 0), STAGES.length - 1)].focus({ preventScroll: true });
    });
  }

  /** 지금 가운데에 가장 가까운 칸을 지금 단계로 삼는다 */
  function nearest() {
    const mid = rail.scrollLeft + rail.clientWidth / 2;
    let best = 0, gap = Infinity;
    steps.forEach((b, i) => {
      const c = b.offsetLeft + b.offsetWidth / 2;
      const d = Math.abs(c - mid);
      if (d < gap) { gap = d; best = i; }
    });
    if (best !== stage) apply(best, true);
  }

  /** 그 단계를 가운데로 데려온다. 스냅이 나머지를 맞춰 준다 */
  function center(i, jump) {
    const b = steps[i];
    if (!b) return;
    const to = b.offsetLeft + b.offsetWidth / 2 - rail.clientWidth / 2;
    quietUntil = Date.now() + (jump || reduced() ? 60 : 700);
    rail.scrollTo({ left: to, behavior: jump || reduced() ? 'auto' : 'smooth' });
    clearTimeout(settle);
  }

  function toStage(i) {
    const to = Math.min(Math.max(i, 0), STAGES.length - 1);
    apply(to, false);
    center(to);
  }

  /** 단계를 바꾸고 아래 화면을 그 단계의 **첫 산출물**로 되돌린다 (17항) */
  function apply(i, fromRail) {
    stage = i;
    paint();
    turn(STAGES[i].at[0]);
    if (window.dadaTrack) window.dadaTrack('case_stage', { stage: STAGES[i].id });
  }

  /** 화면을 갈아 끼운다. 미끄러뜨리지 않고 짧게 흐렸다 켠다 — 왜 그런지는 CSS에 */
  function turn(at) {
    if (at === case_.at()) return;
    /* **초점을 넘겨주지 않는다**(`focus: false`). 뷰어는 장을 펼 때마다 그 절로
       초점을 옮기는데 — 화살표로 넘길 때는 그게 맞다 — 축에서 고른 것이면
       손은 아직 축에 있다. 넘겨주면 그다음 키를 축이 못 받아서, 키보드로는
       한 단계밖에 못 갔다(End를 눌러도 아무 일이 없었다). */
    const opt = { focus: false };
    if (reduced()) { case_.go(at, opt); return; }
    document.body.classList.add('rm-turning');
    setTimeout(() => {
      case_.go(at, opt);
      requestAnimationFrame(() => document.body.classList.remove('rm-turning'));
    }, 130);
  }

  /** 축·설명·개수·화살표를 지금 상태에 맞춘다 */
  function paint() {
    const s = STAGES[stage];
    steps.forEach((b, i) => b.setAttribute('aria-selected', String(i === stage)));
    nudgePrev.disabled = stage === 0;
    nudgeNext.disabled = stage === STAGES.length - 1;

    /* 세 조각을 각자 요소로 둔다 — 폰에서 「단계 + 개수」를 한 줄로 묶고 문장을
       아래로 내리려면 CSS가 셋을 따로 집을 수 있어야 한다 */
    lineEl.textContent = '';
    ofEl = el('span', 'rm-of');
    lineEl.append(el('b', null, s.label), el('span', 'rm-msg', s.line), ofEl);
    paintCount();
  }

  /** 「과정의 산출물 2 / 3」 — 산출물을 보는 동안에도 어느 단계의 증거인지 남는다 */
  function paintCount() {
    if (!ofEl) return;
    const s = STAGES[stage];
    const n = s.at.indexOf(case_.at());
    ofEl.textContent = s.at.length > 1
      ? `${s.label}의 산출물 ${Math.max(n, 0) + 1} / ${s.at.length}`
      : `${s.label}의 산출물 1 / 1`;
  }

  /* 아래에서 장이 바뀌면(화살표·쓸기·점·주소) 축이 따라온다.
     같은 단계 안이면 개수만 고치고 축은 가만히 둔다 — 산출물을 넘길 때마다
     축이 들썩이면 둘이 한 덩어리처럼 보인다(22항: 두 영역은 구분되어야 한다) */
  document.addEventListener('case:panel', (e) => {
    const at = e.detail.at;
    const s = stageOf(at);
    if (s < 0) { paintCount(); return; }
    if (s === stage) { paintCount(); return; }
    stage = s;
    paint();
    center(s);
  });

  build();
  wireDrag();

  /* ── 어디서부터 시작하는가 ────────────────────
     주소에 화면 이름표가 붙어 왔으면 그 장이 속한 단계에서 시작한다.

     그냥 들어온 사람은 **문제부터**다. 문서 자체는 표지에서 열리는데, 표지가
     말하는 것은 「맡은 일」이라 로드맵에서는 「역할」에 속한다 — 그대로 두면
     여섯 단계 중 두 번째가 첫 화면이 되어 축이 선형으로 안 읽힌다.
     이 화면이 하려는 말은 **먼저 사고축**이므로 그 축의 처음에 세운다.
     `push: false`인 것은 들어오자마자 뒤로 가기가 하나 쌓이면 안 되기 때문이다. */
  let start = stageOf(case_.at());
  if (!case_.deep || start < 0) {
    start = 0;
    case_.go(STAGES[0].at[0], { push: false, focus: false });
  }
  stage = start;
  paint();
  center(start, true);
})();
