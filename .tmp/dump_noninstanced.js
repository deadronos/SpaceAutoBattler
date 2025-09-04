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
  await page.waitForFunction(()=>!!window.__listNonInstancedMeshes, { timeout: 60000 });
  const near = { x: 1770, y: 375, z: 960, radius: 200 };
  const list = await page.evaluate((n)=>{
    const raw = window.__listNonInstancedMeshes({ near: n }) || [];
    return raw.map(m=>({
      name: m.name || m.mesh?.name || null,
      uuid: m.uuid || m.mesh?.uuid || (m.mesh && m.mesh.uuid) || null,
      position: m.position || (m.mesh && m.mesh.getWorldPosition?.(new THREE.Vector3()) && {
        x: m.mesh.getWorldPosition(new THREE.Vector3()).x,
        y: m.mesh.getWorldPosition(new THREE.Vector3()).y,
        z: m.mesh.getWorldPosition(new THREE.Vector3()).z,
      }) || null,
      visible: Boolean(m.mesh?.visible ?? true),
      materialType: m.mesh && m.mesh.material ? (Array.isArray(m.mesh.material)? 'Array('+m.mesh.material.length+')': (m.mesh.material.type||typeof m.mesh.material)) : null,
      materialUuid: m.mesh && m.mesh.material ? (m.mesh.material.uuid || null) : null,
      geometryType: m.mesh && m.mesh.geometry ? (m.mesh.geometry.type || null) : null,
      parentName: m.mesh && m.mesh.parent ? (m.mesh.parent.name || null) : null,
      userData: m.mesh && m.mesh.userData ? m.mesh.userData : null,
    }));
  }, near);
  const out = path.resolve('.tmp/noninstanced.json');
  fs.writeFileSync(out, JSON.stringify(list, null, 2));
  console.log('wrote', out);
  console.log('--- DUMP ---');
  console.log(JSON.stringify(list, null, 2));
  await browser.close();
})();
