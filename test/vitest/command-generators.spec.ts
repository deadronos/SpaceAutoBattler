import { describe, expect, it } from 'vite-plus/test';
import { Quaternion, Vector3 } from 'three';
import {
  computeAttackCommand,
  computeKiteCommand,
} from '../../src/game/systems/decision/command-generators.js';
import type { BehaviorProfile, GameState, ShipEntity } from '../../src/types/index.js';

function makeShip(id: number, position: Vector3, rotation = new Quaternion()): ShipEntity {
  return {
    id,
    transform: {
      position,
      rotation,
      scale: 1,
    },
    ship: {
      range: 120,
    },
  } as unknown as ShipEntity;
}

function makeState(): GameState {
  return {
    ai: {
      tickIndex: 1,
    },
  } as unknown as GameState;
}

function makeProfile(desiredRange: [number, number] = [40, 80]): BehaviorProfile {
  return {
    desiredRange,
    orbit: 0,
    aggression: 0.5,
    patience: 0.5,
    dodgeFreq: 0,
    verticalManeuver: 0,
    classBias: {},
    style: 'brawler',
  };
}

describe('command-generators zero-distance guards', () => {
  it('computeKiteCommand falls back to ship forward when co-located with target', () => {
    const state = makeState();
    const profile = makeProfile();
    const rotation = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2);
    const ship = makeShip(1, new Vector3(10, 20, 30), rotation);
    const target = makeShip(2, new Vector3(10, 20, 30));
    const heading = new Vector3();

    const result = computeKiteCommand(state, ship, profile, target, heading);

    expect(Number.isFinite(heading.x)).toBe(true);
    expect(Number.isFinite(heading.y)).toBe(true);
    expect(Number.isFinite(heading.z)).toBe(true);
    expect(heading.length()).toBeCloseTo(1, 6);
    expect(heading.x).toBeCloseTo(1, 6);
    expect(heading.y).toBeCloseTo(0, 6);
    expect(heading.z).toBeCloseTo(0, 6);
    expect(result.distanceToTarget).toBe(0);
    expect(result.firePrimary).toBe(true);
    expect(result.targetId).toBe(2);
  });

  it('computeKiteCommand still heads directly away from separated target', () => {
    const state = makeState();
    const profile = makeProfile();
    const ship = makeShip(1, new Vector3(0, 0, 0));
    const target = makeShip(2, new Vector3(10, 0, 0));
    const heading = new Vector3();

    computeKiteCommand(state, ship, profile, target, heading);

    expect(heading.x).toBeCloseTo(-1, 6);
    expect(heading.y).toBeCloseTo(0, 6);
    expect(heading.z).toBeCloseTo(0, 6);
  });

  it('computeAttackCommand produces finite unit heading when co-located with target', () => {
    const state = makeState();
    const profile = makeProfile([0, 80]);
    const ship = makeShip(1, new Vector3(5, -3, 2));
    const target = makeShip(2, new Vector3(5, -3, 2));
    const heading = new Vector3();

    const result = computeAttackCommand(state, ship, profile, target, heading);

    expect(Number.isFinite(heading.x)).toBe(true);
    expect(Number.isFinite(heading.y)).toBe(true);
    expect(Number.isFinite(heading.z)).toBe(true);
    expect(heading.length()).toBeCloseTo(1, 6);
    expect(heading.z).toBeCloseTo(1, 6);
    expect(result.distanceToTarget).toBe(0);
    expect(result.firePrimary).toBe(true);
    expect(result.targetId).toBe(2);
  });

  it('computeAttackCommand negates fallback unit heading when co-located and below desiredMin', () => {
    const state = makeState();
    const profile = makeProfile([40, 80]);
    const ship = makeShip(1, new Vector3(5, -3, 2));
    const target = makeShip(2, new Vector3(5, -3, 2));
    const heading = new Vector3();

    const result = computeAttackCommand(state, ship, profile, target, heading);

    expect(heading.length()).toBeCloseTo(1, 6);
    expect(heading.z).toBeCloseTo(-1, 6);
    expect(result.thrust).toBe(0.6);
    expect(result.distanceToTarget).toBe(0);
  });
});
