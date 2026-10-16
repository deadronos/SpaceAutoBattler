#!/usr/bin/env node
// Dev-server boot smoke test.
//
// The Playwright suite runs against the production build, so failures that only occur under
// Vite's dev server (e.g. dependency pre-bundling changing what `?url` imports resolve to)
// go unnoticed. This script starts `vp dev`, loads the app in headless Chromium and fails if
// the page throws an uncaught error or never mounts its WebGL canvas.
import { spawn } from 'child_process';
import { chromium } from 'playwright';

const portArgIndex = process.argv.findIndex((arg) => arg === '--port' || arg === '-p');
const port = portArgIndex >= 0 ? Number(process.argv[portArgIndex + 1]) : 5199;
const url = `http://localhost:${port}/spaceautobattler.html`;
const STARTUP_TIMEOUT_MS = 60_000;
const CANVAS_TIMEOUT_MS = 30_000;
// Give module-load side effects time to run after the canvas appears.
const SETTLE_MS = 3_000;

function startDevServer() {
  const server = spawn('vp', ['dev', '--port', String(port)], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, FORCE_COLOR: '0' },
    // `vp` launches Vite as a child process; run it in its own process group so shutdown can
    // signal the whole group and not leave Vite holding the port.
    detached: true,
  });
  let output = '';

  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`dev server did not start within ${STARTUP_TIMEOUT_MS}ms`)),
      STARTUP_TIMEOUT_MS,
    );
    const onData = (chunk) => {
      // Vite styles the banner (e.g. a bold port number) regardless of FORCE_COLOR.
      const text = chunk.toString().replace(/\x1b\[[0-9;]*m/g, '');
      output += text;
      if (text.includes(`localhost:${port}`)) {
        clearTimeout(timer);
        resolve();
      }
    };
    server.stdout.on('data', onData);
    server.stderr.on('data', onData);
    server.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`dev server exited early with code ${code}:\n${output}`));
    });
  });

  const stop = () => {
    try {
      process.kill(-server.pid, 'SIGTERM');
    } catch {
      // already exited
    }
  };

  return { ready, stop };
}

async function run() {
  const { ready, stop } = startDevServer();
  let browser;
  try {
    await ready;
    console.log(`[smoke-dev] dev server ready on port ${port}`);
    browser = await chromium.launch({
      args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
    });
    const page = await browser.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error));
    // Console errors are diagnostics only: they often carry the root cause of a later throw.
    page.on('console', (message) => {
      if (message.type() === 'error') console.error(`[smoke-dev] console.error: ${message.text()}`);
    });

    await page.goto(url, { waitUntil: 'load' });
    console.log(`[smoke-dev] loaded ${url}`);
    await page.waitForSelector('canvas', { timeout: CANVAS_TIMEOUT_MS });
    await page.waitForTimeout(SETTLE_MS);

    if (pageErrors.length > 0) {
      for (const error of pageErrors)
        console.error(`[smoke-dev] page error: ${error.stack ?? error}`);
      throw new Error(`${pageErrors.length} uncaught page error(s) under the dev server`);
    }
    console.log(`[smoke-dev] OK: ${url} mounted a canvas with no uncaught errors`);
  } finally {
    await browser?.close();
    stop();
  }
}

run().catch((error) => {
  console.error(`[smoke-dev] FAILED: ${error.message}`);
  process.exit(1);
});
