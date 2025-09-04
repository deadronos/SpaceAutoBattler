import { chromium } from 'playwright';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  page.on('requestfailed', req => {
    console.log('REQUEST_FAILED:', req.method(), req.url(), req.failure()?.errorText || '<no-reason>');
  });

  page.on('response', res => {
    if (!res.ok()) {
      console.log('BAD_RESPONSE:', res.status(), res.statusText(), res.url());
    }
  });

  page.on('console', msg => console.log('PAGE_CONSOLE:', msg.type(), msg.text()));

  try {
    await page.goto('http://localhost:8080/dist/spaceautobattler.html', { timeout: 15000 });
    await page.waitForTimeout(2500);
  } catch (e) {
    console.error('NAV_ERROR', e.message);
  }

  await browser.close();
})();
