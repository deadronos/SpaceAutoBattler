const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const url = 'http://localhost:8080/spaceautobattler.html?copilot_debug=1';
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleMessages = [];
  page.on('console', (msg) => {
    try {
      const args = msg
        .args()
        .map((a) =>
          a._remoteObject && a._remoteObject.value !== undefined
            ? a._remoteObject.value
            : String(a),
        );
      consoleMessages.push({ type: msg.type(), text: msg.text(), args });
    } catch (e) {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    }
  });

  try {
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  } catch (e) {
    console.error('NAV_ERROR', String(e));
  }

  // wait a moment for frames/compilation
  await page.waitForTimeout(2000);

  function safeEval(winVar) {
    return page.evaluate((v) => {
      try {
        // return deep cloneable value
        const val = window[v];
        return typeof val === 'undefined' ? null : val;
      } catch (e) {
        return { error: String(e) };
      }
    }, winVar);
  }

  // Collect globals
  const results = {};
  const keys = [
    '__copilot_starDiskTelemetry',
    '__copilot_starDiskDiagnostics',
    '__copilot_starUniforms',
    '__STAR_COMPILED',
    '__copilot_starMeshStatus',
    '__copilot_rapierPanics',
    '__copilot_glLogs',
    '__copilot_forceStarOpaque',
    '__copilot_star_forceOnTop',
    '__copilot_star_forcedOpaque',
  ];

  for (const k of keys) {
    try {
      results[k] = await safeEval(k);
    } catch (e) {
      results[k] = { error: String(e) };
    }
  }

  // Also capture localStorage markers
  try {
    results._localStorage = await page.evaluate(() => {
      try {
        return {
          copilot_star_compiled:
            (localStorage &&
              localStorage.getItem &&
              localStorage.getItem('copilot_star_compiled')) ||
            null,
        };
      } catch (e) {
        return { error: String(e) };
      }
    });
  } catch (e) {
    results._localStorage = { error: String(e) };
  }

  // Final wait to capture leftover console messages
  await page.waitForTimeout(200);

  await browser.close();

  const out = { url, results, consoleMessages };
  const outPath = path.resolve(process.cwd(), 'test-output', 'star-disk-inspect.json');
  try {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
  } catch (e) {}
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
  console.log('INSPECT_OK', outPath);
})();
