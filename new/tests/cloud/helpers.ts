import { expect, type Page } from '@playwright/test';

export const unikat = (p: string) => p + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);

export async function registruj(page: Page, jmeno: string, heslo = 'heslo123') {
    await page.goto('/?tab=register');
    await page.locator('input[name=jmeno]').fill(jmeno);
    await page.locator('input[name=email]').fill(`${jmeno}@example.cz`);
    await page.locator('input[name=heslo]').fill(heslo);
    await page.locator('input[name=heslo_znovu]').fill(heslo);
    await page.locator('input[type=submit]').click();
    await page.waitForURL('**/zalozit-mesto');
}

export async function zalozMesto(page: Page, jmeno: string, smer: string) {
    await page.locator('input[name=jmeno]').fill(jmeno);
    await page.selectOption('select[name=smer]', smer);
    await page.locator('input[type=submit]').click();
    await page.waitForURL(/\/game$/, { timeout: 30_000 });
    await expect(page.locator('h1').first()).toHaveText(jmeno);
}
