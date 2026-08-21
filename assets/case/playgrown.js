/* 브랜드 보드 타일을 눌러서 크게 보는 것 하나. 이 페이지의 JS는 이게 전부다.
 *
 * **없어도 되게 만든다.** 확대는 전부 `<a href="…jpg">`라, 이 파일이 안 실행돼도
 * 누르면 그림 파일이 그냥 열린다. 문서 본문은 애초에 JS와 무관하다 — 이 페이지를
 * 뷰어가 아니라 스크롤 문서로 정한 이유가 그것이다.
 *
 * `<dialog>`를 쓰는 이유는 **초점과 Esc를 브라우저가 대신 처리해 주기 때문**이다.
 * div로 만들면 초점 가두기와 Esc 닫기와 배경 스크롤 막기를 손으로 다시 짜야 한다.
 */
const links = document.querySelectorAll('.zoom-link');
if (links.length && window.HTMLDialogElement) {
  const box = document.createElement('dialog');
  box.className = 'lightbox';
  box.innerHTML = '<button class="lightbox-close" type="button" aria-label="닫기">✕</button>'
    + '<img alt=""><figcaption></figcaption>';
  document.body.appendChild(box);

  const img = box.querySelector('img');
  const cap = box.querySelector('figcaption');

  links.forEach((a) => a.addEventListener('click', (e) => {
    /* 새 탭으로 열려는 사람(가운데 클릭 · Ctrl/⌘)의 뜻을 뺏지 않는다 */
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    img.src = a.getAttribute('href');
    /* 타일 안 그림의 대체 텍스트를 그대로 물려받는다. 링크에만 있는 설명(data-cap)은
       그림 아래 설명으로 쓴다 — 둘을 겹쳐 읽히면 스크린리더가 같은 말을 두 번 한다 */
    const inner = a.querySelector('img');
    img.alt = inner ? inner.alt : (a.dataset.cap || '');
    cap.textContent = a.dataset.cap || '';
    box.showModal();
  }));

  const shut = () => box.close();
  box.querySelector('.lightbox-close').addEventListener('click', shut);
  /* 그림 바깥(백드롭)을 눌러도 닫힌다. dialog는 백드롭 클릭도 자기 자신에게
     오므로 target이 상자 자신일 때만 닫는다 */
  box.addEventListener('click', (e) => { if (e.target === box) shut(); });
  /* 닫을 때 src를 비운다. 안 비우면 다음에 열 때 이전 그림이 한 프레임 보인다 */
  box.addEventListener('close', () => { img.removeAttribute('src'); });
}

/* ── 영상 ───────────────────────────────────────────────────────
   재생 카드를 누르면 그 자리에 유튜브 틀을 바꿔 끼운다.
   **누르기 전에는 유튜브에 아무 요청도 안 나간다** — 썸네일조차 안 받아온다.
   `youtube-nocookie.com`을 쓰는 것도 같은 이유다 (§4 「영상을 넣을 때 지킬 것」).
   이 코드가 안 돌면 카드는 그냥 유튜브로 가는 링크다. */
document.querySelectorAll('.film-card[data-yt]').forEach((a) => {
  a.addEventListener('click', (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;   // 새 탭은 그대로 둔다
    e.preventDefault();
    const f = document.createElement('iframe');
    f.className = 'film-frame';
    f.src = `https://www.youtube-nocookie.com/embed/${a.dataset.yt}?autoplay=1&rel=0`;
    f.title = a.dataset.title || '영상';
    f.allow = 'accelerometer; autoplay; encrypted-media; picture-in-picture';
    f.allowFullscreen = true;
    a.replaceWith(f);
  });
});

/* ── 넘기는 화면 ────────────────────────────────────────────────
   화면 아홉(표지 + 절 여덟)을 한 장씩 넘긴다.

   **`.viewer`를 여기서 붙인다.** 그래서 JS가 없으면 아무 규칙도 안 걸리고
   문서는 그냥 위에서 아래로 이어진 한 장으로 남는다 — 넘기는 쪽을 고르면서도
   못 넘기는 상황에서 통째로 안 읽히는 일은 없어야 한다.

   굴리는 문서라면 공짜로 얻었을 것 넷을 여기서는 손으로 만든다.
   초점 옮기기 · 뒤로 가기 · 스크린리더에 알리기 · 안 보이는 화면을 훑기에서 빼기.
   이 넷이 없으면 키보드로 읽는 사람은 안 보이는 화면에 갇히고, 뒤로 가기는
   마을로 나가 버리고, 눈으로 안 보는 사람에게는 아무 일도 안 일어난 것이 된다. */
const track = document.getElementById('vwTrack');
const panels = [...document.querySelectorAll('.vw-panel')];

if (track && panels.length > 1) {
  document.body.classList.add('viewer');

  /* 화면 이름은 절의 어깨말(리서치 · 18일 …)을 그대로 쓴다. 표지에는 없다 */
  const nameOf = (el) => (el.querySelector('.room-no') || {}).textContent?.trim() || '표지';
  /* 뒤로 가기에 남길 이름표. 앵커가 이미 이 id를 가리키고 있다 */
  const ids = panels.map((el) => (el.querySelector('[id]') || {}).id || '');
  const canInert = 'inert' in HTMLElement.prototype;

  const el = (tag, cls, txt) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt) n.textContent = txt;
    return n;
  };

  const pager = el('nav', 'vw-pager');
  pager.setAttribute('aria-label', '화면 고르기');
  const dots = panels.map((p, i) => {
    const b = el('button', null);
    b.type = 'button';
    b.setAttribute('aria-label', `${i + 1}. ${nameOf(p)}`);
    b.addEventListener('click', () => go(i));
    pager.appendChild(b);
    return b;
  });
  const count = el('span', 'vw-count');
  pager.appendChild(count);

  const arrow = (dir, glyph, label) => {
    const b = el('button', `vw-arrow vw-arrow--${dir}`, glyph);
    b.type = 'button';
    b.setAttribute('aria-label', label);
    return b;
  };
  const prev = arrow('prev', '←', '이전 화면');
  const next = arrow('next', '→', '다음 화면');
  prev.addEventListener('click', () => go(at - 1));
  next.addEventListener('click', () => go(at + 1));

  /* 화면이 바뀐 것을 눈으로 안 보는 사람에게 말해 준다 */
  const live = el('p', 'vw-live');
  live.setAttribute('aria-live', 'polite');

  panels.forEach((p) => { p.tabIndex = -1; });
  document.body.append(pager, prev, next, live);

  let at = -1;

  function go(i, opt = {}) {
    const to = Math.max(0, Math.min(panels.length - 1, i));
    if (to === at) return;
    at = to;
    track.style.transform = `translateX(${-at * 100}%)`;

    panels.forEach((p, n) => {
      /* **안 보이는 화면은 훑기에서 뺀다.** 안 그러면 탭을 누를 때마다 화면 밖
         링크로 초점이 날아가 화면이 제멋대로 옆으로 밀린다 */
      if (canInert) p.inert = n !== at;
      if (n !== at) p.scrollTop = 0;
    });
    dots.forEach((d, n) => {
      if (n === at) d.setAttribute('aria-current', 'true');
      else d.removeAttribute('aria-current');
    });
    count.textContent = `${at + 1} / ${panels.length}`;
    prev.disabled = at === 0;
    next.disabled = at === panels.length - 1;
    /* 넘어간 화면은 맨 위에서 시작한다. 안 되돌리면 앞 화면을 굴려 놓은 만큼
       다음 화면도 중간부터 보인다 */
    panels[at].scrollTop = 0;

    if (opt.focus !== false) panels[at].focus({ preventScroll: true });
    live.textContent = `${panels.length}개 화면 중 ${at + 1} — ${nameOf(panels[at])}`;

    /* 뒤로 가기가 마을로 나가 버리지 않게 화면마다 이력을 남긴다.
       처음 그릴 때만 replace다 — 들어오자마자 뒤로 가기가 하나 쌓이면 안 된다 */
    const url = ids[at] ? `#${ids[at]}` : location.pathname;
    if (opt.push === false) history.replaceState({ at }, '', url);
    else history.pushState({ at }, '', url);
  }

  addEventListener('popstate', (e) => {
    const i = e.state && typeof e.state.at === 'number'
      ? e.state.at
      : Math.max(0, ids.indexOf(location.hash.slice(1)));
    go(i, { push: false });
  });

  /* 글자를 넣는 칸이 없는 화면이라 좌우 화살표를 통째로 가져다 쓴다.
     위아래는 안 건드린다 — 절 안을 굴리는 데 쓰이기 때문이다 */
  addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'ArrowRight') go(at + 1);
    if (e.key === 'ArrowLeft') go(at - 1);
  });

  /* 손가락 쓸기. **세로로 쓴 것은 넘기지 않는다** — 절 안을 굴리는 동작이라
     가로보다 세로가 크면 그대로 둔다. 안 가르면 일력을 훑다가 화면이 넘어간다 */
  let x0 = null, y0 = null;
  addEventListener('touchstart', (e) => {
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
  }, { passive: true });
  addEventListener('touchend', (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    const dy = e.changedTouches[0].clientY - y0;
    if (Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.4) go(at + (dx < 0 ? 1 : -1));
    x0 = y0 = null;
  }, { passive: true });

  /* 주소에 화면 이름표가 붙어 온 것이면 그 화면부터 편다.
     처음에는 초점을 옮기지 않는다 — 들어오자마자 화면이 스스로 움직이면 놀란다 */
  const first = Math.max(0, ids.indexOf(location.hash.slice(1)));
  go(first, { push: false, focus: false });

  /* 목차(굴려서 읽을 때의 것)를 눌러도 그 화면으로 간다 */
  document.querySelectorAll('.case-dots a').forEach((a) => {
    a.addEventListener('click', (e) => {
      const i = ids.indexOf(a.hash.slice(1));
      if (i < 0) return;
      e.preventDefault();
      go(i);
    });
  });
}
