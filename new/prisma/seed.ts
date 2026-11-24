// Seed světa, port install.php: z prázdné DB udělá hratelnou mapu. Idempotentní jako předloha,
// už naplněné tabulky přeskočí. Render obrázků mapy (www/mapacache) sem nepatří.
import { PrismaClient } from '@prisma/client';
import { generateMapa, generateMapaBloky } from '../src/lib/game/mapGen';

const BATCH_SIZE = 5000;

const prisma = new PrismaClient();

function chunks<T>(rows: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

async function seedMapa(): Promise<void> {
  if ((await prisma.mapa.count()) > 0) {
    console.info('mapa: hotová, přeskakuji');
    return;
  }
  const started = Date.now();
  // stat/hranice/dom PHP nevyplňovalo; MySQL 8 ve strict módu NOT NULL bez defaultu nepustí.
  const rows = generateMapa().map((pole) => ({ ...pole, stat: 0, hranice: 0, dom: 0 }));
  await prisma.$transaction(
    chunks(rows, BATCH_SIZE).map((data) => prisma.mapa.createMany({ data })),
  );
  console.info(`mapa: ${rows.length} polí za ${Date.now() - started} ms`);
}

async function seedMapaBloky(): Promise<void> {
  if ((await prisma.mapa_bloky.count()) > 0) {
    console.info('mapa_bloky: hotové, přeskakuji');
    return;
  }
  const rows = generateMapaBloky().map((blok) => ({ ...blok, verze: 0 }));
  await prisma.mapa_bloky.createMany({ data: rows });
  console.info(`mapa_bloky: ${rows.length} bloků`);
}

async function main(): Promise<void> {
  await seedMapa();
  await seedMapaBloky();
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
