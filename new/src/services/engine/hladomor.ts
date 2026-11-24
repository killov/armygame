// Port konce inc/akce.php: městu se zápornou produkcí jídla a prázdným skladem umírá pěchota.
// Hladovějí nejdřív cizí podpory ve městě, pak vlastní jednotky na cestě, nakonec posádka.
import type { akce, mesto, podpory, Prisma, PrismaClient } from '@prisma/client';
import { HODNOTY } from '../../lib/game/data';
import { JEDNOTKA_IDS, PECHOTA_IDS, surovina } from '../../lib/game/vzorce';
import { surovinyPricti, surovinyRefresh, zamkniMesto, type Suroviny } from './mesto';
import { vTransakci, type Tx } from './transakce';

type Pechota = (typeof PECHOTA_IDS)[number];
type Oddil = Record<`j${(typeof JEDNOTKA_IDS)[number]}`, number>;

interface Uhynuti {
  jednotka: Pechota;
  zabito: number;
  /** Náklad rozpuštěného oddílu, který se vrací do města. */
  vratit: Suroviny;
}

const BEZ_SUROVIN: Suroviny = [0, 0, 0, 0];

/** Vrátí počet hladovějících měst, která prošla kontrolou. */
export async function zpracujHladomor(prisma: PrismaClient, now: number): Promise<number> {
  const hladova = await prisma.$queryRaw<{ id: number }[]>`
    SELECT id FROM mesto
    WHERE typ = 1 AND smrt = 0 AND surovina4_produkce < 0
      AND surovina4 + (${now} - suroviny_time) * (surovina4_produkce / 3600) < 0`;
  for (const { id } of hladova) await vTransakci(prisma, (tx) => hladovi(tx, id, now));
  return hladova.length;
}

async function hladovi(tx: Tx, id: number, now: number): Promise<void> {
  const m = await zamkniMesto(tx, id);
  if (!m) return;
  const jidlo = surovina(m.surovina4, m.surovina4_produkce, m.suroviny_time, m.sklad, now);
  // Mezitím ho mohl zachránit dovoz nebo souběžný worker.
  if (jidlo >= 0) return;

  const uhynuti =
    (await hladoviPodpory(tx, m, jidlo)) ?? (await hladoviCesty(tx, m, jidlo)) ?? (await hladoviPosadka(tx, m, jidlo));
  if (!uhynuti) return;

  await surovinyRefresh(tx, m, now);
  // Padlí vrátí jídlo, za které byli vycvičeni. Předloha vratku rozpuštěné podpory přepsala
  // následným refreshem ze starých dat; tady se přičítá až po něm.
  const [s1, s2, s3, s4] = uhynuti.vratit;
  const zaPadle = uhynuti.zabito * HODNOTY.jednotky[uhynuti.jednotka].surovina4;
  await surovinyPricti(tx, m.id, [s1, s2, s3, s4 + zaPadle]);
}

/**
 * Typ pěchoty s největším součtem napříč oddíly, z něj oddíl, který ho má nejvíc, a kolik kusů
 * musí padnout, aby jejich cena v jídle pokryla schodek. Předloha vybírala zdroj jen podle
 * existence oddílů — zdroj bez pěchoty tu přeskakujeme, jinak by město hladovělo věčně.
 */
function vyberObet<T extends Oddil>(oddily: readonly T[], jidlo: number) {
  const soucty = PECHOTA_IDS.map((j) => oddily.reduce((sum, o) => sum + o[`j${j}`], 0));
  const max = Math.max(0, ...soucty);
  if (max === 0) return undefined;
  const jednotka = PECHOTA_IDS[soucty.indexOf(max)];
  const oddil = oddily.reduce((a, b) => (b[`j${jednotka}`] > a[`j${jednotka}`] ? b : a));
  const zabito = Math.min(Math.ceil(-jidlo / HODNOTY.jednotky[jednotka].surovina4), oddil[`j${jednotka}`]);
  return { oddil, jednotka, zabito };
}

const bezJednotek = (o: Oddil) => JEDNOTKA_IDS.every((j) => o[`j${j}`] === 0);

async function hladoviPodpory(tx: Tx, m: mesto, jidlo: number): Promise<Uhynuti | undefined> {
  const podpory = await tx.$queryRaw<podpory[]>`SELECT * FROM podpory WHERE kde = ${m.id} ORDER BY id FOR UPDATE`;
  const obet = vyberObet(podpory, jidlo);
  if (!obet) return undefined;
  const { oddil, jednotka, zabito } = obet;
  oddil[`j${jednotka}`] -= zabito;

  // Podpory::podpory_clear — prázdná podpora zanikne a její náklad zůstane městu.
  if (bezJednotek(oddil)) {
    await tx.podpory.delete({ where: { id: oddil.id } });
    return { jednotka, zabito, vratit: [oddil.surovina1, oddil.surovina2, oddil.surovina3, oddil.surovina4] };
  }
  const data: Prisma.podporyUpdateInput = {};
  data[`j${jednotka}`] = oddil[`j${jednotka}`];
  await tx.podpory.update({ where: { id: oddil.id }, data });
  return { jednotka, zabito, vratit: BEZ_SUROVIN };
}

async function hladoviCesty(tx: Tx, m: mesto, jidlo: number): Promise<Uhynuti | undefined> {
  const cesty = await tx.$queryRaw<akce[]>`SELECT * FROM akce WHERE typ = 6 AND mesto = ${m.id} ORDER BY id FOR UPDATE`;
  const obet = vyberObet(cesty, jidlo);
  if (!obet) return undefined;
  const { oddil, jednotka, zabito } = obet;
  oddil[`j${jednotka}`] -= zabito;

  // Předloha tu volá neexistující Mesto::cesty_clear; obdoba podpory_clear: vyhladovělý pohyb
  // zanikne i s trasou a jeho náklad připadne domovskému městu.
  if (bezJednotek(oddil)) {
    await tx.pohyb.deleteMany({ where: { akce: oddil.id } });
    await tx.akce.delete({ where: { id: oddil.id } });
    return {
      jednotka,
      zabito,
      vratit: [oddil.surovina1 ?? 0, oddil.surovina2 ?? 0, oddil.surovina3 ?? 0, oddil.surovina4 ?? 0],
    };
  }
  const data: Prisma.akceUpdateInput = {};
  data[`j${jednotka}`] = oddil[`j${jednotka}`];
  await tx.akce.update({ where: { id: oddil.id }, data });
  return { jednotka, zabito, vratit: BEZ_SUROVIN };
}

async function hladoviPosadka(tx: Tx, m: mesto, jidlo: number): Promise<Uhynuti | undefined> {
  const obet = vyberObet([m], jidlo);
  if (!obet) return undefined;
  const { jednotka, zabito } = obet;
  const data: Prisma.mestoUpdateInput = {};
  data[`j${jednotka}`] = m[`j${jednotka}`] -= zabito;
  await tx.mesto.update({ where: { id: m.id }, data });
  return { jednotka, zabito, vratit: BEZ_SUROVIN };
}
