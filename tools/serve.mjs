/* 로컬 서버를 알아서 띄운다.
 *
 * **이 저장소에서 검사가 실패한 이유 중 제일 잦은 것이 「서버가 죽어 있었다」였다.**
 * 컨테이너가 쉬다 깨면 배경으로 띄워 둔 `python3 -m http.server`가 먼저 사라지는데,
 * 화면에는 `ERR_CONNECTION_REFUSED`만 뜨므로 **고친 것이 깨진 줄 알고 한참 헤맨다.**
 * 그래서 검사도 찍기 도구도 서버를 먼저 확인하고, 없으면 스스로 띄운다.
 *
 * 우리가 띄운 것만 우리가 내린다 — 다원님이 따로 띄워 둔 서버를 뺏지 않기 위해서다.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** @returns 우리가 띄웠으면 그 프로세스, 이미 떠 있었으면 null */
export async function serve(base = 'http://localhost:8000') {
  const up = () => fetch(base).then((r) => r.ok).catch(() => false);
  if (await up()) return null;

  // **반드시 저장소 루트에서.** 다른 데서 띄우면 전부 404가 나는데, 그러면
  // 「검사가 통째로 타임아웃」으로만 보여 원인이 서버라는 것을 알기 어렵다.
  const kid = spawn('python3', ['-m', 'http.server', new URL(base).port || '8000'],
    { cwd: ROOT, stdio: 'ignore' });
  for (let i = 0; i < 40; i++) {
    if (await up()) return kid;
    await new Promise((r) => setTimeout(r, 100));
  }
  kid.kill();
  throw new Error(`${base}에 서버를 못 띄웠다 — 그 포트를 다른 것이 쓰고 있는지 본다`);
}
