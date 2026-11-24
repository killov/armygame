// Port inc/akce.php: provede akce s `cas <= now` v pořadí podle času, každou v samostatné transakci.
import type { akce, Prisma, PrismaClient, users } from '@prisma/client';
import { banka, BUDOVA_IDS, JEDNOTKA_IDS, penize, VYZKUM_IDS } from '../../lib/game/vzorce';
import { surovinyPricti, surovinyRefresh, zamkniMesta, zamkniMesto } from './mesto';
import { vTransakci, type Tx } from './transakce';
import { naplanujUlohu, ULOHA } from './ulohy';

/** akce.typ */
const AKCE = { Stavba: 1, VyzkumHrace: 2, Obchod: 3, VyzkumJednotky: 4, Vycvik: 5, Pohyb: 6 } as const;
/** akce.typ_jednotky pohybu, který předloha zpracovává (podpora). Útoky řeší bitevní modul. */
const POHYB_PODPORA = 1;
/** akce.budova obchodu: 1 = prodej za peníze, jinak dovoz surovin */
const OBCHOD_PENIZE = 1;

/** WHERE `cas` <= now vylučuje NULL, takže splatná akce čas vždy má. */
type SplatnaAkce = akce & { cas: number };

/** Akce, kterou nejde provést nikdy (neznámý typ, id mimo rozsah) — jediná, kterou engine zahodí. */
class VadnaAkceError extends Error {
  constructor(
    readonly akce: SplatnaAkce,
    duvod: string,
  ) {
    super(duvod);
    this.name = 'VadnaAkceError';
  }
}

/**
 * Provede všechny splatné akce a vrátí jejich počet. Akce se bere přes FOR UPDATE SKIP LOCKED
 * a maže se ve stejné transakci, ve které se provede — souběžné workery (daemon i doháněcí
 * request hráče) si akce rozeberou a každou provede právě jeden.
 */
export async function zpracujAkce(prisma: PrismaClient, now: number): Promise<number> {
  let pocet = 0;
  for (;;) {
    try {
      const provedena = await vTransakci(prisma, async (tx) => {
        const [a] = await tx.$queryRaw<SplatnaAkce[]>`
          SELECT * FROM akce
          WHERE cas <= ${now} AND (typ <> ${AKCE.Pohyb} OR typ_jednotky = ${POHYB_PODPORA})
          ORDER BY cas, id
          LIMIT 1
          FOR UPDATE SKIP LOCKED`;
        if (a) await proved(tx, a);
        return a !== undefined;
      });
      if (!provedena) return pocet;
      pocet++;
    } catch (err) {
      // Přechodné chyby (timeout transakce, spadlé spojení) akci nechají ve frontě pro další průchod.
      if (!(err instanceof VadnaAkceError)) throw err;
      await zahodVadnouAkci(prisma, err);
    }
  }
}

/**
 * Vadná akce by jinak zůstala první ve frontě a zablokovala všechny další. Předloha akce mazala
 * před zpracováním, takže i tam se taková akce zahodila.
 */
async function zahodVadnouAkci(prisma: PrismaClient, err: VadnaAkceError): Promise<void> {
  console.error(`engine: akci ${err.akce.id} nejde provést (${err.message}), zahazuji ji`, err.akce);
  await prisma.akce.deleteMany({ where: { id: err.akce.id } });
}

async function proved(tx: Tx, a: SplatnaAkce): Promise<void> {
  // Předloha akci maže před provedením — přepočet spotřeby už pohyb na cestě nesmí započítat.
  await tx.akce.delete({ where: { id: a.id } });
  switch (a.typ) {
    case AKCE.Stavba:
      return dokonciStavbu(tx, a);
    case AKCE.VyzkumHrace:
      return dokonciVyzkumHrace(tx, a);
    case AKCE.Obchod:
      return dorucObchod(tx, a);
    case AKCE.VyzkumJednotky:
      return dokonciVyzkumJednotky(tx, a);
    case AKCE.Vycvik:
      return vycvicKus(tx, a);
    case AKCE.Pohyb:
      return dorucPodporu(tx, a);
    default:
      throw new VadnaAkceError(a, `neznámý typ akce ${a.typ}`);
  }
}

function platneId<T extends number>(ids: readonly T[], a: SplatnaAkce, id: number | null, co: string): T {
  const platne = ids.find((i) => i === id);
  if (platne === undefined) throw new VadnaAkceError(a, `neplatné id ${co}: ${id}`);
  return platne;
}

async function dokonciStavbu(tx: Tx, a: SplatnaAkce): Promise<void> {
  const budova = platneId(BUDOVA_IDS, a, a.budova, 'budovy');
  const m = await zamkniMesto(tx, a.mesto);
  if (!m) return;
  const data: Prisma.mestoUpdateInput = {};
  data[`b${budova}`] = m[`b${budova}`] += 1;
  await tx.mesto.update({ where: { id: m.id }, data });
  await surovinyRefresh(tx, m, a.cas);
  await naplanujUlohu(tx, ULOHA.Statistika);
  if (budova === 8) await obnovBanku(tx, m.user);
}

/** User::refresh — kapacita banky je součet bank všech měst hráče; peníze nad ni propadnou. */
async function obnovBanku(tx: Tx, userId: number): Promise<void> {
  const [u] = await tx.$queryRaw<Pick<users, 'penize' | 'banka'>[]>`
    SELECT penize, banka FROM users WHERE id = ${userId} FOR UPDATE`;
  if (!u) return;
  const mesta = await tx.mesto.findMany({ where: { user: userId }, select: { b8: true } });
  const kapacita = mesta.reduce((sum, m) => sum + banka(m.b8), 0);
  await tx.users.update({
    where: { id: userId },
    data: { banka: kapacita, penize: penize(penize(u.penize, u.banka), kapacita) },
  });
}

async function dokonciVyzkumHrace(tx: Tx, a: SplatnaAkce): Promise<void> {
  const vyzkum = platneId(VYZKUM_IDS, a, a.budova, 'výzkumu');
  if (a.user === null) return;
  const data: Prisma.usersUpdateManyMutationInput = {};
  data[`v${vyzkum}`] = { increment: 1 };
  await tx.users.updateMany({ where: { id: a.user }, data });
}

async function dorucObchod(tx: Tx, a: SplatnaAkce): Promise<void> {
  if (a.mesto === null) return;
  if (a.budova !== OBCHOD_PENIZE) {
    await surovinyPricti(tx, a.mesto, [a.surovina1 ?? 0, a.surovina2 ?? 0, a.surovina3 ?? 0, a.surovina4 ?? 0]);
    return;
  }
  const m = await tx.mesto.findUnique({ where: { id: a.mesto }, select: { user: true } });
  if (!m) return;
  await tx.users.updateMany({ where: { id: m.user }, data: { penize: { increment: a.surovina1 ?? 0 } } });
}

async function dokonciVyzkumJednotky(tx: Tx, a: SplatnaAkce): Promise<void> {
  const jednotka = platneId(JEDNOTKA_IDS, a, a.obchodniku, 'jednotky');
  if (a.mesto === null) return;
  const data: Prisma.mestoUpdateManyMutationInput = {};
  data[`v${jednotka}`] = 1;
  await tx.mesto.updateMany({ where: { id: a.mesto }, data });
}

/** Výcvik jde po kusech: akce nese zbývající počet (surovina1) a po každém kusu se posune o délku. */
async function vycvicKus(tx: Tx, a: SplatnaAkce): Promise<void> {
  const jednotka = platneId(JEDNOTKA_IDS, a, a.obchodniku, 'jednotky');
  const m = await zamkniMesto(tx, a.mesto);
  if (!m) return;
  const data: Prisma.mestoUpdateInput = {};
  data[`j${jednotka}`] = m[`j${jednotka}`] += 1;
  await tx.mesto.update({ where: { id: m.id }, data });
  await surovinyRefresh(tx, m, a.cas);

  const zbyva = (a.surovina1 ?? 1) - 1;
  // Stejné id jako předloha — fronta výcviku v UI drží klíč přes celou dávku.
  if (zbyva > 0) await tx.akce.create({ data: { ...a, surovina1: zbyva, cas: a.cas + (a.delka ?? 0) } });
}

async function dorucPodporu(tx: Tx, a: SplatnaAkce): Promise<void> {
  await tx.pohyb.deleteMany({ where: { akce: a.id } });
  if (a.mesto === null) return;
  const mesta = await zamkniMesta(tx, [...new Set([a.mesto, a.cil])]);
  if (!mesta.has(a.cil)) return;

  const jednotky = { j1: a.j1, j2: a.j2, j3: a.j3, j4: a.j4, j5: a.j5, j6: a.j6, j7: a.j7, j8: a.j8 };
  const naklad = { surovina1: a.surovina1 ?? 0, surovina2: a.surovina2 ?? 0, surovina3: a.surovina3 ?? 0, surovina4: a.surovina4 ?? 0 };
  const [podpora] = await tx.$queryRaw<{ id: number }[]>`
    SELECT id FROM podpory WHERE mesto = ${a.mesto} AND kde = ${a.cil} LIMIT 1 FOR UPDATE`;
  if (podpora) {
    await tx.podpory.update({ where: { id: podpora.id }, data: inkrementy({ ...jednotky, ...naklad }) });
  } else {
    await tx.podpory.create({ data: { mesto: a.mesto, kde: a.cil, ...jednotky, ...naklad } });
  }

  for (const m of mesta.values()) await surovinyRefresh(tx, m, a.cas);
}

function inkrementy<K extends string>(hodnoty: Record<K, number>): Record<K, { increment: number }> {
  const out = {} as Record<K, { increment: number }>;
  for (const k in hodnoty) out[k] = { increment: hodnoty[k] };
  return out;
}
