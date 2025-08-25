import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// This test loads the app (tries localhost then file fallback), captures console
// logs, interacts with UI controls if available, and inspects window state for
// ship positions to detect whether ships move (not just rotate/fire).

const builtIndexPaths = [
  path.resolve(__dirname, '..', 'dist', 'index.html'),
  path.resolve(__dirname, '..', 'ui.html'),
  path.resolve(__dirname, '..', 'spec', 'ui.html')
];

async function resolveUrl() {
  // Try localhost first
  const localhost = 'http://localhost:8080/';
  try {
    // We'll let Playwright navigate and handle connection errors itself;
    // tests can check page response via navigation result.
    return localhost;
  } catch (e) {
    // fallback to file:// if built index exists
  }
  for (const p of builtIndexPaths) {
    if (fs.existsSync(p)) return 'file://' + p.replace(/\\/g, '/');
  }
  // default fallback to project root ui.html
  const fallback = path.resolve(__dirname, '..', 'ui.html');
  if (fs.existsSync(fallback)) return 'file://' + fallback.replace(/\\/g, '/');
  return localhost;
}

test('debug ship movement - interact and inspect state', async ({ page, browserName }) => {
  const logs: string[] = [];
  page.on('console', msg => {
    const text = `${msg.type().toUpperCase()}: ${msg.text()}`;
    logs.push(text);
    console.log(text);
  });

  const url = await resolveUrl();
  console.log('Navigating to', url);
  const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => null);
  if (resp && resp.status && resp.status() >= 400) {
    console.warn('Navigation returned status', resp.status());
  }

  // Give the app time to initialize
  await page.waitForTimeout(2000);

  // Try clicking common UI buttons (Start, Play, Resume, Run) to start simulation
  const buttonSelectors = [
    'text=Start', 'text=Play', 'text=Run', 'text=Resume', 'button#start', 'button#play'
  ];
  for (const sel of buttonSelectors) {
    const el = await page.$(sel);
    if (el) {
      console.log('Clicking', sel);
      await el.click().catch(() => null);
      await page.waitForTimeout(300);
    }
  }

  // Wait while simulation runs
  await page.waitForTimeout(3000);

  // Try to read window.gameState or window.state or window.simState
  const state = await page.evaluate(() => {
    // Expose multiple likely globals used by the app
    // @ts-ignore
    const s = (window as any).gameState || (window as any).state || (window as any).simState || null;
    return s ? {
      t: s.t,
      ships: (s.ships || []).slice(0, 20).map((sh: any) => ({ id: sh.id, x: sh.x, y: sh.y, angle: sh.angle }))
    } : null;
  }).catch(() => null);

  // If window state not available, try to query DOM canvas for positions encoded in data attributes
  let ships = state && state.ships ? state.ships : null;
  if (!ships) {
    // Look for elements with data-ship attributes
    ships = await page.$$eval('[data-ship-id]', els => els.slice(0, 20).map(e => {
      const id = e.getAttribute('data-ship-id');
      const x = parseFloat(e.getAttribute('data-ship-x') || 'NaN');
      const y = parseFloat(e.getAttribute('data-ship-y') || 'NaN');
      const angle = parseFloat(e.getAttribute('data-ship-angle') || 'NaN');
      return { id, x, y, angle };
    })).catch(() => null as any);
  }

  const outDir = path.resolve(process.cwd(), 'playwright-debug');
  try { fs.mkdirSync(outDir, { recursive: true }); } catch (e) {}
  const screenshotPath = path.join(outDir, `ship-debug-${Date.now()}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => null);

  const result: any = { url, logs, ships, screenshot: screenshotPath };
  // Save a JSON dump
  try { fs.writeFileSync(path.join(outDir, 'ship-debug.json'), JSON.stringify(result, null, 2)); } catch (e) {}

  // Basic assertions: ensure we at least observed ships and that positions changed over a short period
  expect(result.ships, 'ships present in state').not.toBeNull();
  if (result.ships && result.ships.length > 0) {
    // sample positions now and after a short wait to see if they move
    const before = result.ships.map((s: any) => ({ id: s.id, x: s.x, y: s.y }));
    await page.waitForTimeout(1200);
    const after = await page.evaluate(() => {
      // @ts-ignore
      const s = (window as any).gameState || (window as any).state || (window as any).simState || null;
      return s ? (s.ships || []).slice(0, 20).map((sh: any) => ({ id: sh.id, x: sh.x, y: sh.y })) : null;
    }).catch(() => null);
    if (after && Array.isArray(after)) {
      // compute max delta
      let maxDelta = 0;
      for (const b of before) {
        const a = after.find((x: any) => x.id === b.id);
        if (!a) continue;
        const dx = (a.x || 0) - (b.x || 0);
        const dy = (a.y || 0) - (b.y || 0);
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > maxDelta) maxDelta = d;
      }
      console.log('max positional delta after 1.2s =', maxDelta);
      // Allow small movement tolerance; expect some movement > 0.5 logical units
      expect(maxDelta, 'ships moved significantly').toBeGreaterThan(0.5);
    } else {
      // If we couldn't read after positions, fail so user can inspect logs
      expect(after, 'able to read ships after wait').not.toBeNull();
    }
  }
});

export {};
