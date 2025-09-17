#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { statSync } from 'node:fs';

const SCENARIOS = [20, 40, 80];
const DEFAULT_MIN_FRAMES = 240; // ~4 seconds at 60 FPS
const DEFAULT_SETTLE_MS = 1000;
const PERF_MIN_FRAMES = Number.parseInt(process.env.PERF_MIN_FRAMES ?? '', 10);
const PERF_SETTLE_MS = Number.parseInt(process.env.PERF_SETTLE_MS ?? '', 10);
const MIN_FRAMES = Number.isFinite(PERF_MIN_FRAMES) ? Math.max(60, PERF_MIN_FRAMES) : DEFAULT_MIN_FRAMES;
const SETTLE_MS = Number.isFinite(PERF_SETTLE_MS) ? Math.max(100, PERF_SETTLE_MS) : DEFAULT_SETTLE_MS;
const OUTPUT_DIR = process.env.PERF_OUTPUT_DIR ?? path.resolve('perf', 'baselines');
// Environment-driven runtime options
const PERF_USE_GPU = (process.env.PERF_USE_GPU || '').toLowerCase() === '1' || (process.env.PERF_USE_GPU || '').toLowerCase() === 'true';
const PERF_CHROME_PATH = process.env.PERF_CHROME_PATH || process.env.CHROME_PATH || process.env.CHROMIUM_PATH || undefined;
// PERF_HEADLESS: '1' or 'true' forces headless, '0' or 'false' forces headed. If unset, script chooses sensible defaults.
const PERF_HEADLESS_RAW = (process.env.PERF_HEADLESS || '').toLowerCase();
const PERF_HEADLESS = PERF_HEADLESS_RAW === '1' || PERF_HEADLESS_RAW === 'true' ? true : (PERF_HEADLESS_RAW === '0' || PERF_HEADLESS_RAW === 'false' ? false : null);

async function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    // Use shell: true for cross-platform compatibility (Windows cmd/powershell differences)
    // Keep mapping for npm on Windows for systems that rely on npm.cmd directly.
    const cmd = process.platform === 'win32' && command === 'npm' ? 'npm.cmd' : command;
    const child = spawn(cmd, args, { stdio: 'inherit', shell: true, env: process.env });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(' ')} failed with exit code ${code}`));
      }
    });
  });
}

async function ensureBuild() {
  if (process.env.PERF_SKIP_BUILD === '1') {
    console.log('[perf] Skipping build step (PERF_SKIP_BUILD=1)');
    return;
  }
  console.log('[perf] Running npm run build …');
  await runCommand('npm', ['run', 'build']);
}

async function waitForApp(page, options = { timeout: 30000 }) {
  await page.waitForFunction(
    () => {
      return Boolean(window.__appDebug && typeof window.__appDebug.configurePerfScenario === 'function' && window.perf);
    },
    null,
    options,
  );
}

async function runScenario(page, shipCount) {
  await page.evaluate(() => {
    window.perf?.clear();
  });
  const configureResult = await page.evaluate((count) => {
    const helper = window.__appDebug?.configurePerfScenario;
    if (typeof helper !== 'function') {
      return { ok: false, error: 'configurePerfScenario missing' };
    }
    const result = helper({ totalShips: count });
    if (!result) {
      return { ok: false, error: 'configurePerfScenario returned null' };
    }
    return { ok: true, counts: result };
  }, shipCount);

  if (!configureResult.ok) {
    throw new Error(`[perf] Failed to configure scenario (${shipCount} ships): ${configureResult.error}`);
  }

  await page.waitForTimeout(SETTLE_MS);
  try {
    await page.waitForFunction(
      (targetFrames) => {
        const perf = window.perf;
        if (!perf) return false;
        const summary = perf.getSummary();
        return summary.frameCount >= targetFrames;
      },
      MIN_FRAMES,
      { timeout: 45000 },
    );
  } catch (err) {
    // Timeout waiting for enough frames. Capture what we have and continue if any frames were collected.
    const partial = await page.evaluate(() => {
      const perf = window.perf;
      if (!perf) return null;
      return perf.getSummary();
    });
    if (partial && partial.frameCount > 0) {
      console.warn(`[perf] Only collected ${partial.frameCount} frames (target ${MIN_FRAMES}). Proceeding with partial data.`);
    } else {
      throw err; // rethrow if no frames collected
    }
  }

  const summary = await page.evaluate(() => {
    const perf = window.perf;
    if (!perf) {
      return null;
    }
    const base = perf.getSummary();
    return {
      frameCount: base.frameCount,
      totalFrameMs: base.totalFrameMs,
      avgFrameMs: base.avgFrameMs,
      p95FrameMs: base.p95FrameMs,
      subsystems: base.subsystems.map((sub) => ({
        name: sub.name,
        totalMs: sub.totalMs,
        count: sub.count,
        avgMs: sub.avgMs,
        p95Ms: sub.p95Ms,
      })),
    };
  });

  if (!summary) {
    throw new Error('[perf] perf.getSummary() returned null');
  }

  return {
    shipCount,
    counts: configureResult.counts,
    summary,
    settleMs: SETTLE_MS,
    minFrames: MIN_FRAMES,
  };
}

async function collectBaseline() {
  await ensureBuild();

  const distHtml = path.resolve('dist', 'spaceautobattler.html');
  if (!existsSync(distHtml)) {
    throw new Error('dist/spaceautobattler.html not found. Run npm run build first.');
  }
  // Start a simple static file server to serve the dist directory over HTTP.
  // This avoids fetch/file:// issues when loading assets from the built HTML.
  const distDir = path.resolve('dist');
  const server = createServer((req, res) => {
    try {
      const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      let filePath = path.join(distDir, urlPath);
      // If path ends with / or is root, serve spaceautobattler.html
      if (urlPath === '/' || urlPath.endsWith('/')) {
        filePath = path.join(distDir, 'spaceautobattler.html');
      }
      // Fallback to index for root
      // Basic security: prevent path traversal
      if (!filePath.startsWith(distDir)) {
        res.statusCode = 403;
        res.end('Forbidden');
        return;
      }
      const stats = statSync(filePath);
      if (stats.isDirectory()) {
        filePath = path.join(filePath, 'spaceautobattler.html');
      }
      const stream = createReadStream(filePath);
      // Minimal content-type mapping
      const ext = path.extname(filePath).toLowerCase();
      const map = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.glb': 'model/gltf-binary',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.svg': 'image/svg+xml',
      };
      res.statusCode = 200;
      res.setHeader('Content-Type', map[ext] || 'application/octet-stream');
      stream.pipe(res);
    } catch (err) {
      res.statusCode = 404;
      res.end('Not found');
    }
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = address && typeof address === 'object' ? address.port : address;
  const fileUrl = `http://127.0.0.1:${port}/spaceautobattler.html?debugPerf=1&showPerf=1`;

  // Launch Chromium with flags. We support GPU-accelerated headless runs via PERF_USE_GPU and PERF_CHROME_PATH.
  // Helper to attempt running with given browser launch options.
  async function tryRun(launchOptions) {
    // Ensure timers and rendering are not background-throttled
    const baseArgs = ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'];
    const opts = Object.assign({}, launchOptions);
    // Merge base args that mitigate background throttling; allow caller to add extra args
    opts.args = Array.isArray(launchOptions.args) ? [...baseArgs, ...launchOptions.args] : [...baseArgs];
    // If an executable path is provided (PERF_CHROME_PATH), prefer it
    if (launchOptions.executablePath) {
      opts.executablePath = launchOptions.executablePath;
    }
    const browser = await chromium.launch(opts);
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
      const pageErrors = [];
      // Log browser console messages to the Node console for easier debugging
      page.on('console', (msg) => {
        try {
          const text = msg.text();
          console.log(`[browser][console][${msg.type()}] ${text}`);
        } catch (e) {
          console.log('[browser][console] (failed to read message)');
        }
      });
      page.on('pageerror', (err) => {
        pageErrors.push(String(err));
        console.error('[browser][pageerror]', err);
      });

      await page.goto(fileUrl);
      // Bring page to front and focus to avoid requestAnimationFrame throttling
      try {
        await page.bringToFront();
        await page.evaluate(() => {
          try {
            if (document && document.body) {
              document.body.setAttribute('tabindex', '-1');
              document.body.focus();
            }
            if (typeof window.focus === 'function') window.focus();
          } catch (e) {
            // ignore
          }
        });
      } catch (e) {
        // ignore
      }
      // Increase wait timeout to give the app more time in CI/slow machines
      try {
        await waitForApp(page, { timeout: 60000 });
      } catch (err) {
        // Capture diagnostics: screenshot and page HTML
        try {
          await mkdir(path.resolve(OUTPUT_DIR), { recursive: true });
          const ts = new Date().toISOString().replace(/[:.]/g, '-');
          const screenshotPath = path.join(OUTPUT_DIR, `error-${ts}.png`);
          const htmlPath = path.join(OUTPUT_DIR, `error-${ts}.html`);
          await page.screenshot({ path: screenshotPath, fullPage: true });
          const html = await page.content();
          await writeFile(htmlPath, html, 'utf8');
          console.error(`[perf] Captured screenshot to ${screenshotPath} and HTML to ${htmlPath}`);
        } catch (diagErr) {
          console.error('[perf] Failed to capture diagnostics', diagErr);
        }
        const combined = `${err.message || err}\n${pageErrors.join('\n')}`;
        const e = new Error(combined);
        e.pageErrors = pageErrors;
        throw e;
      }

      // Run scenarios
      const scenarioResults = [];
      for (const shipCount of SCENARIOS) {
        console.log(`[perf] Running scenario with ${shipCount} ships …`);
        const result = await runScenario(page, shipCount);
        scenarioResults.push({
          shipCount,
          summary: result.summary,
          counts: result.counts,
          settleMs: result.settleMs,
          minFrames: result.minFrames,
        });
        console.log(
          `[perf] ships=${shipCount} avgFrameMs=${result.summary.avgFrameMs} p95FrameMs=${result.summary.p95FrameMs}`,
        );
      }

      await mkdir(OUTPUT_DIR, { recursive: true });
      const outputFile = path.join(
        OUTPUT_DIR,
        `baseline-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
      );
      const payload = {
        version: 1,
        generatedAt: new Date().toISOString(),
        minFrames: MIN_FRAMES,
        settleMs: SETTLE_MS,
        scenarios: scenarioResults,
      };
      await writeFile(outputFile, JSON.stringify(payload, null, 2), 'utf8');
      console.log(`[perf] Baseline metrics written to ${outputFile}`);
    } finally {
      await browser.close();
    }
  }

    try {
      // Decide preferred headless/headful based on env or sensible defaults
      // If PERF_HEADLESS is explicitly provided (true/false), use it; otherwise keep existing heuristics
      const explicitHeadless = PERF_HEADLESS;

      // Prepare GPU vs software flags
      const gpuArgs = ['--enable-gpu', '--enable-accelerated-2d-canvas', '--disable-software-rasterizer', '--ignore-gpu-blocklist', '--disable-dev-shm-usage'];
      const softwareArgs = ['--use-gl=swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--disable-dev-shm-usage'];

      // Build launch options depending on platform and env
      if (PERF_USE_GPU) {
        // User asked for GPU acceleration. Prefer headless unless user forced headed on Windows.
        const headlessPref = explicitHeadless !== null ? explicitHeadless : true;
        const launchOpts = {
          headless: headlessPref,
          args: gpuArgs,
          executablePath: PERF_CHROME_PATH,
        };
        console.log(`[perf] Launching Chromium (GPU) headless=${headlessPref} executablePath=${PERF_CHROME_PATH || '[playwright-managed]'} args=${JSON.stringify(gpuArgs)}`);
        try {
          await tryRun(launchOpts);
        } catch (err) {
          console.warn('[perf] GPU-accelerated run failed:', err.message || err);
          // If it failed due to WebGL, try a headed fallback using GPU
          const msg = String(err.message || err).toLowerCase();
          if (msg.includes('webgl') || (err.pageErrors && err.pageErrors.some((p) => p.toLowerCase().includes('webgl')))) {
            console.warn('[perf] GPU headless failed; retrying with headful GPU-enabled Chromium');
            await tryRun({ headless: false, args: gpuArgs, executablePath: PERF_CHROME_PATH });
          } else {
            throw err;
          }
        }
      } else {
        // PERF_USE_GPU not requested — use previous strategy (software GL / headful fallback)
        if (process.platform === 'win32') {
          const headlessPref = explicitHeadless !== null ? explicitHeadless : false;
          console.log(`[perf] Launching Chromium on Windows headless=${headlessPref} (software GL disabled unless PERF_USE_GPU=1)`);
          await tryRun({ headless: headlessPref });
        } else {
          const headlessPref = explicitHeadless !== null ? explicitHeadless : true;
          try {
            console.log(`[perf] Launching Chromium (software GL) headless=${headlessPref}`);
            await tryRun({ headless: headlessPref, args: softwareArgs });
          } catch (err) {
            const msg = String(err.message || err).toLowerCase();
            if (msg.includes('webgl') || (err.pageErrors && err.pageErrors.some((p) => p.toLowerCase().includes('webgl')))) {
              console.warn('[perf] WebGL context failed in headless software mode; retrying with headful Chromium');
              await tryRun({ headless: false });
            } else {
              throw err;
            }
          }
        }
      }
    } finally {
      server.close();
    }
}

collectBaseline().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
