// Integrační testy enginu proti MySQL (testovací DB vedle vývojové, viz testDb.ts).
import type { akce, mapa, mesto, podpory, users } from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { HODNOTY } from '../../lib/game/data';
import { spocitejMapuStatu } from '../../lib/game/mapaStatu';
import { banka, budovaObyvatele, produkce } from '../../lib/game/vzorce';
import { dohonStav, zpracujUlohy } from '.';
import { zpracujAkce } from './akce';
import { pripravTestDb, radek, vycistiTestDb } from './testDb';
import { ULOHA } from './ulohy';

const NOW = 1_700_000_000;
const MESTO = 100;
const HRAC = 1;

let url: string;
let prisma: PrismaClient;

beforeAll(async () => {
  url = await pripravTestDb();
  prisma = new PrismaClient({ datasourceUrl: url });
}, 120_000);

afterAll(() => prisma?.$disconnect());

beforeEach(async () => {
  await vycistiTestDb(prisma);
  await prisma.users.create({ data: radek<users>('users', { id: HRAC, jmeno: 'hrac', penize: 500, banka: 1000 }) });
  await zalozMesto(MESTO);
});

function zalozMesto(id: number, data: Partial<mesto> = {}) {
  return prisma.mesto.create({
    data: radek<mesto>('mesto', {
      id,
      typ: 1,
      user: HRAC,
      surovina1: 1000,
      surovina2: 1000,
      surovina3: 1000,
      surovina4: 1000,
      sklad: 10_000,
      suroviny_time: NOW - 1000,
      ...data,
    }),
  });
}

function zalozAkci(data: Partial<akce>) {
  return prisma.akce.create({ data: radek<akce>('akce', { user: HRAC, mesto: MESTO, cil: MESTO, ...data }) });
}

const mestoPo = (id = MESTO) => prisma.mesto.findUniqueOrThrow({ where: { id } });
const hracPo = () => prisma.users.findUniqueOrThrow({ where: { id: HRAC } });

describe('zpracujAkce', () => {
  it('1: dokončí budovu, přepočítá produkci a naplánuje statistiku', async () => {
    await zalozAkci({ typ: 1, budova: 2, cas: NOW - 10 });

    expect(await zpracujAkce(prisma, NOW)).toBe(1);

    const m = await mestoPo();
    expect(m.b2).toBe(1);
    expect(m.surovina1_produkce).toBe(produkce(1, 1));
    expect(m.populace).toBe(budovaObyvatele(2, 1));
    // Suroviny se dopočítaly k času dokončení, ne k času zpracování.
    expect(m.suroviny_time).toBe(NOW - 10);
    expect(await prisma.akce.count()).toBe(0);
    expect(await prisma.tasks.findMany({ select: { typ: true } })).toEqual([{ typ: ULOHA.Statistika }]);
  });

  it('1: banka zvedne kapacitu hráče a peníze nad ni propadnou', async () => {
    await prisma.users.update({ where: { id: HRAC }, data: { penize: 5000, banka: 5000 } });
    await zalozAkci({ typ: 1, budova: 8, cas: NOW - 10 });

    await zpracujAkce(prisma, NOW);

    expect(await hracPo()).toMatchObject({ banka: banka(1), penize: banka(1) });
  });

  it('2: zvýší úroveň výzkumu hráče', async () => {
    await zalozAkci({ typ: 2, budova: 3, cas: NOW - 10 });

    await zpracujAkce(prisma, NOW);

    expect((await hracPo()).v3).toBe(1);
  });

  it('3: doručí obchod — peníze hráči, suroviny městu', async () => {
    await zalozAkci({ typ: 3, budova: 1, surovina1: 300, cas: NOW - 10 });
    await zalozAkci({ typ: 3, budova: 2, surovina1: 1, surovina2: 2, surovina3: 3, surovina4: 4, cas: NOW - 5 });

    expect(await zpracujAkce(prisma, NOW)).toBe(2);

    expect((await hracPo()).penize).toBe(800);
    expect(await mestoPo()).toMatchObject({ surovina1: 1001, surovina2: 1002, surovina3: 1003, surovina4: 1004 });
  });

  it('4: vyzkoumá jednotku ve městě', async () => {
    await zalozAkci({ typ: 4, obchodniku: 5, cas: NOW - 10 });

    await zpracujAkce(prisma, NOW);

    expect((await mestoPo()).v5).toBe(1);
  });

  it('5: cvičí po kusech a zbytek dávky nechá ve frontě pod stejným id', async () => {
    const { id } = await zalozAkci({ typ: 5, obchodniku: 2, surovina1: 3, delka: 10, cas: NOW - 15 });

    // Kusy v NOW-15 a NOW-5, třetí až v NOW+5.
    expect(await zpracujAkce(prisma, NOW)).toBe(2);

    expect((await mestoPo()).j2).toBe(2);
    expect(await prisma.akce.findMany()).toMatchObject([{ id, surovina1: 1, cas: NOW + 5 }]);

    await zpracujAkce(prisma, NOW + 5);

    expect((await mestoPo()).j2).toBe(3);
    expect(await prisma.akce.count()).toBe(0);
  });

  it('6: podpora dorazí do cíle i s nákladem a trasa se smaže; útok nechá bitevnímu modulu', async () => {
    const CIL = 200;
    await zalozMesto(CIL, { user: 2 });
    const podpora = await zalozAkci({ typ: 6, typ_jednotky: 1, cil: CIL, j1: 5, j6: 2, surovina4: 50, cas: NOW - 10 });
    await prisma.pohyb.create({ data: { akce: podpora.id, x: 1, y: 1, cas: NOW - 20 } });
    const utok = await zalozAkci({ typ: 6, typ_jednotky: 0, cil: CIL, j1: 3, cas: NOW - 10 });

    expect(await zpracujAkce(prisma, NOW)).toBe(1);

    expect(await prisma.podpory.findMany()).toMatchObject([{ mesto: MESTO, kde: CIL, j1: 5, j6: 2, surovina4: 50 }]);
    expect(await prisma.pohyb.count()).toBe(0);
    expect(await prisma.akce.findMany({ select: { id: true } })).toEqual([{ id: utok.id }]);
    // Cílové město živí podporu: spotřeba pěchoty v ní jde z jeho produkce jídla.
    expect((await mestoPo(CIL)).surovina4_produkce).toBe(produkce(4, 0) - 5 * HODNOTY.jednotky[1].spotreba);
  });

  it('druhá podpora ze stejného města se přičte k existující', async () => {
    const CIL = 200;
    await zalozMesto(CIL, { user: 2 });
    await prisma.podpory.create({ data: radek<podpory>('podpory', { mesto: MESTO, kde: CIL, j1: 1, surovina1: 10 }) });
    await zalozAkci({ typ: 6, typ_jednotky: 1, cil: CIL, j1: 5, surovina1: 5, cas: NOW - 10 });

    await zpracujAkce(prisma, NOW);

    expect(await prisma.podpory.findMany()).toMatchObject([{ j1: 6, surovina1: 15 }]);
  });

  it('akce v budoucnu nechá být a splatné provede podle času', async () => {
    await zalozAkci({ typ: 1, budova: 3, cas: NOW + 10 });
    await zalozAkci({ typ: 1, budova: 2, cas: NOW - 5 });
    await zalozAkci({ typ: 1, budova: 1, cas: NOW - 10 });

    expect(await zpracujAkce(prisma, NOW)).toBe(2);

    const m = await mestoPo();
    expect([m.b1, m.b2, m.b3]).toEqual([1, 1, 0]);
    // Poslední zpracovaná (b2) dopočítala suroviny ke svému času.
    expect(m.suroviny_time).toBe(NOW - 5);
  });

  it('vadnou akci zahodí a frontu neucpe', async () => {
    await zalozAkci({ typ: 99, cas: NOW - 10 });
    await zalozAkci({ typ: 2, budova: 1, cas: NOW - 5 });

    expect(await zpracujAkce(prisma, NOW)).toBe(1);

    expect((await hracPo()).v1).toBe(1);
    expect(await prisma.akce.count()).toBe(0);
  });

  it('akci s neplatným id budovy zahodí', async () => {
    await zalozAkci({ typ: 1, budova: 999, cas: NOW - 10 });

    expect(await zpracujAkce(prisma, NOW)).toBe(0);

    expect(await prisma.akce.count()).toBe(0);
  });

  it('při přechodné chybě akci nezahodí a nechá ji dalšímu průchodu', async () => {
    await zalozAkci({ typ: 1, budova: 2, cas: NOW - 10 });
    const padajici = prisma.$extends({
      query: {
        mesto: {
          update: () => Promise.reject(new Error('spojení spadlo')),
        },
      },
    }) as unknown as PrismaClient;

    await expect(zpracujAkce(padajici, NOW)).rejects.toThrow('spojení spadlo');

    expect(await prisma.akce.count()).toBe(1);
    expect(await zpracujAkce(prisma, NOW)).toBe(1);
    expect((await mestoPo()).b2).toBe(1);
  });

  describe('souběh dvou workerů', () => {
    let druhy: PrismaClient;
    beforeAll(() => {
      druhy = new PrismaClient({ datasourceUrl: url });
    });
    afterAll(() => druhy.$disconnect());

    it('stejnou akci provede jen jeden', async () => {
      await zalozAkci({ typ: 2, budova: 4, cas: NOW - 10 });

      const pocty = await Promise.all([zpracujAkce(prisma, NOW), zpracujAkce(druhy, NOW)]);

      expect(pocty[0] + pocty[1]).toBe(1);
      expect((await hracPo()).v4).toBe(1);
    });

    it('frontu nad sdílenými městy si rozeberou a každou akci provedou právě jednou', async () => {
      const mesta = [MESTO, 101, 102];
      await zalozMesto(101);
      await zalozMesto(102);
      const AKCI_NA_MESTO = 10;
      await prisma.akce.createMany({
        data: mesta.flatMap((mesto) =>
          Array.from({ length: AKCI_NA_MESTO }, (_, i) =>
            radek<akce>('akce', { typ: 1, budova: 5, mesto, cil: mesto, user: HRAC, cas: NOW - 100 + i }),
          ),
        ),
      });

      const pocty = await Promise.all([zpracujAkce(prisma, NOW), zpracujAkce(druhy, NOW)]);

      expect(pocty[0] + pocty[1]).toBe(mesta.length * AKCI_NA_MESTO);
      const vysledek = await prisma.mesto.findMany({ select: { b5: true }, orderBy: { id: 'asc' } });
      expect(vysledek).toEqual(mesta.map(() => ({ b5: AKCI_NA_MESTO })));
      expect(await prisma.akce.count()).toBe(0);
    }, 30_000);
  });
});

describe('hladomor', () => {
  /** Město, kterému za 100 s produkce -3600/h chybí 100 jídla — jeden pěšák (100 jídla) to pokryje. */
  const hladove = { surovina4: 0, surovina4_produkce: -3600, suroviny_time: NOW - 100, sklad: 1000 };

  it('padne posádka a vrátí jídlo, za které byla vycvičena', async () => {
    await prisma.mesto.update({ where: { id: MESTO }, data: { ...hladove, j1: 10 } });

    await dohonStav(prisma, NOW);

    const m = await mestoPo();
    expect(m.j1).toBe(10 - Math.ceil(100 / HODNOTY.jednotky[1].surovina4));
    expect(m.surovina4).toBe(-100 + HODNOTY.jednotky[1].surovina4);
    expect(m.suroviny_time).toBe(NOW);
  });

  it('nejdřív hladoví cizí podpora; prázdná zanikne a náklad nechá městu', async () => {
    await prisma.mesto.update({ where: { id: MESTO }, data: { ...hladove, j1: 10 } });
    await prisma.podpory.create({ data: radek<podpory>('podpory', { mesto: 300, kde: MESTO, j1: 1, surovina1: 50 }) });

    await dohonStav(prisma, NOW);

    expect(await prisma.podpory.count()).toBe(0);
    expect(await mestoPo()).toMatchObject({ j1: 10, surovina1: 1000 + 50 });
  });

  it('město s jídlem nechá být', async () => {
    await prisma.mesto.update({ where: { id: MESTO }, data: { ...hladove, surovina4: 500, j1: 10 } });

    await dohonStav(prisma, NOW);

    expect((await mestoPo()).j1).toBe(10);
  });
});

describe('zpracujUlohy', () => {
  it('statistika přepočítá hráče a státy a zruší státy bez členů', async () => {
    await prisma.stat.createMany({ data: [{ id: 1, jmeno: 'a', clenu: 0, pop: 0, poradi: 0 }, { id: 2, jmeno: 'prazdny', clenu: 0, pop: 0, poradi: 0 }] });
    await prisma.users.update({ where: { id: HRAC }, data: { stat: 1 } });
    await prisma.users.create({ data: radek<users>('users', { id: 2, jmeno: 'druhy', stat: 1 }) });
    await prisma.mesto.update({ where: { id: MESTO }, data: { populace: 30 } });
    await zalozMesto(101, { populace: 20 });
    await zalozMesto(200, { user: 2, populace: 80 });
    await prisma.tasks.createMany({ data: [{ pro: 1, typ: ULOHA.Statistika, x: 0, y: 0 }, { pro: 1, typ: ULOHA.Statistika, x: 0, y: 0 }] });

    await zpracujUlohy(prisma);

    const hraci = await prisma.users.findMany({ select: { pop: true, mest: true, poradi: true }, orderBy: { id: 'asc' } });
    expect(hraci).toEqual([{ pop: 50, mest: 2, poradi: 2 }, { pop: 80, mest: 1, poradi: 1 }]);
    expect(await prisma.stat.findMany()).toMatchObject([{ id: 1, pop: 130, clenu: 2, poradi: 1 }]);
    expect(await prisma.tasks.count()).toBe(0);
  });

  it('mapa přepočítá příslušnost polí ke státům, blok mapy zvedne verzi', async () => {
    await prisma.mesto.update({ where: { id: MESTO }, data: { x: 10, y: 10, stat: 7, populace: 100 } });
    const souradnice = [[10, 10], [11, 10], [14, 10], [30, 30]] as const;
    await prisma.mapa.createMany({ data: souradnice.map(([x, y]) => radek<mapa>('mapa', { x, y })) });
    await prisma.mapa_bloky.create({ data: { x: 1, y: 1, verze: 3 } });
    await prisma.tasks.createMany({ data: [{ pro: 1, typ: ULOHA.Mapa, x: 0, y: 0 }, { pro: 1, typ: ULOHA.MapaBlok, x: 1, y: 1 }] });

    await zpracujUlohy(prisma);

    const ocekavana = spocitejMapuStatu([{ x: 10, y: 10, stat: 7, populace: 100 }]);
    const pole = await prisma.mapa.findMany({ select: { x: true, y: true, stat: true, hranice: true, dom: true }, orderBy: { id: 'asc' } });
    expect(pole).toEqual(souradnice.map(([x, y]) => ({ x, y, ...ocekavana.pole(x, y) })));
    expect(pole[0].stat).toBe(7);
    expect(pole[3].stat).toBe(0);
    expect((await prisma.mapa_bloky.findFirstOrThrow()).verze).toBe(4);
    expect(await prisma.tasks.count()).toBe(0);
  });
});
