const { chromium } = require('playwright');

const BASE = 'http://localhost:3005';
const RESULTS = [];

function log(msg) {
  console.log('[TEST] ' + msg);
}

function pass(test, detail = '') {
  const msg = `PASS: ${test}${detail ? ' - ' + detail : ''}`;
  log(msg);
  RESULTS.push({ status: 'PASS', test, detail });
}

function fail(test, detail = '') {
  const msg = `FAIL: ${test}${detail ? ' - ' + detail : ''}`;
  log(msg);
  RESULTS.push({ status: 'FAIL', test, detail });
}

async function checkPageForErrors(page, testName) {
  const url = page.url();

  // Check for Next.js error overlay or error text
  const errorText = await page.evaluate(() => {
    // Check for Next.js error UI
    const errorEl = document.querySelector('[data-nextjs-dialog]') ||
                    document.querySelector('.nextjs-container-errors-header') ||
                    document.querySelector('[data-error-overlay]');
    if (errorEl) return errorEl.innerText || errorEl.textContent;

    // Check for error in page body
    const body = document.body?.innerText ?? '';
    if (body.includes('Application error') || body.includes('Unhandled Runtime Error')) {
      return body.substring(0, 300);
    }
    return null;
  });

  if (errorText) {
    fail(testName, `Error on page: ${errorText.substring(0, 200)}`);
    return false;
  }

  // Check HTTP status (for server-rendered pages, 500 would be in body)
  const content = await page.content();
  if (content.includes('Internal Server Error') || content.includes('500')) {
    // Check if it's actually an error page
    const title = await page.title();
    if (title.includes('500') || title.includes('Error')) {
      fail(testName, `500 error page`);
      return false;
    }
  }

  pass(testName, `URL: ${url}`);
  return true;
}

async function main() {
  log('Starting ArmyGame browser tests...');

  const browser = await chromium.launch({
    headless: true,
    slowMo: 200,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Capture console errors
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  // Capture page errors
  page.on('pageerror', err => {
    consoleErrors.push('PAGE ERROR: ' + err.message);
  });

  try {
    // ===== Test 0: Home page =====
    log('--- Test 0: Home page ---');
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1000);
    const homeTitle = await page.title();
    if (homeTitle.includes('Armygame') || homeTitle.includes('Army')) {
      pass('Home page', `Title: ${homeTitle}`);
    } else {
      fail('Home page', `Unexpected title: ${homeTitle}`);
    }

    // ===== Test 1: Register page loads =====
    log('--- Test 1: Register page loads ---');
    await page.goto(`${BASE}/register`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1000);
    const registerForm = await page.$('form');
    if (registerForm) {
      pass('Register page loads');
    } else {
      fail('Register page loads', 'No form found');
    }

    // ===== Test 2: Register a new user =====
    log('--- Test 2: Register new user ---');
    const timestamp = Date.now();
    const testUsername = `Tester${timestamp % 10000}`;
    const testCity = `TestCity${timestamp % 10000}`;
    const testEmail = `test${timestamp % 10000}@test.com`;

    try {
      await page.fill('#jmeno', testUsername);
      await page.fill('#mesto', testCity);
      await page.fill('#email', testEmail);
      await page.fill('#password', 'test123');
      await page.fill('#passwordConfirm', 'test123');

      await page.click('button[type="submit"]');

      // Wait for navigation or error
      await page.waitForTimeout(3000);

      const currentUrl = page.url();
      log(`After register, URL: ${currentUrl}`);

      if (currentUrl.includes('/game/mesto')) {
        pass('Register + redirect to /game/mesto', `URL: ${currentUrl}`);
      } else if (currentUrl.includes('/register')) {
        // Check for error message
        const errorEl = await page.$('[class*="error"]');
        const errorMsg = errorEl ? await errorEl.innerText() : 'Unknown error';
        fail('Register redirect', `Still on register page: ${errorMsg}`);
      } else {
        fail('Register redirect', `Unexpected URL: ${currentUrl}`);
      }
    } catch (err) {
      fail('Register', err.message);
    }

    // ===== Test 3: Mesto page =====
    log('--- Test 3: /game/mesto ---');
    await page.goto(`${BASE}/game/mesto`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    const mestoUrl = page.url();
    if (mestoUrl.includes('/login')) {
      fail('/game/mesto', 'Redirected to login - session not preserved');
    } else {
      await checkPageForErrors(page, '/game/mesto');
    }

    // ===== Test 4: Budovy page =====
    log('--- Test 4: /game/budovy ---');
    await page.goto(`${BASE}/game/budovy`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    const budovyUrl = page.url();
    if (budovyUrl.includes('/login')) {
      fail('/game/budovy', 'Redirected to login');
    } else {
      await checkPageForErrors(page, '/game/budovy');
    }

    // ===== Test 5: Jednotky page =====
    log('--- Test 5: /game/jednotky ---');
    await page.goto(`${BASE}/game/jednotky`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    const jednotkyUrl = page.url();
    if (jednotkyUrl.includes('/login')) {
      fail('/game/jednotky', 'Redirected to login');
    } else {
      await checkPageForErrors(page, '/game/jednotky');
    }

    // ===== Test 6: Vyzkum page =====
    log('--- Test 6: /game/vyzkum ---');
    await page.goto(`${BASE}/game/vyzkum`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    const vyzkumUrl = page.url();
    if (vyzkumUrl.includes('/login')) {
      fail('/game/vyzkum', 'Redirected to login');
    } else {
      await checkPageForErrors(page, '/game/vyzkum');
    }

    // ===== Test 7: Mapa page =====
    log('--- Test 7: /game/mapa ---');
    await page.goto(`${BASE}/game/mapa`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    const mapaUrl = page.url();
    if (mapaUrl.includes('/login')) {
      fail('/game/mapa', 'Redirected to login');
    } else {
      await checkPageForErrors(page, '/game/mapa');
    }

    // ===== Test 8: Pohyb page =====
    log('--- Test 8: /game/pohyb ---');
    await page.goto(`${BASE}/game/pohyb`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    const pohybUrl = page.url();
    if (pohybUrl.includes('/login')) {
      fail('/game/pohyb', 'Redirected to login');
    } else {
      await checkPageForErrors(page, '/game/pohyb');
    }

    // ===== Test 9: Profil page =====
    log('--- Test 9: /game/profil ---');
    await page.goto(`${BASE}/game/profil`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    const profilUrl = page.url();
    if (profilUrl.includes('/login')) {
      fail('/game/profil', 'Redirected to login');
    } else {
      await checkPageForErrors(page, '/game/profil');
    }

  } catch (err) {
    log('FATAL ERROR: ' + err.message);
    console.error(err);
  } finally {
    // Capture screenshot of current state
    try {
      await page.screenshot({ path: '/tmp/test-final.png' });
    } catch(e) {}

    await browser.close();
  }

  // Print summary
  log('\n========== TEST SUMMARY ==========');
  for (const r of RESULTS) {
    log(`${r.status}: ${r.test}${r.detail ? ' — ' + r.detail : ''}`);
  }

  if (consoleErrors.length > 0) {
    log('\n--- Console Errors ---');
    for (const e of consoleErrors.slice(0, 10)) {
      log(e);
    }
  }

  const passed = RESULTS.filter(r => r.status === 'PASS').length;
  const failed = RESULTS.filter(r => r.status === 'FAIL').length;
  log(`\nTotal: ${passed} passed, ${failed} failed`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
