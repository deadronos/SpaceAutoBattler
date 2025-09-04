import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

(async ()=>{
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  page.on('console', msg => console.log('PAGE LOG>', msg.type(), msg.text()));
  const url = 'http://localhost:8080/dist/spaceautobattler_standalone.html';
  console.log('opening', url);
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(()=>!!window.__listNonInstancedMeshes && !!window.__listInstancedHealthBarShips, { timeout: 60000 });

  const result = await page.evaluate(()=>{
    const nonInst = window.__listNonInstancedMeshes ? window.__listNonInstancedMeshes({ near: { x: 1700, y: 400, z: 950, radius: 400 } }) : [];
    const nonInstShips = window.__listShipsWithHealthBar ? window.__listShipsWithHealthBar() : [];
    const instShips = window.__listInstancedHealthBarShips ? window.__listInstancedHealthBarShips() : [];
    const instStats = window.__hbInstancerStats ? window.__hbInstancerStats() : null;
    return { nonInstCount: nonInst.length, nonInst, nonInstShips, instShips, instStats };
  });

  const out = path.resolve('.tmp/hb_lists.json');
  fs.writeFileSync(out, JSON.stringify(result, null, 2));
  console.log('wrote', out);
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})();
