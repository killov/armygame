import { test, expect, type Page } from '@playwright/test';

// ARM-3: registrace → založení města → odhlášení → přihlášení; /game bez session → login.

const unikat = (p: string) => p + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);

async function registruj(page: Page, jmeno: string, heslo = 'heslo123') {
    await page.goto('/?tab=register');
    await page.locator('input[name=jmeno]').fill(jmeno);
    await page.locator('input[name=email]').fill(`${jmeno}@example.cz`);
    await page.locator('input[name=heslo]').fill(heslo);
    await page.locator('input[name=heslo_znovu]').fill(heslo);
    await page.locator('input[type=submit]').click();
    await page.waitForURL('**/zalozit-mesto');
}

async function zalozMesto(page: Page, jmeno: string, smer: string) {
    await page.locator('input[name=jmeno]').fill(jmeno);
    await page.selectOption('select[name=smer]', smer);
    await page.locator('input[type=submit]').click();
    await page.waitForURL(/\/game$/, { timeout: 30_000 });
    await expect(page.locator('h1').first()).toHaveText(jmeno);
}

test('bez session /game přesměruje na login', async ({ page }) => {
    await page.goto('/game');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('input[name=heslo]')).toBeVisible();
});

test('registrace: validace jako PHP', async ({ page }) => {
    await page.goto('/?tab=register');
    const chyby = page.locator('form label');
    await page.locator('input[type=submit]').click();
    await expect(chyby).toHaveText(['Musíte vyplnit!', 'Musíte vyplnit!', 'Musíte vyplnit!', 'Musíte vyplnit!']);

    await page.locator('input[name=jmeno]').fill('x');
    await page.locator('input[name=email]').fill('spatny');
    await page.locator('input[name=heslo]').fill('abc');
    await page.locator('input[name=heslo_znovu]').fill('abd');
    await page.locator('input[type=submit]').click();
    await expect(chyby).toHaveText(['', 'Email není platný!', 'Heslo musí mít minimálně 4 znaky!', 'Hesla se neshodují!']);
    await expect(page.locator('input[name=jmeno]')).toHaveValue('x');
});

test('registrace → založení města → odhlášení → přihlášení', async ({ page, context }) => {
    const jmeno = unikat('qa');
    await registruj(page, jmeno);

    const cookie = (await context.cookies()).find((c) => c.name === 'armygame_session');
    expect(cookie?.httpOnly).toBe(true);

    await page.locator('input[type=submit]').click();
    await expect(page.locator('#chyba0')).toHaveText('Musíte vyplnit!');
    await page.locator('input[name=jmeno]').fill('A'.repeat(25));
    await page.locator('input[type=submit]').click();
    await expect(page.locator('#chyba0')).toHaveText('Jméno může mít maximálně 20 znaků!');

    await zalozMesto(page, `Mesto ${jmeno}`.slice(0, 20), '0');

    // Druhé město se nezakládá a z / se s platnou session jde do hry.
    await page.goto('/zalozit-mesto');
    await expect(page).toHaveURL(/\/game$/);

    await page.getByRole('button', { name: 'Odhlásit se' }).click();
    await page.waitForURL(/\/$/);
    expect((await context.cookies()).find((c) => c.name === 'armygame_session')).toBeUndefined();
    await page.goto('/game');
    await expect(page).toHaveURL(/\/$/);

    await page.locator('input[name=jmeno]').fill(jmeno);
    await page.locator('input[name=heslo]').fill('spatne');
    await page.locator('input[type=submit]').click();
    await expect(page.locator('#chyba0')).toHaveText('Jméno nebo heslo nejsou správné.');
    await page.locator('input[name=heslo]').fill('heslo123');
    await page.locator('input[type=submit]').click();
    await page.waitForURL(/\/game$/);
    await expect(page.locator('h1').first()).toHaveText(`Mesto ${jmeno}`.slice(0, 20));

    // Duplicitní jméno i e-mail.
    await context.clearCookies();
    await page.goto('/?tab=register');
    await page.locator('input[name=jmeno]').fill(jmeno);
    await page.locator('input[name=email]').fill(`${jmeno}@example.cz`);
    await page.locator('input[name=heslo]').fill('heslo123');
    await page.locator('input[name=heslo_znovu]').fill('heslo123');
    await page.locator('input[type=submit]').click();
    await expect(page.locator('form label').nth(0)).toHaveText('Jméno už existuje, zvolte si jiné!');
    await expect(page.locator('form label').nth(1)).toHaveText('Email už existuje, zvolte si jiný!');
});

// Každá ze čtyř světových stran musí jít založit opakovaně (i když jsou pole u [0|0] zabraná).
for (const [smer, nazev] of [['1', 'Jihovýchod'], ['2', 'Jihozápad'], ['3', 'Severozápad']] as const) {
    test(`založení města směrem ${nazev} (2 hráči po sobě)`, async ({ browser }) => {
        for (let i = 0; i < 2; i++) {
            const ctx = await browser.newContext();
            const page = await ctx.newPage();
            const jmeno = unikat('qs');
            await registruj(page, jmeno);
            await zalozMesto(page, `M ${jmeno}`.slice(0, 20), smer);
            await ctx.close();
        }
    });
}

test('mobil 390×844: veřejné stránky a založení města bez přetečení', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    const preteceni = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    for (const tab of ['login', 'register', 'changelog']) {
        await page.goto(`/?tab=${tab}`);
        expect(await preteceni()).toBeLessThanOrEqual(2);
    }
    await registruj(page, unikat('qm'));
    expect(await preteceni()).toBeLessThanOrEqual(2);
    await ctx.close();
});
