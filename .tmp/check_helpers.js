import path from 'path';
import { chromium } from 'playwright';

(async ()=>{
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  page.on('console', msg => console.log('PAGE LOG>', msg.type(), msg.text()));
  const url = 'http://localhost:8080/dist/spaceautobattler_standalone.html';
  console.log('opening', url);
  await page.goto(url, { waitUntil: 'networkidle' });
  for (let i=0;i<20;i++){
    const ok = await page.evaluate(()=>{
      try { return {
        listNonInstanced: typeof window.__listNonInstancedMeshes !== 'undefined',
        highlight: typeof window.__highlightNonInstancedMeshes !== 'undefined',
        focus: typeof window.__focusCameraOn !== 'undefined',
      } } catch (e){ return { err: String(e) } }
    });
    console.log('helpers:', ok);
    if (ok && (ok.listNonInstanced || ok.highlight || ok.focus)) break;
    await new Promise(r=>setTimeout(r,1000));
  }
  await browser.close();
})();
