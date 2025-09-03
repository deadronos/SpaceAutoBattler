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
  // First: attempt to hide any objects that look like they were created by HealthBarInstancer
  try {
    const hideRes = await page.evaluate(() => {
      try {
        const changed = [];
        const scene = window.scene;
        if (!scene) return { ok: false, reason: 'no-scene' };
        scene.traverse(function(o) {
          try {
            const ud = o.userData || {};
            const stack = ud && ud.__hb_early_stack ? String(ud.__hb_early_stack) : '';
            // Hide anything that was added by HealthBarInstancer (or explicitly to healthBarsGroup)
            if (stack && (stack.indexOf('HealthBarInstancer') !== -1 || stack.indexOf('healthBarsGroup.add') !== -1)) {
              if (o.visible !== false) {
                o.visible = false;
                changed.push({ name: o.name || null, type: o.type || null });
              }
            }
          } catch (e) { /* ignore per object */ }
        });
        return { ok: true, changed };
      } catch (e) { return { ok: false, reason: String(e) }; }
    });
    console.log('HIDE_RESULT', JSON.stringify(hideRes));
  } catch (e) {
    console.log('HIDE_FAILED', String(e));
  }

  // Now traverse window.scene and collect objects with HB markers or near y=400 (post-hide)
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
            out.push({ name: o.name || null, type: o.type || null, visible: o.visible !== false, userData: Object.keys(ud||{}), probe: ud.__hb_probe || null, origin: ud.__hb_origin || null, early: ud.__hb_early_stack || null, position: wp });
          }
        } catch (e) { /* ignore per object */ }
      });
      return { ok: true, count: out.length, data: out };
    } catch (e) { return { ok: false, reason: String(e) }; }
  });

  console.log('PROBE_RESULT_AFTER', JSON.stringify(res, null, 2));

  // Save a screenshot for visual verification (post-hide)
  try {
    await page.screenshot({ path: '.tmp/probe_screenshot_after.png', fullPage: true });
    console.log('SCREENSHOT_SAVED .tmp/probe_screenshot_after.png');
  } catch (e) {
    console.log('SCREENSHOT_FAILED', String(e));
  }

  // Additional targeted hide: hide objects whose projected screen position is in the bottom-right corner
  try {
    const hideScreen = await page.evaluate(() => {
      try {
        const changed = [];
        const scene = window.scene;
        const camera = window.state && window.state.renderer && window.state.renderer.camera ? window.state.renderer.camera : window.camera || null;
        if (!scene || !camera || !window.THREE) return { ok: false, reason: 'no-camera-or-three' };
        const vec = new window.THREE.Vector3();
        const width = window.innerWidth || 800;
        const height = window.innerHeight || 600;
        scene.traverse(function(o) {
          try {
            if (typeof o.getWorldPosition !== 'function') return;
            o.getWorldPosition(vec);
            vec.project(camera);
            const sx = (vec.x * 0.5 + 0.5) * width;
            const sy = ( -vec.y * 0.5 + 0.5) * height;
            // bottom-right threshold: within 10% from right and 10% from bottom
            if (sx > width * 0.9 && sy > height * 0.9) {
              if (o.visible !== false) { o.visible = false; changed.push({ name: o.name || null, type: o.type || null, sx, sy }); }
            }
          } catch (e) { /* ignore per object */ }
        });
        return { ok: true, changed };
      } catch (e) { return { ok: false, reason: String(e) }; }
    });
    console.log('HIDE_BY_SCREEN_RESULT', JSON.stringify(hideScreen));
  } catch (e) {
    console.log('HIDE_BY_SCREEN_FAILED', String(e));
  }

  // Save one more screenshot after screen-space hide
  try {
    await page.screenshot({ path: '.tmp/probe_screenshot_after2.png', fullPage: true });
    console.log('SCREENSHOT_SAVED .tmp/probe_screenshot_after2.png');
  } catch (e) {
    console.log('SCREENSHOT_FAILED', String(e));
  }

  await browser.close();
}

run().catch(e => { console.error(e); process.exit(1); });
