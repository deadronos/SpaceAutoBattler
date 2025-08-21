import fs from 'fs';
import path from 'path';

export async function capturePageDiagnostics(page, outDir = 'playwright-report/debug-capture') {
  const logs = [];
  const errors = [];
  page.on('console', msg => {
    try {
      const t = msg.type();
      const text = msg.text();
      logs.push(`[${t}] ${text}`);
    } catch (e) { logs.push('[console-error] ' + String(e)); }
  });
  page.on('pageerror', e => { errors.push(String(e)); logs.push('[pageerror] ' + String(e)); });

  // ensure output dir
  fs.mkdirSync(outDir, { recursive: true });
  const outLog = path.join(outDir, 'header-capture.log');
  const outShot = path.join(outDir, 'header-capture.png');

  // Wait for potential renderer hook and call diagnostics
  try {
    await page.waitForFunction(() => typeof window !== 'undefined' && !!window.__getRendererDiagnostics, { timeout: 2000 }).catch(() => {});
    const diag = await page.evaluate(() => { try { return window.__getRendererDiagnostics ? window.__getRendererDiagnostics() : null } catch (e) { return { __diag_err: String(e) } } });
    logs.push('[diag] ' + JSON.stringify(diag));
    try {
      const sample = await page.evaluate(() => { try { return window.__renderer && window.__renderer.sampleGLCenter ? window.__renderer.sampleGLCenter() : null } catch (e) { return { __sample_err: String(e) } } });
      logs.push('[gl-sample] ' + JSON.stringify(sample));
    } catch (e) { logs.push('[gl-sample-call-error] ' + String(e)); }
  } catch (e) {
    logs.push('[diag-call-failed] ' + String(e));
  }

  // sample center pixel of canvas if present
  try {
    const sample = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      if (!c) return { hasCanvas: false };
      const w = c.width || c.clientWidth || 0;
      const h = c.height || c.clientHeight || 0;
      const sx = Math.floor(w/2); const sy = Math.floor(h/2);
      try {
        const t = document.createElement('canvas'); t.width = Math.max(1,w); t.height = Math.max(1,h);
        const ctx = t.getContext('2d'); if (!ctx) return { hasCanvas: true, ctxMissing: true };
        ctx.drawImage(c, 0, 0);
        const d = ctx.getImageData(sx, sy, 1, 1).data; return { hasCanvas: true, sample: [d[0],d[1],d[2],d[3]] };
      } catch (e) { return { hasCanvas: true, sampleError: String(e) }; }
    });
    logs.push('[canvas-sample] ' + JSON.stringify(sample));
  } catch (e) {
    logs.push('[canvas-sample-error] ' + String(e));
  }

  // screenshot
  try {
    const el = await page.$('canvas');
    if (el) await el.screenshot({ path: outShot });
    else await page.screenshot({ path: outShot, fullPage: true });
    logs.push('[screenshot] ' + outShot);
  } catch (e) { logs.push('[screenshot-error] ' + String(e)); }

  // write logs
  try { fs.writeFileSync(outLog, logs.join('\n')); } catch (e) { console.warn('failed to write log', e); }
  return { logs, errors, outLog, outShot };
}

export default { capturePageDiagnostics };
