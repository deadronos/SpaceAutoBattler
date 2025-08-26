import { chromium } from 'playwright';
import fs from 'fs';

async function run(){
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const url = 'http://127.0.0.1:8080/dist/spaceautobattler_standalone.html';
  console.log('navigating to', url);
  await page.goto(url, { waitUntil: 'load', timeout: 15000 });
  await page.waitForTimeout(500);
  const result = await page.evaluate(async () => {
    try{
  const inline = (typeof globalThis !== 'undefined' && globalThis.__INLINE_SVG_ASSETS && globalThis.__INLINE_SVG_ASSETS['carrier']) || (typeof window !== 'undefined' && window.AssetsConfig && window.AssetsConfig.svgAssets && window.AssetsConfig.svgAssets['carrier']);
      if(!inline) return { error: 'no_inline' };
      // create canvas and draw via Image
      const canvas = document.createElement('canvas');
      canvas.width = 128; canvas.height = 128;
      const ctx = canvas.getContext('2d');
      return await new Promise((resolve) => {
        try{
          const img = new Image();
          const blob = new Blob([inline], { type: 'image/svg+xml;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          img.onload = () => {
            try{ ctx.drawImage(img,0,0,128,128); } catch(e) { }
            try{ URL.revokeObjectURL(url); } catch(e) {}
            try{ resolve({ data: canvas.toDataURL('image/png') }); } catch(e){ resolve({ error: String(e) }); }
          };
          img.onerror = (e) => { try{ URL.revokeObjectURL(url); } catch(e){}; resolve({ error: 'img_error' }); };
          img.src = url;
          // timeout fallback
          setTimeout(()=>{ resolve({ error: 'timeout' }); }, 2000);
        }catch(e){ resolve({ error: String(e) }); }
      });
    }catch(e){ return { error: String(e) }; }
  });
  if(result && result.data){
    const base = result.data.replace(/^data:image\/png;base64,/, '');
    const fname = `.playwright-mcp/inline_raster_carrier.png`;
    fs.writeFileSync(fname, Buffer.from(base, 'base64'));
    console.log('wrote', fname);
  } else {
    console.log('no data', result);
  }
  await browser.close();
}
run().catch(e=>{ console.error('test_raster_inline failed', e); process.exit(1); });
