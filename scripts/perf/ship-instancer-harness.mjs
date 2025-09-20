#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { existsSync, createReadStream, statSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { createServer } from 'node:http';
import { chromium } from 'playwright';

const OUTPUT_DIR = process.env.PERF_OUTPUT_DIR ?? path.resolve('perf', 'runs');
const DEFAULT_SHIP_COUNT = 400;
const DEFAULT_MIN_FRAMES = 240;
const DEFAULT_SETTLE_MS = 1000;

function parseIntEnv(key, fallback) {
  const raw = process.env[key];
  if (!raw) return fallback;
  const num = Number.parseInt(raw, 10);
  return Number.isFinite(num) ? num : fallback;
}

const SHIP_COUNT = parseIntEnv('INSTANCER_SHIP_COUNT', DEFAULT_SHIP_COUNT);
const MIN_FRAMES = Math.max(90, parseIntEnv('INSTANCER_MIN_FRAMES', DEFAULT_MIN_FRAMES));
const SETTLE_MS = Math.max(100, parseIntEnv('INSTANCER_SETTLE_MS', DEFAULT_SETTLE_MS));

async function runCommand(command, args) {
  return new Promise((resolve, reject) => {
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
  if ((process.env.PERF_SKIP_BUILD || '').toLowerCase() === '1') {
    console.log('[instancer-perf] Skipping build step (PERF_SKIP_BUILD=1)');
    return;
  }
  console.log('[instancer-perf] Running npm run build …');
  await runCommand('npm', ['run', 'build']);
}

function createStaticServer(rootDir) {
  return createServer((req, res) => {
    try {
      const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      let filePath = path.join(rootDir, urlPath);
      if (urlPath === '/' || urlPath.endsWith('/')) {
        filePath = path.join(rootDir, 'spaceautobattler.html');
      }
      if (!filePath.startsWith(rootDir)) {
        res.statusCode = 403;
        res.end('Forbidden');
        return;
      }
      const stats = statSync(filePath);
      if (stats.isDirectory()) {
        filePath = path.join(filePath, 'spaceautobattler.html');
      }
      const stream = createReadStream(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const types = {
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
      res.setHeader('Content-Type', types[ext] || 'application/octet-stream');
      stream.pipe(res);
    } catch (err) {
      res.statusCode = 404;
      res.end('Not found');
    }
  });
}

async function waitForApp(page) {
  await page.waitForFunction(() => {
    return Boolean(window.__appDebug && typeof window.__appDebug.configurePerfScenario === 'function' && window.perf);
  });
}

async function collectMetrics(page) {
  return page.evaluate(
    ({ shipCount, minFrames, settleMs }) => {
      const perf = window.perf;
      const inst = window.__shipInstancer;
      const summary = perf?.getSummary();
      const relevant = summary
        ? summary.subsystems.filter((sub) => sub.name.startsWith('renderer.'))
        : [];
      return {
        frameCount: summary?.frameCount ?? 0,
        avgFrameMs: summary?.avgFrameMs ?? 0,
        p95FrameMs: summary?.p95FrameMs ?? 0,
        settleMs,
        minFrames,
        shipCount,
        rendererSubsystems: relevant,
        instancerStats: inst?.getStats ? inst.getStats() : null,
      };
    },
    { shipCount: SHIP_COUNT, minFrames: MIN_FRAMES, settleMs: SETTLE_MS },
  );
}

async function runHarness() {
  await ensureBuild();
  const distDir = path.resolve('dist');
  const distHtml = path.join(distDir, 'spaceautobattler.html');
  if (!existsSync(distHtml)) {
    throw new Error('dist/spaceautobattler.html not found. Run npm run build first.');
  }

  const server = createStaticServer(distDir);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : address;
  const url = `http://127.0.0.1:${port}/spaceautobattler.html?debugPerf=1&showPerf=1`;

  const launchOptions = {
    headless: true,
    args: ['--use-gl=swiftshader', '--disable-dev-shm-usage', '--ignore-gpu-blocklist'],
  };

  const browser = await chromium.launch(launchOptions);
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    await waitForApp(page);

    await page.evaluate(() => {
      window.perf?.clear();
    });

    const scenario = await page.evaluate((count) => {
      const helper = window.__appDebug?.configurePerfScenario;
      if (typeof helper !== 'function') {
        return { ok: false, error: 'configurePerfScenario missing' };
      }
      const result = helper({ totalShips: count, running: true });
      if (!result) {
        return { ok: false, error: 'configurePerfScenario returned null' };
      }
      return { ok: true, data: result };
    }, SHIP_COUNT);

    if (!scenario.ok) {
      throw new Error(`[instancer-perf] Failed to configure scenario: ${scenario.error}`);
    }

    await page.waitForTimeout(SETTLE_MS);
    await page.waitForFunction(
      (target) => {
        const perf = window.perf;
        if (!perf) return false;
        const summary = perf.getSummary();
        return summary.frameCount >= target;
      },
      MIN_FRAMES,
      { timeout: 45000 },
    );

    const metrics = await collectMetrics(page);

    await mkdir(OUTPUT_DIR, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputPath = path.join(OUTPUT_DIR, `ship-instancer-${timestamp}.json`);
    await writeFile(outputPath, JSON.stringify({ metrics, scenario: scenario.data }, null, 2), 'utf8');
    console.log(`[instancer-perf] Metrics written to ${outputPath}`);
  } finally {
    await browser.close();
    server.close();
  }
}

runHarness().catch((err) => {
  console.error('[instancer-perf] Harness failed', err);
  process.exitCode = 1;
});
