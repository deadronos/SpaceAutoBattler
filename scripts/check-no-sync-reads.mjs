#!/usr/bin/env node
// Quick check script to detect forbidden synchronous GPU/canvas read APIs
// Exits with code 1 if any disallowed occurrences are found outside allowed files.

import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(new URL(import.meta.url).pathname.replace(/^(?:[A-Z]:)?\//i, '/').replace(/^\//, ''));
// Patterns to search for (simple grep-style)
const patterns = [
  'getImageData(',
  'readRenderTargetPixels',
  'readPixels(',
  'WebGLRenderingContext.prototype.readPixels',
  'WebGL2RenderingContext.prototype.readPixels'
];

// Files to ignore (well-known safe wrappers/instrumentation)
const allowlist = [
  'src/renderer/effects.ts'
];

function runGrep(pattern) {
  // Use node's recursive directory scan to avoid shell differences
  const results = [];
  const walk = (dir) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name === 'dist' || e.name === '.git') continue;
        walk(full);
      } else if (e.isFile()) {
        if (!full.endsWith('.ts') && !full.endsWith('.js') && !full.endsWith('.mjs')) continue;
        const rel = path.relative(process.cwd(), full).replace(/\\/g, '/');
        if (allowlist.some(a => rel === a)) continue;
        const txt = fs.readFileSync(full, 'utf8');
        if (txt.indexOf(pattern) !== -1) results.push({ file: rel, snippet: getSnippet(txt, pattern) });
      }
    }
  };
  walk(path.join(process.cwd(), 'src'));
  return results;
}

function getSnippet(text, pat) {
  const idx = text.indexOf(pat);
  if (idx === -1) return '';
  const start = Math.max(0, idx - 80);
  const end = Math.min(text.length, idx + pat.length + 80);
  return text.slice(start, end).replace(/\n/g, ' ');
}

let found = [];
for (const p of patterns) {
  const r = runGrep(p);
  if (r.length) {
    found = found.concat(r.map(x => ({ pattern: p, file: x.file, snippet: x.snippet })));
  }
}

if (found.length) {
  console.error('\nForbidden synchronous-read API usages found:');
  for (const f of found) {
    console.error(` - Pattern: ${f.pattern}  File: ${f.file}`);
    console.error(`   Snippet: ${f.snippet}\n`);
  }
  console.error('To allow a legitimate occurrence, add the file to the allowlist inside scripts/check-no-sync-reads.mjs');
  process.exitCode = 1;
  process.exit(1);
} else {
  console.log('No forbidden sync-read patterns found.');
  process.exit(0);
}
