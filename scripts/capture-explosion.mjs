import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const port = process.env.PORT || '8081';
  const url = `http://127.0.0.1:${port}/spaceautobattler.html`;
  // Ensure output directory exists
  try {
    const fs = await import('fs');
    if (!fs.existsSync('test-output')) fs.mkdirSync('test-output');
  } catch (e) {
    void e;
  }
  console.log('Navigating to', url);
  try {
    await page.goto(url, { waitUntil: 'networkidle' });
  } catch (e) {
    console.error('Page load error', e);
  }
  // Wait for the simulation to run so projectiles can spawn and hit
  const waitMs = parseInt(process.env.WAIT_MS || '10000', 10);
  console.log(`Waiting ${waitMs}ms for simulation...`);
  await page.waitForTimeout(waitMs);

  // Attempt to capture the canvas element if present
  try {
    const canvas = await page.$('canvas');
    if (canvas) {
      await canvas.screenshot({ path: 'test-output/explosion-screenshot.png' });
      console.log('Saved canvas screenshot to test-output/explosion-screenshot.png');
    } else {
      await page.screenshot({ path: 'test-output/explosion-screenshot.png', fullPage: true });
      console.log('Saved full-page screenshot to test-output/explosion-screenshot.png');
    }
  } catch (e) {
    console.error('Screenshot failed', e);
  }

  await browser.close();
})();