#!/usr/bin/env node
import { spawnSync, spawn } from 'child_process';
import glob from 'glob';
import path from 'path';
import { chromium } from 'playwright';

// Candidate globs to test (files under renderer and ship components)
const candidates = [
  ...glob.sync('src/renderer/**/*.tsx'),
  ...glob.sync('src/components/ship/**/*.tsx')
];

if (candidates.length === 0) {
  console.error('No candidate files found.');
  process.exit(1);
}

console.log(`Found ${candidates.length} candidates to test.`);

async function testFile(file) {
  console.log('\n---\nTesting', file);
  // Build with REACT_COMPILER_INCLUDE=<file>
  const env = { ...process.env, REACT_COMPILER_INCLUDE: file };
  const build = spawnSync('npm', ['run', 'build:dev'], { stdio: 'inherit', env, shell: true });
  if (build.status !== 0) {
    console.error('Build failed for', file);
    return false;
  }

  // Serve dist and run Playwright to look for clamp warning.
  const server = spawn('npx', ['http-server', './dist', '-p', '8081', '-c-1'], { shell: true, stdio: 'inherit' });
  // Give server time to start
  await new Promise(r => setTimeout(r, 800));

  let found = false;
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('console', (msg) => {
    const text = msg.text();
    if (text && text.includes('[ShieldBubble] Clamped shieldScale')) {
      console.log('Detected clamp warning for', file);
      found = true;
    }
  });

  try {
    await page.goto('http://127.0.0.1:8081/spaceautobattler.html', { waitUntil: 'load', timeout: 5000 });
    // Let runtime run a bit to allow shields to initialize
    await page.waitForTimeout(2500);
  } catch (e) {
    console.error('Playwright load failed for', file, e.message);
  }

  await browser.close();
  // Kill server
  try { server.kill(); } catch (e) { /* ignore */ }
  return found;
}

(async () => {
  for (const f of candidates) {
    const rel = f; // already relative
    const ok = await testFile(rel);
    if (ok) {
      console.log('\n=== Found culprit file:', rel);
      process.exit(0);
    }
  }

  console.log('\n=== No single-file inclusion triggered the clamp. Consider testing combinations or bisecting directories.');
  process.exit(0);
})();
