import path from 'path';
import { chromium } from 'playwright';

 (async ()=>{
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('console', msg => console.log('PAGE LOG>', msg.type(), msg.text()));
  const url = 'http://localhost:8080/dist/spaceautobattler_standalone.html';
  console.log('opening', url);
  // use 'load' so we don't wait for long-running network requests (service workers, analytics, etc.)
  await page.goto(url, { waitUntil: 'load' });
  // wait for renderer helpers
  // wait for renderer helpers to be available (give extra time in headless)
  await page.waitForFunction(() => !!window.__listNonInstancedMeshes, { timeout: 60000 });
  // dump near-corner meshes
  const near = { x: 1770, y: 375, z: 960, radius: 120 };
  const list = await page.evaluate((n) => window.__listNonInstancedMeshes({ near: n }), near);
  console.log('found', list.length, 'non-instanced candidate meshes');
  // highlight
  const res = await page.evaluate((n) => window.__highlightNonInstancedMeshes({ near: n, color: 0xff00ff }), near);
  console.log('highlight result', res);
  // focus camera on average position
  if (list.length > 0) {
  const avg = list.reduce((acc, it)=>({ x: acc.x+it.position.x, y: acc.y+it.position.y, z: acc.z+it.position.z }), { x:0,y:0,z:0 });
    avg.x/=list.length; avg.y/=list.length; avg.z/=list.length;
  await page.evaluate((p) => window.__focusCameraOn(p, 300), avg);
  }
  await page.waitForTimeout(250);
  const out = path.resolve('.tmp/highlight.png');
  await page.screenshot({ path: out });
  console.log('wrote', out);
  // unhighlight
  await page.evaluate(() => window.__unhighlightNonInstancedMeshes());
  await browser.close();
})();
