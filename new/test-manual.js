const { chromium } = require('playwright');

async function main() {
  const browser = await chromium.launch({ headless: false, slowMo: 800 });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('console', msg => console.log('BROWSER:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  // --- REGISTRATION ---
  console.log('\n=== TEST 1: Registration ===');
  await page.goto('http://localhost:3005/register');
  await page.waitForLoadState('networkidle');
  console.log('Register page title:', await page.title());

  // Take screenshot
  await page.screenshot({ path: 'screenshot-register.png' });

  // Fill in registration form
  // First log all input fields to see what's there
  const inputs = await page.$$eval('input', els => els.map(e => ({ name: e.name, type: e.type, placeholder: e.placeholder })));
  console.log('Form inputs:', JSON.stringify(inputs));

  // Use a unique username to avoid conflicts
  const ts = Date.now();
  const username = `Hrac${ts % 10000}`;

  await page.fill('input[name="jmeno"]', username);
  await page.fill('input[name="mesto"]', `Mesto${ts % 10000}`);
  await page.fill('input[name="email"]', `${username}@test.com`);
  await page.fill('input[name="password"]', 'heslo123');
  await page.fill('input[name="passwordConfirm"]', 'heslo123');

  await page.screenshot({ path: 'screenshot-register-filled.png' });
  console.log('Form filled, submitting...');

  await page.click('button[type="submit"]');
  await page.waitForURL('**/game/**', { timeout: 10000 }).catch(async () => {
    // If redirect didn't happen, check for error
    const errorText = await page.textContent('body');
    console.log('No redirect. Page content:', errorText.substring(0, 500));
    await page.screenshot({ path: 'screenshot-register-error.png' });
  });

  const afterRegisterUrl = page.url();
  console.log('After register URL:', afterRegisterUrl);
  await page.screenshot({ path: 'screenshot-after-register.png' });

  // --- CHECK CITY PAGE ---
  if (afterRegisterUrl.includes('/game/')) {
    console.log('\n=== TEST 2: City page ===');
    const bodyText = await page.textContent('body');
    console.log('City page content (first 800 chars):', bodyText.substring(0, 800));
    await page.screenshot({ path: 'screenshot-mesto.png' });

    // --- LOGOUT ---
    console.log('\n=== TEST 3: Logout ===');
    // Find logout link/button
    const logoutEl = await page.$('a[href*="logout"], button:has-text("Odhlásit"), form button:has-text("Odhlásit")');
    if (logoutEl) {
      await logoutEl.click();
      await page.waitForURL('**/login**', { timeout: 5000 }).catch(() => {});
      console.log('After logout URL:', page.url());
    } else {
      console.log('Logout button not found, checking nav...');
      const navHtml = await page.$eval('nav', el => el.innerHTML).catch(() => 'no nav');
      console.log('Nav HTML:', navHtml.substring(0, 500));
    }
  }

  // --- LOGIN with new user ---
  console.log('\n=== TEST 4: Login ===');
  await page.goto('http://localhost:3005/login');
  await page.waitForLoadState('networkidle');

  const loginInputs = await page.$$eval('input', els => els.map(e => ({ name: e.name, type: e.type })));
  console.log('Login form inputs:', JSON.stringify(loginInputs));

  await page.fill('input[name="jmeno"]', username);
  await page.fill('input[name="password"]', 'heslo123');
  await page.screenshot({ path: 'screenshot-login-filled.png' });

  await page.click('button[type="submit"]');
  await page.waitForURL('**/game/**', { timeout: 10000 }).catch(async () => {
    const errorText = await page.textContent('body');
    console.log('Login failed. Content:', errorText.substring(0, 500));
    await page.screenshot({ path: 'screenshot-login-error.png' });
  });

  console.log('After login URL:', page.url());
  await page.screenshot({ path: 'screenshot-after-login.png' });

  // Wait 3 seconds so user can see the result
  await page.waitForTimeout(3000);

  await browser.close();
  console.log('\nAll screenshots saved. Test complete.');
}

main().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
