import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', (msg) => {
    try { console.log('[page]', msg.type(), msg.text()); } catch (e) {}
  });
  page.on('requestfailed', (req) => console.log('[requestfailed]', req.url(), req.failure && req.failure().errorText));
  page.on('requestfinished', (req) => console.log('[requestfinished]', req.url()));
  page.on('pageerror', (err) => console.log('[pageerror]', err && err.stack ? err.stack : String(err)));

  const url = 'http://127.0.0.1:8080/src/ui.html';
  console.log('navigating to', url);
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
  } catch (e) {
    console.error('goto failed', e);
    await browser.close();
    process.exit(2);
  }

  // wait a bit for scripts to run
  await page.waitForTimeout(500);

  const statsExists = await page.evaluate(() => !!document.querySelector('#stats'));
  console.log('statsExists=', statsExists);
  const statsText = await page.evaluate(() => { const el = document.querySelector('#stats'); return el ? el.innerText : null; });
  console.log('statsText:', JSON.stringify(statsText));

  // wait up to 3s for window.gm to be initialized by the page
  const hasGm = await page.evaluate(() => {
    return new Promise((resolve) => {
      const start = Date.now();
      (function check() {
        if (window.gm) return resolve(true);
        if (Date.now() - start > 3000) return resolve(false);
        setTimeout(check, 50);
      }());
    });
  });
  console.log('window.gm exists=', hasGm);

    if (hasGm) {
      const gmInfo = await page.evaluate(() => {
        try {
          const gm = window.gm;
          return { isWorker: typeof gm.isWorker === 'function' ? gm.isWorker() : null, hasStepOnce: typeof gm.stepOnce === 'function', keys: Object.keys(gm || {}) };
        } catch (e) { return { error: String(e) }; }
      });
      console.log('gmInfo=', gmInfo);
      try {
        console.log('invoking gm.setContinuousEnabled(true), setReinforcementInterval(0.01), stepOnce(0.02)');
        await page.evaluate(() => {
          try { window.gm.setContinuousEnabled && window.gm.setContinuousEnabled(true); } catch (e) { console.error('gm.setContinuousEnabled error', String(e)); }
          try { window.gm.setReinforcementInterval && window.gm.setReinforcementInterval(0.01); } catch (e) { console.error('gm.setReinforcementInterval error', String(e)); }
          try { window.gm.stepOnce && window.gm.stepOnce(0.02); } catch (e) { console.error('gm.stepOnce error', String(e)); }
        });
        await page.waitForTimeout(300);
        const statsAfter = await page.evaluate(() => { const el = document.querySelector('#stats'); return el ? el.innerText : null; });
        const lastReinf = await page.evaluate(() => { try { return window.gm && typeof window.gm.getLastReinforcement === 'function' ? window.gm.getLastReinforcement() : null; } catch (e) { return { error: String(e) }; } });
        console.log('statsAfter:', JSON.stringify(statsAfter));
        console.log('lastReinforcement:', JSON.stringify(lastReinf));
      } catch (e) { console.log('gm invocation error', e); }
    }

  await browser.close();
}

run().catch(e => { console.error(e); process.exit(1); });
