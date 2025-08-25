const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const builtIndexPaths = [
  path.resolve(__dirname, '..', '..', 'dist', 'index.html'),
  path.resolve(__dirname, '..', '..', 'ui.html'),
  path.resolve(__dirname, '..', '..', 'spec', 'ui.html')
];

async function resolveUrl() {
  const localhost = 'http://localhost:8080/';
  for (const p of builtIndexPaths) {
    if (fs.existsSync(p)) return 'file://' + p.replace(/\\/g, '/');
  }
  const fallback = path.resolve(__dirname, '..', '..', 'ui.html');
  if (fs.existsSync(fallback)) return 'file://' + fallback.replace(/\\/g, '/');
  return localhost;
}

test('debug ship movement - interact and inspect state', async ({ page }) => {
  const logs = [];
  page.on('console', msg => {
    const text = `${msg.type().toUpperCase()}: ${msg.text()}`;
    logs.push(text);
    console.log(text);
  });

  const url = await resolveUrl();
  console.log('Navigating to', url);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => null);
  await page.waitForTimeout(2000);

  const buttonSelectors = ['text=Start', 'text=Play', 'text=Run', 'text=Resume', 'button#start', 'button#play'];
  for (const sel of buttonSelectors) {
    const el = await page.$(sel);
    if (el) {
      console.log('Clicking', sel);
      await el.click().catch(() => null);
      await page.waitForTimeout(300);
    }
  }

  await page.waitForTimeout(3000);

  const state = await page.evaluate(() => {
    const s = window.gameState || window.state || window.simState || null;
    return s ? {
      t: s.t,
      ships: (s.ships || []).slice(0, 20).map(sh => ({ id: sh.id, x: sh.x, y: sh.y, angle: sh.angle }))
    } : null;
  }).catch(() => null);

  let ships = state && state.ships ? state.ships : null;
  if (!ships) {
    ships = await page.$$eval('[data-ship-id]', els => els.slice(0, 20).map(e => ({
      id: e.getAttribute('data-ship-id'),
      x: parseFloat(e.getAttribute('data-ship-x') || 'NaN'),
      y: parseFloat(e.getAttribute('data-ship-y') || 'NaN'),
      angle: parseFloat(e.getAttribute('data-ship-angle') || 'NaN')
    }))).catch(() => null);
  }

  const outDir = path.resolve(process.cwd(), 'playwright-debug');
  try { fs.mkdirSync(outDir, { recursive: true }); } catch (e) {}
  const screenshotPath = path.join(outDir, `ship-debug-${Date.now()}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => null);

  const result = { url, logs, ships, screenshot: screenshotPath };
  try { fs.writeFileSync(path.join(outDir, 'ship-debug.json'), JSON.stringify(result, null, 2)); } catch (e) {}

  expect(result.ships, 'ships present in state').not.toBeNull();
  if (result.ships && result.ships.length > 0) {
    const before = result.ships.map(s => ({ id: s.id, x: s.x, y: s.y }));
    await page.waitForTimeout(1200);
    const after = await page.evaluate(() => {
      const s = window.gameState || window.state || window.simState || null;
      return s ? (s.ships || []).slice(0, 20).map(sh => ({ id: sh.id, x: sh.x, y: sh.y })) : null;
    }).catch(() => null);
    if (after && Array.isArray(after)) {
      let maxDelta = 0;
      for (const b of before) {
        const a = after.find(x => x.id === b.id);
        if (!a) continue;
        const dx = (a.x || 0) - (b.x || 0);
        const dy = (a.y || 0) - (b.y || 0);
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > maxDelta) maxDelta = d;
      }
      console.log('max positional delta after 1.2s =', maxDelta);
      expect(maxDelta, 'ships moved significantly').toBeGreaterThan(0.5);
    } else {
      expect(after, 'able to read ships after wait').not.toBeNull();
    }
  }
});

module.exports = {};
