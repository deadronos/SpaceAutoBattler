import { describe, expect, it, vi } from 'vitest';
import { safeSetNextKinematicTranslation, safeSetNextKinematicRotation } from '../../src/game/physics/safeKinematics.js';

describe('safeSetNextKinematicTranslation', () => {
  it('invokes the underlying setter when coordinates are finite', () => {
    const setter = vi.fn();
    const body = { setNextKinematicTranslation: setter };

    safeSetNextKinematicTranslation(null, body, 1, 2, 3);

    expect(setter).toHaveBeenCalledTimes(1);
    expect(setter).toHaveBeenCalledWith({ x: 1, y: 2, z: 3 });
  });

  it('ignores missing bodies or non-finite coordinates', () => {
    const setter = vi.fn();
    const body = { setNextKinematicTranslation: setter };

    safeSetNextKinematicTranslation(null, null, 1, 2, 3);
    safeSetNextKinematicTranslation(null, undefined, 1, 2, 3);
    safeSetNextKinematicTranslation(null, body, Number.POSITIVE_INFINITY, 0, 0);

    expect(setter).not.toHaveBeenCalled();
  });

  it('swallows exceptions from the underlying Rapier call', () => {
    const setter = vi.fn(() => {
      throw new Error('Rapier panic');
    });
    const body = { setNextKinematicTranslation: setter };

    expect(() => safeSetNextKinematicTranslation(null, body, 4, 5, 6)).not.toThrow();
    expect(setter).toHaveBeenCalledTimes(1);
  });
});

describe('safeSetNextKinematicRotation', () => {
  it('invokes the underlying setter when components are finite', () => {
    const setter = vi.fn();
    const body = { setNextKinematicTranslation: () => {}, setNextKinematicRotation: setter } as unknown as any;

    safeSetNextKinematicRotation(null, body, 1, 2, 3, 1);

    expect(setter).toHaveBeenCalledTimes(1);
    expect(setter).toHaveBeenCalledWith({ x: 1, y: 2, z: 3, w: 1 });
  });

  it('ignores missing bodies or non-finite components', () => {
    const setter = vi.fn();
    const body = { setNextKinematicTranslation: () => {}, setNextKinematicRotation: setter } as unknown as any;

    safeSetNextKinematicRotation(null, null, 1, 2, 3, 1);
    safeSetNextKinematicRotation(null, undefined, 1, 2, 3, 1);
    safeSetNextKinematicRotation(null, body, Number.NaN, 0, 0, 1);

    expect(setter).not.toHaveBeenCalled();
  });

  it('swallows exceptions from the underlying Rapier call', () => {
    const setter = vi.fn(() => {
      throw new Error('Rapier panic');
    });
    const body = { setNextKinematicTranslation: () => {}, setNextKinematicRotation: setter } as unknown as any;

    expect(() => safeSetNextKinematicRotation(null, body, 4, 5, 6, 1)).not.toThrow();
    expect(setter).toHaveBeenCalledTimes(1);
  });
});
