import { chromium } from 'playwright';

(async () => {
  const url = process.argv[2] || 'http://127.0.0.1:8080/spaceautobattler_standalone.html';
  const browser = await chromium.launch();
  const page = await browser.newPage();

  page.on('console', msg => {
    try { console.log('PAGE_CONSOLE:', msg.text()); } catch (e) { console.log('PAGE_CONSOLE: <unserializable>'); }
  });
  page.on('pageerror', err => console.log('PAGE_ERROR:', err.toString()));

  console.log('Navigating to', url);
  await page.goto(url, { waitUntil: 'domcontentloaded' });

  await page.waitForTimeout(1000);

  const hasSlider = await page.$('#rendererScaleRange') !== null;
  console.log('Has slider?', !!hasSlider);

  if (hasSlider) {
    // set slider to 1.5 and fire input event
    await page.evaluate(() => {
      try {
        const el = document.getElementById('rendererScaleRange');
        el.value = '1.50';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      } catch (e) { console.log('eval error', e && e.toString()); }
    });
    await page.waitForTimeout(500);
  }

  const sizes = await page.evaluate(() => {
    const c = document.getElementById('world');
    if (!c) return null;
    const rect = c.getBoundingClientRect();
    return { cssW: rect.width, cssH: rect.height, width: c.width, height: c.height };
  });
  console.log('Canvas sizes:', sizes);

  await page.screenshot({ path: 'tmp_debug_screenshot.png' });
  console.log('Screenshot saved to tmp_debug_screenshot.png');

  await browser.close();
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
