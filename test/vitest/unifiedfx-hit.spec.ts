import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createInitialState } from '../../src/core/gameState.js';
import { ProjectileSystem } from '../../src/core/systems/projectileSystem.js';

describe('unifiedFX hit micro-FX', () => {
  let state: any;
  let ps: ProjectileSystem;
  beforeEach(() => {
    state = createInitialState('test-seed');
    // attach a fake unifiedFX with spies
    state.unifiedFX = {
      handleHitEffect: vi.fn(),
      handleExplosion: vi.fn(),
    };
    ps = new ProjectileSystem(state);
  });

  it('calls handleHitEffect for non-lethal hit events', () => {
    // create two ships so target exists and has health > 0
    state.ships = [
      { id: 1, health: 10 },
      { id: 2, health: 5 },
    ];
    state.shipIndex = new Map();
    state.shipIndex.set(1, state.ships[0]);
    state.shipIndex.set(2, state.ships[1]);

    const evt = {
      type: 'hit',
      bulletId: 42,
      timestamp: state.time,
      sourceShipId: 1,
      targetId: 2,
      hitResult: {
        bulletId: 42,
        targetId: 2,
        damage: 1,
        hitPosition: { x: 1, y: 2, z: 3 },
        penetrated: true,
      },
    } as any;

    // Register a main-like handler that routes projectile events to unifiedFX
    ps.onProjectileEvent((event: any) => {
      if (
        event &&
        event.type === 'hit' &&
        event.hitResult &&
        typeof event.targetId !== 'undefined'
      ) {
        const targetId = event.targetId;
        const targetShip =
          state.shipIndex?.get(targetId) ?? state.ships.find((s: any) => s.id === targetId);
        const isDead = targetShip ? (targetShip.health ?? 0) <= 0 : false;
        if (isDead) {
          state.unifiedFX.handleExplosion(event.hitResult.hitPosition, event.hitResult.damage ?? 1);
        } else {
          state.unifiedFX.handleHitEffect(event.hitResult.hitPosition, event.hitResult.damage ?? 1);
        }
      }
    });

    // Emit event
    (ps as any).emitEvent(evt);

    // unifiedFX.handleHitEffect should be called once
    expect(state.unifiedFX.handleHitEffect).toHaveBeenCalled();
    expect(state.unifiedFX.handleExplosion).not.toHaveBeenCalled();
  });
});
