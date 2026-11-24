// Port zpracování tabulky `tasks` z bin/daemon.php (mapa_pocitej, statistika, nový blok mapy).
// Render obrázků bloků do www/mapacache a rozeslání mapa_refresh přes websocket sem nepatří (ARM-14).
import { Prisma, type PrismaClient, type tasks } from '@prisma/client';
import { spocitejMapuStatu } from '../../lib/game/mapaStatu';
import { vTransakci, type Tx } from './transakce';

/** tasks.typ podle inc/classes/Task.php */
export const ULOHA = { Mapa: 1, Statistika: 2, MapaBlok: 3 } as const;
type Uloha = (typeof ULOHA)[keyof typeof ULOHA];

/** tasks.pro — úlohy pro daemona */
const PRO_DAEMON = 1;

// Přepočet celé mapy čte 160 tisíc polí; výchozích 5 s interaktivní transakce na to nestačí.
const ULOHY_TIMEOUT_MS = 120_000;
const UPDATE_DAVKA = 1000;

export async function naplanujUlohu(tx: Tx, typ: Uloha): Promise<void> {
  await tx.tasks.create({ data: { pro: PRO_DAEMON, typ, x: 0, y: 0 } });
}

/**
 * Zpracuje čekající úlohy. Přepočet mapy i statistik je idempotentní, takže víc úloh stejného typu
 * stačí provést jednou. Úlohy se mažou až s výsledkem v jedné transakci — při chybě zůstanou
 * na další průchod; souběžný worker zamčené úlohy přeskočí.
 */
export async function zpracujUlohy(prisma: PrismaClient): Promise<void> {
  await vTransakci(
    prisma,
    async (tx) => {
      const ulohy = await tx.$queryRaw<tasks[]>`
        SELECT * FROM tasks WHERE pro = ${PRO_DAEMON} ORDER BY id FOR UPDATE SKIP LOCKED`;
      if (ulohy.length === 0) return;

      if (ulohy.some((u) => u.typ === ULOHA.Mapa)) await mapaPocitej(tx);
      if (ulohy.some((u) => u.typ === ULOHA.Statistika)) await statistika(tx);
      const bloky = ulohy.filter((u) => u.typ === ULOHA.MapaBlok);
      if (bloky.length > 0) {
        // Verze je klíč cache obrázku bloku — zvednutím ho zneplatní, render obrázku sem nepatří.
        await tx.$executeRaw`
          UPDATE mapa_bloky SET verze = verze + 1
          WHERE (x, y) IN (${Prisma.join(bloky.map((b) => Prisma.sql`(${b.x}, ${b.y})`))})`;
      }

      await tx.tasks.deleteMany({ where: { id: { in: ulohy.map((u) => u.id) } } });
    },
    { timeout: ULOHY_TIMEOUT_MS },
  );
}

/** mapa_pocitej — přepočítá státní příslušnost a hranice polí a zapíše jen změněná pole. */
async function mapaPocitej(tx: Tx): Promise<void> {
  const mesta = await tx.mesto.findMany({
    where: { typ: 1 },
    select: { x: true, y: true, stat: true, populace: true },
    orderBy: { id: 'asc' },
  });
  const mapa = spocitejMapuStatu(mesta);
  const pole = await tx.mapa.findMany({ select: { id: true, x: true, y: true, stat: true, hranice: true, dom: true } });

  const zmeny = pole.flatMap((p) => {
    const nove = mapa.pole(p.x, p.y);
    const zmena = nove.stat !== p.stat || nove.hranice !== p.hranice || nove.dom !== p.dom;
    return zmena ? [{ id: p.id, ...nove }] : [];
  });

  for (let i = 0; i < zmeny.length; i += UPDATE_DAVKA) {
    const davka = zmeny.slice(i, i + UPDATE_DAVKA);
    const pripad = (sloupec: 'stat' | 'hranice' | 'dom') =>
      Prisma.sql`CASE id ${Prisma.join(
        davka.map((z) => Prisma.sql`WHEN ${z.id} THEN ${z[sloupec]}`),
        ' ',
      )} END`;
    await tx.$executeRaw`
      UPDATE mapa SET stat = ${pripad('stat')}, hranice = ${pripad('hranice')}, dom = ${pripad('dom')}
      WHERE id IN (${Prisma.join(davka.map((z) => z.id))})`;
  }
}

/**
 * statistika — populace, počet měst a pořadí hráčů, z nich populace, členové a pořadí států;
 * státy bez členů zruší. Při shodné populaci rozhoduje nižší id (předloha pořadí neurčovala).
 */
async function statistika(tx: Tx): Promise<void> {
  await tx.$executeRaw`
    UPDATE users u JOIN (
      SELECT m.user AS id, SUM(m.populace) AS pop, COUNT(*) AS mest,
             ROW_NUMBER() OVER (ORDER BY SUM(m.populace) DESC, m.user) AS poradi
      FROM mesto m JOIN users hrac ON hrac.id = m.user
      GROUP BY m.user
    ) s ON s.id = u.id
    SET u.pop = s.pop, u.mest = s.mest, u.poradi = s.poradi`;
  await tx.$executeRaw`
    UPDATE stat st JOIN (
      SELECT u.stat AS id, SUM(u.pop) AS pop, COUNT(*) AS clenu,
             ROW_NUMBER() OVER (ORDER BY SUM(u.pop) DESC, u.stat) AS poradi
      FROM users u JOIN stat clen ON clen.id = u.stat
      GROUP BY u.stat
    ) s ON s.id = st.id
    SET st.pop = s.pop, st.clenu = s.clenu, st.poradi = s.poradi`;
  await tx.$executeRaw`
    DELETE st FROM stat st LEFT JOIN users u ON u.stat = st.id WHERE u.id IS NULL`;
}
