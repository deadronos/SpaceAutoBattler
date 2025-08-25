const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const { exec } = require('child_process');
const { spawn } = require('child_process');
const util = require('util');
const execP = util.promisify(exec);

// Target file to open on the server (built file lives in /dist)
const SERVER_URL = 'http://localhost:8080/dist/spaceautobattler_standalone.html';

async function killProcessOnPortWindows(port = 8080) {
  try {
    // netstat output includes PID as last column
    const { stdout } = await execP(`netstat -ano | findstr :${port}`);
    if (!stdout) return [];
    const lines = stdout.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const pids = [...new Set(lines.map(l => l.split(/\s+/).pop()))];
    for (const pid of pids) {
      try { await execP(`taskkill /PID ${pid} /F`); } catch (e) { /* ignore individual fail */ }
    }
    return pids;
  } catch (e) {
    return [];
  }
}

async function waitForServer(url, timeout = 15000, interval = 500) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(url, { method: 'GET' });
      if (res && res.status && res.status < 400) return true;
    } catch (e) {}
    await new Promise(r => setTimeout(r, interval));
  }
  return false;
}

test('debug ship movement - interact and inspect state', async ({ page }) => {
  test.setTimeout(120000); // allow time for build + serve
  // 1) Run build steps
  try {
    console.log('Running: npm run build');
    await execP('npm run build', { maxBuffer: 1024 * 1024 * 10 });
  } catch (e) {
    console.warn('npm run build failed or was skipped:', e && e.message ? e.message : e);
  }
  try {
    console.log('Running: npm run build-standalone');
    await execP('npm run build-standalone', { maxBuffer: 1024 * 1024 * 10 });
  } catch (e) {
    console.warn('npm run build-standalone failed or was skipped:', e && e.message ? e.message : e);
  }

  // 2) Kill any existing server on port 8080 (Windows)
  try {
    const killed = await killProcessOnPortWindows(8080);
    if (killed && killed.length) console.log('Killed processes on port 8080:', killed.join(', '));
  } catch (e) {
    console.warn('Error killing existing processes on port 8080:', e && e.message ? e.message : e);
  }

  // 3) Start npm run serve:dist in background
  console.log('Starting: npm run serve:dist');
  const server = spawn('npm', ['run', 'serve:dist'], { shell: true, detached: true, stdio: 'ignore' });
  let serverPid = server && server.pid ? server.pid : null;
  if (serverPid) console.log('Spawned server PID', serverPid);
  // Detach so it stays alive independently; we will kill it explicitly later
  try { server.unref(); } catch (e) {}

  // 4) Wait for server to be ready by polling the target URL
  // Allow more time for the static server to start
  const serverReady = await waitForServer(SERVER_URL, 30000, 500);
  if (!serverReady) {
    // If server failed to start within timeout, attempt to kill spawned process and fail
    if (serverPid) {
      try { await execP(`taskkill /PID ${serverPid} /F`); } catch (e) {}
    }
    throw new Error('Server did not become ready in time: ' + SERVER_URL);
  }

  // Now navigate the page to the server URL
  const logs = [];
  page.on('console', msg => {
    const text = `${msg.type().toUpperCase()}: ${msg.text()}`;
    logs.push(text);
    console.log(text);
  });

  // Capture page-level errors and network failures to the logs array
  page.on('pageerror', err => {
    const entry = { type: 'pageerror', message: err && err.message ? err.message : String(err), stack: err && err.stack ? err.stack : undefined, time: Date.now() };
    logs.push(entry);
    console.error('PAGEERROR:', entry);
  });

  page.on('requestfailed', req => {
    try {
      const f = req.failure ? req.failure() : null;
      const entry = { type: 'requestfailed', url: req.url(), method: req.method(), failure: f && f.errorText ? f.errorText : (f || null), time: Date.now() };
      logs.push(entry);
      console.warn('REQUESTFAILED:', entry);
    } catch (e) { /* ignore */ }
  });

  page.on('response', res => {
    try {
      const status = res.status();
      if (status >= 400) {
        const entry = { type: 'response', url: res.url(), status, statusText: res.statusText(), time: Date.now() };
        logs.push(entry);
        console.warn('RESPONSE ERROR:', entry);
      }
    } catch (e) { /* ignore */ }
  });

  page.on('requestfinished', req => {
    try {
      const entry = { type: 'requestfinished', url: req.url(), method: req.method(), time: Date.now() };
      logs.push(entry);
    } catch (e) { /* ignore */ }
  });

  const url = SERVER_URL;
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

  // Ensure there are ships: ask the game manager to form initial fleets if available
  try {
    // wait up to 3s for window.gm to be available
    await page.waitForFunction(() => !!(window.gm), { timeout: 3000 }).catch(() => null);
    const gmInfo = await page.evaluate(() => {
      try {
        const gm = window.gm;
        if (!gm) return { present: false };
        const keys = Object.keys(gm || {});
        const hasForm = typeof gm.formFleets === 'function';
        const hasSnapshot = typeof gm.snapshot === 'function';
        const hasInternal = !!gm._internal;
        // try to read ships from common places
        const shipsA = gm._internal && gm._internal.state && Array.isArray(gm._internal.state.ships) ? gm._internal.state.ships.slice(0, 50).map(s => ({ id: s.id, x: s.x, y: s.y })) : null;
        const shipsB = typeof gm.snapshot === 'function' ? (gm.snapshot().ships || []).slice(0, 50).map(s => ({ id: s.id, x: s.x, y: s.y })) : null;
        return { present: true, keys, hasForm, hasSnapshot, hasInternal, shipsA, shipsB };
      } catch (e) { return { error: String(e) }; }
    });
    console.log('gmInfo:', JSON.stringify(gmInfo));
    // call formFleets if available
    if (gmInfo && gmInfo.hasForm) {
      // Prevent auto reinforcements and continuous simulation while forming fleets for deterministic snapshot
      try {
        await page.evaluate(() => {
          try { if (window.gm && typeof window.gm.setReinforcementInterval === 'function') window.gm.setReinforcementInterval(1e9); } catch (e) {}
          try { if (window.gm && typeof window.gm.setContinuousEnabled === 'function') window.gm.setContinuousEnabled(false); } catch (e) {}
        });
      } catch (e) {}
      await page.evaluate(() => { try { window.gm.formFleets(); } catch (e) {} });
      await page.waitForTimeout(200);
    }
  } catch (e) {}

  // Also click the UI Add Red/Add Blue buttons if present to ensure ships exist
  const addButtons = ['button#addRed', 'button#addBlue', 'text=+ Red', 'text=+ Blue'];
  for (const sel of addButtons) {
    const el = await page.$(sel);
    if (el) {
      try { await el.click(); } catch (e) {}
      await page.waitForTimeout(200);
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
  // enrich result with gm diagnostics
  try {
    const gmDiagnostics = await page.evaluate(() => {
      try {
        const gm = window.gm;
        if (!gm) return { present: false };
        const out = { present: true };
        try { out.keys = Object.keys(gm); } catch (e) { out.keysError = String(e); }
        try { out.ships_internal = gm._internal && gm._internal.state && Array.isArray(gm._internal.state.ships) ? gm._internal.state.ships.slice(0, 50).map(s => ({ id: s.id, x: s.x, y: s.y })) : null; } catch (e) { out.ships_internal_error = String(e); }
        try { out.ships_snapshot = typeof gm.snapshot === 'function' ? (gm.snapshot().ships || []).slice(0, 50).map(s => ({ id: s.id, x: s.x, y: s.y })) : null; } catch (e) { out.ships_snapshot_error = String(e); }
        try { out.getLastReinforcement = typeof gm.getLastReinforcement === 'function' ? gm.getLastReinforcement() : null; } catch (e) { out.getLastReinforcement_error = String(e); }
        return out;
      } catch (e) { return { error: String(e) }; }
    });
    result.gm = gmDiagnostics;
    // If ships not found earlier, prefer snapshot ships
    if ((!result.ships || result.ships.length === 0) && gmDiagnostics && Array.isArray(gmDiagnostics.ships_snapshot) && gmDiagnostics.ships_snapshot.length) {
      result.ships = gmDiagnostics.ships_snapshot;
    }
    // If we still have no ships, spawn a few programmatically to ensure movement checks run
    if ((!result.ships || result.ships.length === 0) && (typeof window !== 'undefined')) {
      try {
        await page.evaluate(() => {
          try {
            if (window.gm && typeof window.gm.spawnShip === 'function') {
              window.gm.spawnShip('red');
              window.gm.spawnShip('blue');
              window.gm.spawnShip('red');
              window.gm.spawnShip('blue');
            }
          } catch (e) {}
        });
        await page.waitForTimeout(200);
        const refreshed = await page.evaluate(() => {
          try { return window.gm && typeof window.gm.snapshot === 'function' ? (window.gm.snapshot().ships || []).slice(0, 500).map(s => ({ id: s.id, x: s.x, y: s.y })) : null; } catch (e) { return null; }
        });
        if (Array.isArray(refreshed) && refreshed.length) {
          result.ships = refreshed;
          result.gm.ships_snapshot_after_spawn = refreshed.slice(0, 20);
        }
      } catch (e) {}
    }
    // Advance simulation using gm.stepOnce a few times to see movement, then collect another snapshot
    try {
      const beforeSnap = await page.evaluate(() => {
        try { return window.gm && typeof window.gm.snapshot === 'function' ? (window.gm.snapshot().ships || []).slice(0, 500).map(s => ({ id: s.id, x: s.x, y: s.y })) : null; } catch (e) { return null; }
      });
      // Simulate multiple step batch sizes to detect slow movement over time
      const stepBatches = [6, 60, 300];
      const movementBySteps = {};
      // Keep an immutable baseline snapshot to compare against for each batch
      const baseline = Array.isArray(beforeSnap) ? beforeSnap : [];
      for (const count of stepBatches) {
        // run `count` small steps of dt=0.02
        await page.evaluate((cnt) => {
          try {
            for (let i = 0; i < cnt; i++) {
              try { window.gm.stepOnce && window.gm.stepOnce(0.02); } catch (e) {}
            }
          } catch (e) {}
        }, count);
        // small settle time for any async internal updates
        await page.waitForTimeout(150);
        const after = await page.evaluate(() => {
          try { return window.gm && typeof window.gm.snapshot === 'function' ? (window.gm.snapshot().ships || []).slice(0, 500).map(s => ({ id: s.id, x: s.x, y: s.y })) : null; } catch (e) { return null; }
        });
        // compute max delta compared to baseline
        let maxDelta = 0;
        if (Array.isArray(baseline) && Array.isArray(after)) {
          for (const b of baseline) {
            const a = after.find(x => x.id === b.id);
            if (!a) continue;
            const dx = (a.x || 0) - (b.x || 0);
            const dy = (a.y || 0) - (b.y || 0);
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d > maxDelta) maxDelta = d;
          }
        }
        movementBySteps[count] = { maxDelta, beforeCount: Array.isArray(baseline) ? baseline.length : 0, afterCount: Array.isArray(after) ? after.length : 0 };
        // also record last after snapshot for inspection
        result.gm = result.gm || {};
        result.gm[`after_${count}`] = after;
      }
      result.gm.beforeStepOnce = beforeSnap;
      result.gm.movementBySteps = movementBySteps;
    } catch (e) {
      result.gm.stepError = String(e);
    }
  } catch (e) { result.gm_error = String(e); }
  try { fs.writeFileSync(path.join(outDir, 'ship-debug.json'), JSON.stringify(result, null, 2)); } catch (e) {}

  // Instead of failing the test on missing DOM-based state, compute movement
  // diagnostics from gm snapshots (if available) and write them to the result.
  try {
    const before = result.gm && result.gm.beforeStepOnce ? result.gm.beforeStepOnce : (result.ships || []);
    const after = result.gm && result.gm.afterStepOnce ? result.gm.afterStepOnce : null;
    let maxDelta = null;
    if (before && after && Array.isArray(before) && Array.isArray(after)) {
      maxDelta = 0;
      for (const b of before) {
        const a = after.find(x => x.id === b.id);
        if (!a) continue;
        const dx = (a.x || 0) - (b.x || 0);
        const dy = (a.y || 0) - (b.y || 0);
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > maxDelta) maxDelta = d;
      }
    }
    result.gm = result.gm || {};
    result.gm.movementMaxDelta = maxDelta;
    console.log('Recorded movement max delta:', maxDelta);
  } catch (e) {
    result.gm = result.gm || {};
    result.gm.movementError = String(e);
  }

  // Cleanup: kill the server we started earlier
  if (serverPid) {
    try {
      console.log('Stopping server PID', serverPid);
      await execP(`taskkill /PID ${serverPid} /F`);
    } catch (e) {
      console.warn('Failed to kill server PID', serverPid, e && e.message ? e.message : e);
    }
  }
});

module.exports = {};
