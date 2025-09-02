import { chromium } from 'playwright';
import fs from 'fs';
import http from 'http';
import path from 'path';
import url from 'url';

function contentTypeFromPath(p) {
  const ext = path.extname(p).toLowerCase();
  switch (ext) {
    case '.html': return 'text/html; charset=utf-8';
    case '.js': return 'application/javascript; charset=utf-8';
    case '.css': return 'text/css; charset=utf-8';
    case '.json': return 'application/json; charset=utf-8';
    case '.png': return 'image/png';
    case '.jpg': case '.jpeg': return 'image/jpeg';
    case '.svg': return 'image/svg+xml';
    case '.wasm': return 'application/wasm';
    default: return 'application/octet-stream';
  }
}

async function run() {
  const out = { console: [], errors: [], requests: [] };

  // Simple static file server rooted at repo root
  const server = http.createServer((req, res) => {
    try {
      const parsed = url.parse(req.url || '/');
      let filePath = decodeURIComponent(parsed.pathname || '/');
      if (filePath === '/' ) filePath = '/dist/spaceautobattler_standalone.html';
      // Prevent directory traversal
      const safe = path.normalize(path.join(process.cwd(), filePath));
      if (!safe.startsWith(process.cwd())) {
        res.statusCode = 403; res.end('Forbidden'); return;
      }
      if (!fs.existsSync(safe) || fs.statSync(safe).isDirectory()) {
        res.statusCode = 404; res.end('Not found'); return;
      }
      const ct = contentTypeFromPath(safe);
      res.writeHead(200, { 'Content-Type': ct });
      const stream = fs.createReadStream(safe);
      stream.pipe(res);
    } catch (e) {
      res.statusCode = 500; res.end(String(e));
    }
  });

  await new Promise((resolve, reject) => server.listen(8080, '127.0.0.1', err => err ? reject(err) : resolve()));
  console.log('Static server listening on http://127.0.0.1:8080');

  const browser = await chromium.launch();
  const page = await browser.newPage();

  page.on('console', msg => {
    out.console.push({ type: msg.type(), text: msg.text() });
  });
  page.on('pageerror', err => out.errors.push(String(err)));
  page.on('request', req => out.requests.push({ url: req.url(), method: req.method(), resourceType: req.resourceType() }));
  page.on('requestfailed', req => out.requests.push({ url: req.url(), failed: true, failureText: req.failure()?.errorText }));

  try {
    await page.goto('http://127.0.0.1:8080/dist/spaceautobattler_standalone.html', { timeout: 60000 });
    // wait for 6s to allow shader compile and possible runtime warnings
    await page.waitForTimeout(6000);
  } catch (e) {
    out.errors.push(String(e));
  }

  await browser.close();
  server.close();

  fs.writeFileSync('capture-standalone-output.json', JSON.stringify(out, null, 2));
  console.log('WROTE capture-standalone-output.json');
}

run().catch(err => { console.error(err); process.exit(1); });
