/* DADA TOWN */
(() => {
  'use strict';

  const S = 'assets/sprites/cut/';

  // 지도 위를 움직이는 것들. 좌표는 지도 기준 %.
  const CARS = [
    { src: 'car-yellow.png', y: 36.6, w: 4.6, dur: 26, delay: 0, dir: 1 },
    { src: 'car-blue.png',   y: 74.6, w: 4.8, dur: 21, delay: 4, dir: 1 },
    { src: 'car-red.png',    y: 76.4, w: 4.8, dur: 24, delay: 11, dir: -1 },
  ];
  const CLOUDS = [
    { src: 'cloud-1.png', y: 4,  w: 11, dur: 150, delay: 0 },
    { src: 'cloud-3.png', y: 12, w: 8,  dur: 200, delay: 60 },
    { src: 'cloud-4.png', y: 2,  w: 12, dur: 240, delay: 130 },
  ];
  const BIRDS = [
    { src: 'sparrow-fly.png',  from: [-8, 22], to: [110, 8],  w: 2.4, dur: 26, delay: 3 },
    { src: 'bluebird-fly.png', from: [112, 9], to: [-8, 26],  w: 2.5, dur: 34, delay: 17 },
    { src: 'sparrow-fly.png',  from: [-8, 14], to: [110, 30], w: 2.1, dur: 40, delay: 31 },
  ];
  // 공원에 모여 있는 사람들. 8종 중 6명만 — 다 넣으면 붐빈다.
  // w는 지도 폭 기준 %. 높이가 아니라 폭으로 잡아야 지도와 같이 축소된다.
  const FOLKS = [
    { src: 'person-1.png', x: 10,   y: 57,   w: 2.05 },
    { src: 'person-2.png', x: 13.5, y: 60,   w: 2.18 },
    { src: 'person-6.png', x: 20,   y: 56.5, w: 2.73 },
    { src: 'person-4.png', x: 23.5, y: 60,   w: 1.82 },
    { src: 'person-7.png', x: 7.5,  y: 62.5, w: 2.00 },
    { src: 'person-8.png', x: 17,   y: 63.5, w: 1.77 },
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
      const node = sprite('bird', b.src, {
        top: pct(b.from[1]), left: pct(b.from[0]), width: pct(b.w),
        animationDuration: b.dur + 's', animationDelay: '-' + b.delay + 's',
        animationName: 'fly' + i,
      });
      const rule = `@keyframes fly${i}{from{left:${b.from[0]}%;top:${b.from[1]}%}
        to{left:${b.to[0]}%;top:${b.to[1]}%}}`;
      document.styleSheets[0].insertRule(rule, document.styleSheets[0].cssRules.length);
      sky.appendChild(node);
    });

    CARS.forEach((c) => {
      const node = sprite('car' + (c.dir < 0 ? ' leftward' : ''), c.src, {
        top: pct(c.y), width: pct(c.w),
        animationDuration: c.dur + 's', animationDelay: '-' + c.delay + 's',
      });
      road.appendChild(node);
    });

    FOLKS.forEach((f, i) => folks.appendChild(sprite('folk', f.src, {
      left: pct(f.x), top: pct(f.y), width: pct(f.w),
      animationDelay: '-' + (i * 0.7) + 's',
    })));

    PERCHED.forEach((p) => folks.appendChild(sprite('folk', p.src, {
      left: pct(p.x), top: pct(p.y), width: pct(p.w), animation: 'none',
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
      btn.setAttribute('aria-label',
        `${d.name}${count ? ` — 작업물 ${count}개` : ' — 준비 중'}`);

      if (isMe) {
        btn.style.left = pct(d.character[0]);
        btn.style.top = pct(d.character[1]);
        btn.style.width = '3.6%';
        const img = new Image();
        img.src = S + 'me.png';
        img.alt = '';
        btn.appendChild(img);
      } else {
        const [x, y, w, h] = d.rect;
        Object.assign(btn.style, { left: pct(x), top: pct(y), width: pct(w), height: pct(h) });
      }

      const label = el('span', 'spot-label');
      label.append(d.name);
      if (count) label.appendChild(el('span', 'spot-count', String(count)));
      btn.appendChild(label);

      btn.addEventListener('click', () => toggle(d.id, btn));
      wrap.appendChild(btn);
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
      ? { x: d.character[0] / 100 * MW - MW * 0.018, y: d.character[1] / 100 * MH - MH * 0.075,
          w: MW * 0.036, h: MH * 0.075 }
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

  /* ── 움직임 토글 ─────────────────────────── */

  const KEY = 'dada-motion';

  function applyMotion(on) {
    document.documentElement.dataset.motion = on ? 'on' : 'off';
    const b = $('motionBtn');
    b.setAttribute('aria-pressed', String(on));
    b.textContent = on ? '⏸ 움직임 끄기' : '▶ 움직임 켜기';
  }

  function initMotion() {
    const saved = localStorage.getItem(KEY);
    const prefersLess = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // 저장된 선택이 우선, 없으면 OS 설정을 따른다
    applyMotion(saved ? saved === 'on' : !prefersLess);

    $('motionBtn').addEventListener('click', () => {
      const on = document.documentElement.dataset.motion !== 'on';
      localStorage.setItem(KEY, on ? 'on' : 'off');
      applyMotion(on);
    });
  }

  /* ── 모달 열고 닫기 ──────────────────────── */

  let lastFocus = null;

  function openModal() {
    lastFocus = document.activeElement;
    $('modal').hidden = false;
    document.body.style.overflow = 'hidden';
    $('search').focus();
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
    makeChips();
    renderModalList();
    initMotion();

    $('footName').textContent = `${data.profile.name} · ${data.profile.tagline}`;
    const fc = $('footContact');
    const a = el('a', null, data.profile.email);
    a.href = 'mailto:' + data.profile.email;
    fc.appendChild(a);

    $('openList').addEventListener('click', openModal);
    $('closeList').addEventListener('click', closeModal);
    $('modal').addEventListener('click', (e) => {
      if (e.target === $('modal')) closeModal();
    });
    $('search').addEventListener('input', (e) => { query = e.target.value; renderModalList(); });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (!$('modal').hidden) closeModal();
        else if (openId) { const b = lastSpot; closePanel(); b?.focus(); }
      }
      trapFocus(e);
    });

    // 창 크기가 바뀌면 열려 있는 패널을 다시 붙인다
    let t;
    window.addEventListener('resize', () => {
      if (!openId) return;
      clearTimeout(t);
      t = setTimeout(() => placePanel(data.districts.find((x) => x.id === openId)), 80);
    });

    if (new URLSearchParams(location.search).has('tune')) enableTuning();
  }

  init();
})();
