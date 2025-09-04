import { chromium } from 'playwright';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE_CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE_ERROR:', err.message));
  try {
    await page.goto('http://localhost:8080/dist/spaceautobattler.html', { timeout: 10000 });
    await page.waitForTimeout(2000);
  } catch (e) { console.error('NAV_ERROR', e.message); }
  await browser.close();
})();
