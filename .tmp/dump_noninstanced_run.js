import { chromium } from 'playwright';

(async ()=>{
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', m=> console.log('PAGE>', m.type(), m.text()));
  await page.goto('http://localhost:8080/dist/spaceautobattler_standalone.html', { waitUntil: 'load', timeout: 120000 }).catch(e=>console.log('goto err', e));
  // wait briefly for runtime
  await new Promise(r=>setTimeout(r,3000));
  const list = await page.evaluate(()=>{
    try {
      const out = [];
      const near = { x: 1700, y: 400, z: 950, radius: 1000 };
      const radius2 = (near.radius||1000)*(near.radius||1000);
      window.scene.traverse(function(o){
        try {
          if (!o) return;
          if (o.isInstancedMesh) return;
          var wp = new window.THREE.Vector3();
          if (typeof o.getWorldPosition === 'function') o.getWorldPosition(wp);
          var dx = wp.x - near.x; var dy = wp.y - near.y; var dz = wp.z - near.z;
          if ((dx*dx + dy*dy + dz*dz) > radius2) return;
          out.push({ name: o.name || null, id: o.userData && o.userData.id ? o.userData.id : null, pos: { x: wp.x, y: wp.y, z: wp.z }, origin: o.userData && o.userData.__hb_origin ? o.userData.__hb_origin : null });
        } catch (e) { /* ignore per-object errors */ }
      });
      return out;
    } catch (e) { return { err: String(e) } }
  });
  const legacy = await page.evaluate(()=>{ try { return typeof window.__listNonInstancedMeshes === 'function' ? window.__listNonInstancedMeshes({ near: { x: 1700, y: 400, z: 950, radius: 1000 } }) : null } catch (e) { return { err: String(e) } } });

  // Ask runtime to highlight legacy-matched objects so we can find them reliably
  await page.evaluate(()=>{ try { if (typeof window.__highlightNonInstancedMeshes === 'function') window.__highlightNonInstancedMeshes({ near: { x: 1700, y: 400, z: 950, radius: 1000 }, color: 0xff00ff }); } catch(e){} });
  await new Promise(r=>setTimeout(r,200));

  const diagnostics = await page.evaluate(()=>{
    try {
      const out = [];
      window.scene.traverse(function(o){
        try {
          if (!o) return;
          if (o.isMesh) {
            const mat = o.material;
            if (mat && mat.wireframe === true && mat.color && typeof mat.color.getHex === 'function' && mat.color.getHex() === 0xff00ff) {
              const wp = new window.THREE.Vector3(); if (typeof o.getWorldPosition === 'function') o.getWorldPosition(wp);
              out.push({
                constructor: o.constructor && o.constructor.name ? o.constructor.name : String(o),
                geomType: (o.geometry && o.geometry.type) || null,
                matType: (o.material && (o.material.constructor && o.material.constructor.name ? o.material.constructor.name : typeof o.material)) || null,
                userDataKeys: Object.keys(o.userData || {}),
                parentName: o.parent ? (o.parent.name || (o.parent.constructor && o.parent.constructor.name) || null) : null,
                worldPos: { x: wp.x, y: wp.y, z: wp.z }
              });
            }
          }
        } catch (e) { /* ignore per-object */ }
      });
      return out;
    } catch (e) { return { err: String(e) } }
  });

  console.log('TRAVERSE_RESULT', JSON.stringify(list, null, 2));
  console.log('LEGACY_LIST_FN', JSON.stringify(legacy, null, 2));
  console.log('DIAGNOSTICS', JSON.stringify(diagnostics, null, 2));
  await browser.close();
})();
