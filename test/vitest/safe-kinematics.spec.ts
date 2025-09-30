import { describe, expect, it, vi } from 'vitest';
import { safeSetNextKinematicTranslation } from '../../src/game/physics/safeKinematics.js';

describe('safeSetNextKinematicTranslation', () => {
  it('invokes the underlying setter when coordinates are finite', () => {
    const setter = vi.fn();
    const body = { setNextKinematicTranslation: setter };

    safeSetNextKinematicTranslation(body, 1, 2, 3);

    expect(setter).toHaveBeenCalledTimes(1);
    expect(setter).toHaveBeenCalledWith({ x: 1, y: 2, z: 3 });
  });

  it('ignores missing bodies or non-finite coordinates', () => {
    const setter = vi.fn();
    const body = { setNextKinematicTranslation: setter };

    safeSetNextKinematicTranslation(null, 1, 2, 3);
    safeSetNextKinematicTranslation(undefined, 1, 2, 3);
    safeSetNextKinematicTranslation(body, Number.POSITIVE_INFINITY, 0, 0);

    expect(setter).not.toHaveBeenCalled();
  });

  it('swallows exceptions from the underlying Rapier call', () => {
    const setter = vi.fn(() => {
      throw new Error('Rapier panic');
    });
    const body = { setNextKinematicTranslation: setter };

    expect(() => safeSetNextKinematicTranslation(body, 4, 5, 6)).not.toThrow();
    expect(setter).toHaveBeenCalledTimes(1);
  });
});
