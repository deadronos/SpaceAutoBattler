import { describe, it, expect } from 'vite-plus/test';
import { Vector3 } from 'three';
import { computeVerticalClamp } from '../../src/game/utils/ai-vertical.js';
import { resolveBehaviorProfile } from '../../src/game/aiProfiles.js';
import type { BehaviorProfile, GameState, ShipEntity } from '../../src/types/index.js';
import { createDefaultMotionStats } from '../../src/game/ships.js';
import { applyProgressionDefaults } from './helpers/progression.js';

function makeShip(hull: ShipEntity['ship']['hull'], y: number) {
  const ship = {
    id: 1,
    rigidBody: {} as never,
    collider: {} as never,
    transform: { position: new Vector3(0, y, 0), rotation: undefined, scale: 1 } as any,
    ship: {
      team: 'blue',
      hull,
      hp: 100,
      maxHp: 100,
      shield: 0,
      maxShield: 0,
      shieldRegen: 0,
      cooldown: 0,
      fireRate: 1,
      damage: 10,
      projectileSpeed: 35,
      range: 260,
      speed: 40,
      bulletType: 'bullet:laser',
      velocity: new Vector3(),
      angularVelocity: new Vector3(),
      lateralAcceleration: 0,
      motion: createDefaultMotionStats(),
    },
    model: hull,
  } as unknown as ShipEntity;
  applyProgressionDefaults(ship.ship, { maxHpOverride: ship.ship.maxHp });
  return ship;
}

function makeTarget(y: number) {
  return {
    id: 2,
    transform: { position: new Vector3(0, y, 100), rotation: undefined, scale: 1 } as any,
    ship: { hull: 'corvette' } as any,
  } as unknown as ShipEntity;
}

function makeState() {
  return {
    ai: { tickIndex: 1, metrics: {} as any },
    blackboard: { tickIndex: 1 },
  } as unknown as GameState;
}

describe('computeVerticalClamp', () => {
  it('returns higher clamp for fighters with escort style', () => {
    const ship = makeShip('fighter', 0);
    const profile = {
      ...resolveBehaviorProfile('escort'),
      verticalManeuver: 0.7,
    } as BehaviorProfile;
    const state = makeState();
    const ai = { desiredRange: [50, 300] } as any;
    const target = makeTarget(200);

    const clamp = computeVerticalClamp(state, ship, profile, ai, target);
    expect(clamp).toBeGreaterThanOrEqual(0.45); // expect agility-high value region
    expect(clamp).toBeLessThanOrEqual(0.7);
  });

  it('returns lower clamp for destroyers', () => {
    const ship = makeShip('destroyer', 0);
    const profile = {
      ...resolveBehaviorProfile('artillery'),
      verticalManeuver: 0.8,
    } as BehaviorProfile;
    const state = makeState();
    const ai = { desiredRange: [30, 200] } as any;
    const target = makeTarget(100);

    const clamp = computeVerticalClamp(state, ship, profile, ai, target);
    expect(clamp).toBeLessThanOrEqual(0.45);
    expect(clamp).toBeGreaterThanOrEqual(0.1);
  });

  it('scales clamp based on distance deviation from midpoint', () => {
    const ship = makeShip('fighter', 0);
    const profile = {
      ...resolveBehaviorProfile('escort'),
      verticalManeuver: 0.7,
    } as BehaviorProfile;
    const state = makeState();
    const ai = { desiredRange: [50, 300] } as any;

    let closeTarget = makeTarget(50);
    let farTarget = makeTarget(400);
    const clampClose = computeVerticalClamp(state, ship, profile, ai, closeTarget);
    const clampFar = computeVerticalClamp(state, ship, profile, ai, farTarget);
    // clamp further from midpoint should be greater or equal
    expect(clampFar).toBeGreaterThanOrEqual(clampClose);
  });
});
