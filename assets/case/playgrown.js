/* 브랜드 보드 타일을 눌러서 크게 보는 것 하나. 이 페이지의 JS는 이게 전부다.
 *
 * **없어도 되게 만든다.** 확대는 전부 `<a href="…jpg">`라, 이 파일이 안 실행돼도
 * 누르면 그림 파일이 그냥 열린다. 문서 본문은 애초에 JS와 무관하다 — 이 페이지를
 * 뷰어가 아니라 스크롤 문서로 정한 이유가 그것이다.
 *
 * `<dialog>`를 쓰는 이유는 **초점과 Esc를 브라우저가 대신 처리해 주기 때문**이다.
 * div로 만들면 초점 가두기와 Esc 닫기와 배경 스크롤 막기를 손으로 다시 짜야 한다.
 */
const links = document.querySelectorAll('.tile-zoom');
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

/* ── 지금 어느 방인지 ───────────────────────────────────────────
   점 여덟 개에 현재 절을 표시한다. 스크롤 이벤트로 매번 좌표를 재면 굴릴 때마다
   계산이 돌아 폰에서 버벅인다 — IntersectionObserver는 브라우저가 대신 봐 준다. */
const dots = [...document.querySelectorAll('.case-dots a')];
if (dots.length && window.IntersectionObserver) {
  /* **점이 가리키는 것은 표제가 아니라 절 전체다.** 앵커는 표제(h2)를 가리켜야
     눌렀을 때 제목이 화면 위에 오는데, 표제만 지켜보면 그 몇 십 px이 띠를 지나는
     순간에만 켜지고 나머지 내내 꺼져 있다. 그래서 앵커는 표제, 지켜보는 것은 절. */
  const watched = new Map();          // 절 → 그 절의 점
  const here = new Set();
  dots.forEach((d) => {
    const head = document.getElementById(d.hash.slice(1));
    const room = head && head.closest('section.room');
    if (room) watched.set(room, d);
  });

  const paint = () => {
    /* **맨 아래까지 내려갔으면 마지막 절이다.** 마지막 절(노트)은 짧아서 페이지
       끝에 닿아도 제 위쪽이 띠까지 못 올라온다 — 그러면 끝까지 굴렸는데도 점은
       계속 앞 절을 가리킨다. 더 굴릴 데가 없으면 그것이 곧 마지막 절이다. */
    const d = document.documentElement;
    if (window.scrollY + window.innerHeight >= d.scrollHeight - 4) {
      dots.forEach((x, i) => {
        if (i === dots.length - 1) x.setAttribute('aria-current', 'true');
        else x.removeAttribute('aria-current');
      });
      return;
    }
    /* 띠에 걸친 절이 둘일 때는 **아래쪽 것**을 고른다 — 내려가는 중이면 새로 들어온
       절이고, 올라가는 중이면 아직 화면을 채우고 있는 절이다 */
    const live = [...watched.keys()].filter((r) => here.has(r));
    const now = watched.get(live[live.length - 1]) || dots[0];
    dots.forEach((d) => {
      if (d === now) d.setAttribute('aria-current', 'true');
      else d.removeAttribute('aria-current');   // 값 없는 속성은 CSS가 못 잡는다
    });
  };

  /* 경계선은 화면 위쪽 35%. 가운데에 두면 절이 화면보다 길 때(일력·브랜드 보드가
     그렇다) 다음 절 표제가 이미 올라왔는데도 점이 안 넘어간다 */
  const io = new IntersectionObserver((rows) => {
    rows.forEach((r) => (r.isIntersecting ? here.add(r.target) : here.delete(r.target)));
    paint();
  }, { rootMargin: '0px 0px -65% 0px' });
  watched.forEach((_, room) => io.observe(room));

  /* 페이지 끝에 닿는 것은 절이 바뀌는 일이 아니라 IntersectionObserver가 안 알려준다.
     한 프레임에 한 번으로 묶어 두면 여덟 개 칠하는 값은 없는 것이나 같다 */
  let queued = false;
  addEventListener('scroll', () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; paint(); });
  }, { passive: true });
}
