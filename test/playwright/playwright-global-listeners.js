// Attach global page event listeners so every test's `page` fixture will have crash/close logging
// This module is required from `playwright.config.cjs` at config load time and registers hooks

const { test } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const os = require('os');

// prefer __dirname so worker processes write into repo-relative report folder
let CRASH_DIR = path.resolve(__dirname, '..', '..', 'playwright-report', 'crash-dumps');
function ensureCrashDir(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    console.warn('[playwright-global] ensured crash dir', dir);
    return true;
  } catch (e) {
    console.warn('[playwright-global] ensure crash dir failed', dir, e && e.message);
    return false;
  }
}
if (!ensureCrashDir(CRASH_DIR)) {
  // fallback to tmpdir if repo-relative path isn't writable in this worker
  const fallback = path.join(os.tmpdir(), 'spaceautobattler-crash-dumps');
  if (ensureCrashDir(fallback)) {
    CRASH_DIR = fallback;
    console.warn('[playwright-global] using fallback crash dir', CRASH_DIR);
  } else {
    console.error('[playwright-global] failed to create any crash dir, will attempt writes but they may fail');
  }
}

function safeFilename(prefix) {
  const t = new Date().toISOString().replace(/[:.]/g, '-');
  return `${prefix}-${t}`;
}

async function dumpPageState(page, namePrefix = 'dump') {
  try {
    const fname = safeFilename(namePrefix);
    const outLog = path.join(CRASH_DIR, fname + '.log.json');
    const outShot = path.join(CRASH_DIR, fname + '.png');
    const outMeta = path.join(CRASH_DIR, fname + '.meta.json');
    // collect diagnostics already captured on page (we attach listeners that push to page._diagnostics)
    const diags = page._diagnostics || { console: [], pageerrors: [] };
    try {
      fs.writeFileSync(outLog, JSON.stringify(diags, null, 2));
      console.warn('[playwright-global] wrote log', outLog, 'exists?', fs.existsSync(outLog));
    } catch (e) { console.warn('[playwright-global] failed write diag log', outLog, e && e.message); }
    try {
      if (page.screenshot) await page.screenshot({ path: outShot, timeout: 5000 }).catch(() => {});
    } catch (e) {
      console.warn('[playwright-global] screenshot failed', outShot, e && e.message);
    }
    try {
      fs.writeFileSync(outMeta, JSON.stringify({ url: page.url ? page.url() : null, timestamp: Date.now() }));
      console.warn('[playwright-global] wrote meta', outMeta, 'exists?', fs.existsSync(outMeta));
    } catch (e) { console.warn('[playwright-global] failed write meta', outMeta, e && e.message); }
    console.warn(`[playwright-global] attempted crash dump: ${outLog} ${outShot} (dir=${CRASH_DIR})`);
  } catch (e) {
    console.warn('[playwright-global] dumpPageState failed', e);
  }
}

try {
  test.beforeEach(async ({ page }, testInfo) => {
    try {
      // per-page diagnostics store
      page._diagnostics = { console: [], pageerrors: [] };
      page.on('console', (msg) => {
        try { page._diagnostics.console.push({ type: msg.type(), text: msg.text() }); } catch (e) {}
      });
      page.on('pageerror', (err) => {
        try { page._diagnostics.pageerrors.push(String(err)); } catch (e) {}
      });

      // write a quick marker so we can see the hook ran and had write permission
      try {
        const marker = path.join(CRASH_DIR, safeFilename('marker') + '.txt');
        try {
          fs.writeFileSync(marker, JSON.stringify({ test: testInfo && testInfo.title }) );
          console.warn('[playwright-global] wrote marker', marker, 'exists?', fs.existsSync(marker));
        } catch (e) { console.warn('[playwright-global] marker write failed', marker, e && e.message); }
      } catch (e) {}

      page.on('crash', async () => {
        console.warn('[playwright-global] page crashed - writing dump');
        // stop tracing if active
        try { if (page.context && page.context().tracing) await page.context().tracing.stop({ path: path.join(CRASH_DIR, safeFilename('trace-crash') + '.zip') }).catch(() => {}); } catch (e) {}
        await dumpPageState(page, 'page-crash');
      });
      page.on('close', async () => {
        console.warn('[playwright-global] page closed unexpectedly - writing dump');
        try { if (page.context && page.context().tracing) await page.context().tracing.stop({ path: path.join(CRASH_DIR, safeFilename('trace-close') + '.zip') }).catch(() => {}); } catch (e) {}
        await dumpPageState(page, 'page-close');
      });

      // start tracing by default for each test unless explicitly disabled
      try {
        const noTrace = process.env.PLAYWRIGHT_NO_TRACES === '1' || process.env.PLAYWRIGHT_NO_TRACES === 'true';
        if (!noTrace) {
          try {
            if (page.context && page.context().tracing) {
              await page.context().tracing.start({ screenshots: true, snapshots: true });
              page._tracingActive = true;
            }
          } catch (e) {
            // ignore tracing start errors
          }
        }
      } catch (e) {}
    } catch (e) {
      // swallow listener install errors
    }
  });

  test.afterEach(async ({ page }, testInfo) => {
    try {
      // if the test failed, capture a dump for post-mortem
      if (testInfo && testInfo.status !== 'passed') {
        console.warn('[playwright-global] test failed - writing dump');
        // stop tracing if active and save
        try {
          if (page && page._tracingActive && page.context && page.context().tracing) {
            const tracePath = path.join(CRASH_DIR, safeFilename('trace-failure') + '.zip');
            try { await page.context().tracing.stop({ path: tracePath }).catch(() => {}); } catch (e) {}
            console.warn('[playwright-global] saved trace to', tracePath);
          }
        } catch (e) {}
        await dumpPageState(page, 'test-failure');
      } else {
        // if tracing was started but the test passed, stop and discard the trace to avoid leaving tracing running
        try {
          if (page && page._tracingActive && page.context && page.context().tracing) {
            await page.context().tracing.stop().catch(() => {});
            page._tracingActive = false;
          }
        } catch (e) {}
      }
    } catch (e) {
      console.warn('[playwright-global] afterEach dump failed', e);
    }
  });
} catch (e) {
  // If @playwright/test isn't available at config-load, ignore
}
