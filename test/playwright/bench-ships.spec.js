// Manual performance bench for ship counts and telemetry overhead.
// Run with: E2E_BENCH=1 npx playwright test test/playwright/bench-ships.spec.js --project=chromium
// Optional strict threshold: E2E_BENCH_STRICT=1

import { test, expect } from '@playwright/test';
import { spawn, execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import http from 'node:http';
import process from 'node:process';
import logger from '../../src/logger.js';

function isBenchEnabled() { return process.env.E2E_BENCH === '1' || process.env.E2E_BENCH === 'true'; }

async function isServerUp() {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:8080/', (res) => { res.resume(); resolve(true); });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => { try { req.destroy(); } catch {logger.error('Request timeout');} resolve(false); });
  });
}

function hasBuiltDist() {
  try {
    return existsSync('dist/spaceautobattler.html');
  } catch { return false; }
}

function run(cmd) {
  console.log(`[bench] ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
}

async function ensureBuildAndServer() {
  const server = await isServerUp();
  const built = hasBuiltDist();
  if (!built) run('npm run build');
  if (!server) {
    // fire and forget server; rely on playwright webServer in config if present, otherwise local
    spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'serve'], { stdio: 'ignore', detached: true });
    // wait for port
    const start = Date.now();
    while (!(await isServerUp())) {
      if (Date.now() - start > 15000) throw new Error('Server did not come up on :8080');
      await new Promise(r => setTimeout(r, 300));
    }
  }
}

async function measureRun(page, url, addCountPerTeam, seconds) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#reset');
  // Reset
  await page.click('#reset');
  // Add ships
  for (let i = 0; i < addCountPerTeam; i++) {
    await page.click('#addRed');
    await page.click('#addBlue');
  }
  // Start if needed
  const startBtn = page.locator('#startPause');
  const txt = await startBtn.textContent();
  if (txt && /start/i.test(txt)) await startBtn.click();

  // Collect FPS via window.__perf if available; otherwise compute from rAF timestamps
  await page.exposeFunction('__bench_now', () => Date.now());
  const result = await page.evaluate(async (seconds) => {
    const usePerf = typeof window.__perf === 'object' && typeof window.__perf.getFpsStats === 'function';
    if (usePerf) {
      const until = performance.now() + seconds * 1000;
      while (performance.now() < until) { await new Promise(r => setTimeout(r, 50)); }
      return window.__perf.getFpsStats();
    }
    const frames = [];
    const start = performance.now();
    let last = start;
    return await new Promise((resolve) => {
      function tick(ts) {
        frames.push(ts - last);
        last = ts;
        if (ts - start >= seconds * 1000) {
          const ms = frames.reduce((a,b)=>a+b,0) / frames.length;
          const fps = 1000 / ms;
          frames.sort((a,b)=>a-b);
          const idx = Math.max(0, Math.floor(frames.length * 0.99) - 1);
          const p99 = frames[idx];
          resolve({ avgFps: fps, p99FrameMs: p99 });
          return;
        }
        requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  }, seconds);
  return result;
}

test.describe('bench: ships FPS', () => {
  test.skip(!isBenchEnabled(), 'Set E2E_BENCH=1 to run this manual bench');

  test('25 and 50 per team, with/without telemetry', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Bench runs on Chromium only by default');
    await ensureBuildAndServer();

    const base = 'http://localhost:8080/spaceautobattler.html';
    const durations = 12;

    const r1 = await measureRun(page, base, 15, durations);
    const r2 = await measureRun(page, `${base}?debugPerf=1`, 15, durations);
    console.log('[bench] 25/team no-telemetry:', r1);
    console.log('[bench] 25/team telemetry:', r2);

    const r3 = await measureRun(page, base, 40, durations);
    const r4 = await measureRun(page, `${base}?debugPerf=1`, 40, durations);
    console.log('[bench] 50/team no-telemetry:', r3);
    console.log('[bench] 50/team telemetry:', r4);

    if (process.env.E2E_BENCH_STRICT) {
      expect(r1.avgFps || 0).toBeGreaterThanOrEqual(60);
    }
  });
});
