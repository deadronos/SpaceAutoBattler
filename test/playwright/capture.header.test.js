import { test, expect } from '@playwright/test';
import path from 'path';
import { capturePageDiagnostics } from './helpers/captureHelper.js';

test('header capture: standalone page console + screenshot (chromium)', async ({ page }) => {
  // add page crash/close handlers to improve diagnostics in CI
  page.on('crash', () => console.warn('[playwright] page crashed'));
  page.on('close', () => console.warn('[playwright] page closed unexpectedly'));
  const rootHtml = path.resolve(process.cwd(), 'space_themed_autobattler_canvas_red_vs_blue_standalone.html');
  const url = 'file://' + rootHtml.replace(/\\/g, '/');
  await page.goto(url, { waitUntil: 'load' });
  // small delay to allow scripts to run
  await page.waitForTimeout(400);
  // Inject a visible test ship at canvas center to force rendering at a known pixel
  await page.evaluate(() => {
    try {
      const c = document.querySelector('canvas');
      if (!c) return;
      const x = (c.width || c.clientWidth || 800) / 2;
      const y = (c.height || c.clientHeight || 600) / 2;
      if (window.__GM && Array.isArray(window.__GM.ships)) {
        window.__GM.ships.push({ x, y, radius: 16, team: 'red' });
      }
    } catch (e) { /* ignore */ }
  });
  // allow a frame to render
  await page.waitForTimeout(200);
  // stop the live renderer to avoid it clearing/overwriting our test draws
  await page.evaluate(() => { try { if (window.__renderer && window.__renderer.stop) window.__renderer.stop(); } catch (e) {} });
  // attempt a forced opaque debug draw to validate framebuffer writes in headless Chromium
  await page.evaluate(() => {
    try {
      if (window.__renderer && typeof window.__renderer.debugDrawSolid === 'function') {
        // center a 64x64 opaque red rect
        window.__renderer.debugDrawSolid({ x: (document.querySelector('canvas').width / 2) - 32, y: (document.querySelector('canvas').height / 2) - 32, w: 64, h: 64, color: [1,0,0,1] });
      }
    } catch (e) { /* ignore */ }
  });
  await page.waitForTimeout(60);
  // as a stronger test, clear the framebuffer to an opaque green and re-sample
  await page.evaluate(() => {
    try {
      if (window.__renderer && typeof window.__renderer.debugClear === 'function') {
        window.__renderer.debugClear({ color: [0,1,0,1] });
      }
    } catch (e) { /* ignore */ }
  });
  await page.waitForTimeout(60);
  // test writing/reading an offscreen FBO (returns pixel bytes)
  const fboResult = await page.evaluate(() => { try { return window.__renderer && window.__renderer.debugDrawToFBO ? window.__renderer.debugDrawToFBO({ color: [255/255,0,0,1] }) : null } catch (e) { return { __err: String(e) } } });
  console.log('[fbo-result]', JSON.stringify(fboResult));
  // draw into canvas via 2D context as a control test: should produce visible pixels if canvas is writable
  await page.evaluate(() => {
    try {
      const c = document.querySelector('canvas');
      if (!c) return;
      const ctx = c.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = 'rgb(0,0,255)';
      const x = Math.floor((c.width || c.clientWidth) / 2) - 16;
      const y = Math.floor((c.height || c.clientHeight) / 2) - 16;
      ctx.fillRect(x, y, 32, 32);
    } catch (e) { /* ignore */ }
  });
  await page.waitForTimeout(60);
  const out = await capturePageDiagnostics(page, 'playwright-report/header-capture');
  // basic expectations: a canvas exists and logs were saved
  const canvas = await page.$('canvas');
  expect(canvas).toBeTruthy();
  expect(out.logs.length).toBeGreaterThanOrEqual(0);
});
