// @ts-nocheck - test harness file: skip strict TS checks to avoid conflicting global test types during webpack build
import { test, expect } from '@playwright/test';
import fs from 'fs';

const URL = 'http://127.0.0.1:8080/spaceautobattler.html?simDebug=1';

test.describe('Fire Intent visual debug', () => {
  test('loads page and shows AI debug logs and bullets', async ({ page }: any) => {
    const logs: string[] = [];
    page.on('console', (msg) => {
      try {
        logs.push(`${msg.type()}: ${msg.text()}`);
      } catch {}
    });

    // Inject a capture script early so we can record worker messages posted to window
    await page.addInitScript(() => {
      try {
        (window as any).__test_worker_messages = [];
        window.addEventListener('message', (e) => {
          try {
            (window as any).__test_worker_messages.push(e.data);
          } catch {}
        });
      } catch {}
    });

    await page.goto(URL);
    // wait a bit longer for simulation to warm up and for worker AI steps
    await page.waitForTimeout(8000);

    // take screenshot for visual inspection
    await page.screenshot({ path: 'tmp/fire-intent-screenshot.png', fullPage: true });

    // Look for our debug markers
    const applied = logs.find((l) => l.includes('DEBUG: Applied AI to ship'));
    const fireIntent = logs.find((l) => l.includes('DEBUG: Processing fireIntentBuffer'));
    const fallback = logs.find((l) => l.includes('DEBUG: No fireIntentBuffer'));
    const firing = logs.find((l) => l.includes('DEBUG: Firing from turret'));

    console.log('Collected console logs count:', logs.length);
    // Persist logs and runtime snapshot for offline inspection
    try {
      fs.mkdirSync('tmp', { recursive: true });
      fs.writeFileSync('tmp/fire-intent-logs.txt', logs.join('\n'));
      // capture runtime snapshot from page
      const snap = await page.evaluate(() => {
        try {
          const w = window as any;
          return {
            hasSimWorker: !!w.__simWorker,
            workerMessages: w.__test_worker_messages || [],
            ships: w.__gameState?.ships?.length ?? null,
            bullets: w.__gameState?.bullets?.length ?? null,
            lastTime: w.__gameState?.time ?? null,
          };
        } catch (e) {
          return { error: String(e) };
        }
      });
      fs.writeFileSync('tmp/fire-intent-snapshot.json', JSON.stringify(snap, null, 2));
    } catch (e) {
      console.warn('Failed to write logs:', e);
    }

    expect(applied || fireIntent || fallback).toBeTruthy();
    // Expect at least one firing debug entry eventually
    expect(firing).toBeTruthy();
  }, 20000);
});
