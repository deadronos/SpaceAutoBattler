import { test, expect } from '@playwright/test';
import * as fs from 'fs';

test.use({ viewport: { width: 1280, height: 720 } });

test('bullet visual smoke test - collect state and screenshot', async ({ page }, testInfo) => {
  const logs: string[] = [];
  page.on('console', msg => {
    try { logs.push(`${msg.type()}: ${msg.text()}`); } catch (e) { void e; }
  });

  // Load the running app (user-provided server) and wait for initial load
  await page.goto('http://localhost:8080/spaceautobattler.html', { waitUntil: 'load' });
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
  const result = await page.evaluate(() => {
    const candidates = ['state', '__GAME_STATE__', 'gameState', 'appState'];
    for (const k of candidates) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const val = (window as any)[k];
      if (val && Array.isArray(val.bullets)) {
        try {
          return {
            foundKey: k,
            bullets: val.bullets.length,
            sample: val.bullets.slice(0, 8).map((b: any) => ({ id: b.id, ownerTeam: b.ownerTeam, pos: b.pos }))
          };
        } catch (e) {
          return { foundKey: k, bullets: 'error' };
        }
      }
    }
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

  expect(result).toBeDefined();
});
