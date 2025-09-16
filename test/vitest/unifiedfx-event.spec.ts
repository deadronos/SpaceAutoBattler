import { describe, it, expect, vi } from 'vitest';
import { createInitialState } from '../../src/core/gameState.js';
import { ProjectileSystem } from '../../src/core/systems/projectileSystem.js';

describe('Projectile -> unifiedFX wiring', () => {
  it('calls unifiedFX.handleExplosion when a hit event is emitted', async () => {
    const state: any = createInitialState('test-seed');

    // Minimal unifiedFX stub with a spy on handleExplosion
    const unifiedFXStub = {
      handleExplosion: vi.fn(async (_pos: { x: number; y: number; z: number }, _int?: number) => {
        return Promise.resolve();
      }),
      update: () => {},
      dispose: () => {},
      setQuality: () => {},
    } as any;

    state.unifiedFX = unifiedFXStub;

    const ps = new ProjectileSystem(state as any);

    // Register the same wiring main.ts uses: on hit -> unifiedFX.handleExplosion
    ps.onProjectileEvent((evt: any) => {
      try {
        if (evt && evt.type === 'hit' && evt.hitResult && evt.hitResult.hitPosition) {
          const intensity = Math.min(2, 1 + (evt.hitResult.damage ?? 1) * 0.1);
          // call without awaiting to mimic bootstrap wiring
          void (state.unifiedFX as any).handleExplosion(evt.hitResult.hitPosition, intensity);
        }
      } catch (_e) {
        void _e;
      }
    });

    // Emit a synthetic 'hit' event using the internal emitter (private in TS,
    // but accessible at runtime). This simulates the ProjectileSystem reporting a hit.
    const fakeEvent = {
      type: 'hit',
      bulletId: 123,
      timestamp: state.time,
      sourceShipId: 1,
      targetId: 2,
      hitResult: {
        bulletId: 123,
        targetId: 2,
        damage: 5,
        hitPosition: { x: 10, y: 20, z: 30 },
        penetrated: true,
      },
    } as any;

    // Call the private emitEvent method
    (ps as any).emitEvent(fakeEvent);

    // Allow any microtasks to run (handleExplosion is async)
    await Promise.resolve();

    expect(unifiedFXStub.handleExplosion).toHaveBeenCalledTimes(1);
    // intensity = min(2, 1 + damage*0.1) = min(2, 1+0.5) = 1.5
    expect(unifiedFXStub.handleExplosion).toHaveBeenCalledWith({ x: 10, y: 20, z: 30 }, 1.5);
  });

  it('does NOT call unifiedFX.handleExplosion for non-hit events', async () => {
    const state: any = createInitialState('test-seed');

    const unifiedFXStub = {
      handleExplosion: vi.fn(async () => Promise.resolve()),
      update: () => {},
      dispose: () => {},
      setQuality: () => {},
    } as any;

    state.unifiedFX = unifiedFXStub;
    const ps = new ProjectileSystem(state as any);

    ps.onProjectileEvent((evt: any) => {
      try {
        if (evt && evt.type === 'hit' && evt.hitResult && evt.hitResult.hitPosition) {
          const intensity = Math.min(2, 1 + (evt.hitResult.damage ?? 1) * 0.1);
          void (state.unifiedFX as any).handleExplosion(evt.hitResult.hitPosition, intensity);
        }
      } catch (_e) {
        void _e;
      }
    });

    const nonHitEvent = {
      type: 'fired',
      bulletId: 999,
      timestamp: state.time,
      sourceShipId: 1,
    } as any;

    (ps as any).emitEvent(nonHitEvent);
    await Promise.resolve();
    expect(unifiedFXStub.handleExplosion).not.toHaveBeenCalled();
  });
});
