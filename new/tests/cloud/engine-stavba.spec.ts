// ARM-8: engine herních událostí — stavba se po doběhnutí odpočtu sama dokončí (bez reloadu
// serveru) a worker dokončí splatnou akci i bez jakéhokoli requestu hráče.
// Předpoklad: běží appka (QA_BASE_URL, default :3000) i worker (npm run worker) proti stejné DB.
import { test, expect, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL ?? 'mysql://root:armygame@db:3306/armygame' } },
});
const HESLO = 'heslo12345';
const zalozeno: { users: number[]; mesta: number[] } = { users: [], mesta: [] };

const ted = () => Math.floor(Date.now() / 1000);

/** Hráč s městem přímo v DB (registrace zakládá město napevno na id 0, druhé už neprojde). */
async function zalozHrace(): Promise<{ jmeno: string; mestoId: number }> {
  const jmeno = 'qa' + Date.now().toString(36) + Math.floor(Math.random() * 1000);
  const user = await prisma.users.create({
    data: {
      jmeno, heslo: createHash('md5').update(HESLO).digest('hex'), email: `${jmeno}@qa.cz`,
      mesto: 0, pop: 0, mest: 0, poradi: 0, zprava: 0, stat: 0, statjmeno: '', sp_all: 0, penize: 0,
      v1: 0, v2: 0, v3: 0, v4: 0, v5: 0, banka: 0,
    },
  });
  const nuly: Record<string, number> = { stat: 0, smrt: 0 };
  for (let i = 1; i <= 11; i++) nuly[`b${i}`] = 0;
  for (let i = 1; i <= 8; i++) { nuly[`v${i}`] = 0; nuly[`j${i}`] = 0; }
  const mestoId = 700_000 + Math.floor(Math.random() * 250_000);
  await prisma.mesto.create({
    data: {
      ...nuly, id: mestoId, x: mestoId % 400, y: 3, typ: 1, user: user.id, userjmeno: jmeno, jmeno: 'M' + jmeno,
      statjmeno: '', surovina1: 2000, surovina2: 2000, surovina3: 2000, surovina4: 2000,
      surovina1_produkce: 100, surovina2_produkce: 100, surovina3_produkce: 100, surovina4_produkce: 100,
      suroviny_time: ted(), sklad: 1000, populace: 10,
    } as never,
  });
  zalozeno.users.push(user.id);
  zalozeno.mesta.push(mestoId);
  return { jmeno, mestoId };
}

async function prihlas(page: Page, jmeno: string) {
  await page.goto('/login');
  await page.fill('[name=jmeno]', jmeno);
  await page.fill('[name=password]', HESLO);
  await page.locator('button[type=submit]').click();
  await page.waitForURL((u) => !u.pathname.includes('login'));
}

async function stavbaDokoncenaSama(page: Page, mestoId: number) {
  await page.goto('/game/mesto');
  const radek = page.locator('tr', { has: page.locator('a', { hasText: /^Stavebniny$/ }) }).first();
  await expect(radek.locator('td').nth(1)).toHaveText('0');
  await radek.locator('button', { hasText: 'Vylepšit' }).click();
  await expect(page.locator('li', { hasText: 'Stavebniny → level 1' })).toBeVisible();

  // Zkrácení odpočtu (cas = splatnost pro engine, dokonceni = odpočet v UI); reálných 40 s ověřeno ručně.
  const akce = await prisma.akce.findFirstOrThrow({ where: { mesto: mestoId, typ: 1 } });
  const t = ted() + 6;
  await prisma.akce.update({ where: { id: akce.id }, data: { cas: t, dokonceni: t } });
  await page.reload();
  await expect(page.locator('li', { hasText: 'Stavebniny → level 1' })).toBeVisible();

  // Od teď žádná navigace: odpočet doběhne, router.refresh() a fronta se vyprázdní.
  await expect(page.getByText('Fronta je prázdná')).toBeVisible({ timeout: 30_000 });
  await expect(radek.locator('td').nth(1)).toHaveText('1');
  expect(await prisma.akce.count({ where: { id: akce.id } })).toBe(0);
  expect((await prisma.mesto.findUniqueOrThrow({ where: { id: mestoId } })).b2).toBe(1);
}

test.afterAll(async () => {
  await prisma.akce.deleteMany({ where: { mesto: { in: zalozeno.mesta } } });
  await prisma.mesto.deleteMany({ where: { id: { in: zalozeno.mesta } } });
  await prisma.users.deleteMany({ where: { id: { in: zalozeno.users } } });
  await prisma.$disconnect();
});

test('stavba se po doběhnutí odpočtu sama dokončí (desktop)', async ({ page }) => {
  const chyby: string[] = [];
  page.on('pageerror', (e) => chyby.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') chyby.push(m.text()); });
  const { jmeno, mestoId } = await zalozHrace();
  await prihlas(page, jmeno);
  await stavbaDokoncenaSama(page, mestoId);
  // CountdownTimer (mimo ARM-8) počítá zbytek z Date.now() už při SSR, na hranici sekundy občas
  // nesedí hydratace v dev buildu — to není chyba enginu, ostatní chyby konzole ano.
  expect(chyby.filter((c) => !c.includes('Hydration failed'))).toEqual([]);
});

test.describe('mobil 390×844', () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });

  test('stavba se dokončí i na telefonu, fronta a tabulka nepřetékají', async ({ page }) => {
    const { jmeno, mestoId } = await zalozHrace();
    await prihlas(page, jmeno);
    expect(await page.evaluate(() => matchMedia('(pointer:coarse)').matches)).toBe(true);
    await stavbaDokoncenaSama(page, mestoId);
    // Obsah stránky města (fronta, tabulka budov) se vejde do viewportu. Hlavička s navigací
    // přetéká už v masteru (mimo ARM-8), proto se měří jen obsah pod ní.
    const pretekajici = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const koren = document.querySelector('h2')?.closest('div[class*="page"]') ?? document.body;
      return [...koren.querySelectorAll('*')]
        .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.right > vw + 2; })
        .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)}`);
    });
    expect(pretekajici).toEqual([]);
  });
});

test('worker dokončí splatnou akci bez requestu hráče', async () => {
  const { mestoId } = await zalozHrace();
  const user = (await prisma.mesto.findUniqueOrThrow({ where: { id: mestoId } })).user;
  const t = ted() + 1;
  const akce = await prisma.akce.create({
    data: {
      user, mesto: mestoId, cil: 0, budova: 3, delka: 1, cas: t, dokonceni: t, typ: 1, typ_jednotky: 0,
      j1: 0, j2: 0, j3: 0, j4: 0, j5: 0, j6: 0, j7: 0, j8: 0,
    },
  });
  // Worker běží v intervalu 5 s; nikdo mezitím na appku nesahá.
  await expect.poll(() => prisma.akce.count({ where: { id: akce.id } }), { timeout: 20_000 }).toBe(0);
  expect((await prisma.mesto.findUniqueOrThrow({ where: { id: mestoId } })).b3).toBe(1);
});
