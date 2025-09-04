import { chromium } from 'playwright';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto('http://localhost:8080/dist/spaceautobattler.html', { timeout: 10000 });
    await page.waitForTimeout(2000);
    const result = await page.evaluate(() => {
      const out = { found: false, meshes: [] };
      const scene = globalThis.__three_scene || globalThis.scene || globalThis.appScene;
      if (!scene) return { error: 'no_scene' };
      let first = null;
      scene.traverse((o) => { if (!first && o && o.isInstancedMesh) first = o; });
      if (!first) return { error: 'no_instanced_mesh' };
      try {
  const geom = first.geometry;
  const mat = first.material;
  const instColor = geom.getAttribute('instanceColor') || geom.getAttribute('color');
  const position = geom.getAttribute('position');
  const normal = geom.getAttribute('normal');
  const matrixArray = first.instanceMatrix && first.instanceMatrix.array ? Array.prototype.slice.call(first.instanceMatrix.array, 0, 16) : null;
  const colorSlice = instColor ? Array.prototype.slice.call(instColor.array, 0, Math.min(12, instColor.array.length)) : null;
  out.found = true;
  out.matrixFirst = matrixArray;
  out.colorFirst12 = colorSlice;
  out.material = { vertexColors: !!mat.vertexColors, transparent: !!mat.transparent, needsUpdate: !!mat.needsUpdate };
  out.attributes = { position: !!position, normal: !!normal, instanceColor: !!geom.getAttribute('instanceColor'), colorAttr: !!geom.getAttribute('color') };
  out.count = first.count;
  return out;
      } catch (e) { return { error: e.message }; }
    });
    console.log(JSON.stringify(result, null, 2));
  } catch (e) { console.error('NAV_ERROR', e); }
  await browser.close();
})();
