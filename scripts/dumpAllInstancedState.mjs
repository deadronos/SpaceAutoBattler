import { chromium } from 'playwright';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto('http://localhost:8080/dist/spaceautobattler.html', { timeout: 10000 });
  await page.waitForTimeout(4500);
    const result = await page.evaluate(() => {
      const out = { meshes: [] };
      const scene = globalThis.__three_scene || globalThis.scene || globalThis.appScene;
      if (!scene) return { error: 'no_scene' };
      scene.traverse((o) => {
        if (o && o.isInstancedMesh) {
          try {
            const geom = o.geometry;
            const mat = o.material;
            const instColorAttr = geom.getAttribute('instanceColor') || geom.getAttribute('color');
            const position = geom.getAttribute('position');
            const normal = geom.getAttribute('normal');
            const matrixFirst = o.instanceMatrix && o.instanceMatrix.array ? Array.prototype.slice.call(o.instanceMatrix.array, 0, Math.min(16, o.instanceMatrix.array.length)) : null;
            const colorFirst12 = instColorAttr ? Array.prototype.slice.call(instColorAttr.array, 0, Math.min(12, instColorAttr.array.length)) : null;
            out.meshes.push({
              name: o.name || null,
              userData: o.userData || null,
              count: o.count,
              frustumCulled: !!o.frustumCulled,
              visible: !!o.visible,
              matrixFirst,
              colorFirst12,
              material: { vertexColors: !!mat.vertexColors, transparent: !!mat.transparent, alphaTest: !!mat.alphaTest, map: !!mat.map },
              attributes: { position: position ? position.count : 0, normal: normal ? normal.count : 0, instanceColor: instColorAttr ? instColorAttr.count : 0, colorAttr: !!geom.getAttribute('color') },
            });
          } catch (e) {
            out.meshes.push({ error: e.message });
          }
        }
      });
      return out;
    });
    console.log(JSON.stringify(result, null, 2));
  } catch (e) { console.error('NAV_ERROR', e); }
  await browser.close();
})();
