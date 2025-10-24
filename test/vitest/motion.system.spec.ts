import { describe, it, expect, vi } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import { applyProgressionDefaults } from './helpers/progression.js';
import { updateMotionSystem } from '../../src/game/systems/motion.js';
import { createDefaultMotionStats } from '../../src/game/ships.js';
import type { GameState, ShipEntity } from '../../src/types/index.js';
import { createTestGameState } from './helpers/fixtures.js';

function createMockShip(team: 'red' | 'blue', position: Vector3): ShipEntity {
  const shipEntity = {
    id: Math.floor(Math.random() * 10000),
    rigidBody: {
      setNextKinematicTranslation: () => {},
      setNextKinematicRotation: () => {},
      translation: () => ({ x: position.x, y: position.y, z: position.z }),
      rotation: () => ({ x: 0, y: 0, z: 0, w: 1 }),
    } as any,
    collider: {} as any,
    transform: {
      position: position.clone(),
      rotation: new Quaternion(),
      scale: 1,
    },
    ship: {
      team,
      hull: 'fighter',
      hp: 100,
      maxHp: 100,
      shield: 0,
      maxShield: 0,
      cooldown: 0,
      fireRate: 1,
      damage: 10,
      projectileSpeed: 20,
      range: 100,
      speed: 10,
      bulletType: 'bullet:laser',
      velocity: new Vector3(0, 0, 0),
      angularVelocity: new Vector3(0, 0, 0),
      lateralAcceleration: 0,
      motion: createDefaultMotionStats(),
    },
    model: 'fighter',
    ai: {
      profileId: 'brawler',
      intent: 'Attack',
      nextThinkAt: 0,
      cooldowns: { dodgeAt: 0, burstAt: 0 },
      lod: 1,
      traitSeed: 123,
      traits: { aggression: 1, patience: 1, dodge: 1 },
      command: {
        heading: new Vector3(0, 0, 1), // forward
        thrust: 0,
        firePrimary: false,
        ttl: 0.1,
      },
    },
  } as unknown as ShipEntity;

  applyProgressionDefaults(shipEntity.ship, { maxHpOverride: shipEntity.ship.maxHp });
  return shipEntity;
}

function createMockGameState(ships: ShipEntity[]): GameState {
  return createTestGameState({
    queries: {
      ships: { entities: ships },
      projectiles: { entities: [] },
      turrets: { entities: [] },
    },
    time: 0,
  });
}

describe('Motion System Behavior', () => {
  it('maintains zero velocity when thrust is zero', () => {
    const ship = createMockShip('blue', new Vector3(0, 0, 0));
    const state = createMockGameState([ship]);

    // Set thrust to zero
    ship.ai!.command.thrust = 0;

    // Run several motion updates
    for (let i = 0; i < 10; i++) {
      updateMotionSystem(state, 0.016);
    }

    // Velocity should remain very small (only damping effects)
    expect(ship.ship.velocity.length()).toBeLessThan(0.1);
  });

  it('accelerates forward when thrust is applied', () => {
    const ship = createMockShip('blue', new Vector3(0, 0, 0));
    const state = createMockGameState([ship]);

    // Set full forward thrust
    ship.ai!.command.thrust = 1.0;
    ship.ai!.command.heading = new Vector3(0, 0, 1); // forward

    const initialSpeed = ship.ship.velocity.length();

    // Run motion update
    updateMotionSystem(state, 0.016);

    const finalSpeed = ship.ship.velocity.length();

    // Should have gained speed
    expect(finalSpeed).toBeGreaterThan(initialSpeed);
  });

  it('turns toward target heading', () => {
    const ship = createMockShip('blue', new Vector3(0, 0, 0));
    const state = createMockGameState([ship]);

    // Start facing forward, command to turn right
    ship.transform.rotation.setFromAxisAngle(new Vector3(0, 1, 0), 0); // facing +Z
    ship.ai!.command.heading = new Vector3(1, 0, 0); // target +X (90° right)

    const initialForward = new Vector3(0, 0, 1).applyQuaternion(ship.transform.rotation);

    // Run several motion updates to allow turning
    for (let i = 0; i < 30; i++) {
      updateMotionSystem(state, 0.016);
    }

    const finalForward = new Vector3(0, 0, 1).applyQuaternion(ship.transform.rotation);

    // Should have turned toward target (dot product with target should increase)
    const initialDot = initialForward.dot(ship.ai!.command.heading);
    const finalDot = finalForward.dot(ship.ai!.command.heading);

    expect(finalDot).toBeGreaterThan(initialDot);
  });

  it('respects maximum speed limits', () => {
    const ship = createMockShip('blue', new Vector3(0, 0, 0));
    const state = createMockGameState([ship]);

    // Set motion stats with low max speed for testing
    ship.ship.motion.maxSpeed = 5.0;
    ship.ship.motion.linearAcceleration = 100; // High acceleration

    // Set full thrust
    ship.ai!.command.thrust = 1.0;

    // Run many updates to reach steady state
    for (let i = 0; i < 100; i++) {
      updateMotionSystem(state, 0.016);
    }

    // Speed should not exceed maxSpeed
    expect(ship.ship.velocity.length()).toBeLessThanOrEqual(ship.ship.motion.maxSpeed + 0.1);
  });

  it('applies angular velocity damping when aligned', () => {
    const ship = createMockShip('blue', new Vector3(0, 0, 0));
    const state = createMockGameState([ship]);

    // Start with some angular velocity and already aligned heading
    ship.ship.angularVelocity.set(0, 2.0, 0); // rad/s around yaw
    ship.ai!.command.heading = new Vector3(0, 0, 1); // same as current forward

    const initialAngularSpeed = ship.ship.angularVelocity.length();

    // Run motion update
    updateMotionSystem(state, 0.016);

    // Angular velocity should be reduced by damping
    expect(ship.ship.angularVelocity.length()).toBeLessThan(initialAngularSpeed);
  });

  it('handles ships without AI commands gracefully', () => {
    const ship = createMockShip('blue', new Vector3(0, 0, 0));
    const state = createMockGameState([ship]);

    // Remove AI command
    ship.ai = undefined;

    // Should not throw
    expect(() => {
      updateMotionSystem(state, 0.016);
    }).not.toThrow();
  });
  it('honors per-hull turn gains when computing angular velocity', () => {
    const dt = 0.016;

    const baselineShip = createMockShip('blue', new Vector3(0, 0, 0));
    baselineShip.ai!.command.heading = new Vector3(1, 0, 0);
    baselineShip.ship.motion.maxTurnRate = Math.PI * 3;
    baselineShip.ship.motion.angularAcceleration = 1e6;
    const baselineState = createMockGameState([baselineShip]);
    updateMotionSystem(baselineState, dt);
    const baselineAngularSpeed = baselineShip.ship.angularVelocity.length();

    const tunedShip = createMockShip('blue', new Vector3(0, 0, 0));
    tunedShip.ai!.command.heading = new Vector3(1, 0, 0);
    tunedShip.ship.motion.maxTurnRate = Math.PI * 3;
    tunedShip.ship.motion.angularAcceleration = 1e6;
    tunedShip.ship.motion.turnKp = (baselineShip.ship.motion.turnKp ?? 4.0) * 1.8;
    tunedShip.ship.motion.turnKd = (baselineShip.ship.motion.turnKd ?? 0.6) * 0.4;
    const tunedState = createMockGameState([tunedShip]);
    updateMotionSystem(tunedState, dt);
    const tunedAngularSpeed = tunedShip.ship.angularVelocity.length();

    expect(tunedAngularSpeed).toBeGreaterThan(baselineAngularSpeed);
  });

  it('damps angular velocity within the settling band to the configured rate', () => {
    const ship = createMockShip('blue', new Vector3(0, 0, 0));
    const state = createMockGameState([ship]);
    ship.ai!.command.heading = new Vector3(0, 0, 1);
    ship.ship.angularVelocity.set(0, 0.6, 0);
    ship.ship.motion.angularSettlingRate = 0.05;
    ship.ship.motion.angularSettleToleranceDeg = 8;

    const dt = 0.016;
    const steps = Math.ceil(0.5 / dt);
    for (let i = 0; i < steps; i++) {
      updateMotionSystem(state, dt);
    }

    expect(ship.ship.angularVelocity.length()).toBeLessThanOrEqual(0.05 + 1e-4);
  });

  it('skips rotation slerp when the ship is inside the settling band', () => {
    const ship = createMockShip('blue', new Vector3(0, 0, 0));
    const state = createMockGameState([ship]);
    ship.ai!.command.heading = new Vector3(0, 0, 1);
    ship.ship.motion.smoothing = {
      ...(ship.ship.motion.smoothing ?? {}),
      rotationSlerp: 0.6,
    };
    ship.ship.motion.angularSettlingRate = 0.05;
    ship.ship.motion.angularSettleToleranceDeg = 10;
    ship.ship.angularVelocity.set(0, 0.02, 0);

    const slerpSpy = vi.spyOn(ship.transform.rotation, 'slerp');
    updateMotionSystem(state, 0.016);
    expect(slerpSpy).not.toHaveBeenCalled();
    slerpSpy.mockRestore();

    const turningShip = createMockShip('blue', new Vector3(0, 0, 0));
    turningShip.ai!.command.heading = new Vector3(1, 0, 0);
    turningShip.ship.motion.smoothing = {
      ...(turningShip.ship.motion.smoothing ?? {}),
      rotationSlerp: 0.6,
    };
    const turningSpy = vi.spyOn(turningShip.transform.rotation, 'slerp');
    updateMotionSystem(createMockGameState([turningShip]), 0.016);
    expect(turningSpy).toHaveBeenCalled();
    turningSpy.mockRestore();
  });
});
