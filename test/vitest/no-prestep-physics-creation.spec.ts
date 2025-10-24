import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, extname } from 'path';

function listFiles(dir: string, files: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      listFiles(full, files);
    } else if (extname(full) === '.ts' || extname(full) === '.js') {
      files.push(full);
    }
  }
  return files;
}

describe('No pre-step physics world mutation rule', () => {
  it('detects physics body/collider creation or removal inside enqueueDeferredMutation closures', () => {
    const src = join(process.cwd(), 'src');
    const files = listFiles(src);
    const violations: { file: string; snippet: string }[] = [];
    const pattern =
      /enqueueDeferredMutation\s*\([\s\S]*?\)\s*=>\s*{[\s\S]*?(createRigidBody|createCollider|removeRigidBody|removeCollider)/g;

    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      let m: RegExpExecArray | null;
      while ((m = pattern.exec(content)) !== null) {
        const start = Math.max(0, m.index - 40);
        const end = Math.min(content.length, m.index + (m[0]?.length ?? 200) + 40);
        const snippet = content.substring(start, end);
        violations.push({ file: file.replace(process.cwd() + '\\', ''), snippet });
      }
    }

    if (violations.length > 0) {
      // Provide a readable message for maintainers
      const lines = ['Found pre-step physics mutations inside enqueueDeferredMutation closures:'];
      for (const v of violations) {
        lines.push(`- ${v.file}:`);
        lines.push(v.snippet.replace(/\n/g, '\n    '));
      }
      // Fail the test with the detailed message
      throw new Error(lines.join('\n'));
    }

    expect(violations.length).toBe(0);
  });
});
