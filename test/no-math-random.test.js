import { test, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

test('no direct Math.random usage in src/', () => {
  const srcDir = path.resolve(__dirname, '..', 'src');
  const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.js'));
  const offenders = [];
  for (const f of files) {
    // allow Math.random in rng.js (it's the fallback when unseeded)
    if (f === 'rng.js') continue;
    const content = fs.readFileSync(path.join(srcDir, f), 'utf8');
    if (/Math\.random\s*\(/.test(content)) offenders.push(f);
  }
  expect(offenders, `Found direct Math.random usage in src: ${offenders.join(', ')}`).toEqual([]);
});
