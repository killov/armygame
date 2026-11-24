// Operace nad městem sdílené akcemi a hladomorem — port Mesto::suroviny_refresh a suroviny_pricti.
import { Prisma, type mesto } from '@prisma/client';
import { HODNOTY } from '../../lib/game/data';
import { BUDOVA_IDS, budovaObyvatele, PECHOTA_IDS, produkce, sklad, surovina } from '../../lib/game/vzorce';
import type { Tx } from './transakce';

export type Suroviny = readonly [number, number, number, number];

type PechotaSoucet = Record<`j${(typeof PECHOTA_IDS)[number]}`, number | null>;

const SUM_PECHOTA = { j1: true, j2: true, j3: true, j4: true } as const;

/**
 * Načte a zamkne města (FOR UPDATE čte poslední commitnutý stav, ne snapshot transakce).
 * Pořadí podle id drží stejné pořadí zámků napříč workery, takže se dvojice měst nezasekne navzájem.
 */
export async function zamkniMesta(tx: Tx, ids: readonly number[]): Promise<Map<number, mesto>> {
  const rows = await tx.$queryRaw<mesto[]>`
    SELECT * FROM mesto WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`;
  return new Map(rows.map((m) => [m.id, m]));
}

export async function zamkniMesto(tx: Tx, id: number | null): Promise<mesto | undefined> {
  if (id === null) return undefined;
  return (await zamkniMesta(tx, [id])).get(id);
}

function spotrebaPechoty(j: PechotaSoucet): number {
  return PECHOTA_IDS.reduce((sum, i) => sum + (j[`j${i}`] ?? 0) * HODNOTY.jednotky[i].spotreba, 0);
}

/**
 * Mesto::suroviny_refresh — dopočítá suroviny k času `time` a přepočítá produkci, sklad a populaci
 * podle aktuálních budov a armády (vlastní, na cestě i cizí podpory ve městě). `m` musí nést
 * stav po změně, kterou akce udělala (úroveň budovy, počet jednotek).
 */
export async function surovinyRefresh(tx: Tx, m: mesto, time: number): Promise<void> {
  // Request hráče mohl suroviny mezitím uložit k pozdějšímu času; zpětný čas by produkci odečetl.
  const t = Math.max(time, m.suroviny_time);
  const cesty = await tx.akce.aggregate({ where: { typ: 6, mesto: m.id }, _sum: SUM_PECHOTA });
  const podpory = await tx.podpory.aggregate({ where: { kde: m.id }, _sum: SUM_PECHOTA });
  const populace = BUDOVA_IDS.reduce((sum, b) => sum + budovaObyvatele(b, m[`b${b}`]), 0);
  const spotreba = populace + spotrebaPechoty(m) + spotrebaPechoty(cesty._sum) + spotrebaPechoty(podpory._sum);
  const stav = (pocet: number, prod: number) => surovina(pocet, prod, m.suroviny_time, m.sklad, t);

  await tx.mesto.update({
    where: { id: m.id },
    data: {
      surovina1: stav(m.surovina1, m.surovina1_produkce),
      surovina2: stav(m.surovina2, m.surovina2_produkce),
      surovina3: stav(m.surovina3, m.surovina3_produkce),
      surovina4: stav(m.surovina4, m.surovina4_produkce),
      surovina1_produkce: produkce(1, m.b2),
      surovina2_produkce: produkce(2, m.b3),
      surovina3_produkce: produkce(3, m.b4),
      surovina4_produkce: produkce(4, m.b5) - spotreba,
      sklad: sklad(m.b6),
      suroviny_time: t,
      populace,
    },
  });
}

/**
 * Mesto::suroviny_pricti — přičte k uloženému stavu bez ohledu na sklad (ořízne se až při čtení).
 * Zaniklé město tiše přeskočí, stejně jako UPDATE v předloze.
 */
export async function surovinyPricti(tx: Tx, mestoId: number, [s1, s2, s3, s4]: Suroviny): Promise<void> {
  await tx.mesto.updateMany({
    where: { id: mestoId },
    data: {
      surovina1: { increment: s1 },
      surovina2: { increment: s2 },
      surovina3: { increment: s3 },
      surovina4: { increment: s4 },
    },
  });
}
