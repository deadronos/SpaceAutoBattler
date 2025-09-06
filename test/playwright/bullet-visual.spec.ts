import { test, expect } from '@playwright/test';
import * as fs from 'fs';

test.use({ viewport: { width: 1280, height: 720 } });

test('bullet visual smoke test - collect state and screenshot', async ({ page }, testInfo) => {
  const logs: string[] = [];
  page.on('console', msg => {
    try { logs.push(`${msg.type()}: ${msg.text()}`); } catch (e) { void e; }
  });

  // Load the running app (user-provided server) and wait for initial load
  // Load with debugState flag so the renderer may expose a safe snapshot accessor
  await page.goto('http://localhost:8080/spaceautobattler.html?debugState=1', { waitUntil: 'load' });
  // Click Start so the simulation begins
  const start = await page.locator('#startPause');
  if (await start.count() > 0) {
    await start.click();
  }
  // Increase speed control if available (click the speed div to toggle)
  const speed = await page.locator('#speed');
  if (await speed.count() > 0) {
    // Click twice to accelerate simulation
    await speed.click();
    await page.waitForTimeout(100);
    await speed.click();
  }
  await page.waitForTimeout(2000);

  // Evaluate possible global GameState exposures
  // If the guarded debug accessor exists, call it to get a safe snapshot for inspection
  const result = await page.evaluate(() => {
    try {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const dbg = (window as any).__GAME_STATE__;
      if (dbg && typeof dbg.getSnapshot === 'function') {
        try {
          const snap = dbg.getSnapshot();
          return { foundKey: '__GAME_STATE__', snapshot: snap };
        } catch (e) { return { foundKey: '__GAME_STATE__', error: String(e) }; }
      }
    } catch (e) { void e; }
    return { foundKey: null };
  });

  // Ensure output dir exists and write artifacts
  const outDir = 'test-output';
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(`${outDir}/console.log`, logs.join('\n'));
  const shotPath = `${outDir}/bullet-visual.png`;
  await page.screenshot({ path: shotPath, fullPage: false });

  // Attach small artifacts to the test report
  try { testInfo.attach('console', { body: logs.join('\n') }); } catch (e) { void e; }
  try { testInfo.attach('screenshot', { path: shotPath }); } catch (e) { void e; }

  console.log('EVAL_RESULT:', JSON.stringify(result));
  // If the guarded debug accessor returned a snapshot, save it and scan for
  // any non-finite coordinates (Number.isFinite). If any are found, fail
  // the test and write a small report listing offending ids.
  if (result && result.snapshot) {
    const snap = result.snapshot as unknown;
    fs.writeFileSync(`${outDir}/state-snapshot.json`, JSON.stringify(snap, null, 2));

    const offendingShips: Array<{ id: string | number | null; issues: string[] }> = [];
    const offendingBullets: Array<{ id: string | number | null; issues: string[] }> = [];

    function isVec3(v: unknown): v is { x: number; y: number; z: number } {
      if (!v || typeof v !== 'object') return false;
      const o = v as Record<string, unknown>;
      return 'x' in o && 'y' in o && 'z' in o && typeof o.x === 'number' && typeof o.y === 'number' && typeof o.z === 'number';
    }

    function safeGet(obj: unknown, key: string) {
      if (!obj || typeof obj !== 'object') return undefined;
      return (obj as Record<string, unknown>)[key];
    }

  function checkFiniteCoord(id: string | number | null, obj: unknown, fields: string[], collector: Array<{ id: string | number | null; issues: string[] }>) {
      const issues: string[] = [];
      for (const f of fields) {
        const v = safeGet(obj, f);
        if (isVec3(v)) {
          const { x, y, z } = v;
          if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
            issues.push(`${f} has non-finite component(s): x=${x},y=${y},z=${z}`);
          }
        } else if (typeof v === 'number') {
          if (!Number.isFinite(v)) issues.push(`${f} is non-finite: ${v}`);
        }
      }
      if (issues.length) collector.push({ id, issues });
    }

    const snapObj = snap as Record<string, unknown>;
    const shipsRaw = Array.isArray(snapObj.ships) ? snapObj.ships : [];
    for (const s of shipsRaw) {
      const id = (s && (s as Record<string, unknown>).id) ?? null;
      checkFiniteCoord(id, s, ['pos'], offendingShips);
    }

    const bulletsRaw = Array.isArray(snapObj.bullets) ? snapObj.bullets : [];
    for (const b of bulletsRaw) {
  const id = (b && (b as Record<string, unknown>).id) ?? null;
      checkFiniteCoord(id, b, ['pos', 'vel'], offendingBullets);
    }

    const report = {
      timestamp: new Date().toISOString(),
      offendingShips,
      offendingBullets,
    };
    fs.writeFileSync(`${outDir}/state-snapshot-report.json`, JSON.stringify(report, null, 2));
    try { testInfo.attach('state-snapshot', { body: JSON.stringify(snap) }); } catch (e) { void e; }
    try { testInfo.attach('state-snapshot-report', { body: JSON.stringify(report) }); } catch (e) { void e; }

    const totalOffenders = offendingShips.length + offendingBullets.length;
    if (totalOffenders > 0) {
      throw new Error(`Non-finite coordinates detected: ${totalOffenders} total. See ${outDir}/state-snapshot-report.json for details.`);
    }
  } else {
    console.log('No snapshot available from __GAME_STATE__.');
  }

  expect(result).toBeDefined();
});
