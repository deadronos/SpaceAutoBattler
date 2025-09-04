import path from 'path';
import { chromium } from 'playwright';

(async ()=>{
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  page.on('console', msg => console.log('PAGE LOG>', msg.type(), msg.text()));
  const url = 'http://localhost:8080/dist/spaceautobattler_standalone.html';
  console.log('opening', url);
  try {
    // Some resources may 404 during load; use 'load' and a longer timeout so the page can finish bootstrapping.
    await page.goto(url, { waitUntil: 'load', timeout: 120000 });
  } catch (err) {
    console.log('page.goto error (continuing):', String(err).slice(0,200));
  }

  // Wait up to 60s for the runtime helpers to appear. Print periodic diagnostics.
  for (let i=0;i<60;i++){
    const ok = await page.evaluate(()=>{
      try { return {
        listNonInstanced: typeof window.__listNonInstancedMeshes !== 'undefined',
        highlight: typeof window.__highlightNonInstancedMeshes !== 'undefined',
        focus: typeof window.__focusCameraOn !== 'undefined',
        hbInstancer: typeof window.__hbInstancerStats !== 'undefined',
      } } catch (e){ return { err: String(e) } }
    });
    console.log('helpers:', ok);
    if (ok && (ok.listNonInstanced || ok.highlight || ok.focus || ok.hbInstancer)) break;
    await new Promise(r=>setTimeout(r,1000));
  }
  // Dump a short screenshot to help debugging if helpers didn't show up.
  const have = await page.evaluate(()=>{
    return {
      listNonInstanced: typeof window.__listNonInstancedMeshes !== 'undefined',
      hbInstancer: typeof window.__hbInstancerStats !== 'undefined'
    }
  });
  if (!have.listNonInstanced && !have.hbInstancer){
    try { await page.screenshot({ path: ' .tmp/check_helpers_page.png' }); console.log('wrote screenshot .tmp/check_helpers_page.png'); } catch(e){ console.log('screenshot failed', String(e).slice(0,200)) }
  }
  await browser.close();
})();
