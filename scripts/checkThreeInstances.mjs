import { chromium } from 'playwright';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto('http://localhost:8080/dist/spaceautobattler.html', { timeout: 10000 });
  await page.waitForTimeout(4500);
    const res = await page.evaluate(() => {
      const report = {};
      const globalThree = globalThis.THREE;
      report.globalThree = !!globalThree;
      report.globalThreeRevision = globalThree ? globalThree.REVISION : null;
      const scene = globalThis.__three_scene || globalThis.scene || globalThis.appScene;
      if (!scene) return { error: 'no_scene', ...report };
      const constructors = new Set();
      scene.traverse((o) => { if (o && o.constructor) constructors.add(o.constructor.name); });
      report.constructors = Array.from(constructors);
      // check whether any instanced mesh's constructor !== globalThree.InstancedMesh
      report.instancedMismatches = [];
      scene.traverse((o) => {
        if (o && o.isInstancedMesh) {
          const ctorName = o.constructor && o.constructor.name;
          const globalName = globalThree && globalThree.InstancedMesh && globalThree.InstancedMesh.name;
          report.instancedMismatches.push({ ctorName, matchesGlobal: ctorName === globalName });
        }
      });
      return report;
    });
    console.log(JSON.stringify(res, null, 2));
  } catch (e) { console.error('ERR', e); }
  await browser.close();
})();
