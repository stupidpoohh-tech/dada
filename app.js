/* DADA TOWN */
(() => {
  'use strict';

  const S = 'assets/sprites/cut/';

  /* **떠다니는 풍경은 두지 않는다.** 한때 구름 셋이 하늘을 가로지르고, 새 둘이
     사선으로 활강하고, 자동차 셋이 도로를 돌았다. 그때는 마을에 움직이는 것이
     그것뿐이라 살아 있어 보였는데, 그 뒤로 까마귀·쪽지·확성기가 차례로 들어오면서
     **눈이 쉴 자리가 없어졌다.** 셋을 걷어낸 이유는 하나씩이 나빠서가 아니라
     전부 합쳐 놓으니 번잡해서다.

     남은 움직임은 전부 **뜻이 있는 것**이다 — 건물은 눌러볼 수 있다는 신호로
     숨쉬고, 사람들은 공원이 사람들 구역이라 들썩이고, 까마귀·쪽지·확성기는
     저마다 문이다. 지나가기만 하는 것은 이제 없다.

     자동차가 사라지면서 `canopy`(차가 나무 뒤로 지나가도록 나무만 오려 덮던
     레이어)도 함께 걷었다 — 가릴 것이 없으면 지도를 한 장 더 까는 값만 남는다. */

  // 공원에 모여 있는 사람들. 8종 중 6명만 — 다 넣으면 붐빈다.
  // w는 지도 폭 기준 %. 높이가 아니라 폭으로 잡아야 지도와 같이 축소된다.
  // 분수 왼쪽 잔디에 5명을 바짝 모아 한 무리로 보이게. 다 같은 박자로 움직인다.
  // 다섯이었다가 셋으로 줄였다 — 요소가 늘면서 마을이 번잡해져 사람들 쪽을 덜어냈다.
  // 줄어든 만큼 하나하나가 눈에 들어오도록 크기를 10%씩 키웠다.
  const FOLKS = [
    { src: 'person-1.png', x: 13.0, y: 57.0, w: 2.26 },  // 분수 왼쪽
    { src: 'person-6.png', x: 17.5, y: 61.5, w: 3.00 },  // 산책로 위 (가운데)
    { src: 'person-7.png', x: 21.5, y: 57.5, w: 2.20 },  // 분수 오른쪽
  ];
  /* 잔디에 내려앉은 새 — 정적으로 얹어 마을을 채운다. **날아다니던 새와 달리
     이 둘은 남긴다.** 걷어낸 것은 「새」가 아니라 「가로지르는 움직임」이라서다 —
     앉은 새는 지도에 그려진 꽃·벤치와 같은 자리에 있는 그림일 뿐 움직이지 않는다. */
  const PERCHED = [
    { src: 'sparrow-side.png',   x: 52,   y: 30, w: 1.7 },
    { src: 'bluebird-front.png', x: 11,   y: 50, w: 1.4 },
  ];
  const TYPE_LABEL = { app: '앱', doc: '문서', video: '영상', external: '외부' };
  const STATUS_LABEL = { beta: '베타', demo: 'demo', soon: '준비 중' };

  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const pct = (v) => v + '%';
  /** 밑변 기준 y좌표(0=지도 위, 100=지도 아래)를 CSS `bottom` 값으로 바꾼다.
   *
   *  **`top` + `translate(-100%)`으로 앉히면 안 된다.** 그 -100%는 요소 「자기
   *  높이」의 100%인데, 스프라이트 상자에는 높이가 없다 — 안의 <img>에 width·height
   *  속성이 없어서 그림이 도착하기 전까지 비율을 모르기 때문이다. 그동안 높이는 0이고
   *  -100%도 0이라, 건물·까마귀·확성기가 전부 「제 키만큼 아래」에 그려진다.
   *  크롬은 그림이 온 뒤 퍼센트 변환을 다시 계산해 제자리로 돌려놓지만
   *  **iOS 사파리는 그러지 않는다** — 폰에서만 마을이 통째로 아래로 흘러내렸고,
   *  키가 가장 큰 세모집은 지도 밖으로 잘려 나갔다 (가로는 -50%가 인라인으로 넣은
   *  width에 걸려 멀쩡했다. 세로만 어긋난 이유가 이것이다).
   *
   *  `bottom`은 담는 상자의 높이에 걸리므로 자기 높이를 몰라도 된다. 밑변이 먼저
   *  못 박히고 그림은 그 위로 자란다 — 「좌표는 밑변」이라는 이 마을의 규칙 그대로다. */
  const upTo = (y) => pct(100 - y);
  /** 지도 위의 「문」 전부. 하나가 열리면 나머지의 aria-expanded를 내려야 하는데,
   *  이 목록을 자리마다 따로 적어 두면 문이 늘 때 한 군데를 빠뜨린다 —
   *  까마귀가 칼럼을 열게 되면서 실제로 빠질 뻔했다. 한 곳에 모아 둔다. */
  const DOORS = '.spot, .me-spot, .note-spot, .horn-spot, .crow-spot, .fish-spot';
  /** 방문 통계 한 줄. 마을은 URL이 바뀌지 않아 무엇을 봤는지가 자동으로는 안 남는다.
   *  ga.js가 없거나(광고 차단·로컬) 꺼져 있으면 조용히 지나간다 — 부르는 자리에
   *  조건문을 두지 않기 위한 감쌈이다. 보내는 목록은 ga.js 머리말에 모아 뒀다. */
  const track = (name, params) => { if (window.dadaTrack) window.dadaTrack(name, params); };
  /** 만든 시기. 데이터는 정렬되게 `2026-05`로 두고, 보이는 곳에서만 짧게 쓴다. */
  const shortDate = (s) => s.slice(2).replace('-', '.');
  const monthLabel = (s) => (s ? `${s.slice(0, 4)}년 ${+s.slice(5, 7)}월` : '시기 미상');

  let data, byDistrict, openId = null, lastSpot = null;

  /** 지도에 얹는 그림 한 장. **못 불러오면 스스로 사라진다.**
   *  브라우저는 깨진 <img>에 물음표 상자를 그리는데, 이 마을에서는 그게 지도 위에
   *  그대로 뜬다 — 없는 그림보다 나쁘다. 실제로 그런 적이 있다: services.json만
   *  예전 것이 캐시에 남아 사라진 파일 이름을 가리키자 카페 앞에 물음표가 섰다. */
  function pixel(src, alt = '') {
    const img = new Image();
    img.src = src;
    img.alt = alt;
    img.addEventListener('error', () => img.remove(), { once: true });
    return img;
  }

  /* ── 지도 위 장식 ───────────────────────── */

  function sprite(cls, src, styles) {
    const box = el('div', cls);
    Object.assign(box.style, styles);
    const img = pixel(S + src);
    img.loading = 'lazy';
    box.appendChild(img);
    return box;
  }

  function paintScenery() {
    const folks = $('folks');

    // 왼쪽 사람부터 오른쪽 사람까지 차례로 솟는다 — 파도타기.
    // 박자(2.4초)는 마을과 같고 시작만 조금씩 늦춘다. 배열이 이미 x 순서다.
    FOLKS.forEach((f, i) => folks.appendChild(sprite('folk person', f.src, {
      left: pct(f.x), bottom: upTo(f.y), width: pct(f.w),
      animationDelay: (i * 0.19).toFixed(2) + 's',
    })));

    PERCHED.forEach((p) => folks.appendChild(sprite('folk', p.src, {
      left: pct(p.x), bottom: upTo(p.y), width: pct(p.w), animation: 'none',
    })));

  }

  /* ── 구역 핫스팟 ─────────────────────────── */

  function makeSpots() {
    const wrap = $('hotspots');

    data.districts.forEach((d) => {
      const count = (byDistrict[d.id] || []).length;
      const isMe = !!d.character;
      const btn = el('button', isMe ? 'me-spot' : 'spot');
      btn.type = 'button';
      btn.dataset.district = d.id;
      btn.setAttribute('aria-expanded', 'false');
      // 바로 열리는 구역은 개수가 아니라 무엇이 열리는지를 말한다.
      // 세모집은 항목이 둘이지만 건물은 소개서만 열고, 안내서는 우편함이 연다
      const direct = d.direct && data.items.find((x) => x.id === d.direct);
      // "나"는 작업물이 0개여도 프로필(경력·학력)이 항상 뜬다 — 다른 구역의
      // "준비 중"과 같은 뜻이 아니므로 그 말을 붙이지 않는다
      btn.setAttribute('aria-label', direct ? `${d.name} — ${direct.name}`
        : count ? `${d.name} — 작업물 ${count}개`
        : isMe ? d.name
        : `${d.name} — 준비 중`);

      if (isMe) {
        btn.style.left = pct(d.character[0]);
        btn.style.bottom = upTo(d.character[1]);
        btn.style.width = '5.4%';
        // 흔들리는 것은 안쪽 그림뿐 — 버튼은 가만히 있어야 누를 자리가 고정된다
        const fig = el('span', 'me-figure');
        fig.appendChild(pixel(S + 'me.png'));
        btn.appendChild(fig);
      } else {
        const [x, y, w, h] = d.rect;
        Object.assign(btn.style, { left: pct(x), top: pct(y), width: pct(w), height: pct(h) });

        if (d.building) {
          // 건물이 이제 지도의 일부가 아니라 따로 오려낸 그림이다(assets/sprites/buildings.png,
          // tools/cut_buildings.py). "나"·확성기·까마귀와 같은 밑변 기준 좌표(at/w)라,
          // 구역 상자(rect) 안에서 상대 위치로 환산해 심는다 — %끼리의 비율이라 창 크기가
          // 바뀌어도 그대로 맞고, syncPops()처럼 지도 픽셀을 다시 재는 일도 필요 없다.
          const b = d.building;
          const [rx, ry, rw, rh] = d.rect;
          const pop = el('span', 'pop');
          Object.assign(pop.style, {
            left: pct((b.at[0] - rx) / rw * 100),
            bottom: upTo((b.at[1] - ry) / rh * 100),
            width: pct(b.w / rw * 100),
          });
          pop.appendChild(pixel(S + b.src));
          btn.appendChild(pop);
        }

        if (d.mailbox) makeMailbox(wrap, d);
        if (d.speaker) makeSpeaker(wrap, d);
        if (d.mascot) makeMascot(wrap, d);

        // 사람들 구역은 공원 땅이 아니라 사람들이 반응한다
        if (d.id === 'park') {
          const layer = $('folks');
          const hot = (on) => layer.classList.toggle('folks-hot', on);
          btn.addEventListener('mouseenter', () => hot(true));
          btn.addEventListener('mouseleave', () => { hot(false); resyncIdle(); });
          btn.addEventListener('focus', () => hot(true));
          btn.addEventListener('blur', () => { hot(false); resyncIdle(); });
          btn.addEventListener('click', () => {
            layer.classList.remove('folks-pop');
            void layer.offsetWidth;          // 리플로우로 애니메이션 재시작
            layer.classList.add('folks-pop');
            // 뾰옹이 끝나면 사람들도 마을 박자로 되돌린다
            setTimeout(resyncIdle, 600);
          });
        }
      }

      // 호버·포커스가 풀리면 그 요소만 idle이 0부터 다시 시작한다 → 박자를 되맞춘다
      btn.addEventListener('mouseleave', resyncIdle);
      btn.addEventListener('blur', resyncIdle);

      btn.addEventListener('click', () => toggle(d.id, btn));
      wrap.appendChild(btn);
    });

    makeFloater(wrap);
    makeFish(wrap);
    makeSign(wrap);
  }

  /** 강물의 물고기 — 구역이 아니라 지도 위에 따로 선 문이다(까마귀·우편함과 같은 결).
   *  다리 위쪽 물길에서 헤엄치다 이따금 솟구친다. 누르면 「지금日지도」로 간다.
   *
   *  **늘 보여야 한다.** 한때는 물속에 숨었다가 한 순간만 솟게 만들었는데,
   *  문이 된 뒤로는 그럴 수 없다 — 누를 것이 12%의 시간에만 있으면 누를 수가 없다.
   *  그래서 물낯에 상시로 떠 있고, 뜀은 그 위에 얹힌 한 순간이다.
   *
   *  **자세는 갈아 끼운다**(까마귀와 같은 규칙). 이 마을에는 프레임 애니메이션이
   *  없어서(transform만 쓴다) 헤엄치던 물고기가 몸을 세우려면 그림이 여러 장이어야
   *  했다 — 비스듬(swim) · 곧추섬(up) · 납작(flat) 세 장이고, 셋은 같은 배율 ·
   *  **같은 밑변**의 한 캔버스다(tools/cut_fish.py). 밑변을 맞춰 둔 덕에 갈아 끼워도
   *  물낯이 안 흔들린다 — 꼬리는 물에 있고 머리만 올라가는 것이 곧 뛰어오르는 몸짓이다.
   *
   *  **헤엄 자세를 비스듬한 것으로 고른 이유**가 있다. 이 물길은 오른쪽 아래로
   *  40°쯤 기울어 흐르는데, 옆모습(납작)을 눕혀 놓으면 상자가 물길보다 넓어
   *  코와 꼬리가 둑에 올라간다. 비스듬한 자세는 물길과 같은 방향이라 폭 8%까지
   *  키워도 온몸이 물 위에 있다 — 크기를 벌어 준 것이 자세다.
   *
   *  상자 높이는 `ratio`(캔버스 비율)로 못 박는다. 그림이 도착해야 알 수 있는
   *  높이에 기대면 뜀(`bottom`의 %)이 그림 오기 전에는 0이 되는데, **iOS 사파리는
   *  그 뒤로도 다시 계산하지 않는다** — 마을이 통째로 흘러내렸던 그 함정이다. */
  function makeFish(wrap) {
    const g = data.fish;
    if (!g || !g.frames) return;
    const item = data.items.find((x) => x.id === g.item);
    const open = item && item.url;
    // 갈 곳이 없으면 풍경으로만 선다 — 없는 곳을 가리키는 문은 만들지 않는다
    const box = el(open ? 'a' : 'span', 'fish-spot' + (open ? '' : ' scenery'));
    if (open) {
      box.href = item.url;
      // 마을 밖으로 나가는 것은 새 탭으로 연다 — 카드와 같은 규칙이다.
      // 같은 탭으로 보내면 돌아올 마을이 없어진다
      if (item.type === 'app' || item.type === 'external' || item.type === 'video') {
        box.target = '_blank';
        box.rel = 'noopener';
      }
      box.setAttribute('aria-label', `${g.name} — ${item.name}`);
      box.addEventListener('click', () => track('item_click', {
        item: item.id, item_type: item.type, from: 'fish',
      }));
    } else {
      box.setAttribute('aria-hidden', 'true');
    }
    Object.assign(box.style, {
      left: pct(g.at[0]), bottom: upTo(g.at[1]), width: pct(g.w),
      aspectRatio: g.ratio ? `${g.ratio[0]} / ${g.ratio[1]}` : 'auto',
    });
    if (g.jump != null) box.style.setProperty('--fish-jump', pct(g.jump));

    // 역할 이름이 곧 클래스다 (swim · up · flat) — 순서에 기대면 한 장만 늘어도 어긋난다
    const fig = el('span', 'fish-figure');
    const body = el('span', 'fish-body');
    Object.entries(g.frames).forEach(([role, src]) => {
      const img = pixel(S + src);
      img.className = 'fish-' + role;
      body.appendChild(img);
    });
    fig.appendChild(body);
    box.appendChild(fig);
    wrap.appendChild(box);
  }

  /** 마을 나가는 길의 표지판 — 구역이 아니라 지도 위에 따로 선 문이다
   *  (우편함·확성기와 같은 결). 누르면 다원이 총총 뛰어와 배웅한다.
   *
   *  **여기서는 배웅을 만들지 않는다.** 그건 안내(onboarding.js)의 일이라
   *  손잡이만 두드린다 — 그쪽이 없으면 표지판은 그냥 풍경으로 선다.
   *  좌표는 다른 것들과 같은 밑변 기준(at/w)이라 `bottom`으로 앉힌다
   *  (`top` + `translateY(-100%)`는 iOS에서 마을을 흘러내리게 한다). */
  function makeSign(wrap) {
    const g = data.sign;
    if (!g || !g.sprite) return;
    const live = typeof window.dadaBye === 'function';
    const box = el(live ? 'button' : 'span', 'sign-spot' + (live ? ' sign-live' : ''));
    Object.assign(box.style, { left: pct(g.at[0]), bottom: upTo(g.at[1]), width: pct(g.w) });

    const fig = el('span', 'sign-fig');
    const zoom = el('span', 'sign-zoom');   // 호버 확대를 idle과 다른 요소에 건다
    zoom.appendChild(pixel(S + g.sprite, ''));
    fig.appendChild(zoom);
    box.appendChild(fig);

    if (live) {
      box.type = 'button';
      box.setAttribute('aria-label', g.name || '마을 나가기');
      box.addEventListener('click', () => {
        track('sign_click', {});
        window.dadaBye();
      });
    } else {
      box.setAttribute('aria-hidden', 'true');   // 누를 수 없는 것을 읽어줄 이유가 없다
    }
    wrap.appendChild(box);
  }

  /** 확성기 — 세모집 마당. 집 테마송이 여기서 나온다.
   *
   *  **`speaker.song`이 없으면 풍경으로만 선다** (까마귀와 같은 규칙 — 없는 곳을
   *  가리키는 문을 만들지 않는다). 있으면 진짜 버튼이 되어 누르면 노래가 재생되고
   *  가사 팝업이 뜬다 — 세모집 우편함·까마귀와 같은 「구역과 별개의 문」이다.
   *  세모집 옆에 서 있지만 세모집 클릭은 가로채지 않는다(각자 판정 영역이 따로 있다).
   *
   *  걸음은 **한 박자에 두 번 앞으로 내지르는 것**이다. 마을의 다른 것들과 겹치지
   *  않아야 해서 회전(우편함)도 뜀(캐릭터)도 아닌 **반동**을 골랐다 — 소리를 내는
   *  물건이니 앞으로 밀렸다 돌아오는 게 제 몸짓이다. 축은 잔디에 닿은 받침이다.
   *  **재생 중에는 같은 반동을 더 크고 빠르게**(`horn-playing`) 해서, 소리가 나고
   *  있다는 것이 눈에도 보이게 한다. */
  function makeSpeaker(wrap, d) {
    const s = d.speaker;
    if (!s || !s.sprite) return;
    const song = s.song;
    const box = el(song ? 'button' : 'span', 'horn-spot' + (song ? ' horn-live' : ''));
    Object.assign(box.style, { left: pct(s.at[0]), bottom: upTo(s.at[1]), width: pct(s.w) });

    const fig = el('span', 'horn-fig');
    const zoom = el('span', 'horn-zoom');    // 호버 확대를 idle 애니메이션과 다른 요소에 건다
    zoom.appendChild(pixel(S + s.sprite));
    fig.appendChild(zoom);
    box.appendChild(fig);

    if (song) {
      box.type = 'button';
      box.setAttribute('aria-label', `${s.name} — ${song.title}`);
      box.setAttribute('aria-expanded', 'false');
      box.addEventListener('click', () => toggleSong(box, s));
    } else {
      box.setAttribute('aria-hidden', 'true');   // 누를 수 없는 것을 읽어줄 이유가 없다
    }
    wrap.appendChild(box);
  }

  /* ── 집 테마송 ─────────────────────────────
   *  확성기가 여는 문. 재생과 가사 팝업이 함께 온다 — 구역 패널을 그대로 쓰되
   *  자리는 확성기를 따라간다(쪽지 묶음과 같은 liveBox 방식).
   *
   *  **자동재생을 페이지 로드에 걸지 않는다.** 브라우저가 막기도 하지만, 그보다
   *  먼저 소리가 방문자 허락 없이 나는 건 무례하다. 재생은 누르는 손 안에서만 시작된다.
   *
   *  `<audio controls>`를 그대로 쓴다 — 재생·일시정지·탐색·볼륨을 직접 만들지 않는
   *  이유는 브라우저 내장 컨트롤이 이미 접근성(키보드·스크린리더)을 갖추고 있어서다. */
  let songEl = null;         // 지금 재생 중인 <audio>. 다른 패널이 열리면 멈춘다

  function stopSong() {
    if (!songEl) return;
    songEl.pause();
    songEl = null;
    document.querySelectorAll('.horn-spot.horn-playing')
      .forEach((b) => b.classList.remove('horn-playing'));
    resyncIdle();     // horn-playing이 걷히며 그 확성기만 idle이 0부터 다시 시작한다
  }

  function toggleSong(btn, d) {
    if (openId === 'song' && songEl) return closePanel();
    openSong(btn, d);
  }

  function openSong(btn, d) {
    stopSong();
    const song = d.song;
    const panel = $('panel');
    panel.textContent = '';
    document.querySelectorAll(DOORS)
      .forEach((x) => x.setAttribute('aria-expanded', String(x === btn)));

    const head = el('div', 'panel-head');
    head.appendChild(el('h2', 'panel-title', `📣 ${song.title}`));
    const close = el('button', 'icon-btn panel-close', '✕');
    close.type = 'button';
    close.setAttribute('aria-label', '닫기');
    close.addEventListener('click', () => { closePanel(); btn.focus(); });
    head.appendChild(close);
    panel.appendChild(head);

    const audio = el('audio', 'song-audio');
    audio.controls = true;
    audio.preload = 'auto';
    audio.src = song.audio;
    panel.appendChild(audio);
    songEl = audio;

    // 눈으로도 보이게 — 재생 중에는 확성기가 더 크고 빠르게 내지른다
    const sync = () => btn.classList.toggle('horn-playing', !audio.paused);
    audio.addEventListener('play', sync);
    audio.addEventListener('pause', sync);
    audio.addEventListener('ended', sync);

    const lyrics = el('div', 'song-lyrics');
    (song.lyrics || []).forEach((sec) => {
      const block = el('div', 'song-section');
      if (sec.label) block.appendChild(el('p', 'song-label', sec.label));
      (sec.lines || []).forEach((line) => block.appendChild(el('p', 'song-line', line)));
      lyrics.appendChild(block);
    });
    panel.appendChild(lyrics);

    track('song_open', { song: song.title });

    $('panelWrap').hidden = false;
    panel.scrollTop = 0;
    openId = 'song';
    lastSpot = btn;
    placePanel({ liveBox: () => btn.getBoundingClientRect() });
    panel.focus({ preventScroll: true });
    $('hint').classList.add('gone');

    // 누르는 손 안에서 시작하는 재생이라 브라우저가 막지 않는다. 그래도 자동재생
    // 정책이 낀 브라우저가 있을 수 있어 실패해도 조용히 넘어간다 — 컨트롤로 누르면 된다
    audio.play().catch(() => {});
  }

  /* ── 날아다니는 쪽지 ─────────────────────── */

  /** 마을 위를 펄럭이며 도는 쪽지. 누르면 묶음 팝업이 열린다.
   *
   *  **새·구름과 다른 것으로 읽혀야 한다.** 저 둘은 풍경이라 눌러도 아무 일이 없는데,
   *  이건 문이다. 그래서 네 가지를 다르게 뒀다.
   *
   *  1. **걸음이 다르다.** 새와 구름은 한 방향으로 일정하게 흐르지만 쪽지는
   *     길목마다 **멈춰 선다.** 멈춤은 「기다리고 있다」로 읽힌다 — 흐르는 것과
   *     기다리는 것은 눈에 확실히 다르다
   *  2. **마을 박자를 타지 않는다.** 건물·사람·까마귀는 전부 2.4초 한 박자인데
   *     쪽지의 펄럭임은 0.55초다. 마을의 일부가 아니라 마을 위에 온 것이라서다
   *  3. **가장 위에 뜬다.** 새·구름(z 6)보다 위라 무엇에도 가리지 않는다
   *  4. **손을 대면 멈춘다.** 호버·포커스에서 비행이 통째로 정지한다.
   *     날아다니는 것을 눌러야 하므로 이게 없으면 조준이 안 된다
   *
   *  데이터는 `floater` 하나 — 경로도 박자도 그림도 전부 거기서 읽는다. */
  function makeFloater(wrap) {
    const m = data.floater;
    if (!m || !(m.path || []).length) return;
    const frames = Object.entries(m.frames || {});
    if (!frames.length) return;

    const btn = el('button', 'note-spot');
    btn.type = 'button';
    btn.setAttribute('aria-label', `${m.name} — ${m.bundle.title}`);
    btn.setAttribute('aria-expanded', 'false');
    btn.style.width = pct(m.w);

    // 오르내림(.note-fig)과 호버 확대(.note-zoom)를 다른 요소에 나눠 건다.
    // 한 요소에 겹치면 애니메이션의 transform이 호버의 transform을 덮어쓴다 (새와 같은 이유)
    const fig = el('span', 'note-fig');
    const zoom = el('span', 'note-zoom');
    frames.forEach(([role, src]) => {
      const img = pixel(S + src);
      img.className = 'note-' + role;
      zoom.appendChild(img);
    });
    fig.appendChild(zoom);
    btn.appendChild(fig);

    /* 경로를 keyframes로 굽는다. `stop: true`인 길목에서는 그 자리에 잠깐 머문다 —
     *  이 「멈춤」이 새·구름과 갈리는 가장 큰 신호다.
     *
     *  한때 **멈춰 있는 동안만 잡히게** 해 뒀다. 날아가는 쪽지가 건물 위를 지날 때
     *  그 건물의 클릭을 가로채는 게 싫어서였는데, 실제로 써 보니 **한 바퀴의 5분의 1만
     *  눌리는 물건**이 됐다. 누르려다 안 눌리는 문은 문이 아니다.
     *  지금은 언제든 잡힌다 — 위에 있는 것이 클릭을 받는 건 원래 그래야 하는 일이고,
     *  머무는 자리를 전부 빈 땅에 둬서 오래 겹치는 일은 없다. */
    const pts = m.path;
    const legs = pts.length - 1;
    const DWELL = 0.45;                   // 한 구간에서 머무는 몫
    const span = 100 / legs;
    let fly = '';
    pts.forEach((w, i) => {
      const at = i * span;
      const here = `left:${w.at[0]}%;top:${w.at[1]}%`;
      fly += `${at.toFixed(2)}%{${here}}`;
      if (w.stop && i < legs) fly += `${(at + span * DWELL).toFixed(2)}%{${here}}`;
    });
    const sheet = document.styleSheets[0];
    sheet.insertRule(`@keyframes note-fly{${fly}}`, sheet.cssRules.length);
    btn.style.animationDuration = (m.dur || 40) + 's';

    btn.addEventListener('click', () => toggleBundle(btn));
    wrap.appendChild(btn);
  }

  /** 쪽지가 여는 묶음 팝업. 구역 패널을 그대로 쓰되 자리는 쪽지를 따라간다. */
  function toggleBundle(btn) {
    if (openId === 'bundle') return closePanel();
    openBundle(btn);
  }

  function openBundle(btn) {
    const b = data.floater.bundle;
    stopSong();        // 노래를 들으며 쪽지를 눌러도 조용히 멈춘다
    const panel = $('panel');
    panel.textContent = '';
    document.querySelectorAll(DOORS)
      .forEach((x) => x.setAttribute('aria-expanded', String(x === btn)));

    const head = el('div', 'panel-head');
    head.appendChild(el('h2', 'panel-title', `${data.floater.icon} ${b.title}`));
    if (data.floater.label) head.appendChild(el('span', 'panel-label', data.floater.label));
    const close = el('button', 'icon-btn panel-close', '✕');
    close.type = 'button';
    close.setAttribute('aria-label', '닫기');
    close.addEventListener('click', () => { closePanel(); btn.focus(); });
    head.appendChild(close);
    panel.appendChild(head);

    /* 묶음이 가리키는 id로 항목을 찾는다. 셋 중 하나다.
     *  ① `items`에 있으면 그 항목 카드 — 목록·`/list`에도 함께 실려 있는 것
     *  ② 묶음 쪽에만 주소가 적혀 있으면 그것으로 카드를 만든다.
     *     아직 만든 시기를 못 받아 `items`에 못 올린 것이 여기 머문다
     *  ③ 주소가 아예 없으면 「준비 중」 — 없는 곳으로 가는 링크를 만들지 않는다 */
    const grid = el('div', 'cards');
    b.items.forEach((entry) => {
      const item = data.items.find((x) => x.id === entry.id);
      const known = item && item.url ? item : (entry.url ? entry : null);
      grid.appendChild(known ? card(known) : soonCard(entry));
    });
    panel.appendChild(grid);

    track('bundle_open', { bundle: b.title, items: b.items.length });

    $('panelWrap').hidden = false;
    panel.scrollTop = 0;
    openId = 'bundle';
    lastSpot = btn;
    placePanel({ liveBox: () => btn.getBoundingClientRect() });
    panel.focus({ preventScroll: true });
    $('hint').classList.add('gone');
  }

  /** 목록·모달·구역 패널에 서는 「준비 중」 카드. 위 `card()`와 같은 것을 담되
   *  누를 수 없는 상자다. 아래 `soonCard()`는 쪽지 묶음이 쓰는 것으로,
   *  거기 적히는 것은 이름과 시기뿐이라 설명 줄이 없다. */
  function soonItemCard(item) {
    const box = el('div', 'card card--soon');
    box.appendChild(el('span', 'card-ico', item.icon || '📦'));
    const body = el('div', 'card-body');
    if (item.date) body.appendChild(el('div', 'card-date', shortDate(item.date)));
    const name = el('div', 'card-name');
    name.append(item.name);
    name.appendChild(el('span', 'badge soon', STATUS_LABEL.soon));
    body.appendChild(name);
    if (item.description) body.appendChild(el('div', 'card-desc', item.description));
    box.appendChild(body);
    return box;
  }

  /** 아직 주소가 없는 항목. 누를 수 없는 카드로 둔다 — 죽은 링크보다 낫다.
   *  만든 시기는 알면 적는다 — 만들어는 뒀고 아직 안 걸었다는 뜻이 된다. */
  function soonCard(entry) {
    const box = el('div', 'card card--soon');
    box.appendChild(el('span', 'card-ico', entry.icon || '📦'));
    const body = el('div', 'card-body');
    if (entry.date) body.appendChild(el('div', 'card-date', shortDate(entry.date)));
    const name = el('div', 'card-name');
    name.append(entry.name);
    name.appendChild(el('span', 'badge soon', '준비 중'));
    body.appendChild(name);
    box.appendChild(body);
    return box;
  }

  /** 마스코트 — 구역과 별개의 문. districts[].mascot = { name, at, w, frames, item }.
   *  카페 앞에 선 까마귀 Croww가 PlayGrown 기록으로 데려간다. 세모집의 우편함과 같은
   *  규칙이다 — **물건마다 문이 하나씩**. 카페 건물은 팝오버로 항목을 다 보여주고,
   *  까마귀는 자기 문서 하나만 연다. 마스코트가 자기 기록으로 데려가는 것이라
   *  문이 둘이어도 층위가 갈린다.
   *
   *  문은 **셋 중 하나**로 열린다. `item`이 있으면 그 문서로 가는 링크(<a>)고,
   *  없고 `column`만 있으면 그 글을 그 자리에서 펴 보이는 버튼이며, 둘 다 없으면
   *  풍경으로만 선다 — 없는 곳을 가리키는 문은 만들지 않는다(확성기와 같은 규칙).
   *
   *  지금은 가운데다. PlayGrown 기록은 아직 준비 중이라 문서가 없고, 그 대신
   *  **읽던 칼럼을 먼저 펴 둔다.** 눌렀는데 아무 일도 없는 것보다, 지금 손에 있는
   *  것을 내어놓고 나머지는 준비 중이라고 말하는 편이 정직하다.
   *
   *  우편함과 다른 점은 그림이다. 우편함은 지도를 오려낸 복제본이지만 까마귀는
   *  지도에 없던 스프라이트라 `<img>` 세 장을 겹쳐 깐다 — 이 마을에는 프레임
   *  애니메이션이 없어서(CSS transform만 쓴다) 퍼덕임과 갸웃은 장을 번갈아 만든다.
   *  세 장은 같은 배율·같은 기준점의 한 캔버스라 갈아 끼워도 새가 튀지 않는다
   *  (tools/cut_crow.py).
   *
   *  링크(<a>)라 JS가 없어도, 새 탭으로 열어도 동작한다. 움직이는 것은 안쪽
   *  그림뿐이고 링크 상자는 가만히 있는다 — 누를 자리는 고정이어야 한다. */
  function makeMascot(wrap, d) {
    const m = d.mascot;
    const item = data.items.find((x) => x.id === m.item);
    const frames = Object.entries(m.frames || {});
    if (!frames.length) return;
    const open = item && item.url;          // 열 문서가 있으면 링크가 된다
    const col = !open && m.column;          // 없으면 칼럼이 그 자리를 대신한다

    const a = el(open ? 'a' : (col ? 'button' : 'span'),
                 'crow-spot' + (open || col ? '' : ' scenery'));
    if (open) {
      a.href = item.url;
      a.setAttribute('aria-label', `${m.name} — ${item.name}`);
    } else if (col) {
      a.type = 'button';
      a.setAttribute('aria-label', `${m.name} — ${m.column.title}`);
      a.setAttribute('aria-expanded', 'false');
      a.addEventListener('click', () => toggleColumn(a, m));
    } else {
      a.setAttribute('aria-hidden', 'true');   // 누를 수 없는 것을 읽어줄 이유가 없다
    }
    Object.assign(a.style, { left: pct(m.at[0]), bottom: upTo(m.at[1]), width: pct(m.w) });

    // 프레임은 이름이 곧 역할이다 (rest · flap · tilt). 그 이름이 그대로 클래스가 되고
    // CSS가 언제 어느 장을 보일지 정한다 — 순서에 기대면 한 장만 늘어도 어긋난다
    const fig = el('span', 'crow-figure');
    frames.forEach(([role, src]) => {
      const img = pixel(S + src);
      img.className = 'crow-' + role;
      fig.appendChild(img);
    });
    a.appendChild(fig);

    if (open) {
      a.addEventListener('click', () => track('item_click', {
        item: item.id, item_type: item.type, from: 'mascot',
      }));
    }
    wrap.appendChild(a);
  }

  /* ── 까마귀가 펴 보이는 칼럼 ────────────────
   *  마스코트가 여는 문인데 가는 곳이 없다 — 노래(확성기)와 같이 **그 자리에서
   *  펴 보이는** 문이다. 구역 패널을 그대로 쓰고 자리만 까마귀를 따라간다.
   *
   *  칼럼이 먼저 오고 「준비 중」은 맨 아래에 온다. 순서가 곧 말이다 — 지금 읽을 수
   *  있는 것을 앞에 놓고, 아직 없는 것은 뒤에서 한 줄로 말한다. 열자마자 준비 중부터
   *  보이면 눌러 봤자 헛일이었다는 뜻이 되는데, 여기에는 읽을 것이 실제로 있다. */
  function toggleColumn(btn, m) {
    if (openId === 'column') return closePanel();
    openColumn(btn, m);
  }

  function openColumn(btn, m) {
    const c = m.column;
    stopSong();        // 노래를 들으며 까마귀를 눌러도 조용히 멈춘다
    const panel = $('panel');
    panel.textContent = '';
    document.querySelectorAll(DOORS)
      .forEach((x) => x.setAttribute('aria-expanded', String(x === btn)));

    const head = el('div', 'panel-head');
    head.appendChild(el('h2', 'panel-title', `${c.icon || '📰'} ${c.title}`));
    if (c.label) head.appendChild(el('span', 'panel-label', c.label));
    const close = el('button', 'icon-btn panel-close', '✕');
    close.type = 'button';
    close.setAttribute('aria-label', '닫기');
    close.addEventListener('click', () => { closePanel(); btn.focus(); });
    head.appendChild(close);
    panel.appendChild(head);

    const body = el('div', 'column');
    (c.notes || []).forEach((line) => body.appendChild(el('p', 'column-note', line)));
    if (c.quote) {
      const q = el('blockquote', 'column-quote');
      (c.quote.lines || []).forEach((line) => q.appendChild(el('p', null, line)));
      if (c.quote.by) q.appendChild(el('cite', 'column-by', c.quote.by));
      body.appendChild(q);
    }
    panel.appendChild(body);

    if (c.soon) {
      const e = el('div', 'empty');
      e.appendChild(el('strong', null, '준비 중이에요'));
      e.append(c.soon);
      panel.appendChild(e);
    }

    track('column_open', { column: c.title });

    $('panelWrap').hidden = false;
    panel.scrollTop = 0;
    openId = 'column';
    lastSpot = btn;
    placePanel({ liveBox: () => btn.getBoundingClientRect() });
    panel.focus({ preventScroll: true });
    $('hint').classList.add('gone');
  }

  /** 우편함 — 구역과 별개의 문. districts[].mailbox = { sprite, at, w, item }.
   *  건물은 자기 항목(direct)을 열고, 우편함은 자기 항목을 연다 — 물건마다 문이 하나씩.
   *  링크(<a>)로 만들어 JS가 없어도, 새 탭으로 열어도 동작한다.
   *  건물과 같은 밑변 기준 좌표(at/w)라 "나"·확성기와 같은 방식으로 앉힌다.
   *  겉의 링크는 가만히 있고 안의 그림(.mbox)만 움직인다 ("나" 캐릭터와 같은 이유 —
   *  버튼이 흔들리면 누를 자리도 같이 흔들린다). */
  function makeMailbox(wrap, d) {
    const item = data.items.find((x) => x.id === d.mailbox.item);
    if (!item || !item.url) return;
    const { at, w, sprite } = d.mailbox;

    const a = el('a', 'mbox-spot');
    a.href = item.url;
    a.setAttribute('aria-label', `우편함 — ${item.name}`);
    Object.assign(a.style, { left: pct(at[0]), bottom: upTo(at[1]), width: pct(w) });

    const mbox = el('span', 'mbox');
    mbox.appendChild(pixel(S + sprite));
    a.appendChild(mbox);

    // 겉장을 미리 받아 두면 누르는 순간 바로 날아오른다
    const warm = () => { if (item.cover) new Image().src = item.cover; };
    a.addEventListener('pointerenter', warm, { once: true });
    a.addEventListener('focus', warm, { once: true });

    a.addEventListener('click', (e) => {
      // 새 탭(⌘·중클릭)은 브라우저에 맡긴다
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      track('mailbox_open', { item: item.id });
      sendMail(a, mbox, item);
    });
    wrap.appendChild(a);
  }

  /** 우편함에서 안내서가 날아온다. 책 뷰어가 아니라 별도 페이지라 결국 이동해야
   *  하는데, 그냥 이동하면 "눌렀더니 어디론가 갔다"가 된다. 겉장(표지)을 우편함에서
   *  화면 가득 날려 보낸 뒤 그 그림 그대로 페이지를 연다 — 도착한 페이지도
   *  표지에서 시작하므로(?from=town) 이어져 보인다. */
  function sendMail(anchor, mbox, item) {
    const go = () => { location.href = item.url + (item.cover ? '?from=town' : ''); };

    // 발송의 뾰옹 — 편지가 튀어나오는 순간
    mbox.classList.remove('send');
    void mbox.offsetWidth;
    mbox.classList.add('send');

    if (!item.cover) return void setTimeout(go, 240);

    const img = new Image();
    img.src = item.cover;
    const start = anchor.getBoundingClientRect();
    let done = false;

    const fly = () => {
      if (done) return;
      done = true;
      // 표지(16:9)가 화면에 contain으로 들어갈 크기에서 출발점으로 되민다
      const vw = innerWidth, vh = innerHeight;
      const W = Math.min(vw, vh * 16 / 9), H = W * 9 / 16;
      const dx = (start.left + start.width / 2) - vw / 2;
      const dy = (start.top + start.height / 2) - vh / 2;
      const sc = Math.max(start.width / W, 0.04);
      const box = { width: W + 'px', height: H + 'px',
                    left: (vw - W) / 2 + 'px', top: (vh - H) / 2 + 'px' };

      // 안내서가 큐카드 뭉치라 한 장이 아니라 여러 장이 챠라라라 쏟아진다.
      // 뒤 넉 장은 빈 카드다 — 이미지를 더 받지 않고도 뭉치로 읽히고,
      // 도착 화면(표지)과 겹치는 얼굴이 여럿이면 오히려 어수선하다.
      // 뒤에서부터 던져 표지가 마지막에 맨 위로 내려앉는다.
      const FAN = [
        { rot: -13, dx: -46, dy: 24, delay: 0 },
        { rot: 9, dx: 40, dy: 18, delay: 45 },
        { rot: -6, dx: -22, dy: 10, delay: 90 },
        { rot: 4, dx: 18, dy: 6, delay: 130 },
      ];
      const nodes = [];
      FAN.forEach((f) => {
        const blank = el('div', 'mail-fly mail-blank');
        Object.assign(blank.style, box);
        document.body.appendChild(blank);
        nodes.push(blank);
        blank.animate(
          [{ transform: `translate(${dx}px, ${dy}px) scale(${sc}) rotate(-9deg)`, opacity: 0 },
           { opacity: 1, offset: .18 },
           { transform: `translate(${f.dx}px, ${f.dy}px) rotate(${f.rot}deg)`, opacity: 1 }],
          { duration: 430, delay: f.delay, easing: 'cubic-bezier(.3, .7, .3, 1)', fill: 'both' });
      });

      img.className = 'mail-fly';
      img.alt = '';
      Object.assign(img.style, box);
      document.body.appendChild(img);
      nodes.push(img);
      img.animate(
        [{ transform: `translate(${dx}px, ${dy}px) scale(${sc}) rotate(-9deg)`, opacity: 0 },
         { opacity: 1, offset: .18 },
         { transform: 'none', opacity: 1 }],
        { duration: 440, delay: 175, easing: 'cubic-bezier(.3, .7, .3, 1)', fill: 'both' })
        .addEventListener('finish', go);
      setTimeout(go, 1100);              // finish가 안 와도 잠기지 않게
      void nodes;
    };

    if (img.complete && img.naturalWidth) fly();
    else {
      img.addEventListener('load', fly, { once: true });
      // 겉장이 늦으면 그냥 간다 — 이동을 그림이 막아서는 안 된다
      setTimeout(() => { if (!done) { done = true; go(); } }, 350);
    }
  }

  /** 건물과 사람들의 상시 움직임을 같은 시각에 맞춘다.
   *  각각 다른 시점에 만들어져 수십 ms 어긋나는데, 박자가 맞아야 정신 사납지 않다. */
  const IDLE_ANIMS = ['bldg-idle', 'folk-idle', 'me-idle', 'mbox-idle', 'crow-idle',
                      'crow-frame-rest', 'crow-frame-flap', 'crow-frame-tilt', 'horn-idle',
                      // 물고기는 헤엄(2.4초)만 마을 박자에 물린다 — 뜀(9초)은 저 혼자다
                      'fish-sway'];

  function syncIdle() {
    const anims = document.getAnimations().filter((a) =>
      IDLE_ANIMS.includes(a.animationName));
    if (!anims.length) return;
    // 기준은 문서 타임라인의 현재 시각. 다른 애니메이션의 startTime을 베끼면
    // 아직 시작 전이라 null일 수 있고, null을 넣으면 전부 멈춰버린다.
    const t = document.timeline.currentTime;
    if (t == null) return;
    anims.forEach((a) => { try { a.startTime = t; } catch (_) {} });
  }

  /** 호버·뾰옹처럼 잠깐 다른 애니메이션이 얹혔다 물러나면 idle이 0부터 다시 시작해
   *  그 요소만 마을과 박자가 어긋난다. 뒤늦게 합류한 것을 **마을이 이미 타고 있는
   *  박자에 끌어다 붙인다.** syncIdle()처럼 전부 0으로 되돌리면 어긋남은 없어져도
   *  온 마을이 그 순간 한 번 움찔한다 — 눌렀을 때 튀어 보이는 게 그 때문이다.
   *  스타일을 강제로 계산해야 되살아난 애니메이션이 getAnimations()에 잡힌다. */
  function resyncIdle() {
    void document.body.offsetHeight;
    const anims = document.getAnimations().filter((a) => IDLE_ANIMS.includes(a.animationName));
    if (anims.length < 2) return;

    // 가장 많은 요소가 쓰고 있는 startTime이 곧 마을의 박자다
    const tally = new Map();
    anims.forEach((a) => {
      if (a.startTime == null) return;
      tally.set(+a.startTime, (tally.get(+a.startTime) || 0) + 1);
    });
    let ref = null, best = 0;
    tally.forEach((n, t) => { if (n > best) { best = n; ref = t; } });
    if (ref == null) return;

    anims.forEach((a) => {
      if (a.startTime != null && +a.startTime === ref) return;
      try { a.startTime = ref; } catch (_) {}
    });
  }


  /* ── 카드 ────────────────────────────────── */

  function card(item, from) {
    /* **주소가 없는 항목은 링크로 만들지 않는다.** 쪽지 묶음에서는 이미 그렇게
       하고 있었는데(soonCard), 목록·모달·구역 패널에서는 `href="#"`가 물려
       **눌리기는 하는데 페이지 맨 위로만 튀는 카드**가 됐다. 「준비 중」인 것을
       items에 올리기로 하면서(2026-08-24) 여기도 같은 규칙으로 맞춘다 —
       카드의 겉모습과 안에 담기는 것은 그대로 두고 태그만 갈린다 */
    const open = item.url || item.route || item.open === 'book' || item.open === 'song';
    if (!open) return soonItemCard(item);

    const a = el('a', 'card');
    a.href = item.url || item.route || '#';
    // 마을 밖으로 나가는 것은 새 탭으로 연다 — 영상도 그렇다(릴스·유튜브 모두
    // 남의 집이라, 같은 탭으로 보내면 돌아올 마을이 없어진다)
    if (item.type === 'app' || item.type === 'external' || item.type === 'video') {
      a.target = '_blank';
      a.rel = 'noopener';
    }
    // 어디서 눌렀는지까지 남긴다 — 같은 항목이라도 지도에서 온 것과 목록에서 온 것은
    // 다른 이야기다. 책을 여는 아래 리스너보다 먼저 달아야 모달이 닫히기 전에 읽는다
    a.addEventListener('click', () => track('item_click', {
      item: item.id,
      item_type: item.type,
      // 어디서 왔는지를 부르는 쪽이 알려줄 수 있다(투어). 없으면 화면을 보고 짐작한다
      from: from || (!$('modal').hidden ? 'list' : (!$('picksPanel').hidden ? 'picks' : 'map')),
    }));

    if (item.open === 'book') {
      const b = bookOf(item);
      a.href = '#' + (b ? b.hash : '');
      a.addEventListener('click', (e) => {
        e.preventDefault();
        if (!$('modal').hidden) closeModal();
        if (!$('picksPanel').hidden) $('picksPanel').hidden = true;
        openBook(b, 1);
      });
    }

    /* 목록·모달의 카드에서도 집 테마송을 열 수 있다 — 지도 위 확성기와 같은 문으로
       보낸다. 이 카드는 별도 페이지가 없으므로(노래는 지도 위에서만 재생된다),
       확성기 버튼을 실제로 찾아 그 문을 그대로 두드린다 — flyBook이 「어느 건물에서
       날아왔는지」 보여주는 것과 같은 이유로, 소리도 제자리(세모집 마당)에서 나야 한다.
       href는 `item.route`(`/#house-theme`)를 그대로 둔다 — JS 없이 눌러도 죽은
       링크(`#`)가 아니라 최소한 마을로는 간다. 다만 그 해시로 자동재생을 걸지는
       않는다 — 페이지 로드에 소리를 거는 건 여기서도 무례하다. */
    if (item.open === 'song') {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        if (!$('modal').hidden) closeModal();
        if (!$('picksPanel').hidden) $('picksPanel').hidden = true;
        const d = data.districts.find((x) => x.speaker && x.speaker.song);
        const btn = document.querySelector('.horn-spot.horn-live');
        if (d && btn) toggleSong(btn, d.speaker);
      });
    }

    a.appendChild(el('span', 'card-ico', item.icon || '📦'));

    const body = el('div', 'card-body');
    // 시기는 이름 줄에 같이 두면 이름이 길 때 혼자 다음 줄로 떨어진다. 위에 얹는다.
    if (item.date) body.appendChild(el('div', 'card-date', shortDate(item.date)));
    const name = el('div', 'card-name');
    name.append(item.name);
    if (STATUS_LABEL[item.status]) {
      name.appendChild(el('span', 'badge ' + item.status, STATUS_LABEL[item.status]));
    }
    body.appendChild(name);
    body.appendChild(el('div', 'card-desc', item.description || ''));
    a.appendChild(body);

    a.appendChild(el('span', 'card-go', '›'));
    return a;
  }

  function groupCards(items, container) {
    const groups = new Map();
    items.forEach((it) => {
      const key = it.group || '';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(it);
    });
    groups.forEach((list, key) => {
      if (key) container.appendChild(el('div', 'group-title', key));
      const grid = el('div', 'cards');
      list.forEach((it) => grid.appendChild(card(it)));
      container.appendChild(grid);
    });
  }

  /* ── 구역 패널 ───────────────────────────── */

  const isNarrow = () => window.matchMedia('(max-width: 699px)').matches;

  /** 누른 건물 바로 옆에 패널을 붙인다. 오른쪽에 자리가 없으면 왼쪽,
   *  양쪽 다 좁으면 건물 중앙에 맞춰 지도 안으로 밀어 넣는다. */
  function placePanel(d) {
    const panel = $('panel');
    if (isNarrow()) {
      panel.style.cssText = '';
      return;
    }

    const map = $('map');
    const MW = map.clientWidth, MH = map.clientHeight;
    const PAD = 12, GAP = 14;

    let w = Math.round(Math.min(360, MW * 0.46));
    panel.style.maxHeight = (MH - PAD * 2) + 'px';

    // 지도 바깥 여백까지 놓을 자리로 친다. 학교처럼 넓고 가운데 있는 건물은
    // 지도 안에만 두면 건물을 덮어버리기 때문.
    const mapBox = map.getBoundingClientRect();
    const stageBox = $('stage').getBoundingClientRect();
    const minLeft = stageBox.left - mapBox.left + PAD;
    const maxLeft = stageBox.right - mapBox.left - w - PAD;

    // 구역 영역(px). 캐릭터는 발끝 기준이라 위로 키를 잡아준다.
    // 쪽지처럼 날아다니는 것은 지금 있는 자리를 재서 쓴다 (liveBox).
    const box = d.liveBox ? (() => {
      const r = d.liveBox(), mb = map.getBoundingClientRect();
      return { x: r.left - mb.left, y: r.top - mb.top, w: r.width, h: r.height };
    })() : d.character
      ? { x: d.character[0] / 100 * MW - MW * 0.027, y: d.character[1] / 100 * MH - MH * 0.11,
          w: MW * 0.054, h: MH * 0.11 }
      : { x: d.rect[0] / 100 * MW, y: d.rect[1] / 100 * MH,
          w: d.rect[2] / 100 * MW, h: d.rect[3] / 100 * MH };

    const right = box.x + box.w + GAP;      // 건물 오른쪽
    const leftOf = box.x - w - GAP;         // 건물 왼쪽

    /* **앵커가 지도 오른쪽 절반이면 패널도 오른쪽에 둔다.** 예전에는 오른쪽이 조금이라도
       모자라면 곧장 왼쪽으로 넘겼는데, 모자란 양과 건너뛰는 거리가 전혀 비례하지 않는다 —
       세모집 마당의 확성기에서 **17px이 모자라 376px을 건너뛰어** 지도 한가운데(카페까지)를
       통째로 덮었다. 은행·성균관·세모집도 같은 이유로 패널이 지도 복판에 떨어지고 있었다.
       끝(maxLeft)에 붙이면 패널의 대부분이 지도 바깥 여백으로 나가므로 훨씬 덜 가린다 —
       누른 건물의 가장자리를 조금 물더라도 남의 구역을 통째로 덮는 것보다 낫다. */
    const onRight = box.x + box.w / 2 > MW / 2;
    let left;
    if (right <= maxLeft) left = right;
    else if (leftOf >= minLeft && !onRight) left = leftOf;
    else if (onRight) left = Math.max(maxLeft, minLeft);
    else left = Math.min(Math.max(box.x + box.w / 2 - w / 2, minLeft), maxLeft);

    /* **문 위에 내려앉지 않는다.** 확성기·쪽지·까마귀는 앵커가 곧 방금 누른 문이라,
       패널이 그 위를 덮으면 눌렀던 자리가 손 밑에서 사라진다 — 다시 눌러 닫을 수도
       없고, 무엇보다 소리를 내고 있는 확성기가 반쯤 잘려 보인다. 확성기를 마당
       오른쪽으로 옮기자 그렇게 됐다 (옛 자리는 패널 왼쪽 끝을 3px 차이로 겨우
       비껴 있었을 뿐이라, 이건 원래부터 아슬아슬했던 것이 넘어간 것이다).

       무대(stage) 여백을 넘어 **창 끝까지** 밀고, 그래도 모자라면 **패널을 조금
       좁혀서** 비켜 준다. 좁히는 데도 바닥을 둔다(280px) — 읽을 수 없을 만큼
       좁아지면 비켜 준 보람이 없다. 셋 다 안 되는 아주 좁은 창에서는 할 수 있는
       데까지만 민다. 그때도 ✕·Esc·바깥 누르기는 그대로 산다. */
    if (d.liveBox) {
      const clear = box.x + box.w + 8;
      const edge = innerWidth - mapBox.left - 8;        // 창 오른쪽 끝 (지도 기준)
      if (left < clear) {
        if (clear + w <= edge) left = clear;
        else if (edge - clear >= Math.max(280, w * 0.8)) { w = Math.round(edge - clear); left = clear; }
        else left = Math.max(left, Math.min(clear, edge - w));
      }
    }
    panel.style.width = w + 'px';

    const h = panel.offsetHeight;
    let top = box.y + box.h / 2 - h / 2;    // 건물과 세로 중심을 맞춘다
    top = Math.min(Math.max(top, PAD), Math.max(PAD, MH - h - PAD));

    panel.style.left = Math.round(left) + 'px';
    panel.style.top = Math.round(top) + 'px';
  }

  function toggle(id, btn) {
    const d = data.districts.find((x) => x.id === id);
    // 항목이 하나뿐인 구역은 팝오버를 거치지 않고 바로 그것을 연다
    if (d && d.direct) {
      const it = data.items.find((x) => x.id === d.direct);
      if (it && it.open === 'book') return openBook(bookOf(it), 1);
    }
    if (openId === id) return closePanel();
    openPanel(id, btn);
  }

  /** 지도만 보이는 상태에서만 안내를 띄운다. 예전에는 한 번 열면 영영 사라져서,
   *  닫고 나면 무엇을 눌러야 하는지 알려주는 것이 없었다. */
  function syncHint() {
    const busy = openId || bookOpen() || !$('modal').hidden || !$('sayModal').hidden;
    $('hint').classList.toggle('gone', !!busy);
  }

  function closePanel() {
    openId = null;
    $('panelWrap').hidden = true;
    document.querySelectorAll('[aria-expanded="true"]')
      .forEach((b) => b.setAttribute('aria-expanded', 'false'));
    stopSong();        // 노래가 나오던 참이면 패널과 함께 멈춘다
    resyncIdle();      // 뾰옹에서 idle로 돌아오며 그 건물만 박자가 어긋난다
    syncHint();
  }

  function openPanel(id, btn) {
    const d = data.districts.find((x) => x.id === id);
    const items = byDistrict[id] || [];
    track('district_open', { district: id, items: items.length });
    stopSong();        // 노래를 들으며 다른 구역을 눌러도 조용히 멈춘다
    const panel = $('panel');
    panel.textContent = '';

    document.querySelectorAll(DOORS)
      .forEach((b) => b.setAttribute('aria-expanded', String(b === btn)));

    const head = el('div', 'panel-head');
    const title = el('h2', 'panel-title', `${d.icon} ${d.name}`);
    head.appendChild(title);
    head.appendChild(el('span', 'panel-label', d.label));
    const close = el('button', 'icon-btn panel-close', '✕');
    close.type = 'button';
    close.setAttribute('aria-label', '닫기');
    close.addEventListener('click', () => { closePanel(); btn.focus(); });
    head.appendChild(close);
    panel.appendChild(head);

    if (id === 'me' && data.profile) {
      const pr = data.profile;
      const head = el('div', 'profile');
      const pic = el('div', 'profile-img');
      const img = new Image();
      img.src = S + 'me.png';
      img.alt = '';
      pic.appendChild(img);
      head.appendChild(pic);
      head.appendChild(el('div', 'profile-name', pr.name));
      panel.appendChild(head);

      const block = (title, rows) => {
        if (!rows || !rows.length) return;
        panel.appendChild(el('div', 'group-title', title));
        const list = el('ul', 'cv');
        rows.forEach((r) => {
          const li = el('li');
          li.appendChild(el('div', 'cv-role', r.role || r.org));
          const meta = [r.role ? r.org : r.detail, r.period].filter(Boolean).join(' · ');
          li.appendChild(el('div', 'cv-meta', meta));
          list.appendChild(li);
        });
        panel.appendChild(list);
      };
      block('경력', pr.career);
      block('학력', pr.education);
    }

    if (items.length) {
      groupCards(items, panel);
    } else if (id !== 'me') {
      const e = el('div', 'empty');
      e.appendChild(el('strong', null, '준비 중이에요'));
      e.append('여기 들어올 작업물을 정리하고 있습니다.');
      panel.appendChild(e);
    }

    $('panelWrap').hidden = false;
    panel.scrollTop = 0;
    openId = id;
    lastSpot = btn;
    placePanel(d);
    panel.focus({ preventScroll: true });
    $('hint').classList.add('gone');
  }

  /** 항목 하나를 **마을이 원래 여는 방식 그대로** 연다 (안내의 투어가 쓴다).
   *
   *  여는 규칙 — 새 탭이냐 · 책이냐 · 노래냐 · 그냥 이동이냐 — 을 부르는 쪽에서
   *  다시 적지 않는다. 목록·구역 패널이 쓰는 **그 카드를 실제로 만들어 누른다.**
   *  규칙이 `card()` 한 군데에만 있어야 나중에 갈릴 때 같이 갈린다.
   *
   *  화면 밖에 잠깐 붙였다 뗀다 — 떼어 둔 `<a>`는 `click()`해도 브라우저가
   *  따라가지 않는다(문서 안에 있어야 한다).
   *
   *  돌려주는 것은 둘이다. `stays`는 **이 페이지에 남느냐**(새 탭이면 남는다),
   *  `leaves`는 **이 페이지를 정말 떠나느냐**다. 둘은 같은 말이 아니다 — 책은
   *  남지도(지도를 통째로 덮는다) 떠나지도 않는다. 투어는 이 둘을 갈라 쓴다:
   *  떠나는 것이면 돌아올 자리를 적어 두고, 덮는 것이면 그냥 접는다.
   *  못 여는 것(「준비 중」처럼 주소가 없는 항목)은 `null`이다. */
  function openItem(id, from) {
    const item = data.items.find((x) => x.id === id);
    if (!item) return null;
    const a = card(item, from);
    if (a.tagName !== 'A') return null;
    const stays = !!a.target;              // target="_blank" — 새 탭이라 이 페이지는 남는다
    const leaves = !stays && item.open !== 'book' && item.open !== 'song';
    Object.assign(a.style, { position: 'fixed', left: '-9999px', top: '0' });
    document.body.appendChild(a);
    a.click();
    a.remove();
    return { stays, leaves, item };
  }

  /* ── 넘겨보는 책 팝업 (아트북·세모집 카탈로그) ── */

  /* 한 벌의 뷰어를 여러 권이 나눠 쓴다. 책마다 다른 것은 폴더·쪽수·해시뿐이고,
     이름은 항목 이름을 그대로 쓴다. 항목에 `open: "book"`과 `book` 덩어리를 두면 등록된다. */
  const books = [];              // 등록된 책들
  let book = null;               // 지금 펼친 책
  let bkPage = 1, bkBusy = false, bkThumbs = [], bkStripFor = null, bkWired = false;
  let beforeBookFocus = null;

  const bkSrc   = (i) => `${book.dir}p${String(i).padStart(2, '0')}.jpg`;
  const bkThumbSrc = (b, i) => `${b.dir}t${String(i).padStart(2, '0')}.jpg`;

  function wireBook() {
    if (bkWired) return;
    bkWired = true;
    $('bkClose').addEventListener('click', closeBook);
    $('bkPrev').addEventListener('click', () => bkGo(bkPage - 1, -1));
    $('bkNext').addEventListener('click', () => bkGo(bkPage + 1, 1));
    // 책 바깥(어두운 여백)을 누르면 닫힌다
    $('bookOverlay').addEventListener('click', (e) => {
      if (e.target === $('bookOverlay')) closeBook();
    });
    // 모바일 스와이프
    let x0 = null, y0 = null;
    const bk = $('bk');
    bk.addEventListener('touchstart', (e) => {
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
    }, { passive: true });
    bk.addEventListener('touchend', (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0;
      const dy = e.changedTouches[0].clientY - y0;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) {
        bkGo(bkPage + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
      }
      x0 = y0 = null;
    }, { passive: true });
  }

  /** 썸네일 줄은 책이 바뀔 때만 다시 짓는다 */
  function buildStrip() {
    if (bkStripFor === book) return;
    bkStripFor = book;
    const strip = $('bkStrip');
    strip.textContent = '';
    bkThumbs = [];
    for (let i = 1; i <= book.pages; i++) {
      const b = el('button', 'thumb');
      b.type = 'button';
      b.setAttribute('aria-label', `${i}쪽`);
      const im = new Image();
      im.src = bkThumbSrc(book, i);
      im.alt = '';
      im.loading = 'lazy';
      b.appendChild(im);
      b.addEventListener('click', () => bkGo(i));
      strip.appendChild(b);
      bkThumbs.push(b);
    }
    $('bkTotal').textContent = book.pages;
    $('bkTitle').textContent = book.label;
    $('bookOverlay').setAttribute('aria-label', book.label);
    // 책과 썸네일이 같은 비율을 쓰도록 둘의 공통 조상에 얹는다
    $('bookOverlay').style.setProperty('--ratio', book.ratio || '16 / 9');
    $('bk').classList.toggle('flat', !!book.flat);
    // 세로로 긴 책은 지도 크기 안에서 높이가 모자라므로 화면 전체를 쓴다
    const [rw, rh] = (book.ratio || '16 / 9').split('/').map(Number);
    $('bookOverlay').classList.toggle('full', rh > rw);
  }

  const bkPreload = (i) => { if (i >= 1 && i <= book.pages) new Image().src = bkSrc(i); };

  function bkPaint() {
    $('bkImg').src = bkSrc(bkPage);
    $('bkImg').alt = `${book.label} ${bkPage}쪽`;
    $('bkCur').textContent = bkPage;
    bkThumbs.forEach((t, i) => t.setAttribute('aria-current', String(i + 1 === bkPage)));
    $('bkPrev').disabled = bkPage === 1;
    $('bkNext').disabled = bkPage === book.pages;
    bkPreload(bkPage + 1); bkPreload(bkPage - 1);
    // 남은 쪽·읽은 쪽만큼 종이 두께를 바꿔 넘어가는 게 눈에 보이게
    const bk = $('bk');
    bk.style.setProperty('--read', ((bkPage - 1) * 0.8 + 1).toFixed(1) + 'px');
    bk.style.setProperty('--left', ((book.pages - bkPage) * 0.8 + 1).toFixed(1) + 'px');
    history.replaceState(null, '', '#' + book.hash + (bkPage === 1 ? '' : '-' + bkPage));
  }

  /** 넘어가는 장을 한 겹 얹어 돌린 뒤, 아래에 새 쪽을 깔아둔다 */
  function bkGo(to, dir) {
    to = Math.min(Math.max(to, 1), book.pages);
    if (bkBusy || to === bkPage) return;
    dir = dir || (to > bkPage ? 1 : -1);
    bkBusy = true;

    const leaf = el('div', 'leaf flipping ' + (dir > 0 ? 'turn-next' : 'turn-prev'));
    const im = new Image();
    im.src = bkSrc(bkPage);        // 넘어가는 건 지금 보고 있던 쪽
    im.alt = '';
    leaf.appendChild(im);
    $('bk').appendChild(leaf);

    bkPage = to;
    // 끝장까지 넘긴 사람 — 열어만 본 것과 다 본 것을 가르는 유일한 신호다
    if (bkPage === book.pages) track('book_end', { book: book.hash });
    bkPaint();

    const done = () => { leaf.remove(); bkBusy = false; };
    leaf.addEventListener('animationend', done, { once: true });
    setTimeout(done, 1100);        // 애니메이션이 끊겨도 잠기지 않게
  }

  let bkAnim = null;

  /** 누른 건물에서 책이 날아오게 한다. 어디서 왔는지가 보여야 장식이 아니라
   *  설명이 된다 — 세모집을 눌렀으니 그 집에서 카탈로그를 꺼내온 것처럼 보인다.
   *  dir > 0이면 날아오고, dir < 0이면 그 자리로 되돌아간다. */
  function flyBook(dir) {
    const src = document.querySelector(`[data-district="${book.district}"]`);
    const bk = $('bk');
    // 재기 전에 이전 애니메이션을 먼저 걷어낸다. 닫을 때 쓴 변형이 fill로 남아 있으면
    // getBoundingClientRect()가 그 변형이 적용된 좌표를 줘서 출발점이 엉뚱해진다.
    if (bkAnim) { bkAnim.cancel(); bkAnim = null; }
    const to = bk.getBoundingClientRect();
    if (!src || !to.width) return null;

    const from = src.getBoundingClientRect();
    const dx = (from.left + from.width / 2) - (to.left + to.width / 2);
    const dy = (from.top + from.height / 2) - (to.top + to.height / 2);
    // 건물보다 더 작아지면 종잇조각처럼 보인다 — 줄이는 폭에 바닥을 둔다
    const s = Math.min(Math.max(from.width / to.width, 0.14), 0.5);

    const away = `translate(${dx}px, ${dy}px) scale(${s}) rotate(-9deg)`;

    if (dir > 0) {
      // 날아오는 동안 **보여야** 날아오는 것이다. 처음에 opacity 0으로 두면
      // 여정의 앞부분이 통째로 안 보여서 그냥 커지는 것처럼만 읽힌다.
      // 그래서 첫 12%에만 짧게 밝아지고 나머지 구간은 불투명한 채로 이동한다.
      bkAnim = bk.animate(
        [{ transform: away }, { transform: 'none' }],
        { duration: 480, easing: 'cubic-bezier(.33, .62, .3, 1)', fill: 'both' });
      bk.animate([{ opacity: 0 }, { opacity: 1 }],
        { duration: 90, easing: 'linear', fill: 'backwards' });
    } else {
      // 닫을 때는 짧게. 여닫기를 반복하는 물건이라 대칭으로 두면 답답하다
      bkAnim = bk.animate(
        [{ transform: 'none', opacity: 1 }, { opacity: 1, offset: .45 },
         { transform: away, opacity: 0 }],
        { duration: 240, easing: 'cubic-bezier(.55, 0, .85, .5)', fill: 'both' });
    }
    return bkAnim;
  }

  function openBook(b, page) {
    if (!b || !b.pages) return;
    wireBook();
    // 다른 책으로 갈아탈 때 넘어가던 장이 남아 있으면 걷어낸다
    if (book !== b) {
      $('bk').querySelectorAll('.leaf.flipping').forEach((n) => n.remove());
      bkBusy = false;
    }
    const wasOpen = bookOpen();
    // 쪽을 넘길 때는 해시를 replaceState로 갈아 끼우므로 여기까지 다시 오지 않는다.
    // 그래서 이 자리는 "새로 열었다"와 "다른 책으로 갈아탔다"만 센다
    if (!wasOpen || book !== b) track('book_open', { book: b.hash, pages: b.pages });
    book = b;
    buildStrip();
    if (!wasOpen) beforeBookFocus = document.activeElement;
    closePanel();
    $('hint').classList.add('gone');
    bkPage = Math.min(Math.max(page || 1, 1), book.pages);
    bkPaint();
    const ov = $('bookOverlay');
    const show = () => {
      ov.classList.remove('closing');
      ov.hidden = false;
      ov.style.pointerEvents = '';      // 닫는 중이었다면 되살린다
      ov.focus({ preventScroll: true });
      // 이미 펼쳐져 있는데 다른 책으로 갈아타는 것뿐이라면 날아올 필요가 없다
      if (!wasOpen) flyBook(1); else if (bkAnim) { bkAnim.cancel(); bkAnim = null; }
    };

    // 그림이 준비되기 전에 날리면 첫 장을 그리느라 100ms 넘게 프레임이 멈춰
    // 날아오는 구간이 통째로 먹힌다 — 그냥 커지는 것처럼만 보인다.
    // 준비될 때까지만 기다렸다 연다 (오래 걸리면 그냥 연다).
    const im = $('bkImg');
    if (wasOpen || (im.complete && im.naturalWidth)) { show(); return; }
    let opened = false;
    const once = () => { if (!opened) { opened = true; show(); } };
    const fallback = () => { if (im.complete) once(); else im.addEventListener('load', once, { once: true }); };
    if (im.decode) im.decode().then(once, fallback); else fallback();
    setTimeout(once, 400);
  }

  function closeBook() {
    const ov = $('bookOverlay');
    const a = flyBook(-1);
    ov.classList.add('closing');       // 어두운 바탕도 같이 걷힌다
    const hide = () => {
      ov.hidden = true;
      ov.style.pointerEvents = '';
      ov.classList.remove('closing');
      syncHint();
    };
    if (a) {
      ov.style.pointerEvents = 'none';   // 되돌아가는 동안 다시 눌리지 않게
      a.finished.then(hide).catch(() => {});   // 도중에 다시 열리면(cancel) 숨기지 않는다
      setTimeout(() => { if (bkAnim === a) hide(); }, 700);   // 탭이 가려져 안 끝나도 닫히게
    } else {
      hide();
    }
    history.replaceState(null, '', location.pathname);
    if (beforeBookFocus) beforeBookFocus.focus();
  }

  const bookOpen = () => !$('bookOverlay').hidden;
  const bookOf = (item) => books.find((b) => b.id === item.id);
  /* ── 전체 목록 (모달 + 정적 페이지) ──────── */

  let filter = 'all', query = '';

  /** 검색어와 타입 필터를 통과한 항목 */
  function visibleItems() {
    const q = query.trim().toLowerCase();
    return data.items.filter((i) => {
      if (filter !== 'all' && i.type !== filter) return false;
      return !q || (i.name + ' ' + (i.description || '')).toLowerCase().includes(q);
    });
  }

  /** 목록은 언제나 만든 순서다 — **최근 것부터** 달 단위로 묶는다.
   *
   *  구역별 보기는 두지 않는다. 구역은 지도가 이미 하는 일이고, 목록까지 구역으로
   *  묶으면 같은 분류를 두 번 보여주면서 정작 목록만 할 수 있는 것(시간)을 놓친다.
   *  달마다 몇 개가 놓였는지가 그대로 보이므로 어느 구간이 촘촘한지를
   *  문장으로 주장하지 않고 목록의 모양으로 보여준다. 날짜가 없는 항목은 끝에 모은다. */
  function renderModalList() {
    const body = $('modalBody');
    body.textContent = '';
    const items = visibleItems();

    if (!items.length) {
      body.appendChild(el('p', 'no-result', '찾는 것이 없어요.'));
      return;
    }

    const sorted = items.slice().sort((a, b) =>
      (b.date || '0000').localeCompare(a.date || '0000'));
    let month, grid;
    sorted.forEach((i) => {
      const key = i.date || '';
      if (key !== month) {
        month = key;
        body.appendChild(el('div', 'group-title', monthLabel(key)));
        grid = el('div', 'cards by-time');
        body.appendChild(grid);
      }
      grid.appendChild(card(i));
    });
  }

  function makeChips() {
    const counts = { all: data.items.length };
    data.items.forEach((i) => { counts[i.type] = (counts[i.type] || 0) + 1; });

    const defs = [['all', '전체'], ['app', '🖥 앱'], ['doc', '📄 문서'],
                  ['video', '🎬 영상'], ['external', '🔗 외부']];
    const wrap = $('chips');
    defs.forEach(([key, label]) => {
      if (!counts[key]) return;
      const b = el('button', 'chip', `${label} ${counts[key]}`);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(key === 'all'));
      b.addEventListener('click', () => {
        if (filter !== key) track('list_filter', { filter: key });
        filter = key;
        wrap.querySelectorAll('.chip').forEach((c) =>
          c.setAttribute('aria-pressed', String(c === b)));
        renderModalList();
      });
      wrap.appendChild(b);
    });
  }

  /* ── 추천 픽 ─────────────────────────────── */

  /** 추천 픽 — 「이것부터 보세요」.
   *
   *  **순서는 `featured`에 적힌 숫자다** (1이 맨 위). 예전에는 `featured: true`만
   *  보고 `items` 배열 순서대로 늘어놓았는데, 그 배열은 구역별로 묶여 있어서
   *  **무엇을 먼저 보여줄지와 아무 상관이 없었다** — 순서를 바꾸려면 항목을 통째로
   *  옮겨야 했고, 그러면 목록·`/list.html`의 묶음까지 같이 흐트러진다.
   *
   *  숫자가 겹치거나 빠져도 된다 — 같은 숫자끼리는 배열 순서를 지킨다(안정 정렬). */
  function initPicks() {
    const featured = data.items.filter((i) => i.featured)
      .sort((a, b) => (+a.featured || 0) - (+b.featured || 0));
    if (!featured.length) { $('picksBtn').hidden = true; return; }

    const body = $('picksBody');
    const grid = el('div', 'cards');
    featured.forEach((i) => grid.appendChild(card(i)));
    body.appendChild(grid);

    const set = (open) => {
      $('picksPanel').hidden = !open;
      $('picksBtn').setAttribute('aria-expanded', String(open));
    };
    $('picksBtn').addEventListener('click', () => {
      if ($('picksPanel').hidden) track('picks_open', {});
      set($('picksPanel').hidden);
    });
    $('closePicks').addEventListener('click', () => { set(false); $('picksBtn').focus(); });
    document.addEventListener('click', (e) => {
      if (!$('picksPanel').hidden
          && !$('picksPanel').contains(e.target)
          && !$('picksBtn').contains(e.target)) set(false);
    });
  }

  /* ── 모달 열고 닫기 ──────────────────────── */

  let lastFocus = null;

  function openModal() {
    track('list_open', {});
    lastFocus = document.activeElement;
    $('modal').hidden = false;
    syncHint();
    document.body.style.overflow = 'hidden';
    // 터치 기기에서 검색창에 자동 포커스를 주면 키보드가 튀어오르며 화면이 확대된다
    if (window.matchMedia('(pointer: fine)').matches) $('search').focus();
    else $('modal').querySelector('.modal').focus();
  }

  function closeModal() {
    $('modal').hidden = true;
    document.body.style.overflow = '';
    if (lastFocus) lastFocus.focus();
    syncHint();
  }

  /** 열린 창 안에서만 탭이 돌게 가둔다.
   *  **창이 둘이 됐다**(목록·한마디). `#modal` 하나에 고정돼 있던 것을 지금 열려
   *  있는 창으로 찾아 쓴다 — 안 그러면 한마디 창을 열어 두고 탭을 누를 때 뒤의
   *  지도로 포커스가 새어 나간다. */
  function openWindow() {
    return [$('sayModal'), $('modal')].find((n) => n && !n.hidden) || null;
  }

  function trapFocus(e) {
    if (e.key !== 'Tab') return;
    const win = openWindow();
    if (!win) return;
    const items = win.querySelectorAll(
      'a[href], button:not([disabled]), input:not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])');
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /* ── 좌표 조정 모드 (?tune) ──────────────── */

  function enableTuning() {
    document.body.classList.add('tuning');
    const out = el('div', 'tune-readout', '지도를 클릭하면 좌표가 표시됩니다');
    document.body.appendChild(out);
    $('map').addEventListener('click', (e) => {
      const r = $('map').getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width * 100).toFixed(1);
      const y = ((e.clientY - r.top) / r.height * 100).toFixed(1);
      out.textContent = `x ${x}%   y ${y}%`;
    }, true);
  }

  /* ── 제작자에게 한마디 ─────────────────────
   *  마을을 다 둘러본 자리(푸터)에서 한마디 남기고 갈 수 있게. 받는 쪽은
   *  `worker.js`의 `/api/word`다 — 이 마을에서 서버가 하는 유일한 일이다.
   *
   *  **푸터에는 이름 옆의 👋 하나뿐이고, 적는 칸은 창 안에 있다.** 처음에는 폼을
   *  푸터에 그대로 펼쳐 뒀는데 나가는 길에 마주치기엔 자리를 너무 많이 먹었다.
   *  손짓 하나면 「말을 걸 수 있다」는 뜻은 다 서고, 칸은 창에서 보면 된다.
   *
   *  **빠른 반응 버튼(그냥 인사·좋았어요 같은 것)은 두지 않는다.** 한때 그림 셋을
   *  놓아 한 번에 보낼 수 있게 했는데, 눌러 봐야 「누가 왔다 갔다」밖에 안 남는다 —
   *  남길 말이 있어서 창을 연 사람에게는 거쳐야 할 단계가 하나 더 생길 뿐이었다.
   *  창을 열면 곧장 적는 칸이다.
   *
   *  창은 목록 모달과 **같은 틀**을 쓴다. 배경 덮개·Esc·바깥 누르기·포커스
   *  가두기가 이미 거기 있어서, 새로 만들면 그걸 다시 흉내 내는 셈이 된다.
   *
   *  **보내는 동안과 보낸 뒤를 눈에 보이게 한다.** 눌렀는데 아무 일도 안 일어나면
   *  두 번 세 번 누르게 되고, 그러면 같은 말이 여러 줄 쌓인다 — 버튼을 잠그고
   *  「보내는 중」이라고 말한 뒤 결과를 그 자리에 쓴다.
   *
   *  **실패를 성공처럼 보이게 하지 않는다.** KV가 아직 안 붙어 있으면 서버가
   *  503과 함께 그렇다고 말하고, 여기서는 그 말을 그대로 띄운다. 조용히
   *  고맙다고 하면 방문자는 남겼다고 믿고 나는 못 받는다 — 그게 제일 나쁘다. */
  function initSay() {
    const form = $('sayForm'), note = $('sayNote');
    const hi = $('sayHi'), win = $('sayModal');
    if (!form || !hi || !win) return;

    hi.addEventListener('click', openSay);
    $('sayClose').addEventListener('click', closeSay);
    win.addEventListener('click', (e) => { if (e.target === win) closeSay(); });

    const say = (msg, tone) => {
      note.textContent = msg;
      note.className = 'say-note' + (tone ? ' say-' + tone : '');
    };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = $('sayText').value.trim();
      if (!text) { say('한마디를 적어 주세요.', 'bad'); $('sayText').focus(); return; }

      const btn = $('sayBtn');
      btn.disabled = true;
      say('보내는 중…');
      try {
        const res = await fetch('/api/word', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            text, name: $('sayName').value, reply: $('sayReply').value, hp: $('sayHp').value,
          }),
        });
        const out = await res.json().catch(() => ({}));
        if (res.ok && out.ok) {
          // 남긴 뒤에는 폼을 치우고 고마웠다는 말만 남긴다 — 또 쓰라고 빈 칸을
          // 다시 내밀면 방금 남긴 것이 안 갔나 싶어진다.
          // **치우되 없애지는 않는다**(`hidden`) — 창을 다시 열 때 `resetSay()`가
          // 되돌린다. `remove()`로 뽑아 버렸더니 그 뒤로는 아무것도 없는 창이 떴다
          track('say_sent', {});
          form.hidden = true;
          say('고맙습니다. 잘 받았어요.', 'good');
          return;
        }
        say(out.message || '지금은 남길 수가 없어요. 잠시 뒤에 다시 시도해 주세요.', 'bad');
      } catch (_) {
        // 네트워크가 끊겼거나 정적으로만 띄운 경우(로컬 python 서버 등)
        say('연결이 안 돼요. 잠시 뒤에 다시 시도해 주세요.', 'bad');
      }
      btn.disabled = false;
    });
  }

  /** 창을 열 때마다 폼을 되돌린다.
   *
   *  **남긴 직후와 다시 연 때는 다른 순간이다.** 남긴 직후에 빈 칸을 다시 내밀면
   *  방금 남긴 것이 안 갔나 싶어지므로 폼을 치운다. 그런데 치운 채로 두었더니
   *  **다시 열었을 때 고맙다는 말만 있는 빈 창이 떴다** — 새로고침하기 전에는 그
   *  세션에서 두 번 다시 남길 수 없었다(2026-09-01에 알았다).
   *
   *  적은 글만 비우고 **이름과 답장받을 곳은 남긴다** — 같은 사람이 다시 남기는
   *  것이 보통이라, 매번 다시 적게 하면 그만큼 안 남긴다. */
  function resetSay() {
    const form = $('sayForm');
    if (!form) return;
    form.hidden = false;
    $('sayText').value = '';
    $('sayBtn').disabled = false;      // 보내는 동안 잠갔던 것이 성공한 자리에서는 안 풀린다
    const note = $('sayNote');
    note.textContent = '';
    note.className = 'say-note';
  }

  function openSay() {
    track('say_open', {});
    resetSay();
    lastFocus = document.activeElement;
    $('sayModal').hidden = false;
    document.body.style.overflow = 'hidden';
    syncHint();
    // 터치 기기에서 칸에 바로 커서를 주면 키보드가 튀어오르며 창을 반쯤 덮는다 —
    // 창 자체를 잡는다 (목록 모달과 같은 규칙)
    if (window.matchMedia('(pointer: fine)').matches) $('sayText').focus();
    else $('sayModal').querySelector('.modal').focus();
  }

  function closeSay() {
    $('sayModal').hidden = true;
    document.body.style.overflow = '';
    if (lastFocus) lastFocus.focus();
    syncHint();
  }

  /* ── 시작 ────────────────────────────────── */

  async function init() {
    // **캐시를 반드시 다시 확인한다.** 이 파일은 화면을 그리는 데이터라 app.js와
    // 짝이 맞아야 하는데, 둘이 따로 캐시되면 예전 데이터가 새 코드를 만난다.
    // 실제로 그래서 카페 앞에 물음표 상자가 섰다 (사라진 파일 이름이 남아 있었다).
    // 바뀐 게 없으면 304로 끝나므로 값은 거의 안 든다.
    data = await (await fetch('services.json', { cache: 'no-cache' })).json();

    byDistrict = {};
    data.districts.forEach((d) => { byDistrict[d.id] = []; });
    // 쪽지가 이미 들고 있는 항목은 구역 패널에서 다시 보여주지 않는다 — 같은 카드가
    // 두 문(구역 패널·쪽지)에서 똑같이 뜨는 건 중복이다. 목록(list.html)·검색 모달은
    // 이 필터를 안 거친다 — 거기는 지도 위 문과 상관없이 「만든 것 전부」를 보여주는
    // 자리라, 클리어 위크도 그대로 나온다.
    const floaterIds = new Set(
      (data.floater && data.floater.bundle ? data.floater.bundle.items : []).map((e) => e.id));
    data.items.forEach((i) => {
      if (floaterIds.has(i.id)) return;
      (byDistrict[i.district] ||= []).push(i);
    });

    // 카드가 책 해시를 href로 쓰므로 무엇이든 그리기 전에 책부터 등록한다
    data.items.forEach((i) => {
      if (i.open !== 'book' || !i.book) return;
      books.push({ id: i.id, label: i.name, dir: i.book.dir, ratio: i.book.ratio,
                   district: i.district,   // 책이 날아올 출발점 (그 구역 건물)
                   flat: !!i.book.flat, pages: i.book.pages || 0, hash: i.book.hash });
    });

    // 첫 장을 미리 받아 디코드해 둔다. 안 해두면 처음 펼칠 때 큰 이미지를 그리느라
    // 프레임이 100ms 넘게 멈춰 날아오는 구간을 통째로 삼킨다 — 그냥 커지는 것처럼만 보인다.
    // 지도가 먼저 뜨는 게 우선이라 한가할 때 한다.
    const warmBooks = () => books.forEach((bk) => {
      const im = new Image();
      im.src = `${bk.dir}p01.jpg`;
      if (im.decode) im.decode().catch(() => {});
    });
    if ('requestIdleCallback' in window) requestIdleCallback(warmBooks, { timeout: 2500 });
    else setTimeout(warmBooks, 1200);

    paintScenery();
    makeSpots();
    syncIdle();
    makeChips();
    renderModalList();
    initPicks();

    $('footName').textContent = data.profile.tagline;
    const fc = $('footContact');
    const a = el('a', null, data.profile.email);
    a.href = 'mailto:' + data.profile.email;
    fc.appendChild(a);

    initSay();

    $('openList').addEventListener('click', openModal);
    $('closeList').addEventListener('click', closeModal);
    $('modal').addEventListener('click', (e) => {
      if (e.target === $('modal')) closeModal();
    });
    // 검색은 글자마다 보내면 `아`·`아니`·`아니그`가 따로 쌓여 아무 말도 안 남는다.
    // 손이 멎고 1.2초 뒤, 두 글자 이상일 때만 한 번 보낸다
    let typed = null;
    $('search').addEventListener('input', (e) => {
      query = e.target.value;
      renderModalList();
      clearTimeout(typed);
      const q = query.trim();
      if (q.length < 2) return;
      typed = setTimeout(() => track('list_search', {
        search_term: q.slice(0, 100), results: visibleItems().length,
      }), 1200);
    });

    document.addEventListener('keydown', (e) => {
      if (bookOpen()) {
        if (e.key === 'Escape') { closeBook(); return; }
        if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); bkGo(bkPage + 1, 1); return; }
        if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); bkGo(bkPage - 1, -1); return; }
        if (e.key === 'Home') { bkGo(1, -1); return; }
        if (e.key === 'End') { bkGo(book.pages, 1); return; }
      }
      if (e.key === 'Escape') {
        if (!$('sayModal').hidden) closeSay();
        else if (!$('modal').hidden) closeModal();
        else if (!$('picksPanel').hidden) { $('picksPanel').hidden = true; $('picksBtn').setAttribute('aria-expanded', 'false'); $('picksBtn').focus(); }
        else if (openId) { const b = lastSpot; closePanel(); b?.focus(); }
      }
      trapFocus(e);
    });

    // 창 크기가 바뀌면 열려 있는 패널을 다시 붙인다
    let t;
    window.addEventListener('resize', () => {
      clearTimeout(t);
      t = setTimeout(() => {
        if (openId) placePanel(data.districts.find((x) => x.id === openId));
      }, 80);
    });

    /* 책 해시 뒤에 쪽번호가 붙는다 — #art · #art-5 · #house-3 */
    function fromHash() {
      const m = /^#([a-z0-9-]+?)(?:-(\d+))?$/.exec(location.hash);
      if (!m) return null;
      const b = books.find((x) => x.hash === m[1]);
      return b ? { book: b, page: parseInt(m[2], 10) || 1 } : null;
    }
    // 세션 중 해시가 바뀌어도(공유 링크 클릭·뒤로가기) 반응하게
    const openFromHash = () => {
      const h = fromHash();
      if (h) openBook(h.book, h.page);
      else if (bookOpen()) closeBook();
    };
    openFromHash();
    window.addEventListener('hashchange', openFromHash);

    if (new URLSearchParams(location.search).has('tune')) enableTuning();

    /* **첫 방문 안내(onboarding.js)와 닿는 유일한 자리다.**
       안내는 마을 위에 잠깐 얹히는 겹이라 app.js 안에 두지 않았다. 대신 마을을
       다 그린 뒤 데이터를 한 번 실어 보낸다 — 안내가 하는 일은 「지도 위의 어떤
       문을 밝힐까」와 「그 문에 걸린 항목의 이름·설명이 무엇인가」뿐이고, 둘 다
       여기 있는 데이터에서 나온다(services.json을 또 받지 않게).

       onboarding.js가 늦게 붙어도 되도록 `window.dadaTown`에도 남긴다 —
       이벤트는 한 번 지나가면 끝이라 그때 없던 쪽은 영영 못 받는다.
       onboarding.js가 아예 없어도 이 두 줄은 그냥 아무도 안 듣는 말이 된다. */
    /* `say`는 배웅 말풍선이 「짧은 메시지 남기기」로 여는 그 창이다 —
       창을 거기서 다시 만들지 않는다 (같은 창이 둘이 되면 반드시 어긋난다) */
    window.dadaTown = { data, open: openItem, say: openSay };
    document.dispatchEvent(new CustomEvent('dada:ready', { detail: { data } }));
  }

  init();
})();
