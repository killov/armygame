// Testovací most na PHP předlohu: vytáhne hodnoty z inc/*.php / lang/*.php přes json_encode.
// Bez php v PATH vrací null a srovnávací testy se přeskočí.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

export const hasPhp = spawnSync('php', ['-v']).status === 0;

/** Pustí `include <file>; echo json_encode(<expr>)` v rootu repa a vrátí naparsovaný výsledek. */
export function phpJson(file: string, expr: string): unknown {
  const res = spawnSync('php', ['-r', `include ${JSON.stringify(file)}; echo json_encode(${expr});`], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  if (res.status !== 0) throw new Error(`php selhalo: ${res.stderr || res.stdout}`);
  return JSON.parse(res.stdout);
}

/** PHP prázdné pole kóduje jako [], TS ho drží jako {} — sjednotí obě strany. */
export function emptyArraysToObjects(value: unknown): unknown {
  if (Array.isArray(value)) return value.length === 0 ? {} : value.map(emptyArraysToObjects);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, emptyArraysToObjects(v)]));
  }
  return value;
}
