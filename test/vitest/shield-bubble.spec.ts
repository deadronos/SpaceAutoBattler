import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('ShieldBubble anchoring (static check)', () => {
  it('uses local origin/identity and scales via radius prop', () => {
    const file = path.resolve(__dirname, '../../src/components/Ship.tsx');
    const txt = fs.readFileSync(file, 'utf-8');
    // Basic heuristics to prevent regression: ensure we reset local transform
    expect(txt).toContain('mesh.position.set(0, 0, 0)');
    expect(txt).toContain('mesh.quaternion.identity()');
    // No hard-coded constant scalar; should use computed radius variable
    expect(txt).toContain('const r = radius ??');
    expect(txt).toContain('mesh.scale.setScalar(r)');
  });
});
