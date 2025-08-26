import { chromium } from 'playwright';
import fs from 'fs';

async function run(){
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const url = 'http://127.0.0.1:8080/dist/spaceautobattler_standalone.html';
  console.log('navigating to', url);
  await page.goto(url, { waitUntil: 'load', timeout: 15000 });
  await page.waitForTimeout(500);
  const info = await page.evaluate(() => {
    try{
      const r = window.__renderer;
      if(!r) return { error: 'no_renderer' };
      const hull = r._svgHullCache && r._svgHullCache['carrier'];
      const tinted = r._tintedHullCache && r._tintedHullCache.get && r._tintedHullCache.get('carrier::#ff4d4d');
      const hullSize = hull ? { w: hull.width, h: hull.height } : null;
      const tintedSize = tinted ? { w: tinted.width, h: tinted.height } : null;
      return { hullSize, tintedSize };
    }catch(e){ return { error: String(e) }; }
  });
  console.log('before:', info);

  const result = await page.evaluate(() => {
    try{
      const r = window.__renderer;
      if(!r) return { error: 'no_renderer' };
      const hull = r._svgHullCache && r._svgHullCache['carrier'];
      if(!hull) return { error: 'no_hull' };
      const desiredW = hull.width;
      const desiredH = hull.height;
      const key = 'carrier::#ff4d4d';
      try{ r._tintedHullCache.delete && r._tintedHullCache.delete(key); } catch (e) {}
      // create a new canvas and tint
      const c = document.createElement('canvas');
      c.width = desiredW;
      c.height = desiredH;
      try{
        const ctx = c.getContext('2d');
        ctx.clearRect(0,0,desiredW,desiredH);
        ctx.drawImage(hull, 0, 0);
        ctx.globalCompositeOperation = 'source-in';
        ctx.fillStyle = '#ff4d4d';
        ctx.fillRect(0,0,desiredW,desiredH);
        ctx.globalCompositeOperation = 'source-over';
      }catch(e){ return { error: 'draw_err:'+String(e)}; }
      // store into cache via public Map-like API
      try{ r._tintedHullCache.set(key, c); } catch(e){ try{ r._setTintedCanvas && r._setTintedCanvas(key, c); } catch(e2){ return { error: 'set_err:'+String(e2)}; } }
      // return dataURL
      try{ return { data: c.toDataURL('image/png') }; } catch(e){ return { error: 'toDataUrl:'+String(e)}; }
    }catch(e){ return { error: String(e) }; }
  });

  if(result && result.data){
    const base = result.data.replace(/^data:image\/png;base64,/, '');
    const fname = `.playwright-mcp/tinted_carrier_fix_ff4d4d.png`;
    fs.writeFileSync(fname, Buffer.from(base, 'base64'));
    console.log('wrote', fname);
  } else {
    console.log('no data from in-page fix', result);
  }

  const after = await page.evaluate(() => {
    try{
      const r = window.__renderer;
      if(!r) return { error: 'no_renderer' };
      const tinted = r._tintedHullCache && r._tintedHullCache.get && r._tintedHullCache.get('carrier::#ff4d4d');
      return tinted ? { w: tinted.width, h: tinted.height } : null;
    }catch(e){ return { error: String(e) }; }
  });
  console.log('after tinted canvas size:', after);
  await browser.close();
}
run().catch(e=>{ console.error('inspect_and_fix failed', e); process.exit(1); });
