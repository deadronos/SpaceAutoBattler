#!/usr/bin/env node
import { chromium } from 'playwright';

async function run() {
  const url = process.env.STANDALONE_URL || 'http://127.0.0.1:8080/dist/spaceautobattler_standalone.html';
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', msg => console.log('[PAGE]', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('[PAGEERROR]', String(err)));

  console.log('Opening', url);
  await page.goto(url, { waitUntil: 'load', timeout: 20000 }).catch(e => { console.error('goto failed', e && e.message); });
  await page.waitForTimeout(3000);

  // Directly traverse window.scene and collect objects with HB markers or near y=400
  const res = await page.evaluate(() => {
    try {
      const out = [];
      const scene = window.scene;
      if (!scene) return { ok: false, reason: 'no-scene' };
      scene.traverse(function(o) {
        try {
          const ud = o.userData || {};
          // compute world position if possible
          var wp = { x: null, y: null, z: null };
          try { var v = new window.THREE.Vector3(); if (o.getWorldPosition) { o.getWorldPosition(v); wp = { x: v.x, y: v.y, z: v.z }; } } catch (e) { /* ignore */ }
          var matches = !!(ud && (ud.__hb_probe || ud.__hb_origin || ud.__hb_early_stack || ud.__hb_marker_for));
          var nearFleetY = wp.y !== null && Math.abs(wp.y - 400) < 0.001;
          if (matches || nearFleetY) {
            out.push({ name: o.name || null, type: o.type || null, userData: Object.keys(ud||{}), probe: ud.__hb_probe || null, origin: ud.__hb_origin || null, early: ud.__hb_early_stack || null, position: wp });
          }
        } catch (e) { /* ignore per object */ }
      });
      return { ok: true, count: out.length, data: out };
    } catch (e) { return { ok: false, reason: String(e) }; }
  });

  console.log('PROBE_RESULT', JSON.stringify(res, null, 2));

  // Save a screenshot for visual verification
  try {
    await page.screenshot({ path: '.tmp/probe_screenshot.png', fullPage: true });
    console.log('SCREENSHOT_SAVED .tmp/probe_screenshot.png');
  } catch (e) {
    console.log('SCREENSHOT_FAILED', String(e));
  }

  await browser.close();
}

run().catch(e => { console.error(e); process.exit(1); });
