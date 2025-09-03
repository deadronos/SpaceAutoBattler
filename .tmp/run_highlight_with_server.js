import http from 'http';
import fs from 'fs';
import path from 'path';
// no-op
import { chromium } from 'playwright';

const root = path.resolve('.');
const port = 8080;

function contentTypeFor(file) {
  if (file.endsWith('.html')) return 'text/html';
  if (file.endsWith('.js')) return 'application/javascript';
  if (file.endsWith('.css')) return 'text/css';
  if (file.endsWith('.png')) return 'image/png';
  if (file.endsWith('.json')) return 'application/json';
  if (file.endsWith('.map')) return 'application/json';
  return 'application/octet-stream';
}

const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url || '/', `http://localhost:${port}`);
    let p = path.join(root, decodeURIComponent(url.pathname.replace(/^\//, '')));
    if (!p.startsWith(root)) { res.statusCode = 403; res.end('forbidden'); return; }
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) {
      // prefer index.html in directory
      const idx = path.join(p, 'index.html');
      if (fs.existsSync(idx)) p = idx;
      else { res.statusCode = 404; res.end('not found'); return; }
    }
    if (!fs.existsSync(p)) {
      // fallback to root index
      const fallback = path.join(root, 'dist', 'spaceautobattler_standalone.html');
      if (fs.existsSync(fallback)) {
        p = fallback;
      } else { res.statusCode = 404; res.end('not found'); return; }
    }
    const ct = contentTypeFor(p);
    res.setHeader('Content-Type', ct + '; charset=utf-8');
    const stream = fs.createReadStream(p);
    stream.pipe(res);
    stream.on('error', (e) => { res.statusCode = 500; res.end('error'); });
  } catch (e) {
    res.statusCode = 500; res.end('err');
  }
});

server.listen(port, '127.0.0.1', async () => {
  console.log('static server running at http://localhost:' + port);
  // run playwright
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('console', msg => console.log('PAGE>', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGEERROR>', String(err)));
  try {
    const url = `http://localhost:${port}/dist/spaceautobattler_standalone.html`;
  console.log('opening', url);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 120000 });
    // wait for helper
  await page.waitForFunction(() => !!window.__listNonInstancedMeshes, { timeout: 60000 });
    const near = { x: 1770, y: 375, z: 960, radius: 120 };
    const list = await page.evaluate((n) => window.__listNonInstancedMeshes({ near: n }), near);
    console.log('found', list.length, 'non-instanced candidate meshes');
    const res = await page.evaluate((n) => window.__highlightNonInstancedMeshes({ near: n, color: 0xff00ff }), near);
    console.log('highlight result', res);
    if (list.length > 0) {
      const avg = list.reduce((acc, it)=>({ x: acc.x+it.position.x, y: acc.y+it.position.y, z: acc.z+it.position.z }), { x:0,y:0,z:0 });
      avg.x/=list.length; avg.y/=list.length; avg.z/=list.length;
      await page.evaluate((p) => window.__focusCameraOn(p, 300), avg);
    }
    await page.waitForTimeout(250);
    const out = path.resolve('.tmp/highlight.png');
    await page.screenshot({ path: out });
    console.log('wrote', out);
    await page.evaluate(() => window.__unhighlightNonInstancedMeshes());
  } catch (err) {
    console.error('playwright error', err);
  } finally {
    await browser.close();
    server.close();
    console.log('done');
  }
});
