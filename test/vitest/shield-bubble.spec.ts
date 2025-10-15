import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('ShieldBubble anchoring (static check)', () => {
  it('uses local origin/identity and scales via radius prop', () => {
    const file = path.resolve(__dirname, '../../src/components/ship/ShipShield.tsx');
    const txt = fs.readFileSync(file, 'utf-8');
    // Basic heuristics to prevent regression: ensure we reset local transform
    expect(txt).toContain('mesh.position.set(0, 0, 0)');
    expect(txt).toContain('mesh.quaternion.identity()');
    // No hard-coded constant scalar; should use computed radius variable
    expect(txt).toContain('const r = radius ??');
    // Accept either legacy uniform scale or new non-uniform ellipsoid scale
    const ok = txt.includes('mesh.scale.setScalar(r)') || txt.includes('mesh.scale.set(');
    expect(ok).toBe(true);
  });

  it('includes conditional rendering for low shield levels', () => {
    const file = path.resolve(__dirname, '../../src/components/ship/ShipShield.tsx');
    const txt = fs.readFileSync(file, 'utf-8');
    // Ensure shield bubble is conditionally rendered when shields are very low
    expect(txt).toContain('minShieldThreshold');
    expect(txt).toMatch(/if\s*\([^)]*<\s*minShieldThreshold\)/);
    expect(txt).toContain('return <></>;');
  });
});
