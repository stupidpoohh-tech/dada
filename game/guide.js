/* 게임을 여행하는 히치하이커를 위한 안내서 — 챕터 네비게이션
 *
 * 챕터 구성과 면 순서는 전부 data.json에서 읽는다. 코드에 박지 않는다.
 * 원본 슬라이드는 이미지로만 쓰고 그 위에 어떤 텍스트도 덧그리지 않는다.
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

  let data, cards = [], zoomable = false;

  /* ── 덱 그리기 ─────────────────────────────────── */

  const pageOf = (n) => data.pages.find((p) => p.n === n) || { n, kind: 'game' };

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
    // 표지와 목차는 첫 화면이라 지연 로딩하지 않는다
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
      a.addEventListener('click', (e) => { e.preventDefault(); goChapter(ch.id); });
      frame.appendChild(a);
    });
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
    card.addEventListener('click', () => goChapter(next.id));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); goChapter(next.id); }
    });
    return card;
  }

  function build() {
    const deck = $('deck');
    deck.textContent = '';

    deck.appendChild(imageCard(pageOf(data.meta.coverPage)));
    deck.appendChild(tocCard(pageOf(data.meta.tocPage)));

    data.chapters.forEach((ch, i) => {
      const sec = el('section', 'chapter');
      sec.id = ch.id;
      sec.dataset.chapter = ch.id;
      sec.setAttribute('aria-label', `챕터 ${ch.label} ${ch.title}`);
      // 붙는 것(배경)과 걸리는 것(카드)을 나눈다 — 까닭은 guide.css의 .chapter-bg
      const dp = pageOf(ch.dividerPage);
      const bg = el('div', 'chapter-bg');
      const bgImg = new Image(1920, 1080);
      bgImg.src = src(dp.n);
      bgImg.alt = altOf(dp, ch);
      bgImg.loading = 'lazy';
      bgImg.decoding = 'async';
      bg.appendChild(bgImg);
      sec.appendChild(bg);

      const dividerCard = el('article', 'card card--divider');
      dividerCard.dataset.page = dp.n;
      dividerCard.dataset.alt = bgImg.alt;
      sec.appendChild(dividerCard);
      ch.pages.forEach((n) => sec.appendChild(imageCard(pageOf(n), ch)));
      // 문은 챕터 1·2·3·4 끝에만. 42 뒤에는 붙이지 않는다
      const next = data.chapters[i + 1];
      if (ch.gate && next) sec.appendChild(gateCard(ch, next));
      deck.appendChild(sec);
    });

    // 마지막 두 장은 42에 딸린 것이 아니라 덱 전체를 닫는 말이다.
    // 챕터 바에서 접근 경로를 주지 않는다 — 끝까지 온 사람만 만난다.
    deck.appendChild(imageCard(pageOf(data.meta.appendixPage)));
    deck.appendChild(imageCard(pageOf(data.meta.endingPage)));

    cards = [...deck.querySelectorAll('.card')];
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
      b.addEventListener('click', () => goChapter(ch.id));
      wrap.appendChild(b);
    });
  }

  function setActive(id) {
    $('barChapters').querySelectorAll('.chip').forEach((b) => {
      if (b.dataset.chapter === id) b.setAttribute('aria-current', 'true');
      else b.removeAttribute('aria-current');
    });
  }

  function goChapter(id) {
    const sec = document.getElementById(id);
    if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /** 뷰포트 중앙선을 넘은 섹션을 현재 챕터로 본다. rootMargin으로 루트를
   *  가운데 한 줄로 좁히면 그 줄에 걸친 섹션만 교차 상태가 된다.
   *  표지·목차·부록·엔딩에서는 걸리는 섹션이 없어 전체가 비활성이 된다. */
  function watchChapters() {
    let current = null;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        const id = e.target.dataset.chapter;
        if (e.isIntersecting) { current = id; setActive(id); }
        else if (current === id) { current = null; setActive(null); }
      });
    }, { root: $('deck'), rootMargin: '-50% 0px -50% 0px', threshold: 0 });
    document.querySelectorAll('.chapter').forEach((s) => io.observe(s));
  }

  /* ── 카드 이동과 미리 로드 ──────────────────────── */

  const deckTop = () => $('deck').scrollTop;
  const cardH = () => cards[0]?.getBoundingClientRect().height || 1;
  const currentIndex = () => Math.round(deckTop() / cardH());

  function goCard(i) {
    const c = cards[Math.min(Math.max(i, 0), cards.length - 1)];
    if (c) c.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /** 스냅 스크롤에서 다음 카드가 비어 있으면 넘김이 끊긴 것처럼 보인다.
   *  앞뒤 두 장을 미리 받아 두면 lazy 이미지가 캐시에서 즉시 뜬다. */
  const warmed = new Set();
  function preload(i) {
    for (let k = i - 2; k <= i + 2; k++) {
      const c = cards[k];
      const n = c && c.dataset.page;
      if (!n || warmed.has(n)) continue;
      warmed.add(n);
      new Image().src = src(n);
    }
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
          e.preventDefault(); goCard(1); break;     // 목차로
        case 'End':
          e.preventDefault(); goCard(cards.length - 1); break;
      }
    });
  }

  /* ── 시작 ──────────────────────────────────────── */

  function syncZoomable() {
    zoomable = window.matchMedia('(max-width: 899px)').matches;
    cards.forEach((c) => {
      const on = zoomable && !!c.dataset.page;
      c.classList.toggle('card--zoomable', on);
    });
  }

  fetch('data.json')
    .then((r) => r.json())
    .then((json) => {
      data = json;
      document.title = `${data.meta.title} — DADA TOWN`;
      build();
      buildBar();
      watchChapters();
      initZoom();
      initKeys();
      syncZoomable();
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

      preload(0);

      // 마을 우편함에서 겉장이 날아와 열린 경우엔 그 그림 그대로 — 표지에서 시작한다
      const fromTown = new URLSearchParams(location.search).has('from');
      // 목차에서 시작한다. 첫 화면은 37편의 리스트가 아니라 챕터를 고르는 화면이다
      if (!location.hash && !fromTown) {
        requestAnimationFrame(() => {
          const deck = $('deck');
          const prev = deck.style.scrollBehavior;
          deck.style.scrollBehavior = 'auto';
          cards[1].scrollIntoView({ block: 'start' });
          deck.style.scrollBehavior = prev;
        });
      } else {
        const id = location.hash.slice(1);
        requestAnimationFrame(() => goChapter(id));
      }
    })
    .catch(() => {
      $('deck').appendChild(el('p', 'nojs', '안내서를 불러오지 못했습니다.'));
    });
})();
