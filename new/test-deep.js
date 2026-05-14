const { chromium } = require('playwright');
const BASE = 'http://localhost:3005';

async function loginAsTestUser(page) {
  await page.goto(`${BASE}/register`, { waitUntil: 'domcontentloaded' });
  const ts = Date.now() % 100000;
  await page.fill('#jmeno', `Deep${ts}`);
  await page.fill('#mesto', `DeepCity${ts}`);
  await page.fill('#email', `deep${ts}@test.com`);
  await page.fill('#password', 'test123');
  await page.fill('#passwordConfirm', 'test123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  return page.url().includes('/game/mesto');
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const loggedIn = await loginAsTestUser(page);
  console.log('Logged in:', loggedIn, page.url());

  const pages = [
    { path: '/game/mesto', checks: ['Budovy', 'Sklad', 'Populace'] },
    { path: '/game/budovy', checks: ['Vylepšit', 'Level'] },
    { path: '/game/jednotky', checks: ['Výcvik', 'Vycvičit'] },
    { path: '/game/vyzkum', checks: ['Výzkum', 'Zkoumat'] },
    { path: '/game/mapa', checks: ['Mapa světa', 'Města'] },
    { path: '/game/pohyb', checks: [] },
    { path: '/game/profil', checks: [] },
  ];

  let passed = 0, failed = 0;
  for (const p of pages) {
    await page.goto(`${BASE}${p.path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    const url = page.url();
    const text = await page.evaluate(() => document.body.innerText);

    let issues = [];
    if (url.includes('/login')) {
      issues.push('Redirected to login!');
    }
    for (const check of p.checks) {
      if (!text.includes(check)) {
        issues.push(`Missing: "${check}"`);
      }
    }
    if (text.includes('Application error') || text.includes('Unhandled Runtime')) {
      issues.push('ERROR on page!');
    }

    if (issues.length > 0) {
      console.log(`FAIL ${p.path}: ${issues.join(', ')}`);
      console.log('  Content preview:', text.substring(0, 400));
      failed++;
    } else {
      console.log(`PASS ${p.path} (url: ${url})`);
      // Show some content
      console.log('  Preview:', text.substring(0, 150).replace(/\n+/g, ' '));
      passed++;
    }
  }

  await browser.close();
  console.log(`\nTotal: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
