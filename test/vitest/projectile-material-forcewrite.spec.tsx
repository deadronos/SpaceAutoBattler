import { describe, it, expect } from 'vite-plus/test';
import { createBeamLaserMaterial } from '../../src/renderer/materials/bulletMaterials.js';

describe('Projectile beam material factory: force-colorWrite opt-out', () => {
  it('should mark beam materials so BloomProvider keeps colorWrite enabled', () => {
    const mat = createBeamLaserMaterial();
    expect(mat.transparent).toBe(true);
    expect(mat.opacity).toBeGreaterThan(0);
    expect(mat.userData && (mat.userData as any).__copilot_forceColorWrite).toBe(true);
    mat.dispose();
  });
});
