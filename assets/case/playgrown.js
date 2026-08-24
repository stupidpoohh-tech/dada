/* 이 페이지의 JS는 둘뿐이다 — 영상을 눌렀을 때 바꿔 끼우는 것, 화면을 넘기는 것.
 *
 * **「눌러서 크게」는 안 만든다** (2026-08-22에 걷었다). 폰에서는 두 손가락으로
 * 벌리면 그만이라, 같은 일을 하는 단추를 하나 더 두는 것은 그 위에 얹는 짐이었다.
 *
 * **없어도 되게 만든다.** 이 파일이 안 실행돼도 문서는 위에서 아래로 이어진
 * 한 장으로 남고, 재생 카드는 유튜브로 가는 링크가 된다.
 */

/* ── 영상 ───────────────────────────────────────────────────────
   재생 카드를 누르면 그 자리에 유튜브 틀을 바꿔 끼운다.
   **누르기 전에는 유튜브에 아무 요청도 안 나간다** — 썸네일조차 안 받아온다.
   `youtube-nocookie.com`을 쓰는 것도 같은 이유다 (§4 「영상을 넣을 때 지킬 것」).
   이 코드가 안 돌면 카드는 그냥 유튜브로 가는 링크다. */
const playing = new Map();   // 지금 틀이 끼워진 자리 → 원래 카드

/** 끼워 둔 유튜브 틀을 걷고 카드를 도로 세운다.
 *  **떠난 화면의 영상은 반드시 걷어야 한다.** 안 걷으면 화면을 넘긴 뒤에도 소리가
 *  계속 나는데, 그 화면은 `inert`라 멈출 단추에 손이 닿지도 않는다. */
const stopFilm = (frame) => {
  const card = playing.get(frame);
  if (!card) return;
  playing.delete(frame);
  frame.replaceWith(card);      // 카드는 떼어 뒀을 뿐 살아 있는 노드다
};

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
    f.tabIndex = 0;
    playing.set(f, a);
    a.replaceWith(f);
    /* **초점을 새로 온 것에 옮긴다.** 안 옮기면 누르던 것이 사라지면서 초점이
       문서 맨 위로 떨어져, 키보드로 누른 사람이 탭 순서를 처음부터 다시 탄다 */
    f.focus({ preventScroll: true });
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

  /* **양 끝에서 한 번 더 넘기면 문서가 닫히고 마을로 돌아간다.**
     끝에 닿았는데 아무 일도 안 일어나면 「여기서 뭘 해야 하나」가 남는다 —
     읽던 사람이 스스로 뒤로 가기를 찾아야 했다. 마지막 장의 「다시 돌아온다」가
     그 문의 표시이고, 한 번 더 미는 동작이 그 문을 여는 것이다.

     **첫 화면의 왼쪽도 같은 문이다**(2026-08-24). 표지 앞에는 마을밖에 없는데
     왼쪽 화살표만 흐리게 죽어 있어서, 되돌아 나가려면 왼쪽 위 고리를 따로
     찾아야 했다. 아홉 장이 양쪽으로 열린 복도가 되는 셈이다 — 어느 끝으로
     밀어도 마을로 나온다. */
  const home = () => { location.href = '/'; };

  /** 트랙을 제자리에 다시 앉히기만 한다. **화면을 바꾸는 것과 갈라 둔다** —
   *  확대했다 돌아왔을 때 필요한 것은 자리 되돌리기뿐인데, go()를 부르면
   *  읽던 자리(scrollTop)까지 같이 지워진다 */
  const place = () => { track.style.transform = `translateX(${-at * 100}%)`; };

  let arrived = 0;   // 지금 화면에 언제 닿았나 (마지막 화면에서 나갈 때 쓴다)

  function go(i, opt = {}) {
    /* **마지막을 지나치는 것은 문 밖으로 나가는 일이라 실수로 되면 안 된다.**
       화살표를 누르고 있으면 자동 반복으로 아홉 장을 훑고 그대로 마을까지 나갔다.
       마지막 화면에 잠깐이라도 머문 뒤에야 문이 열린다 */
    if (i >= panels.length) {
      if (at === panels.length - 1 && Date.now() - arrived > 400) home();
      return;
    }
    /* 첫 화면에서 왼쪽으로 가는 것도 같다. `at`이 아직 -1인 첫 그리기에서는
       아무 일도 일어나지 않아야 해서 `at === 0`을 함께 본다 */
    if (i < 0) {
      if (at === 0 && Date.now() - arrived > 400) home();
      return;
    }
    const to = Math.min(panels.length - 1, i);
    if (to === at) return;
    at = to;
    arrived = Date.now();
    place();

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
    /* **양 끝에서도 화살표는 살아 있다** — 다만 가는 곳이 옆 화면이 아니라 마을이다.
       빨갛게 물드는 것(`--out`)이 「이 문은 밖으로 난다」는 표시다 */
    const first = at === 0;
    const last = at === panels.length - 1;
    prev.disabled = false;
    prev.classList.toggle('vw-arrow--out', first);
    prev.setAttribute('aria-label', first ? '문서를 닫고 마을로' : '이전 화면');
    next.disabled = false;
    next.classList.toggle('vw-arrow--out', last);
    next.setAttribute('aria-label', last ? '문서를 닫고 마을로' : '다음 화면');
    /* 넘어간 화면은 맨 위에서 시작한다. 안 되돌리면 앞 화면을 굴려 놓은 만큼
       다음 화면도 중간부터 보인다 */
    panels[at].scrollTop = 0;

    /* 떠나는 화면의 영상을 걷는다 (위 stopFilm 설명) */
    document.querySelectorAll('.film-frame').forEach((f) => {
      if (!panels[at].contains(f)) stopFilm(f);
    });

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
    /* **누르고 있는 것은 한 번으로 친다.** 자동 반복을 그대로 받으면 1초도 안 되어
       아홉 장을 지나 마을까지 나가 버린다 — 한 장 한 장 눌러야 한 장씩 넘어간다 */
    if (e.repeat) return;
    if (e.key === 'ArrowRight') go(at + 1);
    if (e.key === 'ArrowLeft') go(at - 1);
  });

  /* 손가락 쓸기. **세로로 쓴 것은 넘기지 않는다** — 절 안을 굴리는 동작이라
     가로보다 세로가 크면 그대로 둔다. 안 가르면 일력을 훑다가 화면이 넘어간다 */
  let x0 = null, y0 = null, multi = false;
  addEventListener('touchstart', (e) => {
    /* **두 손가락이 닿았으면 넘기는 동작이 아니다.** 「눌러서 크게」를 걷고 확대를
       두 손가락에 맡겼는데, 벌렸다 떼는 순간의 좌표차가 쓸기 판정을 통과해
       화면이 넘어갔다 — 마지막 화면에서는 그대로 마을로 나가 버렸다 */
    if (e.touches.length > 1) { multi = true; x0 = null; return; }
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
  }, { passive: true });
  addEventListener('touchend', (e) => {
    if (e.touches.length === 0 && multi) { multi = false; x0 = null; return; }
    if (multi || x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    const dy = e.changedTouches[0].clientY - y0;
    if (Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.4) go(at + (dx < 0 ? 1 : -1));
    x0 = y0 = null;
  }, { passive: true });

  /* 주소에 화면 이름표가 붙어 온 것이면 그 화면부터 편다.
     처음에는 초점을 옮기지 않는다 — 들어오자마자 화면이 스스로 움직이면 놀란다 */
  const startAt = Math.max(0, ids.indexOf(location.hash.slice(1)));
  go(startAt, { push: false, focus: false });

  /* **두 손가락으로 벌렸다 놓으면 화면이 어긋난다.** 확대하는 동안 브라우저는
     보이는 창(visual viewport)을 따로 움직이는데, 다시 오므려도 그 어긋남이 남아
     화면이 애매하게 잘린 채로 선다 — 폰에서 실제로 그랬다.

     배율이 1로 돌아온 순간에 **문서를 원점으로 되돌리고 자리를 다시 칠한다.**
     확대하고 있는 중에는 건드리지 않는다(그러면 확대 자체가 안 된다). */
  const vv = window.visualViewport;
  if (vv) {
    let zoomed = false;
    const settle = () => {
      if (vv.scale > 1.01) { zoomed = true; return; }
      /* **확대했다 돌아온 경우에만 손댄다.** 모든 크기 변화에 반응하게 뒀더니
         창 크기를 바꾸거나 폰을 돌리기만 해도 읽던 자리가 맨 위로 튀었다 —
         일력·브랜드처럼 긴 화면에서는 읽던 데를 잃는다는 뜻이다 */
      if (!zoomed) return;
      zoomed = false;
      if (scrollX || scrollY) scrollTo(0, 0);
      place();                     // 자리만 되돌린다 (scrollTop은 그대로 둔다)
    };
    vv.addEventListener('resize', settle);
    vv.addEventListener('scroll', settle);
  }

  /* 창 크기가 바뀌면 트랙도 다시 앉혀야 한다 — %로 밀어 두었으므로 폭이 바뀌면
     계산이 달라진다. 여기서도 읽던 자리는 건드리지 않는다 */
  addEventListener('resize', place);

  /* **목차에는 아무것도 걸지 않는다.** 그것은 JS가 없을 때만 보이는 것이라
     (뷰어 모드에서는 `display: none`) 여기서 누르는 것을 붙여 봐야 닿지 않는다 —
     한동안 붙어 있던 죽은 코드였다 (2026-08-22에 걷었다). */
}
