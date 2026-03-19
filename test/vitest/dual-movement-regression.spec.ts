import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { Vector3, Quaternion } from 'three';
import { createTestGameState, createTestShip } from './helpers/fixtures.js';
import type { GameState, ShipEntity } from '../../src/types/index.js';
import { updateGame } from '../../src/game/systems.js';

/**
 * Regression test for dual movement system issue.
 * Ensures that physics writes (setNextKinematicTranslation) are called
 * exactly once per ship per tick, not multiple times.
 *
 * Context: Previously, both the legacy applyShipMovement (in prepareShips)
 * and the new updateMotionSystem were active in the same tick, causing
 * duplicate physics writes and inconsistent behavior.
 *
 * See: CODE_REVIEW.md finding #3
 */

function setupTestState(): { state: GameState; ship: ShipEntity } {
  const ship = createTestShip(1, 'blue', new Vector3(0, 0, 0));

  // Configure motion stats
  ship.ship.motion = {
    mass: 1.0,
    maxTurnRate: Math.PI / 2,
    angularAcceleration: Math.PI,
    angularDamping: 0.1,
    angularSettlingRate: 0.1,
    angularSettleToleranceDeg: 5,
    turnKp: 4,
    turnKd: 0.6,
    linearAcceleration: 20,
    linearDamping: 0.2,
    maxSpeed: 40,
    maxReverseSpeed: 10,
    smoothing: { rotationSlerp: 0 },
  };

  ship.transform.rotation = new Quaternion();
  ship.ship.velocity = new Vector3(0, 0, 0);
  ship.ship.angularVelocity = new Vector3(0, 0, 0);

  // Set up AI command
  if (ship.ai) {
    ship.ai.command = {
      heading: new Vector3(0, 0, 1),
      thrust: 0.5,
      firePrimary: false,
      ttl: 1.0,
    };
  }

  const state = createTestGameState();

  // Mock physics world
  state.physicsWorld = {
    step: vi.fn(),
  } as never;

  state.queries.ships.entities.push(ship);

  // Mock the rigid body with spy functions
  const setNextKinematicTranslationSpy = vi.fn();
  const setNextKinematicRotationSpy = vi.fn();

  ship.rigidBody = {
    setNextKinematicTranslation: setNextKinematicTranslationSpy,
    setNextKinematicRotation: setNextKinematicRotationSpy,
    translation: () => ({ x: 0, y: 0, z: 0 }),
    rotation: () => ({ x: 0, y: 0, z: 0, w: 1 }),
  } as never;

  return { state, ship };
}

describe('Dual Movement System Regression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls setNextKinematicTranslation exactly once per tick for each ship', () => {
    const { state, ship } = setupTestState();
    const spy = (ship.rigidBody as any).setNextKinematicTranslation;

    // Run a full game tick
    updateGame(state, 0.05);

    // Should be called exactly once for movement
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('calls setNextKinematicRotation exactly once per tick for each ship', () => {
    const { state, ship } = setupTestState();
    const spy = (ship.rigidBody as any).setNextKinematicRotation;

    // Run a full game tick
    updateGame(state, 0.05);

    // Should be called exactly once for rotation
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('maintains deterministic movement across multiple ticks', () => {
    const { state, ship } = setupTestState();
    const translationSpy = (ship.rigidBody as any).setNextKinematicTranslation;

    // Store calls from first run
    type TranslationCall = Array<[{ x: number; y: number; z: number }]>;
    const firstRunCalls: TranslationCall[] = [];

    // Run 5 ticks
    for (let i = 0; i < 5; i++) {
      updateGame(state, 0.05);
      firstRunCalls.push([...translationSpy.mock.calls]);
      translationSpy.mockClear();
    }

    // Reset state
    const { state: state2, ship: ship2 } = setupTestState();
    const translationSpy2 = (ship2.rigidBody as any).setNextKinematicTranslation;

    // Run same 5 ticks
    for (let i = 0; i < 5; i++) {
      updateGame(state2, 0.05);

      // Each tick should have exactly one call
      expect(translationSpy2).toHaveBeenCalledTimes(1);

      // The call should match the first run (determinism)
      const currentCall = translationSpy2.mock.calls[0];
      const expectedCall = firstRunCalls[i][0];

      expect(currentCall[0].x).toBeCloseTo(expectedCall[0].x, 5);
      expect(currentCall[0].y).toBeCloseTo(expectedCall[0].y, 5);
      expect(currentCall[0].z).toBeCloseTo(expectedCall[0].z, 5);

      translationSpy2.mockClear();
    }
  });

  it('does not apply duplicate physics writes when ship has zero thrust', () => {
    const { state, ship } = setupTestState();

    // Set zero thrust
    if (ship.ai) {
      ship.ai.command.thrust = 0;
    }

    const translationSpy = (ship.rigidBody as any).setNextKinematicTranslation;

    // Run a full game tick
    updateGame(state, 0.05);

    // Motion system optimizes away idle ships (zero thrust + already aligned + zero velocity)
    // This is expected behavior - no physics write needed when nothing changes
    // The important thing is that we don't have DUPLICATE writes
    expect(translationSpy).toHaveBeenCalledTimes(0); // No write needed for idle ship
  });

  it('handles multiple ships without duplicate writes', () => {
    const state = createTestGameState();

    // Mock physics world
    state.physicsWorld = {
      step: vi.fn(),
    } as never;

    // Create 3 ships
    const ships: ShipEntity[] = [];
    for (let i = 0; i < 3; i++) {
      const ship = createTestShip(i + 1, 'blue', new Vector3(i * 10, 0, 0));
      ship.ship.motion = {
        mass: 1.0,
        maxTurnRate: Math.PI / 2,
        angularAcceleration: Math.PI,
        angularDamping: 0.1,
        angularSettlingRate: 0.1,
        angularSettleToleranceDeg: 5,
        turnKp: 4,
        turnKd: 0.6,
        linearAcceleration: 20,
        linearDamping: 0.2,
        maxSpeed: 40,
        maxReverseSpeed: 10,
        smoothing: { rotationSlerp: 0 },
      };
      ship.transform.rotation = new Quaternion();
      ship.ship.velocity = new Vector3(0, 0, 0);
      ship.ship.angularVelocity = new Vector3(0, 0, 0);

      if (ship.ai) {
        ship.ai.command = {
          heading: new Vector3(0, 0, 1),
          thrust: 0.5,
          firePrimary: false,
          ttl: 1.0,
        };
      }

      const spy = vi.fn();
      ship.rigidBody = {
        setNextKinematicTranslation: spy,
        setNextKinematicRotation: vi.fn(),
        translation: () => ({ x: i * 10, y: 0, z: 0 }),
        rotation: () => ({ x: 0, y: 0, z: 0, w: 1 }),
      } as never;

      ships.push(ship);
      state.queries.ships.entities.push(ship);
    }

    // Run a full game tick
    updateGame(state, 0.05);

    // Each ship should have exactly one physics write
    for (const ship of ships) {
      const spy = (ship.rigidBody as any).setNextKinematicTranslation;
      expect(spy).toHaveBeenCalledTimes(1);
    }
  });
});
