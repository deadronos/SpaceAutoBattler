import { test } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// This test opens the standalone HTML, captures console messages and page errors,
// waits a few seconds to allow WebGL errors to appear, and writes logs + screenshot.

const OUT_DIR = path.resolve(process.cwd(), 'test-output', 'playwright-capture');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

test('capture webgl and console errors from standalone build', async ({ page, browser }) => {
  const consoleLogs: any[] = [];
  const pageErrors: any[] = [];

  page.on('console', (msg) => {
    try {
      consoleLogs.push({ type: msg.type(), text: msg.text(), location: msg.location() });
    } catch (e) {
      consoleLogs.push({ type: msg.type(), text: msg.text() });
    }
  });

  page.on('pageerror', (err) => {
    pageErrors.push({ message: err.message, stack: err.stack });
  });

  // Navigate to local server URL (server should be started before running test)
  const url = process.env.TEST_BASE_URL || 'http://localhost:8080/spaceautobattler_standalone.html';
  await page.goto(url, { waitUntil: 'load', timeout: 20000 });

  // Wait to let the app run and produce any WebGL/console messages
  await page.waitForTimeout(4000);

  // Save screenshot and logs
  const timestamp = Date.now();
  const screenshotPath = path.join(OUT_DIR, `screenshot-${timestamp}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });

  const logsPath = path.join(OUT_DIR, `console-${timestamp}.json`);
  fs.writeFileSync(logsPath, JSON.stringify({ console: consoleLogs, pageErrors }, null, 2));

  // Optional: save a simple html snapshot of page
  const html = await page.content();
  fs.writeFileSync(path.join(OUT_DIR, `page-${timestamp}.html`), html);

  // Attach output paths to test info for easier retrieval
  test.info().attachments.push({ name: 'screenshot', path: screenshotPath });
  test.info().attachments.push({ name: 'console', path: logsPath });
});
