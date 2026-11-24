import { test, expect, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { noveMestoData } from '../../src/lib/game/vytvorMesto';
import { registruj, unikat, zalozMesto } from './helpers';

// ARM-4: herní rám podle inc/game.php — lišta, tikání surovin, mapa přežije navigaci, přejmenování,
// přepnutí města, hláška, odhlášení, mobil. DB se upravuje přímo (DATABASE_URL z .env jako dev server).

const db = new PrismaClient();
test.afterAll(() => db.$disconnect());

const ted = () => Math.floor(Date.now() / 1000);
const hodnota = async (page: Page, i: number) => Number(await page.locator(`#surovina${i}`).textContent());

async function novyHrac(page: Page) {
    const jmeno = unikat('ra');
    await registruj(page, jmeno);
    const mesto = `R ${jmeno}`.slice(0, 20);
    await zalozMesto(page, mesto, '0');
    const user = await db.users.findFirstOrThrow({ where: { jmeno } });
    return { jmeno, mesto, user };
}

test('rám, tikání surovin, navigace, přejmenování, přepnutí města, odhlášení', async ({ page }) => {
    const { mesto, user } = await novyHrac(page);

    // 1. Rám
    await expect(page.locator('#back')).toBeAttached();
    await expect(page.locator('#suroviny > div')).toHaveCount(5);
    for (const popisek of ['Seznam měst', 'Mapa', 'Město', 'Stát', 'Profil', 'Statistika', 'Odhlásit se']) {
        await expect(page.getByRole('button', { name: popisek, exact: true }).or(page.getByRole('link', { name: popisek, exact: true }))).toBeVisible();
    }
    await expect(page.locator('#levo')).toContainText('Jednotky');
    await expect(page.locator('#levo #jednotky')).toHaveText('Žádné');
    await expect(page.locator('#obsah h1')).toHaveText(mesto);

    // 2. Tikání: 36000/h = 10/s
    const mestoId = user.mesto;
    await db.mesto.update({ where: { id: mestoId }, data: { surovina1: 100, surovina1_produkce: 36_000, suroviny_time: ted() } });
    // 3. Strop: železo kousek pod skladem s vysokou produkcí
    const { sklad } = await db.mesto.findUniqueOrThrow({ where: { id: mestoId } });
    await db.mesto.update({ where: { id: mestoId }, data: { surovina2: sklad - 3, surovina2_produkce: 36_000 } });
    await page.reload();
    const s1 = await hodnota(page, 1);
    await page.waitForTimeout(3000);
    expect(await hodnota(page, 1)).toBeGreaterThanOrEqual(s1 + 20);
    expect(await hodnota(page, 2)).toBe(sklad);
    await page.waitForTimeout(1500);
    expect(await hodnota(page, 2)).toBe(sklad);

    // 4. Navigace nepřemountuje mapu a suroviny nespadnou na hodnotu z prvního renderu
    const mapa = await page.locator('[data-testid=mapa-pozadi]').elementHandle();
    const predNavigaci = await hodnota(page, 1);
    for (const [popisek, url] of [['Město', /\/game\/mesto$/], ['Profil', /\/game\/profil$/], ['Stát', /\/game\/stat$/]] as const) {
        await page.getByRole('link', { name: popisek, exact: true }).click();
        await page.waitForURL(url);
        expect(await mapa!.evaluate((el) => el.isConnected)).toBe(true);
        expect(await hodnota(page, 1)).toBeGreaterThanOrEqual(predNavigaci);
    }
    await expect(page.locator('#obsah h2')).toHaveText('Stát');

    // 5. Přejmenování
    const noveJmeno = `N ${unikat('')}`.slice(0, 20);
    await page.locator('#ren').click();
    await page.locator('#in').fill(noveJmeno);
    await page.locator('#in').press('Enter');
    await expect(page.locator('#ren')).toHaveText(noveJmeno);
    await page.reload();
    await expect(page.locator('#ren')).toHaveText(noveJmeno);
    await page.locator('#ren').click();
    await page.locator('#in').fill('   ');
    await page.locator('#in').press('Enter');
    await expect(page.locator('#hlaska')).toHaveText('Musíte vyplnit!');
    await expect(page.locator('#hlaska')).toHaveCSS('background-color', 'rgb(255, 0, 0)');
    await expect(page.locator('#ren')).toHaveText(noveJmeno);
    expect((await db.mesto.findUniqueOrThrow({ where: { id: mestoId } })).jmeno).toBe(noveJmeno);

    // 6. Přepnutí na druhé město hráče (volné pole jako CityFoundingService)
    const pole = await db.mapa.findFirstOrThrow({ where: { typ: 0, x: { gt: 50 }, y: { gt: 50 } } });
    await db.mapa.update({ where: { id: pole.id }, data: { typ: 1 } });
    const druhe = `D ${unikat('')}`.slice(0, 20);
    await db.mesto.create({
        data: noveMestoData({ poleId: pole.id, x: pole.x, y: pole.y, jmeno: druhe, userId: user.id, userjmeno: user.jmeno, now: ted() }),
    });
    await page.goto('/game');
    await page.getByRole('button', { name: 'Seznam měst', exact: true }).click();
    await expect(page.locator('#seznam-mest tr')).toHaveCount(2);
    await page.locator('#seznam-mest').getByRole('button', { name: druhe, exact: true }).click();
    await expect(page.locator('#ren')).toHaveText(druhe);
    await expect(page.locator('#obsah h1')).toHaveText(druhe);
    await expect(page.locator('#hlaska')).toContainText(druhe);
    await page.reload();
    await expect(page.locator('#ren')).toHaveText(druhe);
    await expect(page.locator('#obsah h1')).toHaveText(druhe);

    // 7. Hair-cross skryje okno, home ho zase ukáže (i #rip pod oknem)
    await page.getByRole('button', { name: 'Mapa', exact: true }).click();
    await expect(page.locator('#celek')).toBeHidden();
    await page.getByRole('link', { name: 'Město', exact: true }).click();
    await page.waitForURL(/\/game\/mesto$/);
    await expect(page.locator('#celek')).toBeVisible();
    await page.locator('#rip').click();
    await expect(page.locator('#celek')).toBeHidden();
    await page.getByRole('link', { name: 'Město', exact: true }).click();
    await expect(page.locator('#celek')).toBeVisible();

    // 8. Odhlášení
    await page.getByRole('button', { name: 'Odhlásit se', exact: true }).click();
    await page.waitForURL(/\/$/);
});

test('users.mesto ukazující na cizí město spadne na vlastní', async ({ page }) => {
    const { mesto, user } = await novyHrac(page);
    const cizi = await db.mesto.findFirstOrThrow({ where: { user: { not: user.id } } });
    await db.users.update({ where: { id: user.id }, data: { mesto: cizi.id } });
    await page.goto('/game');
    await expect(page.locator('#ren')).toHaveText(mesto);
    expect((await db.users.findUniqueOrThrow({ where: { id: user.id } })).mesto).toBe(user.mesto);
});

test('mobil 390×844: lišta ve dvou řadách, nic nepřetéká, panel Jednotky a seznam měst', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await novyHrac(page);
    const sirka = () => page.evaluate(() => document.documentElement.scrollWidth);

    for (const url of ['/game', '/game/profil']) {
        await page.goto(url);
        expect(await sirka()).toBeLessThanOrEqual(390);
        await page.screenshot({ path: test.info().outputPath(`mobil${url.replaceAll('/', '-')}.png`) });
    }

    const tlacitka = await page.locator('[aria-label="Odhlásit se"]').boundingBox();
    const suroviny = await page.locator('#suroviny').boundingBox();
    expect(tlacitka!.height).toBeLessThanOrEqual(41);
    expect(suroviny!.y).toBeGreaterThanOrEqual(tlacitka!.y + tlacitka!.height);
    expect(suroviny!.x + suroviny!.width).toBeLessThanOrEqual(390);

    const celek = await page.locator('#celek').boundingBox();
    expect(celek!.x).toBe(0);
    expect(celek!.width).toBe(390);
    expect(celek!.y).toBeGreaterThanOrEqual(suroviny!.y + suroviny!.height);

    await expect(page.locator('#levo')).toBeHidden();
    await page.getByRole('button', { name: 'Jednotky', exact: true }).click();
    await expect(page.locator('#levo')).toBeVisible();
    expect((await page.locator('#levo').boundingBox())!.width).toBeLessThanOrEqual(390);

    await page.getByRole('button', { name: 'Seznam měst', exact: true }).click();
    const seznam = await page.locator('#seznam-mest').boundingBox();
    expect(seznam!.x).toBeGreaterThanOrEqual(0);
    expect(seznam!.x + seznam!.width).toBeLessThanOrEqual(390);
    expect(await sirka()).toBeLessThanOrEqual(390);
    await ctx.close();
});

test('odpočet fronty běží po vteřinách (Odpocet jako game.js)', async ({ page }) => {
    const { user } = await novyHrac(page);
    const t = ted();
    await db.akce.create({
        data: { user: user.id, mesto: user.mesto, cil: user.mesto, budova: 2, delka: 600, cas: t, dokonceni: t + 600, typ: 1, typ_jednotky: 0, j1: 0, j2: 0, j3: 0, j4: 0, j5: 0, j6: 0, j7: 0, j8: 0 },
    });
    await page.goto('/game/mesto');
    const odpocet = page.locator('[class*=queueTime]').first();
    await expect(odpocet).toHaveText(/^00:(09|10):\d\d$/);
    const sekundy = async () => {
        const [h, m, s] = (await odpocet.textContent())!.split(':').map(Number);
        return h * 3600 + m * 60 + s;
    };
    const a = await sekundy();
    await page.waitForTimeout(3200);
    const b = await sekundy();
    expect(a - b).toBeGreaterThanOrEqual(2);
    expect(a - b).toBeLessThanOrEqual(4);
});
