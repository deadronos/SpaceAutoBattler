// playwright-debug-runner.cjs
// Standalone debug runner for the game UI using Playwright.
// This file intentionally uses CommonJS so it can be run with `node --require` or `node` directly.

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

const SERVER_URL = 'http://localhost:8080/dist/spaceautobattler_standalone.html';

async function killProcessOnPortWindows(port = 8080) {
  try {
    const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
    if (!out) return [];
    const lines = out.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const pids = [...new Set(lines.map(l => l.split(/\s+/).pop()))];
    for (const pid of pids) {
      try { execSync(`taskkill /PID ${pid} /F`); } catch (e) { /* ignore */ }
    }
    return pids;
  } catch (e) {
    return [];
  }
}

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function waitForServer(url, timeout = 30000, interval = 500) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(url, { method: 'GET' });
      if (res && res.status && res.status < 400) return true;
    } catch (e) {}
    await wait(interval);
  }
  return false;
}

(async () => {
  console.log('Running builds (safe to skip if already built)...');
  try { execSync('npm run build', { stdio: 'inherit' }); } catch (e) { console.warn('build failed/skipped'); }
  try { execSync('npm run build-standalone', { stdio: 'inherit' }); } catch (e) { console.warn('build-standalone failed/skipped'); }

  console.log('Killing server on port 8080 (if any)');
  await killProcessOnPortWindows(8080);

  console.log('Starting `npm run serve:dist` in background');
  const server = spawn('npm', ['run', 'serve:dist'], { shell: true, detached: true, stdio: 'ignore' });
  const serverPid = server && server.pid ? server.pid : null;
  if (serverPid) server.unref();

  console.log('Waiting for server...');
  const ready = await waitForServer(SERVER_URL, 30000, 500);
  if (!ready) {
    console.error('Server did not become ready; aborting');
    if (serverPid) try { execSync(`taskkill /PID ${serverPid} /F`); } catch (e) {}
    process.exit(1);
  }

  console.log('Launching browser');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const logs = [];
  page.on('console', msg => { logs.push(`${msg.type()}: ${msg.text()}`); });
  page.on('pageerror', e => logs.push('PAGEERROR: ' + (e && e.message ? e.message : String(e))));

  try {
    await page.goto(SERVER_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);

    const buttonSelectors = ['text=Start', 'text=Play', 'text=Run', 'text=Resume', 'button#start', 'button#play'];
    for (const sel of buttonSelectors) {
      const el = await page.$(sel);
      if (el) { await el.click().catch(() => null); await page.waitForTimeout(200); }
    }

    await page.waitForTimeout(3000);

    const snapshot = await page.evaluate(() => {
      const gm = window.gm || null;
      try {
        if (gm && typeof gm.snapshot === 'function') return gm.snapshot();
        const state = window.gameState || window.state || window.simState || null;
        return state || null;
      } catch (e) { return { error: String(e) }; }
    });

    const outDir = path.resolve(process.cwd(), 'playwright-debug');
    try { fs.mkdirSync(outDir, { recursive: true }); } catch (e) {}
    const screenshotPath = path.join(outDir, `ship-debug-${Date.now()}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => null);

    const result = { url: SERVER_URL, logs, snapshot, screenshot: screenshotPath };
    fs.writeFileSync(path.join(outDir, 'run-result.json'), JSON.stringify(result, null, 2));
    console.log('Wrote debug results to', path.join(outDir, 'run-result.json'));
  } catch (e) {
    console.error('Error during debug run:', e && e.message ? e.message : e);
  }

  await browser.close();
  if (serverPid) {
    try { execSync(`taskkill /PID ${serverPid} /F`); } catch (e) { /* ignore */ }
  }
  console.log('Done');
})();
