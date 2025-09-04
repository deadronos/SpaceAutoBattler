(async()=>{
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:8080/dist/spaceautobattler_standalone.html', { waitUntil: 'load', timeout: 20000 });
    // wait for possible helper injection
    await page.waitForTimeout(2000);

    const hasHelper = await page.evaluate(() => !!globalThis.__listInstancedHealthBarShips);
    console.log('helper present=', hasHelper);
    if (!hasHelper) {
      await page.waitForTimeout(3000);
    }

    const ids = await page.evaluate(() => {
      try {
        return globalThis.__listInstancedHealthBarShips ? globalThis.__listInstancedHealthBarShips().slice(0, 50) : [];
      } catch (e) {
        return { err: String(e) };
      }
    });
    console.log('ids=', JSON.stringify(ids));

    const matrices = await page.evaluate((ids) => {
      try {
        const out = [];
        const idsArr = Array.isArray(ids) ? ids : [];
        for (let i = 0; i < idsArr.length; i++) {
          const id = idsArr[i];
          const mat = globalThis.__hbDebugMatrix ? globalThis.__hbDebugMatrix(id) : null;
          out.push({ id, mat });
        }
        // compute simple extrema
        const vals = { count: out.length, xMin: Infinity, xMax: -Infinity, yMin: Infinity, yMax: -Infinity, zMin: Infinity, zMax: -Infinity };
        out.forEach((e) => {
          if (!e.mat || !e.mat.position) return;
          const p = e.mat.position;
          if (p.x < vals.xMin) vals.xMin = p.x;
          if (p.x > vals.xMax) vals.xMax = p.x;
          if (p.y < vals.yMin) vals.yMin = p.y;
          if (p.y > vals.yMax) vals.yMax = p.y;
          if (p.z < vals.zMin) vals.zMin = p.z;
          if (p.z > vals.zMax) vals.zMax = p.z;
        });
        return { out, extrema: vals };
      } catch (e) {
        return { err: String(e) };
      }
    }, ids);

    console.log('mats count=', matrices && matrices.out ? matrices.out.length : 0);
    console.log('extrema=', JSON.stringify(matrices && matrices.extrema ? matrices.extrema : null, null, 2));
    // Use renderer-side helper to add and remove a visible marker for the first instanced id
    try {
      const firstId = (ids && Array.isArray(ids) && ids.length > 0) ? ids[0] : null;
      if (firstId != null) {
        const addRes = await page.evaluate((id) => {
          try { return globalThis.__hbAddMarker ? globalThis.__hbAddMarker(id) : { ok: false, reason: 'no-helper' }; } catch (e) { return { ok: false, reason: String(e) }; }
        }, firstId);
        console.log('hbAddMarker result=', JSON.stringify(addRes));
        // wait a bit for render
        await page.waitForTimeout(800);
        // capture screenshot of the canvas area
        try {
          await page.screenshot({ path: '.tmp/marker.png', fullPage: false });
          console.log('screenshot saved to .tmp/marker.png');
        } catch (e) { console.log('screenshot failed', String(e)); }

        const removeRes = await page.evaluate((id) => {
          try { return globalThis.__hbRemoveMarker ? globalThis.__hbRemoveMarker(id) : { ok: false, reason: 'no-helper' }; } catch (e) { return { ok: false, reason: String(e) }; }
        }, firstId);
        console.log('hbRemoveMarker result=', JSON.stringify(removeRes));
      }
    } catch (e) {
      console.log('marker helper call failed', String(e));
    }

    // Focus camera roughly on the max-X extrema so we can zoom into the corner and recapture
    try {
      const extrema = matrices && matrices.extrema ? matrices.extrema : null;
      if (extrema) {
        const focusPos = { x: extrema.xMax, y: (extrema.yMin + extrema.yMax) / 2 || 375, z: (extrema.zMin + extrema.zMax) / 2 };
        const focusRes = await page.evaluate((pos) => {
          try { return globalThis.__focusCameraOn ? globalThis.__focusCameraOn(pos, 400) : { ok: false, reason: 'no-focus' }; } catch (e) { return { ok: false, reason: String(e) }; }
        }, focusPos);
        console.log('focusRes=', JSON.stringify(focusRes));
        await page.waitForTimeout(1200);
        try {
          await page.screenshot({ path: '.tmp/marker_focus.png', fullPage: false });
          console.log('focused screenshot saved to .tmp/marker_focus.png');
        } catch (e) { console.log('focused screenshot failed', String(e)); }
      }
    } catch (e) { /* ignore */ }
    await browser.close();
  } catch (err) {
    console.error('error', err);
    try { await browser.close(); } catch (e) {}
    process.exit(1);
  }
})();
