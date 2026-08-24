/* ga.js — 방문 통계 (Google Analytics 4)
 *
 * 이 마을은 **URL이 바뀌지 않는다.** 구역을 열어도, 책을 넘겨도, 목록을 열어도
 * 주소는 `/` 그대로다. 그래서 GA가 알아서 세는 page_view 하나로는 "몇 명이 왔다"
 * 까지만 알고 **"무엇을 봤는가"는 한 줄도 안 남는다.** 그건 이 파일이 내주는
 * window.dadaTrack()으로 각자 자리에서 보낸다 (부르는 곳은 아래 「보내는 것」).
 *
 * 켜지는 곳은 HOSTS에 적은 도메인뿐이다. 이유가 둘 있다.
 *   - localhost에서 켜면 회귀 테스트가 매번 바깥 스크립트를 받으러 나간다.
 *     `networkidle`을 기다리는 검사들이라 남의 서버 사정에 흔들린다.
 *   - 내가 고치면서 백 번 여닫은 것이 통계에 섞이면 숫자가 거짓말을 한다.
 *
 * 갈아 끼울 자리는 ID 한 줄뿐이다. ID가 비어 있으면 아무것도 하지 않는다 —
 * 측정 ID를 받기 전에도 이 파일과 부르는 자리들이 그대로 얹혀 있어도 된다.
 *
 * 손으로 확인할 때는 주소 끝에 `?gadebug`를 붙인다. 실제로 보내는 대신
 * 콘솔에 찍히므로, 어느 자리에서 무엇이 나가는지 로컬에서 그대로 볼 수 있다.
 *
 * **Cloudflare Web Analytics는 여기서 손을 뗐다** (2026-08-24). 아래 CF_TOKEN 참고 —
 * 도메인이 Cloudflare 존이 되면서 대시보드가 알아서 비콘을 넣어 준다.
 *
 * 보내는 것 (이벤트 이름 · 부르는 자리)
 *   district_open   구역을 열었다            app.js openPanel
 *   item_click      항목 카드를 눌렀다        app.js card
 *   book_open       책을 열었다               app.js openBook
 *   book_end        책을 끝까지 넘겼다        app.js bkGo
 *   mailbox_open    우편함을 눌렀다           app.js makeMailbox
 *   bundle_open     날아다니는 쪽지를 눌렀다   app.js openBundle
 *   song_open       확성기로 집 테마송을 틀었다 app.js openSong
 *   column_open     까마귀가 편 칼럼을 열었다  app.js openColumn
 *   say_open        푸터의 👋로 한마디 창을 열었다 app.js openSay
 *   say_sent        한마디를 남겼다           app.js initSay
 *   picks_open      추천 픽을 열었다          app.js initPicks
 *   list_open       목록을 열었다             app.js openModal
 *   list_search     목록에서 검색했다         app.js (입력이 멎은 뒤 한 번)
 *   list_filter     목록에서 종류를 골랐다    app.js makeChips
 *   guide_chapter   안내서 챕터를 골랐다      game/guide.js goStack
 *   guide_zoom      안내서 면을 확대했다      game/guide.js openZoom
 *   guide_end       안내서를 끝까지 봤다      game/guide.js mount
 */
(function () {
  'use strict';

  /* GA4 측정 ID — 관리 → 데이터 스트림 → 웹 → 측정 ID (`G-`로 시작한다). */
  var ID = 'G-62X7QQW0GM';

  /* Cloudflare Web Analytics 토큰. **비워 뒀다 — 이제 손으로 넣지 않는다** (2026-08-24).

     예전에는 여기에 토큰을 적어 비콘을 직접 붙였다. `*.workers.dev`가 Cloudflare가
     관리하는 존(zone)이 아니라서, 호스트 이름을 직접 적고 **"which does not belong
     to Cloudflare websites"**를 골라 토큰을 받아 오는 것이 유일한 길이었다.

     **`dada-town.com`을 붙이면서 그 전제가 사라졌다.** 이 도메인은 존이므로
     대시보드의 Web Analytics에 「Automatic setup」으로 저절로 올라오고,
     Cloudflare가 지나가는 HTML에 비콘을 알아서 끼워 넣는다.
     (여기 「Workers 정적 에셋에는 자동 삽입이 없다」고 적어 뒀던 것은 **틀린
     말이었다** — 존이 아니라서 안 됐던 것이지 Workers라서 안 된 것이 아니었다.)

     그대로 뒀으면 **한 페이지에서 비콘이 둘** 붙었다. 예전 토큰은 workers.dev
     사이트의 것이라 Cloudflare가 호스트를 맞춰 보고 버리므로 숫자가 겹치지는
     않지만, 버려질 요청을 방문자마다 하나씩 더 보내는 셈이었다.

     **예전 토큰은 적어 두지 않는다.** 그 사이트를 Web Analytics에서 지웠으므로
     (2026-08-24) 토큰도 같이 죽었다 — 적어 두면 다음 사람이 그것을 되살리려다
     조용히 아무것도 안 세는 상태에 빠진다. 다시 걸 일이 생기면 **새로 만든다**
     (README 「존이 아닌 주소에 걸어야 할 때」). */
  var CF_TOKEN = '';

  /* **통계를 켤 도메인.** 여기 없는 주소에서는 아무것도 수집하지 않는다 —
     개발하며 여는 localhost와 미리보기 주소가 숫자를 더럽히지 않게 하려는 것이다.
     그래서 도메인을 새로 붙이면 **여기에 한 줄 더해야 켜진다.**

     **예전 주소(`dada-portfolio.stupidpoohh.workers.dev`)는 걷었다** (2026-08-24) —
     그 자리를 Disable 해서 이제 열리지 않는다. 목록에 남겨 둬도 해는 없지만,
     여기 적힌 것이 「지금 살아 있는 주소」로 읽히므로 죽은 주소를 두지 않는다.

     www는 아직 못 붙였지만 미리 적어 둔다 — 붙는 순간 저절로 켜진다. */
  var HOSTS = [
    'dada-town.com',
    'www.dada-town.com',
  ];

  var debug = /[?&]gadebug\b/.test(location.search);
  var onHost = HOSTS.indexOf(location.hostname) >= 0;
  var live = onHost && /^G-[A-Z0-9]+$/.test(ID);

  /* 켜지지 않는 곳에도 자리는 만들어 둔다 — 부르는 쪽이 조건문을 갖지 않도록.
     (그래도 부르는 쪽은 `window.dadaTrack &&`로 한 번 더 감싼다. 광고 차단기가
     이 파일 자체를 막으면 함수가 아예 없기 때문이다.) */
  window.dadaTrack = debug
    ? function (name, params) { console.log('[ga:off]', name, params || {}); }
    : function () {};

  if (live) {
    window.dataLayer = window.dataLayer || [];
    var gtag = function () { window.dataLayer.push(arguments); };

    /* gtag는 큐다. 아래 <script>가 도착하기 전에 쌓아 둬도 그대로 전송된다. */
    gtag('js', new Date());
    gtag('config', ID);

    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(ID);
    document.head.appendChild(s);

    /** 커스텀 이벤트 한 번. 이름은 소문자·밑줄, 매개변수 값은 100자를 넘기지 않는다. */
    window.dadaTrack = function (name, params) {
      gtag('event', name, params || {});
      if (debug) console.log('[ga]', name, params || {});
    };
  }

  /* Cloudflare Web Analytics 비콘. **지금은 CF_TOKEN이 비어 있어 안 붙는다** —
     존이 알아서 넣어 주므로 손으로 넣을 것이 없다. 코드는 남긴다: 존이 아닌
     주소에 다시 걸 일이 생기면 토큰만 도로 적으면 된다.

     GA와 겹쳐도 되지만 세는 값이 다르다 — 쿠키를 심지 않아 차단기에 덜 걸리므로
     「몇 명이 왔나」는 이쪽이 정확하고, 「무엇을 눌렀나」는 커스텀 이벤트가 있는
     GA만 안다. 그래서 자동 설정으로 옮긴 뒤에도 GA4는 그대로 둔다. */
  if (onHost && CF_TOKEN) {
    var b = document.createElement('script');
    b.type = 'module';                 // Cloudflare가 주는 스니펫 그대로
    b.src = 'https://static.cloudflareinsights.com/beacon.min.js';
    b.setAttribute('data-cf-beacon', JSON.stringify({ token: CF_TOKEN }));
    document.head.appendChild(b);
  }
})();
