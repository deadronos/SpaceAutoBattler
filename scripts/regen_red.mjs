import { chromium } from 'playwright';
import fs from 'fs';

async function run(){
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', msg => { try { console.log('[page]', msg.type(), msg.text()); } catch (e) {} });
  const url = 'http://127.0.0.1:8080/dist/spaceautobattler_standalone.html';
  console.log('navigating to', url);
  await page.goto(url, { waitUntil: 'load', timeout: 15000 });
  await page.waitForTimeout(500);
  // remove placeholder red tinted canvas
  await page.evaluate(() => {
    try{
      const r = window.__renderer;
      if(!r) return { error: 'no_renderer' };
      const key = 'carrier::#ff4d4d';
      try{ if(r._tintedHullCache && r._tintedHullCache.delete) r._tintedHullCache.delete(key); } catch(e){}
      return { removed: true };
    }catch(e){ return { error: String(e) }; }
  });
  // trigger spawning a red carrier to force cached generation
  try{ await page.click('#addRed'); } catch(e){ console.log('click addRed failed', String(e)); }
  // Wait a bit for async rasterization to complete
  await page.waitForTimeout(1200);
  // dump tinted carrier canvas
  const data = await page.evaluate(() => {
    try{
      const r = window.__renderer;
      if(!r) return { error: 'no_renderer' };
      const c = r._tintedHullCache.get('carrier::#ff4d4d');
      if(!c) return { error: 'no_canvas' };
      try{ return { data: c.toDataURL('image/png') }; } catch(e){ return { error: String(e) }; }
    }catch(e){ return { error: String(e) }; }
  });
  if(data && data.data){
    const base = data.data.replace(/^data:image\/png;base64,/, '');
    const fname = `.playwright-mcp/tinted_carrier_regen_ff4d4d.png`;
    fs.writeFileSync(fname, Buffer.from(base, 'base64'));
    console.log('wrote', fname);
  } else {
    console.log('no data:', data);
  }
  await browser.close();
}
run().catch(e=>{ console.error('regen failed', e); process.exit(1); });
