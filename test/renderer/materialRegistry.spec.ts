import { describe, it, expect, vi } from 'vitest';
import { getInstanceFriendlyMaterial } from '../../src/renderer/materialRegistry.js';

describe('materialRegistry instance-friendly helpers', () => {
  it('returns original material when instance colors are supported', () => {
    const info = getInstanceFriendlyMaterial('muzzle:flash', { requireInstanceColor: true });
    expect(info.supportsInstanceColor).toBe(true);
    expect(info.material).toBeDefined();
    info.material.dispose();
  });

  it('falls back to provided key when base material lacks instance colors', () => {
    const fallbackSpy = vi.fn();
    const info = getInstanceFriendlyMaterial('bullet:laser', {
      requireInstanceColor: true,
      fallbackKey: 'muzzle:flash',
      onFallback: fallbackSpy,
    });
    expect(info.supportsInstanceColor).toBe(true);
    expect(fallbackSpy).toHaveBeenCalledWith({
      requestedKey: 'bullet:laser',
      resolvedKey: 'muzzle:flash',
      reason: 'no-instance-color',
    });
    info.material.dispose();
  });

  it('uses default atlas-friendly fallback when material is missing', () => {
    const fallbackSpy = vi.fn();
    const info = getInstanceFriendlyMaterial('missing:key', {
      requireInstanceColor: true,
      onFallback: fallbackSpy,
    });
    expect(info.supportsInstanceColor).toBe(true);
    expect(fallbackSpy).toHaveBeenCalledWith({
      requestedKey: 'missing:key',
      resolvedKey: null,
      reason: 'missing',
    });
    info.material.dispose();
  });
});
