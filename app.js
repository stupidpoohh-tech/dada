/* DADA TOWN */
(() => {
  'use strict';

  const S = 'assets/sprites/cut/';

  // 지도 위를 움직이는 것들. 좌표는 지도 기준 %.
  // 자동차 경로는 지도 픽셀을 스캔해 얻은 실측값이다 (도로 중심선 폴리라인).
  // 위 도로는 구간별로 높이가 다르다: 미술관·한옥 앞 y≈41.2, 학교 앞 y≈43.4.
  // path의 y는 차체 세로 중심. 스프라이트가 왼쪽을 보므로 우향일 때만 뒤집는다.
  const TOP_ROAD = [[-10, 41.2], [30, 41.2], [40, 43.4], [70, 43.4], [78, 41.2], [108, 41.2]];
  const CAR_ROUTES = [
    // 위 도로: 두 대가 같은 차선을 반 바퀴 간격으로 순환 — 겹치지 않는다
    { src: 'car-yellow.png', w: 3.8, path: TOP_ROAD, mode: 'wrap', speed: 15, dir: -1, start: 0.15 },
    { src: 'car-blue.png',   w: 3.8, path: TOP_ROAD, mode: 'wrap', speed: 15, dir: -1, start: 0.65 },
    // 아래 도로 가운데 구간(회사·카페 아래)만 왕복 — 양끝은 다리와 세모집이라 막혀 있다
    { src: 'car-red.png',    w: 3.8, path: [[40, 80.6], [64, 80.6]], mode: 'pingpong', speed: 10, dir: 1, pause: 0.7, start: 0.4 },
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
      btn.setAttribute('aria-label',
        `${d.name}${count ? ` — 작업물 ${count}개` : ' — 준비 중'}`);

      if (isMe) {
        btn.style.left = pct(d.character[0]);
        btn.style.top = pct(d.character[1]);
        btn.style.width = '5.4%';
        const img = new Image();
        img.src = S + 'me.png';
        img.alt = '';
        btn.appendChild(img);
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
          pop.appendChild(pimg);
          btn.appendChild(pop);
          pops.push({ pop, pimg, rect: d.rect, building: d.building });
        }

        // 사람들 구역은 공원 땅이 아니라 사람들이 반응한다
        if (d.id === 'park') {
          const layer = $('folks');
          const hot = (on) => layer.classList.toggle('folks-hot', on);
          btn.addEventListener('mouseenter', () => hot(true));
          btn.addEventListener('mouseleave', () => hot(false));
          btn.addEventListener('focus', () => hot(true));
          btn.addEventListener('blur', () => hot(false));
          btn.addEventListener('click', () => {
            layer.classList.remove('folks-pop');
            void layer.offsetWidth;          // 리플로우로 애니메이션 재시작
            layer.classList.add('folks-pop');
          });
        }
      }

      btn.addEventListener('click', () => toggle(d.id, btn));
      wrap.appendChild(btn);
    });
  }

  /** 건물과 사람들의 상시 움직임을 같은 시각에 맞춘다.
   *  각각 다른 시점에 만들어져 수십 ms 어긋나는데, 박자가 맞아야 정신 사납지 않다. */
  function syncIdle() {
    const anims = document.getAnimations().filter((a) =>
      a.animationName === 'bldg-idle' || a.animationName === 'folk-idle');
    if (!anims.length) return;
    const t = anims[0].startTime;
    anims.forEach((a) => { try { a.startTime = t; } catch (_) {} });
  }

  /** 건물 복제본을 지도 픽셀에 정확히 맞춘다. %로 계산하면 반올림이 누적돼
   *  원본과 미세하게 어긋나 이중으로 보인다. 창 크기가 바뀌면 다시 부른다. */
  function syncPops() {
    // clientWidth/Height는 정수로 반올림돼 1px쯤 어긋난다 → 소수점을 살린 값을 쓴다
    const r = $('map').getBoundingClientRect();
    const MW = r.width, MH = r.height;
    if (!MW) return;
    pops.forEach(({ pop, pimg, rect, building }) => {
      const [x, y] = rect;
      const [bx, by, bw, bh] = building;
      pop.style.left = (bx - x) / 100 * MW + 'px';
      pop.style.top = (by - y) / 100 * MH + 'px';
      pop.style.width = bw / 100 * MW + 'px';
      pop.style.height = bh / 100 * MH + 'px';
      // 지도와 똑같은 크기로 깔고 건물 위치만큼 밀어 잘라낸다
      pimg.style.width = MW + 'px';
      pimg.style.height = MH + 'px';
      pimg.style.left = -(bx / 100 * MW) + 'px';
      pimg.style.top = -(by / 100 * MH) + 'px';
    });
  }

  /* ── 카드 ────────────────────────────────── */

  function card(item) {
    const a = el('a', 'card');
    a.href = item.url || item.route || '#';
    if (item.type === 'app' || item.type === 'external') {
      a.target = '_blank';
      a.rel = 'noopener';
    }
    if (item.open === 'artbook') {
      a.href = '#art';
      a.addEventListener('click', (e) => {
        e.preventDefault();
        if (!$('modal').hidden) closeModal();
        if (!$('picksPanel').hidden) $('picksPanel').hidden = true;
        openArtbook(1);
      });
    }

    a.appendChild(el('span', 'card-ico', item.icon || '📦'));

    const body = el('div', 'card-body');
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
      if (it && it.open === 'artbook') return openArtbook(1);
    }
    if (openId === id) return closePanel();
    openPanel(id, btn);
  }

  function closePanel() {
    openId = null;
    $('panelWrap').hidden = true;
    document.querySelectorAll('[aria-expanded="true"]')
      .forEach((b) => b.setAttribute('aria-expanded', 'false'));
  }

  function openPanel(id, btn) {
    const d = data.districts.find((x) => x.id === id);
    const items = byDistrict[id] || [];
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
      const p = el('div', 'profile');
      const pic = el('div', 'profile-img');
      const img = new Image();
      img.src = S + 'me.png';
      img.alt = '';
      pic.appendChild(img);
      p.appendChild(pic);
      const info = el('div');
      info.appendChild(el('div', 'profile-name', data.profile.name));
      info.appendChild(el('div', 'profile-tag', data.profile.tagline));
      const mail = el('a', 'profile-mail', data.profile.email);
      mail.href = 'mailto:' + data.profile.email;
      info.appendChild(mail);
      p.appendChild(info);
      panel.appendChild(p);
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

  /* ── 아트북 팝업 ─────────────────────────── */

  const ART = 'assets/portfolio/art/';
  const artSrc   = (i) => `${ART}p${String(i).padStart(2, '0')}.jpg`;
  const artThumb = (i) => `${ART}t${String(i).padStart(2, '0')}.jpg`;
  let artPages = 0, artPage = 1, artBusy = false, artThumbs = [], artBuilt = false;
  let beforeArtFocus = null;

  function buildArtbook() {
    if (artBuilt) return;
    artBuilt = true;
    const strip = $('bkStrip');
    for (let i = 1; i <= artPages; i++) {
      const b = el('button', 'thumb');
      b.type = 'button';
      b.setAttribute('aria-label', `${i}쪽`);
      const im = new Image();
      im.src = artThumb(i);
      im.alt = '';
      im.loading = 'lazy';
      b.appendChild(im);
      b.addEventListener('click', () => artGo(i));
      strip.appendChild(b);
      artThumbs.push(b);
    }
    $('bkTotal').textContent = artPages;
    $('bkClose').addEventListener('click', closeArtbook);
    $('bkPrev').addEventListener('click', () => artGo(artPage - 1, -1));
    $('bkNext').addEventListener('click', () => artGo(artPage + 1, 1));
    // 책 바깥(어두운 여백)을 누르면 닫힌다
    $('bookOverlay').addEventListener('click', (e) => {
      if (e.target === $('bookOverlay')) closeArtbook();
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
        artGo(artPage + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
      }
      x0 = y0 = null;
    }, { passive: true });
  }

  const artPreload = (i) => { if (i >= 1 && i <= artPages) new Image().src = artSrc(i); };

  function artPaint() {
    $('bkImg').src = artSrc(artPage);
    $('bkImg').alt = `아트 포트폴리오 ${artPage}쪽`;
    $('bkCur').textContent = artPage;
    artThumbs.forEach((t, i) => t.setAttribute('aria-current', String(i + 1 === artPage)));
    $('bkPrev').disabled = artPage === 1;
    $('bkNext').disabled = artPage === artPages;
    artPreload(artPage + 1); artPreload(artPage - 1);
    // 남은 쪽·읽은 쪽만큼 종이 두께를 바꿔 넘어가는 게 눈에 보이게
    const bk = $('bk');
    bk.style.setProperty('--read', ((artPage - 1) * 0.8 + 1).toFixed(1) + 'px');
    bk.style.setProperty('--left', ((artPages - artPage) * 0.8 + 1).toFixed(1) + 'px');
    history.replaceState(null, '', artPage === 1 ? '#art' : '#art-' + artPage);
  }

  /** 넘어가는 장을 한 겹 얹어 돌린 뒤, 아래에 새 쪽을 깔아둔다 */
  function artGo(to, dir) {
    to = Math.min(Math.max(to, 1), artPages);
    if (artBusy || to === artPage) return;
    dir = dir || (to > artPage ? 1 : -1);
    artBusy = true;

    const leaf = el('div', 'leaf flipping ' + (dir > 0 ? 'turn-next' : 'turn-prev'));
    const im = new Image();
    im.src = artSrc(artPage);      // 넘어가는 건 지금 보고 있던 쪽
    im.alt = '';
    leaf.appendChild(im);
    $('bk').appendChild(leaf);

    artPage = to;
    artPaint();

    const done = () => { leaf.remove(); artBusy = false; };
    leaf.addEventListener('animationend', done, { once: true });
    setTimeout(done, 1100);        // 애니메이션이 끊겨도 잠기지 않게
  }

  function openArtbook(page) {
    if (!artPages) return;
    buildArtbook();
    beforeArtFocus = document.activeElement;
    closePanel();
    artPage = Math.min(Math.max(page || 1, 1), artPages);
    artPaint();
    $('bookOverlay').hidden = false;
    $('bookOverlay').focus({ preventScroll: true });
    $('hint').classList.add('gone');
  }

  function closeArtbook() {
    $('bookOverlay').hidden = true;
    history.replaceState(null, '', location.pathname);
    if (beforeArtFocus) beforeArtFocus.focus();
  }

  const artbookOpen = () => !$('bookOverlay').hidden;
  /* ── 전체 목록 (모달 + 정적 페이지) ──────── */

  let filter = 'all', query = '';

  function renderModalList() {
    const body = $('modalBody');
    body.textContent = '';
    const q = query.trim().toLowerCase();
    let shown = 0;

    data.districts.forEach((d) => {
      let items = byDistrict[d.id] || [];
      if (filter !== 'all') items = items.filter((i) => i.type === filter);
      if (q) {
        items = items.filter((i) =>
          (i.name + ' ' + (i.description || '')).toLowerCase().includes(q));
      }
      if (!items.length) return;
      shown += items.length;
      body.appendChild(el('div', 'group-title', `${d.icon} ${d.name}`));
      const grid = el('div', 'cards');
      items.forEach((i) => grid.appendChild(card(i)));
      body.appendChild(grid);
    });

    if (!shown) body.appendChild(el('p', 'no-result', '찾는 것이 없어요.'));
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
    $('picksBtn').addEventListener('click', () =>
      set($('picksPanel').hidden));
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
    lastFocus = document.activeElement;
    $('modal').hidden = false;
    document.body.style.overflow = 'hidden';
    // 터치 기기에서 검색창에 자동 포커스를 주면 키보드가 튀어오르며 화면이 확대된다
    if (window.matchMedia('(pointer: fine)').matches) $('search').focus();
    else $('modal').querySelector('.modal').focus();
  }

  function closeModal() {
    $('modal').hidden = true;
    document.body.style.overflow = '';
    if (lastFocus) lastFocus.focus();
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

    const art = data.items.find((i) => i.open === 'artbook');
    artPages = art ? (art.pages || 0) : 0;

    $('openList').addEventListener('click', openModal);
    $('closeList').addEventListener('click', closeModal);
    $('modal').addEventListener('click', (e) => {
      if (e.target === $('modal')) closeModal();
    });
    $('search').addEventListener('input', (e) => { query = e.target.value; renderModalList(); });

    document.addEventListener('keydown', (e) => {
      if (artbookOpen()) {
        if (e.key === 'Escape') { closeArtbook(); return; }
        if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); artGo(artPage + 1, 1); return; }
        if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); artGo(artPage - 1, -1); return; }
        if (e.key === 'Home') { artGo(1, -1); return; }
        if (e.key === 'End') { artGo(artPages, 1); return; }
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

    const artHash = () => /^#art(-\d+)?$/.test(location.hash);
    if (artHash()) openArtbook(parseInt(location.hash.slice(5), 10) || 1);
    // 세션 중 해시가 바뀌어도(공유 링크 클릭·뒤로가기) 반응하게
    window.addEventListener('hashchange', () => {
      if (artHash()) openArtbook(parseInt(location.hash.slice(5), 10) || 1);
      else if (artbookOpen()) closeArtbook();
    });

    if (new URLSearchParams(location.search).has('tune')) enableTuning();
  }

  init();
})();
