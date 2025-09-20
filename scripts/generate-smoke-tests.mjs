#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const repoRoot = process.cwd();
const srcDir = path.join(repoRoot, 'src');
const outDir = path.join(repoRoot, 'test', 'vitest', 'smoke');
const outFile = path.join(outDir, 'import_all.spec.ts');

// Files or globs to exclude (relative to repo root)
const excludes = [
  'src/renderer',
  'src/main.ts',
  'src/simWorker.ts',
  'src/ui',
  'src/assets',
  'src/styles',
  'src/renderer/shaders',
  'src/renderer/effects',
];

function isExcluded(p) {
  for (const ex of excludes) {
    if (p.startsWith(path.join(repoRoot, ex).replace(/\\/g, '/'))) return true;
  }
  return false;
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (isExcluded(full.replace(/\\/g, '/'))) continue;
    if (e.isDirectory()) files.push(...walk(full));
    else if (e.isFile() && full.endsWith('.ts')) files.push(full);
  }
  return files;
}

function toImportPath(filePath) {
  // filePath is absolute to repo; convert to relative from test/vitest dir
  const rel = path.relative(path.join(repoRoot, 'test', 'vitest'), filePath);
  // Replace .ts with .js to match how tests import modules in this repo
  const withJs = rel.replace(/\\/g, '/').replace(/\.ts$/, '.js');
  // Ensure relative paths start with ./ or ../
  return withJs.startsWith('.') ? withJs : `./${withJs}`;
}

function ensureOutDir() {
  fs.mkdirSync(outDir, { recursive: true });
}

function generate() {
  const files = walk(srcDir).filter(f => !f.endsWith('.d.ts'));
  ensureOutDir();

  // Heavily mocked modules to avoid pulling large/native deps during import.
  const heavyMocks = [
    'three',
    'postprocessing',
    'pixi.js',
    'puppeteer',
    'playwright',
    '@dimforge/rapier3d-compat',
    'gsap',
    'idb-keyval',
  ];

  const imports = files.map(f => toImportPath(f));

  const content = "import { describe, it, expect, vi } from 'vitest';\n\n" +
    "// Auto-generated smoke test. Tries to import many project modules to increase\n" +
    "// coverage. We mock heavy external libs above so imports don't fail.\n" +
    `const heavyMocks = ${JSON.stringify(heavyMocks, null, 2)};\n` +
    "heavyMocks.forEach(m => {\n" +
    "  try { vi.mock(m, () => ({})); } catch (e) { /* ignore */ }\n" +
    "});\n\n" +
    `const modules = ${JSON.stringify(imports, null, 2)};\n\n` +
    "describe('smoke imports', () => {\n" +
    "  for (const m of modules) {\n" +
    "    it('imports ' + m, async () => {\n" +
    "      // dynamic import so mocking can be applied first\n" +
    "      let ok = true;\n" +
    "      try {\n" +
    "        const mod = await import(m);\n" +
    "        expect(mod).toBeTruthy();\n" +
    "      } catch (err) {\n" +
    "        ok = false;\n" +
    "        console.warn('smoke import failed', m, err && err.message ? err.message : err);\n" +
    "      }\n" +
    "      expect(ok).toBe(true);\n" +
    "    });\n" +
    "  }\n" +
    "});\n";

  fs.writeFileSync(outFile, content, 'utf8');
  console.log('Wrote', outFile, `(${imports.length} modules)`);
}

generate();
