import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vite-plus/test';

// Guard: every relative mock path in the test suite must resolve to a real
// file. A stale path silently makes the mock a no-op and the test loses the
// isolation it claims to have.

const ROOT = process.cwd();
const TEST_DIR = path.join(ROOT, 'test');
const SELF = fileURLToPath(import.meta.url);
const MOCK_CALL = /vi\.mock\(\s*['"]([^'"]+)['"]/g;
const MODULE_EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

function listSpecFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'playwright' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listSpecFiles(full));
    } else if (/\.(spec|test)\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function resolveModule(baseWithoutExt: string): string | null {
  for (const ext of MODULE_EXTS) {
    if (fs.existsSync(baseWithoutExt + ext)) return baseWithoutExt + ext;
  }
  for (const ext of MODULE_EXTS) {
    const asIndex = path.join(baseWithoutExt, `index${ext}`);
    if (fs.existsSync(asIndex)) return asIndex;
  }
  return null;
}

describe('spec vi.mock specifiers', () => {
  it('all relative vi.mock paths resolve to real files', () => {
    const unresolved: string[] = [];

    for (const specFile of listSpecFiles(TEST_DIR)) {
      if (path.resolve(specFile) === SELF) continue;
      const content = fs.readFileSync(specFile, 'utf8');
      for (const match of content.matchAll(MOCK_CALL)) {
        const specifier = match[1];
        if (!specifier.startsWith('.')) continue;

        const abs = path.resolve(path.dirname(specFile), specifier);
        const baseWithoutExt = abs.replace(/\.(js|jsx|ts|tsx|mjs|cjs)$/, '');
        const resolved = fs.existsSync(abs) ? abs : resolveModule(baseWithoutExt);

        if (!resolved) {
          unresolved.push(`${path.relative(ROOT, specFile)} -> ${specifier}`);
        }
      }
    }

    expect(unresolved, `Unresolved vi.mock paths:\n${unresolved.join('\n')}`).toEqual([]);
  });
});
