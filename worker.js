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

async function overRate(env, ip) {
  if (!ip) return false;
  const k = `rate:${ip}:${Math.floor(Date.now() / 1000 / RATE_WINDOW)}`;
  const n = Number(await env.WORDS.get(k)) || 0;
  if (n >= RATE_MAX) return true;
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

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/wave') {
      if (request.method === 'POST') return wave(request, env);
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
