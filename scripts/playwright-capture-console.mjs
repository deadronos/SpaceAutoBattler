#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length < 3) {
    console.error('Usage: node scripts/playwright-capture-console.mjs <page.html> <out-console.log> <out-screenshot.png>');
    process.exit(2);
  }
  const [pagePath, outLog, outShot] = argv.map(p => path.resolve(p));
  const url = 'file://' + pagePath;

  const logs = [];
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await context.newPage();

  page.on('console', msg => {
    try {
      const t = msg.type();
      const text = msg.text();
      const location = msg.location && msg.location().url ? `${msg.location().url}:${msg.location().lineNumber || 0}` : '';
      const entry = `[${t}] ${text} ${location}`.trim();
      logs.push(entry);
      // also echo to stdout so CI captures it
      console.log(entry);
    } catch (e) {
      console.log('console handler error', e && e.stack || e);
    }
  });

  page.on('pageerror', err => {
    const entry = `[pageerror] ${err && err.stack ? err.stack : String(err)}`;
    logs.push(entry);
    console.error(entry);
  });

  try {
    await page.goto(url, { waitUntil: 'load', timeout: 10000 });

    // wait for our debug hooks to appear, or time out
    try {
      await page.waitForFunction(() => {
        return typeof window !== 'undefined' && !!window.__getRendererDiagnostics;
      }, { timeout: 3000 });
    } catch (e) {
      logs.push('[warn] renderer diagnostics hook not found on window');
    }

    // try to call the diagnostics hook if present
    try {
      const diag = await page.evaluate(() => {
        try {
          if (window && window.__getRendererDiagnostics) return window.__getRendererDiagnostics();
          return null;
        } catch (e) {
          return { __diag_error: String(e) };
        }
      });
      logs.push('[diag] ' + JSON.stringify(diag));
    } catch (e) {
      logs.push('[diag-call-error] ' + String(e));
    }

    // give the page a moment to run any GL initialization
    await page.waitForTimeout(500);

    // screenshot the canvas if present
    try {
      // also sample a pixel from the canvas to detect if anything was drawn
      const sample = await page.evaluate(() => {
        try {
          const c = document.querySelector('canvas');
          if (!c) return { hasCanvas: false };
          const w = c.width || c.clientWidth || 0;
          const h = c.height || c.clientHeight || 0;
          const sx = Math.floor(w / 2);
          const sy = Math.floor(h / 2);
          const t = document.createElement('canvas');
          t.width = Math.max(1, w);
          t.height = Math.max(1, h);
          const ctx = t.getContext('2d');
          if (!ctx) return { hasCanvas: true, ctxMissing: true };
          ctx.drawImage(c, 0, 0);
          try {
            const d = ctx.getImageData(sx, sy, 1, 1).data;
            return { hasCanvas: true, sample: [d[0], d[1], d[2], d[3]] };
          } catch (e) {
            return { hasCanvas: true, sampleError: String(e) };
          }
        } catch (e) {
          return { error: String(e) };
        }
      });
      logs.push('[canvas-sample] ' + JSON.stringify(sample));

      const shotEl = await page.$('canvas');
      if (shotEl) {
        await shotEl.screenshot({ path: outShot });
        logs.push('[screenshot] saved ' + outShot);
      } else {
        // full page screenshot fallback
        await page.screenshot({ path: outShot, fullPage: true });
        logs.push('[screenshot] fullpage saved ' + outShot);
      }
    } catch (e) {
      logs.push('[screenshot-error] ' + String(e));
    }

  } catch (e) {
    logs.push('[fatal] ' + String(e));
    console.error(e && e.stack || e);
  } finally {
    await browser.close();
    try {
      fs.mkdirSync(path.dirname(outLog), { recursive: true });
      fs.writeFileSync(outLog, logs.join('\n'));
      console.log('Wrote console log to', outLog);
    } catch (e) {
      console.error('Failed to write log', e && e.stack || e);
    }
  }
}

main().catch(err => {
  console.error(err && err.stack || err);
  process.exit(1);
});
