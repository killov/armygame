// Integrační testy enginu běží proti vlastní DB na stejném serveru jako vývojová (jméno s `_test`),
// ať nesmažou rozehranou hru. Schéma do ní nasadí `prisma migrate deploy` z repa.
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import { Prisma, PrismaClient } from '@prisma/client';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');

/** Tabulky, na které engine sahá — mezi testy se vyprázdní. */
const TABULKY = ['akce', 'mesto', 'users', 'podpory', 'pohyb', 'tasks', 'stat', 'mapa', 'mapa_bloky'] as const;

/** Založí testovací DB, nasadí do ní migrace a vrátí její URL. */
export async function pripravTestDb(): Promise<string> {
  if (!process.env.DATABASE_URL) loadEnvFile(join(ROOT, '.env'));
  const url = new URL(process.env.DATABASE_URL!);
  const jmeno = `${url.pathname.slice(1)}_test`;

  const server = new PrismaClient({ datasourceUrl: url.toString() });
  try {
    await server.$executeRawUnsafe(`CREATE DATABASE IF NOT EXISTS \`${jmeno}\``);
  } finally {
    await server.$disconnect();
  }

  url.pathname = `/${jmeno}`;
  const migrace = spawnSync(join(ROOT, 'node_modules/.bin/prisma'), ['migrate', 'deploy'], {
    cwd: ROOT,
    env: { ...process.env, DATABASE_URL: url.toString() },
    encoding: 'utf8',
  });
  if (migrace.status !== 0) throw new Error(`prisma migrate deploy selhal: ${migrace.stderr || migrace.stdout}`);
  return url.toString();
}

/** DELETE místo TRUNCATE — TRUNCATE tabulku zahodí a založí znovu, na pár řádků je o řád pomalejší. */
export async function vycistiTestDb(prisma: PrismaClient): Promise<void> {
  for (const t of TABULKY) await prisma.$executeRawUnsafe(`DELETE FROM \`${t}\``);
}

/**
 * Řádek modelu s nulami a prázdnými řetězci ve všech sloupcích bez výchozí hodnoty — schéma
 * z předlohy žádné defaulty nemá, test tak vyplní jen sloupce, na kterých mu záleží.
 */
export function radek<T>(model: Prisma.ModelName, data: Partial<T>): T {
  const definice = Prisma.dmmf.datamodel.models.find((m) => m.name === model);
  if (!definice) throw new Error(`neznámý model ${model}`);
  const nuly = definice.fields
    .filter((f) => f.kind === 'scalar' && !f.hasDefaultValue)
    .map((f) => [f.name, f.type === 'String' ? '' : 0]);
  return { ...Object.fromEntries(nuly), ...data } as T;
}
