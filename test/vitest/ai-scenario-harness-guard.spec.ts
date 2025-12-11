import { describe, it, expect } from 'vitest';
import { join } from 'path';
import { readdirSync, readFileSync, statSync } from 'fs';

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) {
      walk(full, acc);
    } else if (s.isFile()) {
      acc.push(full);
    }
  }
  return acc;
}

describe('aiScenarioHarness test-only usage guard', () => {
  it('ensures src/ does not import test/support/aiScenarioHarness', () => {
    const srcRoot = join(__dirname, '..', '..', 'src');
    const files = walk(srcRoot).filter(
      (file) =>
        file.endsWith('.ts') ||
        file.endsWith('.tsx') ||
        file.endsWith('.js') ||
        file.endsWith('.jsx'),
    );

    const forbiddenPatterns = [
      'test/support/aiScenarioHarness',
      'test/support/aiScenarioHarness.js',
      'test\\support\\aiScenarioHarness',
      'test\\support\\aiScenarioHarness.js',
    ];

    const offenders: string[] = [];

    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      if (forbiddenPatterns.some((pattern) => content.includes(pattern))) {
        offenders.push(file);
      }
    }

    if (offenders.length > 0) {
      expect.fail(
        `Forbidden imports from test/support/aiScenarioHarness found in src/:\n` +
          offenders.map((f) => ` - ${f}`).join('\n'),
      );
    }
  });
});
