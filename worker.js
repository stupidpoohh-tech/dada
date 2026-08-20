/* DADA TOWN — 「개발자에게 한마디」를 받는 Worker.
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

/** 키를 최신순으로 만든다. KV list는 사전순이라, 남은 시간을 넣으면 최근 것이 앞에 온다. */
const deskKey = (ms) => 'w:' + String(1e15 - ms).padStart(16, '0');

async function overRate(env, ip) {
  if (!ip) return false;
  const k = `rate:${ip}:${Math.floor(Date.now() / 1000 / RATE_WINDOW)}`;
  const n = Number(await env.WORDS.get(k)) || 0;
  if (n >= RATE_MAX) return true;
  // 창이 지나면 저절로 사라진다 — 지우러 다시 올 일이 없다
  await env.WORDS.put(k, String(n + 1), { expirationTtl: RATE_WINDOW * 2 });
  return false;
}

async function leaveWord(request, env) {
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
  await env.WORDS.put(deskKey(now) + ':' + now.toString(36), JSON.stringify({
    at: new Date(now).toISOString(),
    name: String(body.name || '').trim().slice(0, MAX_NAME),
    text,
    // 답장이 필요하면 쓰라고 받는다. 없으면 없는 대로 남는다
    reply: String(body.reply || '').trim().slice(0, 120),
    from: [cf.city, cf.country].filter(Boolean).join(', '),
    ua: (request.headers.get('user-agent') || '').slice(0, 160),
  }));

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
  return json({ ok: true, count: words.length, words });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/word') {
      if (request.method === 'POST') return leaveWord(request, env);
      if (request.method === 'GET') return readWords(url, env);
      return json({ ok: false, error: 'method' }, 405);
    }

    // 마을은 그대로 정적이다. 나머지는 손대지 않고 넘긴다
    return env.ASSETS.fetch(request);
  },
};
