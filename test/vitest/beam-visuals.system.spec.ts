import { describe, it, expect } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import type {
  BeamVisualComponent,
  BeamVisualEntity,
  GameEntity,
  GameState,
  ProjectileEntity,
  ShipEntity,
} from '../../src/types/index.js';
import { createTestGameState, createTestShip } from './helpers/fixtures.js';
import { fireProjectile } from '../../src/game/systems/projectiles.js';
import { advanceBeamVisuals } from '../../src/game/systems/beamVisuals.js';
import { flushPostPhysicsMutations } from '../../src/game/simulationQueue.js';
import {
  createRapierShim,
  createPhysicsWorldShim,
} from '../../src/game/aiScenarioHarness/rapierShim.js';
import {
  MIN_VISIBLE_BEAM_LENGTH,
  computeBeamBrightness,
  resolveBeamRenderLength,
} from '../../src/components/layers/BeamVisualsInstancedLayer.js';

function attachWorld(state: GameState): void {
  const entities: GameEntity[] = [];

  const addEntity = (obj: GameEntity): GameEntity => {
    entities.push(obj);
    if (obj.projectile) {
      (state.queries.projectiles.entities as ProjectileEntity[]).push(obj as ProjectileEntity);
    }
    if (obj.beamVisual) {
      (state.queries.beamVisuals.entities as BeamVisualEntity[]).push(obj as BeamVisualEntity);
    }
    if (obj.ship) {
      (state.queries.ships.entities as ShipEntity[]).push(obj as ShipEntity);
    }
    return obj;
  };

  const removeEntity = (obj: GameEntity): void => {
    const idx = entities.indexOf(obj);
    if (idx >= 0) entities.splice(idx, 1);

    const projectiles = state.queries.projectiles.entities as ProjectileEntity[];
    const projectileIdx = projectiles.indexOf(obj as ProjectileEntity);
    if (projectileIdx >= 0) projectiles.splice(projectileIdx, 1);

    const beams = state.queries.beamVisuals.entities as BeamVisualEntity[];
    const beamIdx = beams.indexOf(obj as BeamVisualEntity);
    if (beamIdx >= 0) beams.splice(beamIdx, 1);

    const ships = state.queries.ships.entities as ShipEntity[];
    const shipIdx = ships.indexOf(obj as ShipEntity);
    if (shipIdx >= 0) ships.splice(shipIdx, 1);
  };

  state.world = {
    entities,
    add: addEntity,
    createEntity: addEntity,
    destroyEntity: removeEntity,
    remove: removeEntity,
  } as unknown as GameState['world'];
}

function expectVectorCloseTo(actual: Vector3, expected: Vector3, precision = 3): void {
  expect(actual.x).toBeCloseTo(expected.x, precision);
  expect(actual.y).toBeCloseTo(expected.y, precision);
  expect(actual.z).toBeCloseTo(expected.z, precision);
}

function makeBeamComponent(overrides: Partial<BeamVisualComponent> = {}): BeamVisualComponent {
  return {
    team: 'blue',
    ttl: 0.3,
    maxTtl: 0.3,
    width: 1,
    length: 10,
    maxLength: 30,
    spawnTime: 0,
    ...overrides,
  };
}

describe('beam visuals system', () => {
  it('reconstructs world transforms from stored local metadata', () => {
    const state = createTestGameState();
    state.rapier = createRapierShim();
    state.physicsWorld = createPhysicsWorldShim();
    attachWorld(state);

    const shooter = createTestShip(1, 'blue', new Vector3(0, 0, 0));
    shooter.ship.bulletType = 'beam:laser';
    shooter.ship.damageType = 'ion';
    const target = createTestShip(2, 'red', new Vector3(0, 0, 30));

    (state.queries.ships.entities as ShipEntity[]).push(shooter, target);

    fireProjectile(state, shooter, new Vector3(0, 0, 1));
    flushPostPhysicsMutations(state);

    const beam = (state.queries.beamVisuals.entities as BeamVisualEntity[])[0];
    expect(beam).toBeDefined();
    const localOrigin = beam.beamVisual.localOrigin?.clone();
    const localDirection = beam.beamVisual.localDirection?.clone();
    const worldOffset = beam.beamVisual.worldOffset?.clone();
    expect(localOrigin).toBeDefined();
    expect(localDirection).toBeDefined();
    expect(worldOffset).toBeDefined();
    expect(beam.beamVisual.fade).toBeUndefined();

    const initialDirection = beam.direction.clone();
    expectVectorCloseTo(initialDirection, new Vector3(0, 0, 1), 5);

    shooter.transform.position.set(12, -3, 5);
    const rotation = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 4);
    shooter.transform.rotation = rotation;

    advanceBeamVisuals(state, 0.016);

    const expectedOrigin = worldOffset
      ? shooter.transform.position.clone().add(worldOffset)
      : beam.transform.position;

    expectVectorCloseTo(beam.transform.position, expectedOrigin, 3);
    expectVectorCloseTo(beam.direction, initialDirection, 5);
    expectVectorCloseTo(
      new Vector3(0, 0, 1).applyQuaternion(beam.transform.rotation),
      initialDirection,
      5,
    );
  });

  it('removes beam visuals when the source ship is absent', () => {
    const state = createTestGameState();
    state.rapier = createRapierShim();
    state.physicsWorld = createPhysicsWorldShim();
    attachWorld(state);

    const shooter = createTestShip(1, 'blue', new Vector3(0, 0, 0));
    shooter.ship.bulletType = 'beam:laser';
    shooter.ship.damageType = 'ion';
    (state.queries.ships.entities as ShipEntity[]).push(shooter);

    fireProjectile(state, shooter, new Vector3(0, 0, 1));
    flushPostPhysicsMutations(state);

    const beams = state.queries.beamVisuals.entities as BeamVisualEntity[];
    expect(beams.length).toBe(1);

    const ships = state.queries.ships.entities as ShipEntity[];
    const shooterIdx = ships.indexOf(shooter);
    if (shooterIdx >= 0) ships.splice(shooterIdx, 1);

    advanceBeamVisuals(state, 0.016);

    expect(beams.length).toBe(0);
  });
});

describe('beam visual render helpers', () => {
  it('clamps near-zero lengths to the minimum visible threshold', () => {
    const width = 0.9;
    const result = resolveBeamRenderLength(0.05, width, 30);
    const minExpected = Math.max(MIN_VISIBLE_BEAM_LENGTH, width * 0.6);
    expect(result).toBeCloseTo(minExpected, 5);
  });

  it('respects configured maximum length', () => {
    const result = resolveBeamRenderLength(120, 1, 40);
    expect(result).toBeCloseTo(40, 5);
  });

  it('recovers gracefully from invalid numeric inputs', () => {
    const result = resolveBeamRenderLength(Number.NaN, Number.POSITIVE_INFINITY, -5);
    expect(result).toBeCloseTo(MIN_VISIBLE_BEAM_LENGTH, 5);
  });
});

describe('beam brightness computation', () => {
  it('returns full brightness when fade is undefined', () => {
    const brightness = computeBeamBrightness(makeBeamComponent({ length: 5, maxLength: 30 }));
    expect(brightness).toBeCloseTo(1, 6);
  });

  it('applies strength and exponent to produce a dimmed brightness', () => {
    const brightness = computeBeamBrightness(
      makeBeamComponent({
        length: 15,
        maxLength: 30,
        fade: { strength: 0.5, exponent: 2 },
      }),
    );
    const expected = 1 - 0.5 * Math.pow(0.5, 2);
    expect(brightness).toBeCloseTo(expected, 6);
  });

  it('disables fading for invalid strength/exponent values', () => {
    const brightness = computeBeamBrightness(
      makeBeamComponent({
        length: 20,
        maxLength: 30,
        fade: { strength: -1, exponent: 0.5 },
      }),
    );
    expect(brightness).toBeCloseTo(1, 6);
  });
});
