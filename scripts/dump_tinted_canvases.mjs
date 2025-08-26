import { chromium } from 'playwright';
import fs from 'fs';

async function run(){
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const url = 'http://127.0.0.1:8080/dist/spaceautobattler_standalone.html';
  console.log('navigating to', url);
  await page.goto(url, { waitUntil: 'load', timeout: 15000 });
  await page.waitForTimeout(500);
  const keys = await page.evaluate(() => {
    try { const r = window.__renderer; if(!r) return { error: 'no_renderer' }; return { keys: Array.from((r._tintedHullCache && r._tintedHullCache.keys && r._tintedHullCache.keys()) || []) }; } catch(e){ return { error: String(e) }; }
  });
  console.log('tinted keys:', keys);
  if(keys && keys.keys && Array.isArray(keys.keys)){
    const outDir = '.playwright-mcp';
    try{ if(!fs.existsSync(outDir)) fs.mkdirSync(outDir); }catch(e){}
    for(const k of keys.keys){
      try{
        const data = await page.evaluate((key) => {
          try{
            const r = window.__renderer;
            if(!r) return { key, error: 'no_renderer' };
            const c = r._tintedHullCache.get(key);
            if(!c) return { key, error: 'no_canvas' };
            try{ const d = c.toDataURL('image/png'); return { key, data: d }; } catch(e){ return { key, error: String(e) }; }
          }catch(e){ return { key, error: String(e) }; }
        }, k);
        if(data && data.data){
          const base = data.data.replace(/^data:image\/png;base64,/, '');
          const fname = `.playwright-mcp/tinted_${k.replace(/[:#]/g, '_')}.png`;
          fs.writeFileSync(fname, Buffer.from(base, 'base64'));
          console.log('wrote', fname);
        } else {
          console.log('no data for', k, data && data.error);
        }
      }catch(e){ console.log('failed to dump', k, e); }
    }
  }
  await browser.close();
}
run().catch(e=>{ console.error('dump failed', e); process.exit(1); });
