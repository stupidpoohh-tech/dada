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
