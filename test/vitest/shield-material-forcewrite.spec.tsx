import { describe, it, expect } from 'vitest';
import { createShieldHexShaderMaterial } from '../../src/renderer/materialRegistry.js';

describe('Shield material factory: force-colorWrite opt-out', () => {
  it('should mark shader materials so BloomProvider does not disable colorWrite', () => {
    const mat = createShieldHexShaderMaterial('fighter', 'blue');
    // Desired: shader factory sets a marker so the BloomProvider will not
    // disable colorWrite for this critical gameplay visual.
    expect(mat.userData && (mat.userData as any).__copilot_forceColorWrite).toBe(true);
    mat.dispose();
  });
});
