/* B안 견본을 넘기는 코드. 견본이라 짧게만 짰다.
 *
 * **A안과 견주려고 만든 것이다.** 이 파일에 손이 얼마나 가는지도 비교 대상이다 —
 * A안은 넘기는 코드가 아예 없다(굴리면 그만이다). 여기서는 화살표 · 키보드 ·
 * 손가락 쓸기 · 현재 화면 표시를 전부 손으로 만들어야 한다.
 *
 * 여기서 안 한 것도 적어 둔다. 정식으로 가려면 이만큼이 더 든다 —
 * 화면이 바뀔 때 초점 옮기기, 뒤로 가기 버튼에 화면 번호 남기기(history),
 * 스크린리더에 「3화면 중 2」 알리기, 안 보이는 화면을 훑기에서 빼기.
 * 굴리는 문서는 이 넷이 애초에 문제가 되지 않는다.
 */
const track = document.getElementById('vwTrack');
const panels = [...document.querySelectorAll('.vw-panel')];
const dots = [...document.querySelectorAll('.vw-pager button')];
const prev = document.getElementById('vwPrev');
const next = document.getElementById('vwNext');
const count = document.getElementById('vwCount');

let at = 0;

const show = (i) => {
  at = Math.max(0, Math.min(panels.length - 1, i));
  track.style.transform = `translateX(${-at * 100}%)`;
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
};

prev.addEventListener('click', () => show(at - 1));
next.addEventListener('click', () => show(at + 1));
dots.forEach((d) => d.addEventListener('click', () => show(Number(d.dataset.go))));

/* 키보드. 글자를 넣는 칸이 없는 화면이라 화살표를 통째로 가져다 쓴다 */
addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') show(at + 1);
  if (e.key === 'ArrowLeft') show(at - 1);
});

/* 손가락 쓸기. **세로로 쓴 것은 넘기지 않는다** — 절 안을 굴리는 동작이라
   가로보다 세로가 크면 그대로 둔다. 이걸 안 가르면 일력을 훑다가 화면이 넘어간다 */
let x0 = null, y0 = null;
addEventListener('touchstart', (e) => {
  x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
}, { passive: true });
addEventListener('touchend', (e) => {
  if (x0 === null) return;
  const dx = e.changedTouches[0].clientX - x0;
  const dy = e.changedTouches[0].clientY - y0;
  if (Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.4) show(at + (dx < 0 ? 1 : -1));
  x0 = y0 = null;
}, { passive: true });

show(0);

/* 재생 카드는 A안과 같은 것을 쓴다 (playgrown.js를 안 불러오므로 여기 한 벌 둔다) */
document.querySelectorAll('.film-card[data-yt]').forEach((a) => {
  a.addEventListener('click', (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
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
