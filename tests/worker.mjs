/* worker.js 검사 — 「제작자에게 한마디」를 받는 서버.
 *
 * 브라우저 검사(smoke.mjs)와 달리 여기는 **모듈을 그대로 불러 fetch()를 부른다.**
 * wrangler를 깔지 않아도 되고, KV도 Map 하나로 흉내 낼 수 있다.
 *
 *   node tests/worker.mjs
 */
import worker from '../worker.js';

let pass = 0, fail = 0;
const ok = (cond, label, detail = '') => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${detail ? '  → ' + detail : ''}`); }
};
const head = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 46 - t.length))}`);

/** KV 흉내. put/get/list만 쓴다. expirationTtl은 받아만 두고 무시한다 */
const fakeKV = () => {
  const m = new Map();
  return {
    _m: m,
    async put(k, v) { m.set(k, v); },
    async get(k) { return m.has(k) ? m.get(k) : null; },
    async list({ prefix = '', limit = 1000 } = {}) {
      const keys = [...m.keys()].filter((k) => k.startsWith(prefix)).sort().slice(0, limit);
      return { keys: keys.map((name) => ({ name })) };
    },
  };
};

const post = (body, headers = {}) => new Request('https://x/api/word', {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...headers },
  body: JSON.stringify(body),
});
const call = (req, env) => worker.fetch(req, env);

/* ── 1. 남긴 말이 실제로 쌓이는가 ─────────────────────── */
head('한마디 남기기');
{
  const env = { WORDS: fakeKV() };
  const res = await call(post({ text: '마을 예뻐요', name: '지나가던 사람' }), env);
  const out = await res.json();
  ok(res.status === 200 && out.ok === true, '남기면 200 · ok', JSON.stringify(out));

  const keys = [...env.WORDS._m.keys()].filter((k) => k.startsWith('w:'));
  ok(keys.length === 1, '한 줄이 KV에 쌓인다', String(keys.length));
  const saved = JSON.parse(env.WORDS._m.get(keys[0]));
  ok(saved.text === '마을 예뻐요' && saved.name === '지나가던 사람',
    '적은 그대로 담긴다', JSON.stringify(saved));
  ok(/^\d{4}-\d{2}-\d{2}T/.test(saved.at), '남긴 시각이 함께 담긴다', saved.at);
}

/* ── 2. 최신순으로 나오는가 ────────────────────────────
   KV의 list는 키 사전순이다. 시각을 그대로 키에 넣으면 오래된 것부터 나와
   나중에 뒤집어야 하므로, 키를 「역순 시각」으로 만들어 두었다. */
head('최신순 정렬');
{
  const env = { WORDS: fakeKV(), ADMIN_KEY: 'zzz' };
  await call(post({ text: '첫째' }), env);
  await new Promise((r) => setTimeout(r, 5));
  await call(post({ text: '둘째' }), env);
  await new Promise((r) => setTimeout(r, 5));
  await call(post({ text: '셋째' }), env);

  const res = await call(new Request('https://x/api/word?key=zzz'), env);
  const out = await res.json();
  ok(out.ok && out.count === 3, '세 줄이 다 나온다', JSON.stringify(out.count));
  ok(out.words.map((w) => w.text).join(',') === '셋째,둘째,첫째',
    '최근에 남긴 것이 맨 위다', out.words.map((w) => w.text).join(','));
}

/* ── 3. 읽기는 열쇠가 있어야 한다 ────────────────────── */
head('읽기 잠금');
{
  const env = { WORDS: fakeKV(), ADMIN_KEY: 'secret' };
  await call(post({ text: '비밀' }), env);

  ok((await call(new Request('https://x/api/word'), env)).status === 403,
    '열쇠 없이는 못 읽는다');
  ok((await call(new Request('https://x/api/word?key=틀림'), env)).status === 403,
    '틀린 열쇠로도 못 읽는다');
  ok((await call(new Request('https://x/api/word?key=secret'), env)).status === 200,
    '맞는 열쇠로는 읽힌다');

  // **설정 안 된 자물쇠는 열린 자물쇠다.** 시크릿을 안 넣었으면 아무에게도 안 준다
  const noKey = { WORDS: fakeKV() };
  const res = await call(new Request('https://x/api/word?key='), noKey);
  ok(res.status === 503, 'ADMIN_KEY가 없으면 읽기가 아예 막힌다', String(res.status));
}

/* ── 4. 빈 말·긴 말 ────────────────────────────────────
   길다고 통째로 버리지 않는다 — 길게 쓴 사람의 글을 버리는 것보다 자르는 게 낫다 */
head('빈 말 · 긴 말');
{
  const env = { WORDS: fakeKV(), ADMIN_KEY: 'k' };
  ok((await call(post({ text: '   ' }), env)).status === 400,
    '글도 그림도 없으면 거절한다');

  await call(post({ text: '가'.repeat(3000), name: '나'.repeat(200) }), env);
  const res = await call(new Request('https://x/api/word?key=k'), env);
  const w = (await res.json()).words[0];
  ok(w.text.length === 1000, '긴 말은 1000자에서 자른다', String(w.text.length));
  ok(w.name.length === 40, '긴 이름은 40자에서 자른다', String(w.name.length));
}

/* ── 4-b. 그림만 눌러도 한마디다 ────────────────────────
   버튼 셋(hi · good · idea)은 글 없이 뜻만 보낸다. 글이 없다고 빈손으로 보면
   그림 버튼이 통째로 죽는다. 대신 목록에 없는 값은 버린다 — 아무 문자열이나
   들어오면 나중에 세어 볼 때 지저분해진다. */
head('그림만 눌렀을 때');
{
  const env = { WORDS: fakeKV(), ADMIN_KEY: 'k' };
  for (const kind of ['hi', 'good', 'idea']) {
    const res = await call(post({ kind }, { 'cf-connecting-ip': kind }), env);
    if (res.status !== 200) ok(false, `${kind}만 눌러도 받는다`, String(res.status));
  }
  ok(true, '글 없이 그림만 눌러도 받는다 (hi · good · idea)');

  // 셋이 같은 밀리초에 들어가므로 **그 안에서의 순서는 정해져 있지 않다** —
  // 여기서는 무엇이 담겼는지만 본다. 진짜 최신순은 위 「최신순 정렬」이 시간 간격을
  // 두고 확인한다
  const got = (await (await call(new Request('https://x/api/word?key=k'), env)).json())
    .words.map((w) => w.kind).sort();
  ok(got.join(',') === 'good,hi,idea', '무엇을 눌렀는지 함께 담긴다', got.join(','));

  // 목록에 없는 값은 뜻으로 치지 않는다 — 글도 없으면 빈손이다
  const bogus = await call(post({ kind: '<script>' }, { 'cf-connecting-ip': 'z' }), env);
  ok(bogus.status === 400, '모르는 값만 보내면 빈손으로 친다', String(bogus.status));

  // 그래도 글이 있으면 받는다. 모르는 값만 버린다
  const withText = { WORDS: fakeKV(), ADMIN_KEY: 'k' };
  await call(post({ kind: '<script>', text: '안녕' }), withText);
  const w = (await (await call(new Request('https://x/api/word?key=k'), withText)).json()).words[0];
  ok(w.text === '안녕' && w.kind === '', '글은 살리고 모르는 값만 버린다', JSON.stringify(w.kind));
}

/* ── 5. 봇이 채우는 칸 ─────────────────────────────────
   거절하면 봇이 다른 방법을 찾는다. 받은 척하고 버린다 */
head('봇 걸러내기');
{
  const env = { WORDS: fakeKV() };
  const res = await call(post({ text: '광고입니다', hp: 'http://spam' }), env);
  ok(res.status === 200 && (await res.json()).ok === true, '봇에게는 받은 척한다');
  ok([...env.WORDS._m.keys()].filter((k) => k.startsWith('w:')).length === 0,
    '실제로는 쌓이지 않는다');
}

/* ── 6. 도배 막기 ──────────────────────────────────────
   같은 IP에서 1분에 세 번까지. 네 번째는 429 */
head('도배 막기');
{
  const env = { WORDS: fakeKV() };
  const ip = { 'cf-connecting-ip': '1.2.3.4' };
  const codes = [];
  for (let i = 0; i < 5; i++) codes.push((await call(post({ text: '또' + i }, ip), env)).status);
  ok(codes.slice(0, 3).every((c) => c === 200), '세 번까지는 받는다', codes.join(','));
  ok(codes.slice(3).every((c) => c === 429), '네 번째부터 막는다', codes.join(','));

  // 다른 사람은 막히지 않는다 — IP별로 따로 센다
  const other = (await call(post({ text: '남' }, { 'cf-connecting-ip': '5.6.7.8' }), env)).status;
  ok(other === 200, '다른 IP는 그대로 받는다', String(other));
}

/* ── 7. KV가 아직 안 붙었을 때 ─────────────────────────
   **조용히 성공한 척하면 안 된다.** 방문자는 남겼다고 믿고 나는 못 받는다 */
head('KV가 없을 때');
{
  const res = await call(post({ text: '안녕' }), {});
  const out = await res.json();
  ok(res.status === 503 && out.ok === false, '받을 수 없으면 그렇다고 말한다', String(res.status));
  ok(typeof out.message === 'string' && out.message.length > 0,
    '방문자에게 보여 줄 말이 함께 온다', out.message);
}

/* ── 8. 마을은 그대로 정적이다 ─────────────────────────
   /api/word 말고는 손대지 않고 에셋으로 넘긴다. 여기가 새면 지도가 안 뜬다 */
head('나머지는 에셋으로');
{
  let asked = null;
  const env = { ASSETS: { fetch: (req) => { asked = req.url; return new Response('map'); } } };
  for (const path of ['/', '/list.html', '/app.js', '/assets/map/town-web.jpg', '/game/']) {
    asked = null;
    const res = await call(new Request('https://x' + path), env);
    if (!(asked === 'https://x' + path && res.status === 200)) {
      ok(false, `${path}가 에셋으로 넘어간다`, String(asked));
    }
  }
  ok(true, '지도·목록·그림·안내서가 전부 에셋으로 넘어간다');

  const bad = await call(new Request('https://x/api/word', { method: 'DELETE' }), env);
  ok(bad.status === 405, '/api/word는 POST·GET만 받는다', String(bad.status));
}

console.log(`\n${fail ? '❌' : '✅'}  통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
