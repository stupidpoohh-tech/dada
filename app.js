/* DADA TOWN */
(() => {
  'use strict';

  const S = 'assets/sprites/cut/';

  // 지도 위를 움직이는 것들. 좌표는 지도 기준 %.
  // 자동차 경로는 지도 픽셀을 스캔해 얻은 실측값이다 (도로 중심선 폴리라인).
  // 위 도로는 구간별로 높이가 다르다. 지도 픽셀에서 아스팔트 띠를 훑어 얻은 중앙선:
  // 미술관·한옥 앞 38.9~43.5(중앙 41.2), 학교·회사 사이 41.1~43.2(중앙 42.1),
  // 카페 위 41.0~45.9(중앙 43.4). 나무에 걸리는 구간은 동선을 피하지 않고
  // 나무를 앞으로 덮는다 (services.json의 canopy).
  // path의 y는 차체 세로 중심. 스프라이트가 왼쪽을 보므로 우향일 때만 뒤집는다.
  const TOP_ROAD = [[-10, 41.2], [30, 41.2], [38, 42.1], [48, 42.3], [54, 43.4], [70, 43.4], [76, 41.2], [108, 41.2]];
  const CAR_ROUTES = [
    // 위 도로: 두 대가 같은 차선을 반 바퀴 간격으로 순환 — 겹치지 않는다
    { src: 'car-yellow.png', w: 3.8, path: TOP_ROAD, mode: 'wrap', speed: 15, dir: -1, start: 0.15 },
    { src: 'car-blue.png',   w: 3.8, path: TOP_ROAD, mode: 'wrap', speed: 15, dir: -1, start: 0.65 },
    // 아래 도로 가운데 구간(회사·카페 아래)만 왕복 — 양끝은 다리와 세모집이라 막혀 있다.
    // 79.4보다 내려오면 길가에 선 캐릭터 머리를 스친다 (캐릭터 윗변 y≈81.2)
    { src: 'car-red.png',    w: 3.8, path: [[40, 79.4], [64, 79.4]], mode: 'pingpong', speed: 10, dir: 1, pause: 0.7, start: 0.4 },
  ];
  const CLOUDS = [
    { src: 'cloud-1.png', y: 4,  w: 11, dur: 150, delay: 0 },
    { src: 'cloud-3.png', y: 12, w: 8,  dur: 200, delay: 60 },
    { src: 'cloud-4.png', y: 2,  w: 12, dur: 240, delay: 130 },
  ];
  // 새: 사선으로 활강 + 위아래 물결. 우향이면 flip (스프라이트가 왼쪽을 봄)
  const BIRDS = [
    { src: 'bluebird-fly.png', from: [110, 8],  to: [-8, 33], w: 2.4, dur: 14, delay: 3 },
    { src: 'sparrow-fly.png',  from: [-8, 31],  to: [108, 5], w: 2.2, dur: 17, delay: 10 },
  ];
  // 공원에 모여 있는 사람들. 8종 중 6명만 — 다 넣으면 붐빈다.
  // w는 지도 폭 기준 %. 높이가 아니라 폭으로 잡아야 지도와 같이 축소된다.
  // 분수 왼쪽 잔디에 5명을 바짝 모아 한 무리로 보이게. 다 같은 박자로 움직인다.
  const FOLKS = [
    { src: 'person-1.png', x: 13.0, y: 57.0, w: 2.05 },  // 분수 왼쪽
    { src: 'person-2.png', x: 15.0, y: 60.0, w: 2.18 },  // 분수 아래 왼쪽
    { src: 'person-6.png', x: 17.5, y: 61.5, w: 2.73 },  // 산책로 위 (가운데)
    { src: 'person-4.png', x: 20.0, y: 59.4, w: 1.82 },  // 분수 아래 오른쪽
    { src: 'person-7.png', x: 21.5, y: 57.5, w: 2.00 },  // 분수 오른쪽
  ];
  // 잔디에 내려앉은 새 — 정적으로 얹어 마을을 채운다.
  const PERCHED = [
    { src: 'sparrow-side.png',   x: 52,   y: 30, w: 1.7 },
    { src: 'bluebird-front.png', x: 11,   y: 50, w: 1.4 },
  ];

  const TYPE_LABEL = { app: '앱', doc: '문서', video: '영상', external: '외부' };
  const STATUS_LABEL = { beta: '베타', demo: 'demo' };

  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const pct = (v) => v + '%';
  /** 방문 통계 한 줄. 마을은 URL이 바뀌지 않아 무엇을 봤는지가 자동으로는 안 남는다.
   *  ga.js가 없거나(광고 차단·로컬) 꺼져 있으면 조용히 지나간다 — 부르는 자리에
   *  조건문을 두지 않기 위한 감쌈이다. 보내는 목록은 ga.js 머리말에 모아 뒀다. */
  const track = (name, params) => { if (window.dadaTrack) window.dadaTrack(name, params); };
  /** 만든 시기. 데이터는 정렬되게 `2026-05`로 두고, 보이는 곳에서만 짧게 쓴다. */
  const shortDate = (s) => s.slice(2).replace('-', '.');
  const monthLabel = (s) => (s ? `${s.slice(0, 4)}년 ${+s.slice(5, 7)}월` : '시기 미상');

  let data, byDistrict, openId = null, lastSpot = null;
  const pops = [];

  /* ── 지도 위 장식 ───────────────────────── */

  function sprite(cls, src, styles) {
    const box = el('div', cls);
    Object.assign(box.style, styles);
    const img = new Image();
    img.src = S + src;
    img.alt = '';
    img.loading = 'lazy';
    box.appendChild(img);
    return box;
  }

  function paintScenery() {
    const sky = $('sky'), road = $('road'), folks = $('folks');

    // 도로에 가지를 드리운 나무 — 지도를 한 장 더 깔고 그 나무만 오려 차 위에 덮는다.
    // 레이어가 지도와 같은 크기라 %가 곧 지도 좌표다.
    (data.canopy || []).forEach((poly) => {
      const img = new Image();
      img.src = 'assets/map/town-web.jpg';
      img.alt = '';
      img.style.clipPath =
        'polygon(' + poly.map(([x, y]) => x + '% ' + y + '%').join(',') + ')';
      $('canopy').appendChild(img);
    });

    CLOUDS.forEach((c) => sky.appendChild(sprite('cloud', c.src, {
      top: pct(c.y), width: pct(c.w),
      animationDuration: c.dur + 's', animationDelay: '-' + c.delay + 's',
    })));

    BIRDS.forEach((b, i) => {
      const node = el('div', 'bird' + (b.to[0] > b.from[0] ? ' flip' : ''));
      Object.assign(node.style, {
        top: pct(b.from[1]), left: pct(b.from[0]), width: pct(b.w),
        animationDuration: b.dur + 's', animationDelay: '-' + b.delay + 's',
        animationName: 'fly' + i,
      });
      // 물결(.bird-wave) · 좌우반전(.bird-flip) · 날갯짓(img)이 서로 다른 요소를 써야
      // transform이 겹쳐 덮어쓰지 않는다
      const wave = el('div', 'bird-wave');
      wave.style.animationDelay = '-' + (i * 1.3) + 's';
      const flip = el('div', 'bird-flip');
      const img = new Image();
      img.src = S + b.src;
      img.alt = '';
      img.loading = 'lazy';
      flip.appendChild(img);
      wave.appendChild(flip);
      node.appendChild(wave);
      const rule = `@keyframes fly${i}{from{left:${b.from[0]}%;top:${b.from[1]}%}
        to{left:${b.to[0]}%;top:${b.to[1]}%}}`;
      document.styleSheets[0].insertRule(rule, document.styleSheets[0].cssRules.length);
      sky.appendChild(node);
    });

    startCars(road);

    FOLKS.forEach((f) => folks.appendChild(sprite('folk person', f.src, {
      left: pct(f.x), top: pct(f.y), width: pct(f.w),
    })));

    PERCHED.forEach((p) => folks.appendChild(sprite('folk', p.src, {
      left: pct(p.x), top: pct(p.y), width: pct(p.w), animation: 'none',
    })));
  }

  /** 자동차를 도로 폴리라인을 따라 움직인다. rAF는 탭이 안 보이면 멈추므로 배터리도 아낀다. */
  function startCars(road) {
    // path에서 x에 해당하는 도로 중심 y를 선형 보간
    const yAt = (path, x) => {
      if (x <= path[0][0]) return path[0][1];
      for (let i = 1; i < path.length; i++) {
        if (x <= path[i][0]) {
          const [x0, y0] = path[i - 1], [x1, y1] = path[i];
          return y0 + (y1 - y0) * ((x - x0) / (x1 - x0));
        }
      }
      return path[path.length - 1][1];
    };

    const cars = CAR_ROUTES.map((r) => {
      const node = el('div', 'car');
      node.style.width = pct(r.w);
      const img = new Image();
      img.src = S + r.src;
      img.alt = '';
      node.appendChild(img);
      road.appendChild(node);
      const face = (dir) => { img.style.transform = dir > 0 ? 'scaleX(-1)' : ''; };
      const x0 = r.path[0][0], x1 = r.path[r.path.length - 1][0];
      // 차체 높이(지도 % 기준): 폭 × 이미지비율 × 지도 가로세로비
      const hPct = r.w * (92 / 140) * (1792 / 1434);
      face(r.dir);
      return { ...r, node, face, x0, x1, hPct,
               x: x0 + (r.start ?? Math.random()) * (x1 - x0), wait: 0 };
    });

    let prev = performance.now();
    function tick(now) {
      const dt = Math.min((now - prev) / 1000, 0.1);
      prev = now;
      cars.forEach((c) => {
        if (c.wait > 0) { c.wait -= dt; return; }
        c.x += c.dir * c.speed * dt;
        if (c.mode === 'wrap') {
          if (c.dir > 0 && c.x > c.x1) c.x = c.x0;
          if (c.dir < 0 && c.x < c.x0) c.x = c.x1;
        } else {
          if (c.x > c.x1) { c.x = c.x1; c.dir = -1; c.wait = c.pause || 1; c.face(-1); }
          if (c.x < c.x0) { c.x = c.x0; c.dir = 1; c.wait = c.pause || 1; c.face(1); }
        }
        c.node.style.left = c.x.toFixed(3) + '%';
        c.node.style.top = (yAt(c.path, c.x) - c.hPct / 2).toFixed(3) + '%';
      });
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
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
      btn.setAttribute('aria-label', direct ? `${d.name} — ${direct.name}`
        : `${d.name}${count ? ` — 작업물 ${count}개` : ' — 준비 중'}`);

      if (isMe) {
        btn.style.left = pct(d.character[0]);
        btn.style.top = pct(d.character[1]);
        btn.style.width = '5.4%';
        // 흔들리는 것은 안쪽 그림뿐 — 버튼은 가만히 있어야 누를 자리가 고정된다
        const fig = el('span', 'me-figure');
        const img = new Image();
        img.src = S + 'me.png';
        img.alt = '';
        fig.appendChild(img);
        btn.appendChild(fig);
      } else {
        const [x, y, w, h] = d.rect;
        Object.assign(btn.style, { left: pct(x), top: pct(y), width: pct(w), height: pct(h) });

        if (d.building) {
          // 블록이 아니라 건물만 뾰잉 — 지도의 건물 영역을 그대로 복제한다.
          // 위치·크기는 syncPops()가 지도 픽셀로 맞춘다 (%로는 미세하게 어긋난다)
          const pop = el('span', 'pop');
          const pimg = new Image();
          pimg.src = 'assets/map/town-web.jpg';
          pimg.alt = '';
          // 사각형으로는 건물만 도려낼 수 없는 곳이 있다 — 학교는 지붕 위 양옆에 나무가
          // 걸리고, 미술관은 몸통이 상자 밖으로 나간다. mask가 있으면 실루엣만 움직인다.
          // 마스크는 지도 원본 크기라 100% 100%로 깔면 그대로 맞는다
          // (tools/cut_buildings.py로 뽑는다).
          if (d.mask) {
            const url = 'url(' + d.mask + ')';
            pimg.style.webkitMaskImage = pimg.style.maskImage = url;
            pimg.style.webkitMaskSize = pimg.style.maskSize = '100% 100%';
            pimg.style.webkitMaskRepeat = pimg.style.maskRepeat = 'no-repeat';
          }
          pop.appendChild(pimg);
          btn.appendChild(pop);
          pops.push({ pop, pimg, rect: d.rect, building: d.building });
        }

        if (d.mailbox) makeMailbox(wrap, d);
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
  }

  /** 마스코트 — 구역과 별개의 문. districts[].mascot = { name, at, w, frames, item }.
   *  카페 앞에 선 까마귀 Croww가 PlayGrown 기록으로 데려간다. 세모집의 우편함과 같은
   *  규칙이다 — **물건마다 문이 하나씩**. 카페 건물은 팝오버로 항목 둘을 다 보여주고,
   *  까마귀는 자기 문서 하나만 연다. 마스코트가 자기 기록으로 데려가는 것이라
   *  문이 둘이어도 층위가 갈린다.
   *
   *  우편함과 다른 점은 그림이다. 우편함은 지도를 오려낸 복제본이지만 까마귀는
   *  지도에 없던 스프라이트라 `<img>` 두 장을 겹쳐 깐다 — 이 마을에는 프레임
   *  애니메이션이 없어서(CSS transform만 쓴다) 날갯짓은 두 장을 번갈아 만든다.
   *
   *  링크(<a>)라 JS가 없어도, 새 탭으로 열어도 동작한다. 움직이는 것은 안쪽
   *  그림뿐이고 링크 상자는 가만히 있는다 — 누를 자리는 고정이어야 한다. */
  function makeMascot(wrap, d) {
    const m = d.mascot;
    const item = data.items.find((x) => x.id === m.item);
    if (!item || !item.url || !(m.frames || []).length) return;

    const a = el('a', 'crow-spot');
    a.href = item.url;
    a.setAttribute('aria-label', `${m.name} — ${item.name}`);
    Object.assign(a.style, { left: pct(m.at[0]), top: pct(m.at[1]), width: pct(m.w) });

    const fig = el('span', 'crow-figure');
    m.frames.forEach((src, i) => {
      const img = new Image();
      img.src = S + src;
      img.alt = '';
      img.className = i ? 'crow-fly' : 'crow-rest';
      fig.appendChild(img);
    });
    a.appendChild(fig);

    a.addEventListener('click', () => track('item_click', {
      item: item.id, item_type: item.type, from: 'mascot',
    }));
    wrap.appendChild(a);
  }

  /** 우편함 — 구역과 별개의 문. districts[].mailbox = { box, item }.
   *  건물은 자기 항목(direct)을 열고, 우편함은 자기 항목을 연다 — 물건마다 문이 하나씩.
   *  링크(<a>)로 만들어 JS가 없어도, 새 탭으로 열어도 동작한다.
   *  겉의 링크는 가만히 있고 안의 복제본만 움직인다 ("나" 캐릭터와 같은 이유 —
   *  버튼이 흔들리면 누를 자리도 같이 흔들린다). */
  function makeMailbox(wrap, d) {
    const item = data.items.find((x) => x.id === d.mailbox.item);
    if (!item || !item.url) return;
    const [x, y, w, h] = d.mailbox.box;

    const a = el('a', 'mbox-spot');
    a.href = item.url;
    a.setAttribute('aria-label', `우편함 — ${item.name}`);
    Object.assign(a.style, { left: pct(x), top: pct(y), width: pct(w), height: pct(h) });

    // 우편함 복제본 — 건물 복제본과 같은 원리라 위치·크기는 syncPops()가 함께 맞춘다
    const mbox = el('span', 'mbox');
    const mimg = new Image();
    mimg.src = 'assets/map/town-web.jpg';
    mimg.alt = '';
    mbox.appendChild(mimg);
    a.appendChild(mbox);
    pops.push({ pop: mbox, pimg: mimg, rect: d.mailbox.box, building: d.mailbox.box });

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
  const IDLE_ANIMS = ['bldg-idle', 'folk-idle', 'me-idle', 'mbox-idle',
                      'crow-idle', 'crow-frame'];

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

  /** 건물 복제본을 지도 픽셀에 정확히 맞춘다. %로 계산하면 반올림이 누적돼
   *  원본과 미세하게 어긋나 이중으로 보인다. 창 크기가 바뀌면 다시 부른다. */
  function syncPops() {
    // clientWidth/Height는 정수로 반올림돼 1px쯤 어긋난다 → 소수점을 살린 값을 쓴다
    const base = $('mapImg').getBoundingClientRect();
    const MW = base.width, MH = base.height;
    if (!MW) return;
    pops.forEach(({ pop, pimg, rect, building }) => {
      const [x, y] = rect;
      const [bx, by, bw, bh] = building;
      pop.style.left = (bx - x) / 100 * MW + 'px';
      pop.style.top = (by - y) / 100 * MH + 'px';
      pop.style.width = bw / 100 * MW + 'px';
      pop.style.height = bh / 100 * MH + 'px';
      // 지도와 똑같은 크기로 깔고, 위치는 아래에서 실측으로 맞춘다
      pimg.style.width = MW + 'px';
      pimg.style.height = MH + 'px';
    });
    // 브라우저는 배치 좌표를 1/64px 격자로 내림한다. 건물 위치를 %로 계산해
    // 밀면 그 오차가 남아 복제본과 원본의 리샘플링 위상이 어긋나고, 지도가
    // 축소돼 그려지는 만큼 경계가 두 겹으로 보인다. 그래서 배치가 끝난 뒤
    // 실제 좌표를 읽어 그 차이만큼 되돌린다 — 격자 위 값끼리의 차라 오차가 0이다.
    // 잴 때는 뾰잉 변형을 잠깐 꺼야 한다. getBoundingClientRect는 transform이
    // 적용된 크기를 주므로, 켜둔 채로 재면 애니메이션 위상만큼 어긋난 값이 나온다.
    // 애니메이션은 인라인 스타일보다 우선하므로 !important로 눌러야 먹는다.
    pops.forEach(({ pop }) => pop.style.setProperty('transform', 'none', 'important'));
    pops.forEach(({ pop, pimg }) => {
      const pr = pop.getBoundingClientRect();
      pimg.style.left = (base.left - pr.left) + 'px';
      pimg.style.top = (base.top - pr.top) + 'px';
    });
    pops.forEach(({ pop }) => pop.style.removeProperty('transform'));
  }

  /* ── 카드 ────────────────────────────────── */

  function card(item) {
    const a = el('a', 'card');
    a.href = item.url || item.route || '#';
    if (item.type === 'app' || item.type === 'external') {
      a.target = '_blank';
      a.rel = 'noopener';
    }
    // 어디서 눌렀는지까지 남긴다 — 같은 항목이라도 지도에서 온 것과 목록에서 온 것은
    // 다른 이야기다. 책을 여는 아래 리스너보다 먼저 달아야 모달이 닫히기 전에 읽는다
    a.addEventListener('click', () => track('item_click', {
      item: item.id,
      item_type: item.type,
      from: !$('modal').hidden ? 'list' : (!$('picksPanel').hidden ? 'picks' : 'map'),
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

    const w = Math.round(Math.min(360, MW * 0.46));
    panel.style.width = w + 'px';
    panel.style.maxHeight = (MH - PAD * 2) + 'px';

    // 지도 바깥 여백까지 놓을 자리로 친다. 학교처럼 넓고 가운데 있는 건물은
    // 지도 안에만 두면 건물을 덮어버리기 때문.
    const mapBox = map.getBoundingClientRect();
    const stageBox = $('stage').getBoundingClientRect();
    const minLeft = stageBox.left - mapBox.left + PAD;
    const maxLeft = stageBox.right - mapBox.left - w - PAD;

    // 구역 영역(px). 캐릭터는 발끝 기준이라 위로 키를 잡아준다.
    const box = d.character
      ? { x: d.character[0] / 100 * MW - MW * 0.027, y: d.character[1] / 100 * MH - MH * 0.11,
          w: MW * 0.054, h: MH * 0.11 }
      : { x: d.rect[0] / 100 * MW, y: d.rect[1] / 100 * MH,
          w: d.rect[2] / 100 * MW, h: d.rect[3] / 100 * MH };

    const right = box.x + box.w + GAP;      // 건물 오른쪽
    const leftOf = box.x - w - GAP;         // 건물 왼쪽
    let left;
    if (right <= maxLeft) left = right;
    else if (leftOf >= minLeft) left = leftOf;
    else left = Math.min(Math.max(box.x + box.w / 2 - w / 2, minLeft), maxLeft);

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
    const busy = openId || bookOpen() || !$('modal').hidden;
    $('hint').classList.toggle('gone', !!busy);
  }

  function closePanel() {
    openId = null;
    $('panelWrap').hidden = true;
    document.querySelectorAll('[aria-expanded="true"]')
      .forEach((b) => b.setAttribute('aria-expanded', 'false'));
    resyncIdle();      // 뾰옹에서 idle로 돌아오며 그 건물만 박자가 어긋난다
    syncHint();
  }

  function openPanel(id, btn) {
    const d = data.districts.find((x) => x.id === id);
    const items = byDistrict[id] || [];
    track('district_open', { district: id, items: items.length });
    const panel = $('panel');
    panel.textContent = '';

    document.querySelectorAll('.spot, .me-spot')
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

  function initPicks() {
    const featured = data.items.filter((i) => i.featured);
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

  function trapFocus(e) {
    if (e.key !== 'Tab' || $('modal').hidden) return;
    const items = $('modal').querySelectorAll(
      'a[href], button, input, [tabindex]:not([tabindex="-1"])');
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

  /* ── 시작 ────────────────────────────────── */

  async function init() {
    data = await (await fetch('services.json')).json();

    byDistrict = {};
    data.districts.forEach((d) => { byDistrict[d.id] = []; });
    data.items.forEach((i) => { (byDistrict[i.district] ||= []).push(i); });

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
    syncPops();
    syncIdle();
    if (!$('mapImg').complete) $('mapImg').addEventListener('load', syncPops, { once: true });
    makeChips();
    renderModalList();
    initPicks();

    $('footName').textContent = data.profile.tagline;
    const fc = $('footContact');
    const a = el('a', null, data.profile.email);
    a.href = 'mailto:' + data.profile.email;
    fc.appendChild(a);

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
        if (!$('modal').hidden) closeModal();
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
        syncPops();
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
  }

  init();
})();
