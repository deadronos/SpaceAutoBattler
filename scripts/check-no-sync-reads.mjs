#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const scanRoot = path.join(repoRoot, 'src');
const allowedExtensions = new Set(['.ts', '.js', '.mjs', '.cjs']);

const syncPatterns = [
  'readFileSync',
  'readdirSync',
  'statSync',
  'existsSync',
  'writeFileSync',
  'appendFileSync',
  'unlinkSync',
  'openSync',
];

function containsSyncCall(text) {
  return syncPatterns.some((p) => text.includes(p));
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === 'dist' || e.name === '.git') continue;
      files.push(...(await walk(full)));
    } else if (e.isFile()) {
      if (allowedExtensions.has(path.extname(e.name))) files.push(full);
    }
  }
  return files;
}

async function reportMatches(files) {
  const matches = [];
  for (const f of files) {
    const content = await fs.readFile(f, 'utf8');
    if (!containsSyncCall(content)) continue;
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (syncPatterns.some((p) => line.includes(p))) {
        matches.push({ file: f, line: i + 1, text: line.trim() });
      }
    }
  }

  if (matches.length === 0) {
    console.log(
      'check-no-sync-reads: OK — no synchronous fs.*Sync calls found in src (quick-scan).',
    );
    return 0;
  }

  console.error(
    'check-no-sync-reads: Found synchronous fs calls (these may block the event loop):',
  );
  for (const m of matches) {
    console.error(`${m.file}:${m.line}: ${m.text}`);
  }
  console.error('\nPlease remove or replace with asynchronous fs APIs before building.');
  return 2;
}

async function main() {
  try {
    const files = await walk(scanRoot);
    const code = await reportMatches(files);
    process.exit(code);
  } catch (err) {
    console.error('check-no-sync-reads: error', err.message);
    process.exit(1);
  }
}

main();
