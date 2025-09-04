import { chromium } from 'playwright';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Log console messages from page and worker contexts
  page.on('console', msg => {
    try {
      // Playwright ConsoleMessage exposes location and args which can indicate worker origin
      const loc = msg.location ? `${msg.location.url || ''}:${msg.location.lineNumber || 0}` : '';
      console.log('PAGE_CONSOLE:', msg.type(), msg.text(), loc);
    } catch (e) {
      console.log('PAGE_CONSOLE_ERROR:', e && e.message ? e.message : e);
    }
  });

  // Log worker creation and URL (helps correlate which worker is active)
  page.on('worker', worker => {
    try { console.log('PAGE_WORKER_CREATED:', worker.url()); } catch (e) { /* ignore */ }
  });

  // Page-level errors
  page.on('pageerror', err => console.log('PAGE_ERROR:', err.message, err.stack));

  try {
    await page.goto('http://127.0.0.1:8080/spaceautobattler.html', { timeout: 20000 });
  // Give extra time for worker initialization and any deferred errors
  await page.waitForTimeout(10000);
  } catch (e) { console.error('NAV_ERROR', e && e.message ? e.message : e); }

  await browser.close();
})();
