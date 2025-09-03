import { chromium } from 'playwright';

(async ()=>{
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:8080/dist/spaceautobattler_standalone.html', { waitUntil: 'load' });
  await page.waitForTimeout(1000);

  const corner = { x: 1770, y: 375, z: 960 };
  const results = await page.evaluate((corner) => {
    try {
      if (!globalThis.__listNonInstancedMeshes) return { err: 'no-helper' };
      return globalThis.__listNonInstancedMeshes({ near: { x: corner.x, y: corner.y, z: corner.z, radius: 60 } });
    } catch (e) { return { err: String(e) }; }
  }, corner);
  console.log('results:', JSON.stringify(results, null, 2));
  await browser.close();
})();
