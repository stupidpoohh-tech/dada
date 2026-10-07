/* DADA TOWN — 「제작자에게 한마디」를 받는 Worker.
 *
 * **이 사이트는 원래 코드가 한 줄도 없는 정적 에셋이었다.** 방문자가 남긴 말을
 * 실제로 저장하려면 서버가 있어야 해서 이 파일 하나가 생겼다. 그래도 마을 자체는
 * 그대로 정적이다 — 여기서 하는 일은 `/api/word` 하나뿐이고, 나머지 주소는 전부
 * 손대지 않고 에셋으로 넘긴다(`env.ASSETS.fetch`).
 *
 * Workers 정적 에셋은 **파일이 있는 주소는 Worker를 거치지 않는다.** 그래서
 * 지도·그림·목록은 이 파일이 배포돼도 예전과 똑같은 길로 나간다. 없는 주소
 * (`/api/word`)만 여기로 온다.
 *
 * ── 저장하는 곳 ─────────────────────────────
 * KV 하나(`WORDS`)에 한 줄씩 넣는다. 키는 `w:<시각역순>:<임의값>`이라
 * **목록이 최신순으로 저절로 정렬된다** — KV의 list는 키 사전순이므로,
 * 시각을 그대로 넣으면 오래된 것부터 나와 나중에 뒤집어야 한다.
 *
 * KV가 안 붙어 있으면(바인딩 없음) 503과 함께 그렇다고 말한다. 조용히
 * 성공한 척하면 **방문자는 남겼다고 믿고 나는 못 받는다** — 그게 제일 나쁘다.
 *
 * ── 읽는 곳 ─────────────────────────────────
 * `GET /api/word?key=<ADMIN_KEY>` — Worker 시크릿과 맞아야 준다.
 *   npx wrangler secret put ADMIN_KEY
 * 시크릿을 안 넣었으면 읽기는 아예 막힌다(설정 안 된 자물쇠는 열린 자물쇠다).
 * 터미널에서 바로 보려면 시크릿 없이도 되는 길이 있다:
 *   npx wrangler kv key list --binding WORDS --remote
 * 사람이 읽는 화면은 `/inbox.html`이다 — 열쇠를 한 번 넣으면 기억한다.
 *
 * ── 알리는 곳 ───────────────────────────────
 * **받아 두기만 하면 아무도 모른다.** 누가 말을 남겨도 KV 안에서 조용히 쌓일 뿐이라,
 * 보러 갈 생각을 해야만 보인다 — 그러면 답할 수 있었던 말을 몇 주 뒤에 읽는다.
 * 그래서 글이 들어오는 **그 순간** 알림을 쏜다. 길이 둘이고, 넣어 둔 것만 나간다.
 *
 * ① 메일 (권장) — Resend로 보낸다
 *     npx wrangler secret put RESEND_KEY      re_… 로 시작하는 API 키
 *     npx wrangler secret put NOTIFY_EMAIL    받을 주소
 *     npx wrangler secret put NOTIFY_FROM     (선택) 보내는 사람. 안 넣으면 기본값
 *
 *   **남긴 사람이 답장받을 메일을 적었으면 그것을 `reply_to`로 넣는다** — 메일함에서
 *   그냥 「답장」을 누르면 그 사람에게 간다. 주소를 옮겨 적는 단계가 통째로 사라진다.
 *
 * ② 웹훅 — Discord·Slack
 *     npx wrangler secret put NOTIFY_URL
 *   몸통을 `{content, text}` 둘 다로 보내므로 **Discord(content)와 Slack(text)이
 *   고치지 않고 그대로 받는다.**
 *
 * 둘 다 안 넣어 두면 아무 일도 일어나지 않는다 — 알림은 있으면 좋은 것이지
 * 없으면 말이 안 들어오는 것이 아니다.
 *
 * **알림이 실패해도 방문자에게는 성공이다.** 남긴 말은 이미 KV에 들어갔고,
 * 내 알림함이 막힌 것은 그 사람 잘못이 아니다 — `waitUntil`로 뒤에서 보내고
 * 실패는 삼킨다.
 *
 * ── 막아 두는 것 ────────────────────────────
 * 1. 길이 — 이름 40자, 말 1000자. 넘으면 자른다(거절하지 않는다. 길게 쓴 사람의
 *    글을 통째로 버리는 것보다 낫다)
 * 2. 봇 — 사람 눈에 안 보이는 칸(`hp`)에 뭐라도 적혀 있으면 조용히 받은 척한다.
 *    거절하면 봇이 다른 방법을 찾는다
 * 3. 도배 — 같은 IP에서 1분에 3번까지. KV 카운터 하나로 센다
 */

const MAX_NAME = 40;
const MAX_TEXT = 1000;
const RATE_MAX = 3;          // 1분에 몇 번까지
const RATE_WINDOW = 60;      // 초

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

/** 키를 최신순으로 만든다. KV list는 사전순이라, 남은 시간을 넣으면 최근 것이 앞에 온다.
 *
 *  **꼬리표는 진짜 임의값이어야 한다.** 처음에는 같은 `ms`를 36진수로 바꿔 붙였는데,
 *  그건 앞머리와 같은 값에서 나온 것이라 아무것도 갈라 주지 못한다 — 1밀리초 안에
 *  둘이 들어오면 키가 똑같아서 **먼저 온 말이 덮여 사라졌다.** 검사가 잡았다. */
const deskKey = (ms) => 'w:' + String(1e15 - ms).padStart(16, '0')
  + ':' + crypto.randomUUID().slice(0, 8);

/** 1분에 몇 번까지. **빗장은 하는 일마다 따로 센다.**
 *  글과 발자국이 한 빗장을 나눠 쓰면, 마을을 두어 번 둘러본 사람이 정작
 *  한마디를 남기려 할 때 막힌다 — 둘은 성격이 다른 행동이다. */
async function overRate(env, ip, kind = 'rate', max = RATE_MAX) {
  if (!ip) return false;
  const k = `${kind}:${ip}:${Math.floor(Date.now() / 1000 / RATE_WINDOW)}`;
  const n = Number(await env.WORDS.get(k)) || 0;
  if (n >= max) return true;
  // 창이 지나면 저절로 사라진다 — 지우러 다시 올 일이 없다
  await env.WORDS.put(k, String(n + 1), { expirationTtl: RATE_WINDOW * 2 });
  return false;
}

/** 알림 한 줄. 남긴 말을 그대로 옮기되 **너무 길면 자른다** —
 *  알림은 「왔다」를 알리는 것이고, 전문은 `/inbox.html`에서 읽는다. */
function notifyLine(w) {
  const who = w.name || '이름 없이';
  const body = w.text.length > 300 ? w.text.slice(0, 300) + '…' : w.text;
  const tail = [w.reply && `↩ ${w.reply}`, w.from].filter(Boolean).join(' · ');
  return `📮 DADA TOWN — ${who}

${body}${tail ? `

${tail}` : ''}`;
}

/** 메일 제목. **본문 첫 줄이 곧 제목**이라 열지 않고도 무슨 말인지 안다 —
 *  「새 메시지가 도착했습니다」는 열어 봐야만 알 수 있어서 아무 일도 안 한다. */
function mailSubject(w) {
  const who = w.name || '이름 없이';
  const head = w.text.replace(/\s+/g, ' ').slice(0, 40);
  return `📮 ${who} — ${head}${w.text.length > 40 ? '…' : ''}`;
}

const MAILABLE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 메일로 보낸다(Resend). **답장받을 메일을 적었으면 `reply_to`에 넣는다** —
 *  메일함에서 그냥 「답장」을 누르면 그 사람에게 간다. 주소를 손으로 옮겨 적는
 *  단계가 사라지고, 그 한 단계가 답장을 하느냐 마느냐를 가른다. */
function notifyMail(env, w, line) {
  if (!env.RESEND_KEY || !env.NOTIFY_EMAIL) return null;
  const body = {
    from: env.NOTIFY_FROM || 'DADA TOWN <onboarding@resend.dev>',
    to: [env.NOTIFY_EMAIL],
    subject: mailSubject(w),
    text: `${line}\n\n— 전부 보기: https://dada-town.com/inbox.html`,
  };
  if (w.reply && MAILABLE.test(w.reply)) body.reply_to = w.reply;
  return fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** 웹훅으로 보낸다 — Discord는 content를, Slack은 text를 읽는다.
 *  서로 모르는 칸은 그냥 무시하므로 한 몸통으로 둘 다 맞는다. */
function notifyHook(env, line) {
  if (!env.NOTIFY_URL) return null;
  return fetch(env.NOTIFY_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ content: line, text: line }),
  });
}

/** 알림을 쏜다. **부르는 쪽을 기다리게 하지 않는다** — 실패해도 조용히 넘긴다.
 *  넣어 둔 길로만 나가고, 둘 다 넣어 뒀으면 둘 다 나간다.
 *  `ctx`가 없으면(검사에서 그냥 부를 때) 그 자리에서 기다린다. */
function notify(env, ctx, w) {
  const line = notifyLine(w);
  const sending = [notifyMail(env, w, line), notifyHook(env, line)].filter(Boolean);
  if (!sending.length) return;
  // 알림함이 막힌 것은 남긴 사람 잘못이 아니다 — 한쪽이 죽어도 나머지는 간다
  const all = Promise.allSettled(sending);
  if (ctx && ctx.waitUntil) ctx.waitUntil(all);
  return all;
}

async function leaveWord(request, env, ctx) {
  if (!env.WORDS) {
    return json({ ok: false, error: 'not_configured',
                  message: '아직 받을 준비가 안 됐어요. 잠시 뒤에 다시 시도해 주세요.' }, 503);
  }

  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'bad_json' }, 400); }

  // 봇은 사람 눈에 안 보이는 칸을 채운다. 거절하면 다른 방법을 찾으므로 받은 척한다
  if (typeof body.hp === 'string' && body.hp.trim()) return json({ ok: true });

  const text = String(body.text || '').trim().slice(0, MAX_TEXT);
  if (!text) return json({ ok: false, error: 'empty', message: '한마디를 적어 주세요.' }, 400);

  const ip = request.headers.get('cf-connecting-ip') || '';
  if (await overRate(env, ip)) {
    return json({ ok: false, error: 'too_many',
                  message: '조금 뒤에 다시 남겨 주세요.' }, 429);
  }

  const now = Date.now();
  const cf = request.cf || {};
  const word = {
    at: new Date(now).toISOString(),
    name: String(body.name || '').trim().slice(0, MAX_NAME),
    text,
    // 답장이 필요하면 쓰라고 받는다. 없으면 없는 대로 남는다
    reply: String(body.reply || '').trim().slice(0, 120),
    from: [cf.city, cf.country].filter(Boolean).join(', '),
    ua: (request.headers.get('user-agent') || '').slice(0, 160),
  };
  // **저장이 먼저다.** 알림보다 남긴 말이 남는 것이 중요하다
  await env.WORDS.put(deskKey(now), JSON.stringify(word));
  notify(env, ctx, word);

  return json({ ok: true });
}

async function readWords(url, env) {
  if (!env.WORDS) return json({ ok: false, error: 'not_configured' }, 503);
  // 설정 안 된 자물쇠는 열린 자물쇠다 — 시크릿이 없으면 아무에게도 안 준다
  if (!env.ADMIN_KEY) return json({ ok: false, error: 'no_admin_key' }, 503);
  if (url.searchParams.get('key') !== env.ADMIN_KEY) {
    return json({ ok: false, error: 'forbidden' }, 403);
  }

  const list = await env.WORDS.list({ prefix: 'w:', limit: 200 });
  const words = [];
  for (const k of list.keys) {
    const v = await env.WORDS.get(k.name);
    if (v) { try { words.push(JSON.parse(v)); } catch { /* 깨진 줄은 건너뛴다 */ } }
  }
  /* 손 인사도 같이 준다 — 글과 숫자를 따로 보러 다니게 하지 않는다 */
  const waves = await env.WORDS.list({ prefix: 'v:', limit: 400 });
  const days = [];
  for (const k of waves.keys) {
    days.push({ day: k.name.slice(2), n: Number(await env.WORDS.get(k.name)) || 0 });
  }
  days.sort((a, b) => b.day.localeCompare(a.day));
  const hello = days.reduce((sum, d) => sum + d.n, 0);

  return json({ ok: true, count: words.length, words, hello, days });
}

/* ── 손 인사 ───────────────────────────────────────────────
 * 표지판 앞에서 👋를 누르면 화면에 손이 하나 떠오르고, 여기로 한 번 셌다고
 * 알린다. **글이 아니라 숫자다** — 남길 말이 없는 사람도 「다녀갔다」는 말은
 * 하고 싶을 수 있고, 그 말에 폼을 세우면 아무도 안 한다.
 *
 * 날짜별로 센다(`v:2026-08-25`). 통짜 하나로 안 세는 이유는 KV에 「1 늘리기」가
 * 없어서다 — 읽고 더해서 쓰는 수밖에 없는데, 통짜 하나면 같은 순간에 둘이
 * 누를 때마다 하나가 덮여 사라진다. 날짜로 갈라 두면 부딪힐 일이 훨씬 적고,
 * 언제 사람이 왔는지도 같이 남는다. (그래도 완전히 안 부딪히지는 않는다 —
 * 이건 포트폴리오의 인사 수이지 회계 장부가 아니다.)
 */
const waveKey = (ms) => 'v:' + new Date(ms).toISOString().slice(0, 10);

async function wave(request, env) {
  if (!env.WORDS) return json({ ok: false, error: 'not_configured' }, 503);
  const ip = request.headers.get('cf-connecting-ip') || '';
  // 도배는 글과 같은 빗장으로 막는다 — 누르고 있으면 하루치가 순식간에 는다
  if (await overRate(env, ip)) {
    return json({ ok: false, error: 'rate', message: '조금 뒤에 다시 눌러 주세요.' }, 429);
  }
  const k = waveKey(Date.now());
  const n = (Number(await env.WORDS.get(k)) || 0) + 1;
  await env.WORDS.put(k, String(n));
  return json({ ok: true, count: n });
}

/* ── 발자국 ────────────────────────────────────────────────
 * **GA는 「몇 명이 왔나」를 말해 주지만 그 화면은 내 것이 아니다.** 보려면 다른
 * 사이트에 로그인해야 하고, 거기 숫자는 하루쯤 지나야 자리를 잡는다. 여기서
 * 세는 것은 그것과 겹치지만 성격이 다르다 — **내 서버에 바로 쌓이고, 내가 만든
 * 화면(`/inbox`)에서 곧바로 보인다.** 둘 중 하나를 고르는 것이 아니라, 빠르고
 * 거친 쪽을 하나 더 두는 것이다.
 *
 * ── 무엇을 세나 ─────────────────────────────
 * **깔때기 한 줄이다.** 들어와서 어디까지 가다 멈추는가.
 *
 *   visit  마을을 열었다            — 페이지를 열 때마다
 *   view   프로젝트를 하나 열어봤다  ┐
 *   say    한마디 창을 열었다        ├ **브라우저 세션에 한 번씩만**
 *   sent   한마디를 남겼다           ┘
 *   tour   투어를 시작했다          ┐ 깔때기 밖이지만 궁금한 것
 *   list   목록을 열었다            ┘
 *
 * 깔때기 네 칸은 **세션 단위**로 센다. 「본 횟수」로 세면 한 사람이 열두 개를
 * 열어본 날 열람이 방문보다 많아져서, 깔때기가 아래로 갈수록 넓어진다.
 * 방문 횟수(`visit`)만 따로 둔다 — 그건 세션이 아니라 페이지를 연 수다.
 *
 * ── 어떻게 담나 ─────────────────────────────
 * **하루에 키 하나**(`h:2026-10-07`)에 셈을 모아 둔다. 발자국마다 줄을 만들면
 * 하루에 수백 줄이 생기고, 읽을 때 그만큼 읽어야 한다.
 *
 * 「최근 방문」은 **키 이름에 다 적는다**(`hl:<역순시각>:<꼬리표>:<들어온 곳>`).
 * 값을 비워 두면 목록을 한 번 부르는 것으로 스무 줄이 그냥 나온다 — 줄마다
 * 따로 읽지 않아도 된다.
 *
 * ── 쓰는 횟수 (무료 한도가 하루 1,000번이다) ──
 * 한 사람이 한 번 다녀가면 보통 **네 번** 쓴다(빗장 2 + 하루치 1 + 방문 기록 1).
 * 끝까지 가도 열 번을 넘지 않는다. **하루 200명쯤까지는 넉넉하고**, 그보다
 * 많아지면 빗장을 메모리로 옮기거나 하루치를 모았다 쓰는 쪽으로 바꾼다.
 *
 * ── 안 담는 것 ──────────────────────────────
 * IP도, 브라우저 종류도, 누가 누구인지 가릴 수 있는 것은 **하나도 안 담는다.**
 * 들어온 곳은 **호스트 이름만** 받는다 — 전체 주소에는 남의 검색어가 붙어
 * 오는 수가 있어서, 아예 브라우저에서 잘라 보내게 했다.
 */
const HIT_STEPS = ['visit', 'view', 'say', 'sent', 'tour', 'list'];
const HIT_RATE_MAX = 10;              // 1분에 몇 번까지 (한 세션이 쓰는 것은 보통 두 번)
const HIT_KEEP = 60 * 60 * 24 * 120;  // 넉 달쯤 들고 있는다
const HIT_LOG = 20;                   // 「최근 방문」 몇 줄
const HIT_MAX_DAYS = 90;

const hitDay = (ms) => 'h:' + new Date(ms).toISOString().slice(0, 10);
const hitLogKey = (ms, host) => 'hl:' + String(1e15 - ms).padStart(16, '0')
  + ':' + crypto.randomUUID().slice(0, 8) + ':' + host;

/** 들어온 곳. **호스트 이름만 받고, 그것도 생김새를 본 뒤에 쓴다** —
 *  키 이름에 그대로 들어가는 값이라 `:`나 긴 글자가 섞이면 줄이 깨진다.
 *  빈 것은 `-`로 둔다(「바로 들어옴」). */
const refHost = (s) => {
  const v = String(s || '').toLowerCase();
  return /^[a-z0-9][a-z0-9.-]{0,62}$/.test(v) ? v : '-';
};

async function hit(request, env) {
  if (!env.WORDS) return json({ ok: false, error: 'not_configured' }, 503);
  const ip = request.headers.get('cf-connecting-ip') || '';
  if (await overRate(env, ip, 'rh', HIT_RATE_MAX)) {
    return json({ ok: false, error: 'rate' }, 429);
  }

  let body = {};
  try { body = await request.json(); } catch { /* 아래에서 걸러진다 */ }
  /* **모르는 이름은 통째로 버린다.** 받는 대로 세면 아무나 `step`을 지어내
     하루치 덩이에 쓰레기 칸을 늘릴 수 있다 */
  const steps = (Array.isArray(body.steps) ? body.steps : [])
    .filter((x) => HIT_STEPS.includes(x));
  if (!steps.length) return json({ ok: false, error: 'step' }, 400);

  const now = Date.now();
  const k = hitDay(now);
  let d = {};
  try { d = JSON.parse(await env.WORDS.get(k)) || {}; } catch { d = {}; }
  steps.forEach((x) => { d[x] = (d[x] || 0) + 1; });

  /* 「다녀간 사람」과 「들어온 곳」은 **세션이 처음 열릴 때만** 센다.
     페이지를 넘길 때마다 세면 한 사람이 여러 명이 되고, 들어온 곳도
     두 번째 쪽부터는 전부 제 사이트가 된다 */
  if (body.fresh === true && steps.includes('visit')) {
    d.people = (d.people || 0) + 1;
    const host = refHost(body.from);
    d.ref = d.ref || {};
    d.ref[host] = (d.ref[host] || 0) + 1;
    await env.WORDS.put(hitLogKey(now, host), '', { expirationTtl: HIT_KEEP });
  }
  await env.WORDS.put(k, JSON.stringify(d), { expirationTtl: HIT_KEEP });
  return json({ ok: true });
}

/* ── Cloudflare Web Analytics에서 받아 오는 것 ──────────────
 * **같은 방문을 두 군데서 센다.** 하나는 위의 발자국(내가 심은 `/api/hit`),
 * 하나는 Cloudflare가 존에 알아서 끼워 넣는 비콘이다. 겹치는 게 아니라 서로
 * 못 하는 것을 메운다.
 *
 *   발자국    깔때기를 안다(무엇을 눌렀나). 대신 광고 차단기가 막기 쉽다
 *   Cloudflare 몇 명 왔나·어디서·어느 나라·무슨 기기를 더 정확히 안다.
 *             대신 **커스텀 이벤트가 없어서** 깔때기는 한 칸도 모른다
 *
 * 그래서 `/inbox`는 **칸마다 출처를 갈라 쓴다.** 윗줄 숫자와 「어디서 들어왔나」는
 * Cloudflare, 깔때기는 발자국이다. 섞어서 한 막대에 올리지 않는다 — 세는 기준도
 * 차단기에 걸리는 비율도 달라서, 그 둘로 만든 비율은 아무 뜻이 없다.
 *
 * ── 넣어 둘 것 (셋 다 있어야 켜진다) ──────────
 *   npx wrangler secret put CF_API_TOKEN     권한 Account Analytics: Read 하나면 된다
 *   npx wrangler secret put CF_ACCOUNT_ID    대시보드 오른쪽 아래 Account ID
 *   npx wrangler secret put CF_SITE_TAG      Web Analytics → 사이트 → Site Tag
 *
 * **`CF_SITE_TAG`를 빠뜨리면 안 된다.** 이 데이터셋은 계정 단위라, 사이트를 안
 * 집으면 그 계정의 **다른 사이트 방문까지 한 숫자로 섞여 나온다.**
 *
 * ── 안 되면 조용히 물러난다 ────────────────
 * 토큰이 없거나, 느리거나, 스키마가 달라 GraphQL이 거절하면 **발자국 숫자만으로
 * 화면이 선다.** 이쪽이 안 된다고 글과 깔때기까지 막을 이유가 없다. 다만 왜 안 됐는지는
 * `cf.error`로 그대로 올려 보낸다 — 열쇠가 있어야 보이는 자리고, 그 말이 없으면
 * 「숫자가 안 뜬다」만 남아 고칠 데를 못 찾는다.
 */
const CF_GQL = 'https://api.cloudflare.com/client/v4/graphql';
const CF_TIMEOUT = 6000;

/* 묶음 넷을 한 번에 묻는다. 나눠 보내면 그만큼 느려지고, 어느 하나가 실패했을 때
   화면이 반만 차는 상태가 생긴다 */
const CF_QUERY = `query($acc:String!,$site:String!,$start:Time!,$end:Time!){
  viewer{ accounts(filter:{accountTag:$acc}){
    byDay: rumPageloadEventsAdaptiveGroups(
      filter:{siteTag:$site, datetime_geq:$start, datetime_leq:$end},
      limit:1000, orderBy:[date_ASC]){ count sum{visits} dimensions{ date } }
    byRef: rumPageloadEventsAdaptiveGroups(
      filter:{siteTag:$site, datetime_geq:$start, datetime_leq:$end},
      limit:30, orderBy:[sum_visits_DESC]){ sum{visits} dimensions{ refererHost } }
    byCountry: rumPageloadEventsAdaptiveGroups(
      filter:{siteTag:$site, datetime_geq:$start, datetime_leq:$end},
      limit:30, orderBy:[sum_visits_DESC]){ sum{visits} dimensions{ countryName } }
    byDevice: rumPageloadEventsAdaptiveGroups(
      filter:{siteTag:$site, datetime_geq:$start, datetime_leq:$end},
      limit:10, orderBy:[sum_visits_DESC]){ sum{visits} dimensions{ deviceType } }
  } }
}`;

/** 묶음 하나를 `{이름: 수}`로 편다. 차원 이름이 묶음마다 달라서 받아서 쓴다.
 *  **빈 이름은 `-`로 둔다** — 발자국 쪽의 「바로 들어옴」과 같은 자리에 서야 한다. */
const cfTally = (rows, dim) => {
  const out = {};
  (rows || []).forEach((r) => {
    const name = (r.dimensions && r.dimensions[dim]) || '-';
    out[name] = (out[name] || 0) + (r.sum ? r.sum.visits : 0);
  });
  return out;
};

async function cfRum(env, want) {
  if (!env.CF_API_TOKEN || !env.CF_ACCOUNT_ID || !env.CF_SITE_TAG) {
    return { ok: false, error: 'not_configured' };
  }
  const end = new Date();
  const start = new Date(end.getTime() - (want - 1) * 86400000);
  start.setUTCHours(0, 0, 0, 0);

  let out;
  try {
    const res = await fetch(CF_GQL, {
      method: 'POST',
      headers: {
        authorization: 'Bearer ' + env.CF_API_TOKEN,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        query: CF_QUERY,
        variables: {
          acc: env.CF_ACCOUNT_ID, site: env.CF_SITE_TAG,
          start: start.toISOString(), end: end.toISOString(),
        },
      }),
      signal: AbortSignal.timeout(CF_TIMEOUT),
    });
    out = await res.json();
    if (!res.ok && !out) return { ok: false, error: 'http_' + res.status };
  } catch (e) {
    /* 느리거나 끊겼다. **화면은 그대로 서야 한다** — 발자국만으로도 할 말은 있다 */
    return { ok: false, error: 'unreachable' };
  }

  /* GraphQL은 거절해도 200으로 답한다. 칸 이름이 하나 달라도 여기로 온다 —
     그 말을 그대로 올려 보내야 무엇을 고칠지 안다 */
  if (out.errors && out.errors.length) {
    return { ok: false, error: String(out.errors[0].message || 'graphql').slice(0, 200) };
  }
  const acc = out.data && out.data.viewer && out.data.viewer.accounts
    && out.data.viewer.accounts[0];
  if (!acc) return { ok: false, error: 'no_account' };

  return {
    ok: true,
    days: (acc.byDay || []).map((r) => ({
      day: r.dimensions.date,
      views: r.count || 0,                       // 쪽을 연 수
      visits: r.sum ? r.sum.visits : 0,          // 밖에서 들어온 수 (≈ 다녀간 사람)
    })),
    ref: cfTally(acc.byRef, 'refererHost'),
    country: cfTally(acc.byCountry, 'countryName'),
    device: cfTally(acc.byDevice, 'deviceType'),
  };
}

/** 발자국을 읽는다 (`GET /api/hits?key=<ADMIN_KEY>&days=7`).
 *
 *  **하루치 키를 직접 만들어 읽는다.** 목록으로 훑으면 지운 날·빈 날까지
 *  섞여 오고 목록 부르기도 한 번 더 든다. 날짜는 오늘부터 거꾸로 세면 되는 것이라
 *  굳이 물어볼 일이 아니다. */
async function readHits(url, env) {
  if (!env.WORDS) return json({ ok: false, error: 'not_configured' }, 503);
  if (!env.ADMIN_KEY) return json({ ok: false, error: 'no_admin_key' }, 503);
  if (url.searchParams.get('key') !== env.ADMIN_KEY) {
    return json({ ok: false, error: 'forbidden' }, 403);
  }

  const want = Math.min(Math.max(Number(url.searchParams.get('days')) || 7, 1), HIT_MAX_DAYS);
  const today = Date.now();
  const days = [];
  for (let i = 0; i < want; i++) {
    const day = new Date(today - i * 86400000).toISOString().slice(0, 10);
    let d = {};
    try { d = JSON.parse(await env.WORDS.get('h:' + day)) || {}; } catch { d = {}; }
    days.push({ day, ...d });
  }

  /* 최근 방문. 키 이름이 곧 내용이라 목록 한 번이면 끝난다 */
  const log = await env.WORDS.list({ prefix: 'hl:', limit: HIT_LOG });
  const recent = log.keys.map((k) => {
    const part = k.name.split(':');
    const ms = 1e15 - Number(part[1]);
    return { at: new Date(ms).toISOString(), from: part.slice(3).join(':') || '-' };
  });

  /* **Cloudflare 쪽은 나란히 담아 보낸다. 더해서 주지 않는다.** 한 숫자로 합쳐
     버리면 화면에서 어느 칸이 어디서 온 것인지 알 수 없고, 몇 달 뒤 내가 그
     비율을 믿어 버린다. 섞는 자리는 화면이지 여기가 아니다. */
  const cf = await cfRum(env, want);
  return json({ ok: true, days, recent, cf });
}

/* ── 설정이 들어갔나 (`GET /api/health`) ────────────────────
 * **값은 절대 내주지 않고, 들어갔는지만 말한다.** 시크릿은 코드가 아니라 대시보드
 * 설정이라 배포로 따라오지 않는데, 그게 붙었는지 확인할 길이 없어서 「넣었는데
 * 왜 안 되지」로 한참 헤맸다(2026-08-27). 열쇠 없이 열리는 것은 여기 나오는 것이
 * 전부 예/아니오뿐이라서다 — 무엇이 들어 있는지는 한 글자도 나가지 않는다.
 *
 * **이 주소가 곧 판본 표시이기도 하다.** 예전 코드에는 없던 주소라, 열리면
 * 새 코드가 떠 있다는 뜻이다. */
function health(env) {
  return json({
    ok: true,
    kv: !!env.WORDS,                                        // 남긴 말을 담을 곳
    adminKey: !!env.ADMIN_KEY,                              // /inbox.html을 여는 열쇠
    /* 셋이 다 있어야 Cloudflare 숫자가 섞인다. 하나만 빠져도 조용히 안 켜지므로
       여기서 예/아니오로 말해 준다 (값은 한 글자도 안 나간다) */
    cf: !!(env.CF_API_TOKEN && env.CF_ACCOUNT_ID && env.CF_SITE_TAG),
    notify: {
      mail: !!(env.RESEND_KEY && env.NOTIFY_EMAIL),         // 둘 다 있어야 메일이 나간다
      hook: !!env.NOTIFY_URL,
    },
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/health') {
      if (request.method === 'GET') return health(env);
      return json({ ok: false, error: 'method' }, 405);
    }

    if (url.pathname === '/api/wave') {
      if (request.method === 'POST') return wave(request, env);
      return json({ ok: false, error: 'method' }, 405);
    }

    if (url.pathname === '/api/hit') {
      if (request.method === 'POST') return hit(request, env);
      return json({ ok: false, error: 'method' }, 405);
    }

    if (url.pathname === '/api/hits') {
      if (request.method === 'GET') return readHits(url, env);
      return json({ ok: false, error: 'method' }, 405);
    }

    if (url.pathname === '/api/word') {
      if (request.method === 'POST') return leaveWord(request, env, ctx);
      if (request.method === 'GET') return readWords(url, env);
      return json({ ok: false, error: 'method' }, 405);
    }

    // 마을은 그대로 정적이다. 나머지는 손대지 않고 넘긴다
    return env.ASSETS.fetch(request);
  },
};
