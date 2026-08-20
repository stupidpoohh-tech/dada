/* 게임을 여행하는 히치하이커를 위한 안내서 — 챕터 네비게이션
 *
 * 챕터 구성과 면 순서는 전부 data.json에서 읽는다. 코드에 박지 않는다.
 * 원본 슬라이드는 이미지로만 쓰고 그 위에 어떤 텍스트도 덧그리지 않는다.
 *
 * 덱은 한 줄로 이어진 두루마리가 아니라 **따로 놓인 카드 뭉치 일곱 개**다
 * (표지·목차 / 챕터 다섯 / 맺음말). 한 번에 한 뭉치만 화면에 올린다.
 * 예전에는 46면을 한 줄로 이어 두고 챕터 이동을 smooth 스크롤로 처리했는데,
 * 챕터를 누를 때마다 사이의 스무 장이 전부 지나가느라 화면이 파바박 튀었다.
 * 뭉치를 갈라 두면 그 구간이 통째로 없어진다 — 다른 책을 집어 드는 것과 같다.
 */
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const src = (n) => `pages/${String(n).padStart(2, '0')}.webp`;
  const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* 목차 히트 영역 — 원본 2면(1920×1080)에서 글자 행을 실측해 얻은 값이다.
     행 중심 y: 28.5 / 40.8 / 53.4 / 65.6 / 80.0%.
     42는 두 줄로 감기므로 상자를 더 높게 잡는다. */
  const TOC_HITS = {
    ch1:  { top: 23.2, height: 10.6 },
    ch2:  { top: 35.5, height: 10.6 },
    ch3:  { top: 48.1, height: 10.6 },
    ch4:  { top: 60.4, height: 10.6 },
    ch42: { top: 73.4, height: 13.2 },
  };
  const TOC_X = { left: 42.5, width: 51.5 };

  let data, stacks = [], at = 0, cards = [], zoomable = false;

  /** 방문 통계 한 줄. 이 페이지도 챕터를 옮겨도 URL이 그대로라 자동으로는 안 남는다.
   *  ga.js가 없거나(광고 차단·로컬) 꺼져 있으면 조용히 지나간다. */
  const track = (name, params) => { if (window.dadaTrack) window.dadaTrack(name, params); };
  let sawEnd = false;

  const pageOf = (n) => data.pages.find((p) => p.n === n) || { n, kind: 'game' };

  /* ── 카드 ──────────────────────────────────────── */

  /** alt는 data.json의 제목·부제로 만든다. 이미지 안의 글자를 기계는 못 읽는다. */
  function altOf(p, ch) {
    if (p.kind === 'cover') return `표지 — ${data.meta.title}`;
    if (p.kind === 'toc') return '목차 — 챕터 1, 2, 3, 4, 42';
    if (p.kind === 'divider') return `챕터 ${ch.label} — ${ch.title}`;
    if (p.kind === 'appendix') return p.title || '그 외 게임의 정석들';
    if (p.kind === 'ending') return p.title || '엔딩';
    return p.subtitle ? `${p.title} — ${p.subtitle}` : p.title;
  }

  function imageCard(p, ch, extraClass) {
    const card = el('article', `card card--${extraClass || p.kind}`);
    const img = new Image(1920, 1080);
    img.src = src(p.n);
    img.alt = altOf(p, ch);
    img.decoding = 'async';
    if (p.n <= 2) { img.loading = 'eager'; img.fetchPriority = 'high'; }
    else img.loading = 'lazy';
    card.appendChild(img);
    card.dataset.page = p.n;
    return card;
  }

  /** 목차 카드 — 원본 이미지 위에 투명 히트 영역 다섯 개만 얹는다 */
  function tocCard(p) {
    const card = imageCard(p);
    const img = card.firstChild;
    card.removeChild(img);
    const frame = el('div', 'toc-frame');
    frame.appendChild(img);
    data.chapters.forEach((ch) => {
      const box = TOC_HITS[ch.id];
      if (!box) return;
      const a = el('a', 'toc-hit');
      a.href = '#' + ch.id;
      a.style.cssText =
        `left:${TOC_X.left}%;width:${TOC_X.width}%;top:${box.top}%;height:${box.height}%`;
      a.appendChild(el('span', 'sr', `챕터 ${ch.label} ${ch.title}`));
      a.addEventListener('click', (e) => { e.preventDefault(); goStack(ch.id); });
      frame.appendChild(a);
    });
    // 출처는 판권면에 온전한 문장으로 있지만 그건 끝까지 온 사람만 만난다.
    // 첫 화면인 목차에 회색 한 줄을 얹어 두면 거의 모든 사람이 한 번은 본다.
    // 원본 이미지 위에 얹을 뿐 파일은 그대로다 — 히트 영역과 같은 방식이다.
    // 목차 글줄은 86.6%에서 끝나므로 아래 여백은 비어 있다.
    const short = (data.colophon || {}).sourceShort;
    if (short) {
      const line = el('p', 'toc-source', short);
      line.setAttribute('aria-hidden', 'true');   // 판권면이 같은 말을 온전히 읽어준다
      frame.appendChild(line);
    }

    card.appendChild(frame);
    return card;
  }

  /** 문 — 이미지가 아니라 유일하게 새로 만드는 화면 */
  function gateCard(ch, next) {
    const card = el('article', 'card card--gate');
    const box = el('div', 'gate');
    box.appendChild(el('p', 'gate-line', ch.gate));

    const nx = el('div', 'gate-next');
    nx.appendChild(el('div', 'gate-num', next.label));
    nx.appendChild(el('div', 'gate-title', next.title));
    box.appendChild(nx);

    // 점으로 찍고 42만 떨어뜨린다 — 챕터 바와 같은 규칙
    const dots = el('div', 'gate-dots');
    const passed = data.chapters.findIndex((c) => c.id === ch.id);
    data.chapters.forEach((c, i) => {
      if (c.label === '42') dots.appendChild(el('span', 'sep'));
      const d = el('i');
      if (i <= passed) d.className = 'on';
      dots.appendChild(d);
    });
    dots.setAttribute('role', 'img');
    dots.setAttribute('aria-label', `챕터 ${ch.label} 끝. 다음은 챕터 ${next.label}`);
    box.appendChild(dots);

    card.appendChild(box);
    card.tabIndex = 0;
    card.setAttribute('role', 'link');
    card.addEventListener('click', () => goStack(next.id));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); goStack(next.id); }
    });
    return card;
  }

  /** 판권면 — 46면을 한 장도 건드리지 않고 출처를 밝히는 자리.
   *
   *  인용한 리뷰가 서른몇 개인데 지금까지 출처 표시가 아예 없었다. 면마다 이름을
   *  다시 붙이려면 2017·2022·2023년까지 흩어진 원본 리뷰를 되찾아야 하고
   *  (스팀에는 그 길이 없다) 리뷰 상자가 커지면서 그 면들의 조판이 딸려 온다.
   *  저작권법 §37은 출처를 「이용 상황에 따라 합리적이라고 인정되는 방법으로」
   *  밝히라고 하므로, 개인 안내서의 짧은 인용 서른몇 개는 한 곳에 모아 밝힌다.
   *
   *  판본과 날짜도 여기서 한 줄로 만난다. 표지에 인쇄된 2026.07.08은 Ver.3을
   *  뽑은 날이고 마을 카드의 25.02는 엮은 때다 — 둘 다 사실인데 따로 놓여 있어
   *  읽는 사람에게만 어긋나 보였다. 나란히 쓰면 어긋남이 아니라 이력이 된다. */
  function colophonCard() {
    const c = data.colophon || {};
    const m = data.meta;
    const card = el('article', 'card card--colophon');
    const box = el('div', 'colophon');
    if (c.source) box.appendChild(el('p', 'colo-source', c.source));

    const meta = el('div', 'colo-meta');
    meta.appendChild(el('div', 'colo-title', m.title));
    const stamp = [m.version, c.made && `${c.made} 엮음`, m.date && `${m.date} 펴냄`]
      .filter(Boolean).join(' · ');
    meta.appendChild(el('div', 'colo-line', stamp));
    if (m.author) meta.appendChild(el('div', 'colo-line', m.author));
    box.appendChild(meta);

    card.appendChild(box);
    return card;
  }

  /* ── 뭉치 ──────────────────────────────────────── */

  /** 카드 뭉치 일곱을 정의한다. 그리기는 올릴 때 한다 (mount). */
  function buildStacks() {
    stacks = [];
    stacks.push({
      id: 'intro',
      pages: [data.meta.coverPage, data.meta.tocPage],
      draw: () => [imageCard(pageOf(data.meta.coverPage)), tocCard(pageOf(data.meta.tocPage))],
    });

    data.chapters.forEach((ch, i) => {
      const next = data.chapters[i + 1];
      stacks.push({
        id: ch.id, chapter: ch,
        pages: [ch.dividerPage, ...ch.pages],
        draw: () => {
          const out = [];
          // 붙는 것(배경)과 걸리는 것(카드)을 나눈다 — 까닭은 guide.css의 .chapter-bg
          const dp = pageOf(ch.dividerPage);
          const bg = el('div', 'chapter-bg');
          const bgImg = new Image(1920, 1080);
          bgImg.src = src(dp.n);
          bgImg.alt = altOf(dp, ch);
          bgImg.decoding = 'async';
          bg.appendChild(bgImg);
          out.push(bg);

          const dividerCard = el('article', 'card card--divider');
          dividerCard.dataset.page = dp.n;
          dividerCard.dataset.alt = bgImg.alt;
          out.push(dividerCard);

          ch.pages.forEach((n) => out.push(imageCard(pageOf(n), ch)));
          // 문은 챕터 1·2·3·4 끝에만. 42 뒤에는 붙이지 않는다
          if (ch.gate && next) out.push(gateCard(ch, next));
          return out;
        },
      });
    });

    // 마지막 두 장은 42에 딸린 것이 아니라 덱 전체를 닫는 말이다.
    // 챕터 바에서 접근 경로를 주지 않는다 — 끝까지 온 사람만 만난다.
    stacks.push({
      id: 'outro',
      pages: [data.meta.appendixPage, data.meta.endingPage],
      // 판권면은 47번째 면이 아니라 46면 뒤에 새로 놓는 한 장이다 (colophonCard)
      draw: () => [imageCard(pageOf(data.meta.appendixPage)),
                   imageCard(pageOf(data.meta.endingPage)),
                   colophonCard()],
    });
  }

  const indexOfStack = (id) => stacks.findIndex((s) => s.id === id);
  const cardH = () => cards[0]?.getBoundingClientRect().height || 1;
  const currentIndex = () => Math.round($('deck').scrollTop / cardH());

  /** 한 뭉치를 화면에 올린다. dir는 어느 쪽에서 왔는지 (1 앞으로, -1 뒤로, 0 바로). */
  function mount(i, { card = 0, dir = 0 } = {}) {
    const s = stacks[Math.min(Math.max(i, 0), stacks.length - 1)];
    if (!s) return;
    at = stacks.indexOf(s);

    const deck = $('deck');
    const stack = el('div', 'stack');
    s.draw().forEach((n) => stack.appendChild(n));
    deck.textContent = '';
    deck.appendChild(stack);

    cards = [...stack.querySelectorAll('.card')];
    const idx = card < 0 ? cards.length - 1 : Math.min(card, cards.length - 1);

    // 스크롤 위치는 애니메이션 없이 잡는다 — 여기서 smooth를 쓰면 올리자마자
    // 화면이 흐른다. 뭉치를 가른 이유가 그 흐름을 없애는 것이었다.
    const prev = deck.style.scrollBehavior;
    deck.style.scrollBehavior = 'auto';
    deck.scrollTop = idx * cardH();
    deck.style.scrollBehavior = prev;

    setActive(s.chapter ? s.id : null);
    const want = s.chapter ? '#' + s.id : ' ';
    if (location.hash !== want) history.replaceState(null, '', want);

    if (dir && !calm()) {
      stack.classList.add(dir > 0 ? 'in-fwd' : 'in-back');
      stack.addEventListener('animationend', () =>
        stack.classList.remove('in-fwd', 'in-back'), { once: true });
    }
    // 마지막 두 장은 챕터 바에 없다 — 끝까지 스크롤한 사람만 만나므로
    // 여기 닿았다는 건 덱을 끝까지 봤다는 뜻이다. 오가며 겹쳐 세지 않게 한 번만
    if (s.id === 'outro' && !sawEnd) { sawEnd = true; track('guide_end', {}); }
    syncZoomable();
    preload(idx);
  }

  /** 뭉치 사이 이동. 챕터 바·목차·문이 전부 이 문을 쓴다. */
  function goStack(id, opts) {
    const i = indexOfStack(id);
    if (i < 0 || i === at) return;
    track('guide_chapter', { chapter: id });
    mount(i, { dir: i > at ? 1 : -1, ...opts });
  }

  /** 뭉치 끝에서 한 걸음 더 — 다음/이전 뭉치의 첫/끝 카드로 */
  function step(dir) {
    const i = at + dir;
    if (i < 0 || i >= stacks.length) return false;
    mount(i, { dir, card: dir > 0 ? 0 : -1 });
    return true;
  }

  /* ── 챕터 바 ───────────────────────────────────── */

  function buildBar() {
    const wrap = $('barChapters');
    data.chapters.forEach((ch, i) => {
      // 4와 42 사이에만 넓은 간격과 구분 기호를 둔다
      if (ch.label === '42' && i > 0) {
        const g = el('span', 'gap', '⌇');
        g.setAttribute('aria-hidden', 'true');
        wrap.appendChild(g);
      }
      const b = el('button', 'chip' + (ch.label === '42' ? ' chip-42' : ''));
      b.type = 'button';
      b.dataset.chapter = ch.id;
      b.appendChild(document.createTextNode(ch.label));
      if (ch.label !== '42') b.appendChild(el('span', 'chip-title', ch.title));
      else {
        b.appendChild(el('span', 'tip', '삶, 우주, 그리고 모든 게임에 대한 답'));
        b.setAttribute('aria-label', `챕터 42 — ${ch.title}`);
      }
      b.addEventListener('click', () => goStack(ch.id));
      wrap.appendChild(b);
    });
  }

  /** 표지·목차·맺음말 뭉치에서는 걸리는 챕터가 없어 전체가 비활성이 된다. */
  function setActive(id) {
    $('barChapters').querySelectorAll('.chip').forEach((b) => {
      if (id && b.dataset.chapter === id) b.setAttribute('aria-current', 'true');
      else b.removeAttribute('aria-current');
    });
  }

  /* ── 카드 이동과 미리 로드 ──────────────────────── */

  function goCard(i) {
    if (i < 0) return step(-1);
    if (i >= cards.length) return step(1);
    cards[i].scrollIntoView({ behavior: calm() ? 'auto' : 'smooth', block: 'start' });
    return true;
  }

  /** 스냅 스크롤에서 다음 카드가 비어 있으면 넘김이 끊긴 것처럼 보인다.
   *  앞뒤 두 장과 다음 뭉치의 첫 장을 미리 받아 둔다. */
  const warmed = new Set();
  const warm = (n) => {
    if (!n || warmed.has(String(n))) return;
    warmed.add(String(n));
    new Image().src = src(n);
  };
  function preload(i) {
    for (let k = i - 2; k <= i + 2; k++) warm(cards[k]?.dataset.page);
    warm(stacks[at + 1]?.pages[0]);
  }

  /* ── 뭉치 경계에서 한 걸음 더 ───────────────────── */

  /** 마지막 카드에서 더 밀면 다음 뭉치로 넘어간다. 카드 안에서는 브라우저의
   *  스냅 스크롤을 그대로 쓰고, 경계에서만 우리가 받는다. */
  function initEdge() {
    const deck = $('deck');
    let accum = 0, lock = false, touchY = null;

    const edge = () => ({
      bottom: deck.scrollTop + deck.clientHeight >= deck.scrollHeight - 2,
      top: deck.scrollTop <= 2,
    });
    const fire = (dir) => {
      if (lock || !step(dir)) return;
      lock = true; accum = 0;
      setTimeout(() => { lock = false; }, 420);
    };

    deck.addEventListener('wheel', (e) => {
      if (lock) return;
      const { bottom, top } = edge();
      if (e.deltaY > 0 && bottom) accum += e.deltaY;
      else if (e.deltaY < 0 && top) accum -= e.deltaY;
      else { accum = 0; return; }
      if (accum > 90) fire(e.deltaY > 0 ? 1 : -1);
    }, { passive: true });

    deck.addEventListener('touchstart', (e) => {
      touchY = e.touches[0].clientY;
    }, { passive: true });
    deck.addEventListener('touchmove', (e) => {
      if (lock || touchY == null) return;
      const dy = touchY - e.touches[0].clientY;
      const { bottom, top } = edge();
      if (dy > 64 && bottom) fire(1);
      else if (-dy > 64 && top) fire(-1);
    }, { passive: true });
    deck.addEventListener('touchend', () => { touchY = null; }, { passive: true });
  }

  /* ── 확대 뷰어 ─────────────────────────────────── */

  const zoom = { scale: 1, x: 0, y: 0, base: 1 };
  const pointers = new Map();
  let pinchStart = null, lastTap = 0, returnTo = null;

  const applyZoom = () => {
    $('zoomImg').style.transform =
      `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.scale})`;
  };

  /** 확대한 이미지가 화면 밖으로 완전히 빠져나가지 않게 이동 범위를 가둔다 */
  function clamp() {
    const img = $('zoomImg');
    const w = img.offsetWidth * zoom.scale, h = img.offsetHeight * zoom.scale;
    const maxX = Math.max(0, (w - window.innerWidth) / 2);
    const maxY = Math.max(0, (h - window.innerHeight) / 2);
    zoom.x = Math.min(Math.max(zoom.x, -maxX), maxX);
    zoom.y = Math.min(Math.max(zoom.y, -maxY), maxY);
  }

  /** 화면 높이를 채우는 배율. 16:9 슬라이드를 세로 화면에서 그냥 펼치면
   *  폭에 맞춰 아주 납작하게 들어가 카드와 다를 게 없다 — 읽으려고 여는 화면이므로
   *  세로를 채우고 좌우로 끌어 읽게 한다. */
  function fitScale() {
    const img = $('zoomImg');
    if (!img.offsetHeight) return 1;
    return Math.min(4, Math.max(1, window.innerHeight / img.offsetHeight));
  }

  function openZoom(card) {
    const n = card.dataset.page;
    if (!n) return;
    track('guide_zoom', { page: Number(n) });
    const img = card.querySelector('img');
    returnTo = card;
    const zi = $('zoomImg');
    zi.src = src(n);
    zi.alt = card.dataset.alt || (img ? img.alt : '');
    zoom.scale = 1; zoom.x = 0; zoom.y = 0;
    applyZoom();
    $('zoom').hidden = false;
    $('deck').style.overflow = 'hidden';       // 배경 덱 스크롤 잠금

    const settle = () => {
      zoom.base = fitScale();
      zoom.scale = zoom.base; zoom.x = 0; zoom.y = 0;
      clamp(); applyZoom();
    };
    if (zi.complete && zi.naturalWidth) settle();
    else zi.addEventListener('load', settle, { once: true });

    $('zoomHint').classList.remove('gone');
    setTimeout(() => $('zoomHint').classList.add('gone'), 2400);
    $('zoomClose').focus();
  }

  function closeZoom() {
    $('zoom').hidden = true;
    $('deck').style.overflow = '';
    pointers.clear(); pinchStart = null;
    if (returnTo) { returnTo.scrollIntoView({ block: 'start' }); returnTo.focus?.(); }
  }

  function initZoom() {
    const stage = $('zoomStage');
    $('zoomClose').addEventListener('click', closeZoom);

    stage.addEventListener('pointerdown', (e) => {
      stage.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinchStart = {
          dist: Math.hypot(a.x - b.x, a.y - b.y),
          scale: zoom.scale,
          cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2,
          x: zoom.x, y: zoom.y,
        };
      }
    });

    stage.addEventListener('pointermove', (e) => {
      if (!pointers.has(e.pointerId)) return;
      const prev = pointers.get(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointers.size === 2 && pinchStart) {
        const [a, b] = [...pointers.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const next = Math.min(Math.max(pinchStart.scale * (dist / pinchStart.dist), 1), 6);
        // 두 손가락 사이 지점이 제자리에 머물러야 손끝에 붙어 있는 느낌이 난다.
        // 변환 기준점이 요소 중앙이므로 화면 중앙을 뺀 좌표로 계산한다.
        const k = next / pinchStart.scale;
        const cx = pinchStart.cx - window.innerWidth / 2;
        const cy = pinchStart.cy - window.innerHeight / 2;
        zoom.x = cx * (1 - k) + pinchStart.x * k;
        zoom.y = cy * (1 - k) + pinchStart.y * k;
        zoom.scale = next;
        clamp(); applyZoom();
      } else if (pointers.size === 1 && zoom.scale > 1) {
        zoom.x += e.clientX - prev.x;
        zoom.y += e.clientY - prev.y;
        clamp(); applyZoom();
      }
    });

    const up = (e) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinchStart = null;
    };
    stage.addEventListener('pointerup', up);
    stage.addEventListener('pointercancel', up);

    // 두 번 두드리면 확대·원래대로
    stage.addEventListener('click', (e) => {
      const now = Date.now();
      if (now - lastTap < 300) {
        if (zoom.scale > 1) {
          zoom.scale = 1; zoom.x = 0; zoom.y = 0;   // 한 장 전체를 다시 본다
        } else {
          // 두드린 지점이 화면 가운데로 오게 민다
          zoom.scale = zoom.base > 1 ? zoom.base : 2.5;
          zoom.x = (window.innerWidth / 2 - e.clientX) * zoom.scale;
          zoom.y = (window.innerHeight / 2 - e.clientY) * zoom.scale;
        }
        clamp(); applyZoom();
      }
      lastTap = now;
    });

    window.addEventListener('resize', () => { if (!$('zoom').hidden) { clamp(); applyZoom(); } });
  }

  /* ── 키보드 ────────────────────────────────────── */

  function initKeys() {
    document.addEventListener('keydown', (e) => {
      if (!$('zoom').hidden) {
        if (e.key === 'Escape') { e.preventDefault(); closeZoom(); }
        return;
      }
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const i = currentIndex();
      switch (e.key) {
        case 'ArrowDown': case 'PageDown': case ' ':
          e.preventDefault(); goCard(i + 1); break;
        case 'ArrowUp': case 'PageUp':
          e.preventDefault(); goCard(i - 1); break;
        case 'Home':
          e.preventDefault(); mount(0, { card: 1 }); break;     // 목차로
        case 'End':
          e.preventDefault(); mount(stacks.length - 1, { card: -1 }); break;
      }
    });
  }

  /* ── 시작 ──────────────────────────────────────── */

  function syncZoomable() {
    zoomable = window.matchMedia('(max-width: 899px)').matches;
    cards.forEach((c) => c.classList.toggle('card--zoomable', zoomable && !!c.dataset.page));
  }

  // 캐시를 다시 확인한다 — 챕터 구성이 여기서 오므로 guide.js와 짝이 맞아야 한다
  fetch('data.json', { cache: 'no-cache' })
    .then((r) => r.json())
    .then((json) => {
      data = json;
      document.title = `${data.meta.title} — DADA TOWN`;
      buildStacks();
      buildBar();
      initZoom();
      initKeys();
      initEdge();
      window.addEventListener('resize', syncZoomable);

      $('deck').addEventListener('click', (e) => {
        if (!zoomable) return;
        const card = e.target.closest('.card');
        if (!card || !card.dataset.page) return;
        if (e.target.closest('.toc-hit')) return;   // 목차 히트 영역이 먼저다
        openZoom(card);
      });

      let tick = null;
      $('deck').addEventListener('scroll', () => {
        if (tick) return;
        tick = setTimeout(() => { tick = null; preload(currentIndex()); }, 120);
      }, { passive: true });

      // 마을 우편함에서 겉장이 날아와 열린 경우엔 그 그림 그대로 — 표지에서 시작한다.
      // 그 외에는 목차에서 시작한다. 첫 화면은 37편의 리스트가 아니라 챕터를 고르는 화면이다.
      const fromTown = new URLSearchParams(location.search).has('from');
      const hash = location.hash.slice(1);
      if (hash && indexOfStack(hash) >= 0) mount(indexOfStack(hash));
      else mount(0, { card: fromTown ? 0 : 1 });
    })
    .catch(() => {
      $('deck').appendChild(el('p', 'nojs', '안내서를 불러오지 못했습니다.'));
    });
})();
