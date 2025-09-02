#!/usr/bin/env node
import { chromium } from 'playwright';

async function run() {
  const url = process.env.STANDALONE_URL || 'http://127.0.0.1:8080/dist/spaceautobattler_standalone.html';
  const logs = [];

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', (msg) => {
    try {
      const location = msg.location ? msg.location() : {};
      logs.push({ kind: 'console', type: msg.type(), text: msg.text(), location });
    } catch (e) {
      logs.push({ kind: 'console', type: msg.type(), text: msg.text() });
    }
  });

  page.on('pageerror', (err) => {
    logs.push({ kind: 'pageerror', text: String(err) });
  });

  page.on('requestfailed', (req) => {
    logs.push({ kind: 'requestfailed', url: req.url(), method: req.method(), failure: req.failure() && req.failure().errorText });
  });

  try {
    console.log('Navigating to', url);
    await page.goto(url, { waitUntil: 'load', timeout: 20000 });
  } catch (err) {
    console.error('Navigation failed:', err && err.message);
  }

  // Wait a bit for dynamic module imports and worker boot
  await page.waitForTimeout(4000);

  // Capture a screenshot for visual debugging (optional)
  try {
    await page.screenshot({ path: 'dist/headless-standalone-snapshot.png', fullPage: false });
    console.log('Saved screenshot: dist/headless-standalone-snapshot.png');
  } catch (e) {
    // ignore
  }

  await browser.close();

  // Print logs in a compact form
  if (logs.length === 0) {
    console.log('No console messages captured.');
  } else {
    console.log('Captured console messages:');
    for (const entry of logs) {
      console.log(JSON.stringify(entry));
    }
  }
}

run().catch((err) => {
  console.error('Headless check failed:', err);
  process.exit(1);
});
