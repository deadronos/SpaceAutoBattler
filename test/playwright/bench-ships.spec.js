import { writeFileSync, mkdirSync } from 'node:fs';
import { chromium, test, expect } from '@playwright/test';
import process from 'process';



const BASE = 'http://localhost:8080/spaceautobattler.html';
const STRICT = process.env.E2E_BENCH_STRICT === '1';

let browser;
let page;

test.beforeEach(async () => {
  browser = await chromium.launch();
  page = await browser.newPage();
});

test.afterEach(async () => {
  if (browser) await browser.close();
});

async function waitForUi(page) {
  console.log('[bench] goto', BASE);
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  console.log('[bench] wait for #reset');
  await page.waitForSelector('#reset', { state: 'visible', timeout: 20000 });
  console.log('[bench] wait for #addRed');
  await page.waitForSelector('#addRed', { state: 'visible', timeout: 20000 });
  console.log('[bench] wait for #addBlue');
  await page.waitForSelector('#addBlue', { state: 'visible', timeout: 20000 });
}

async function setupCounts(page, redCount, blueCount) {
  console.log('[bench] click #reset');
  await page.locator('#reset').click({ timeout: 30000 });
  for (let i = 0; i < redCount; i++) console.log('[bench] click #addRed');
  await page.locator('#addRed').click({ timeout: 30000 });
  for (let i = 0; i < blueCount; i++) console.log('[bench] click #addBlue');
  await page.locator('#addBlue').click({ timeout: 30000 });
  const startBtn = page.locator('#startPause');
  const txt = (await startBtn.textContent()) || '';
  if (/start/i.test(txt)) await startBtn.click();
}

async function measure(page, seconds = 12) {
  return await page.evaluate(async (sec) => {
    const useCollector = typeof (window).__perf === 'object' && typeof (window).__perf.getFpsStats === 'function';
    if (useCollector) {
      const until = performance.now() + sec * 1000;
      while (performance.now() < until) { await new Promise(r => setTimeout(r, 50)); }
      return (window).__perf.getFpsStats();
    }
    const samples = [];
    const end = performance.now() + sec * 1000;
    let last = performance.now();
    await new Promise((resolve) => {
      const loop = (ts) => {
        samples.push(ts - last);
        last = ts;
        if (ts < end) requestAnimationFrame(loop); else resolve(null);
      };
      requestAnimationFrame(loop);
    });
    const avg = samples.reduce((a, b) => a + b, 0) / Math.max(1, samples.length);
    const fps = 1000 / avg;
    const sorted = samples.slice().sort((a, b) => a - b);
    const idx = Math.max(0, Math.floor(sorted.length * 0.99) - 1);
    return { avgFps: fps, p99FrameMs: sorted[idx] ?? 0 };
  }, seconds);
}

// Manual run only: respect E2E_BENCH gate if set in your shell
// You can still run this file directly; it won�t auto-start server/build.

test.describe('Chromium bench bootstrap first', () => {
  test.setTimeout(90_000);
  test('25/team and 50/team, no-telemetry vs telemetry', async () => {
    console.log('[bench] navigating to base and waiting for UI');
    await waitForUi(page);

    // Pass 1: no telemetry
    console.log('[bench] setting up 25 per team');
    await setupCounts(page, 25, 25);
    console.log('[bench] measuring 25/team no-telemetry for 12s');
    const p1a = await measure(page, 12);
    console.log('[bench] setting up 50 per team');
    await setupCounts(page, 50, 50);
    console.log('[bench] measuring 50/team no-telemetry for 12s');
    const p1b = await measure(page, 12);

    // Pass 2: telemetry
    await page.goto(`${BASE}?debugPerf=1`, { waitUntil: 'domcontentloaded' });
    console.log('[bench] setting up 25 per team');
    await setupCounts(page, 25, 25);
    console.log('[bench] measuring 25/team telemetry for 12s');
    const p2a = await measure(page, 12);
    console.log('[bench] setting up 50 per team');
    await setupCounts(page, 50, 50);
    console.log('[bench] measuring 50/team telemetry for 12s');
    const p2b = await measure(page, 12);

    const results = {
      noTelemetry25: p1a,
      noTelemetry50: p1b,
      telemetry25: p2a,
      telemetry50: p2b,
      deltas: {
        avgFps25: (p2a.avgFps - p1a.avgFps),
        avgFps50: (p2b.avgFps - p1b.avgFps),
        p99Ms25: (p2a.p99FrameMs - p1a.p99FrameMs),
        p99Ms50: (p2b.p99FrameMs - p1b.p99FrameMs)
      }
    };
    try { mkdirSync('test-output', { recursive: true }); } catch {} 
    const ts = new Date().toISOString().replace(/[:.]/g,'-'); writeFileSync(	est-output/bench-.json, JSON.stringify(results, null, 2));
    console.log('[bench] Results', results);

    if (STRICT) {
      expect(p1a.avgFps).toBeGreaterThanOrEqual(60);
    }
  });
});





