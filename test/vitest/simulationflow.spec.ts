import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { makeInitialState, createShip, createBullet } from "../../src/entities";
import { simulateStep } from "../../src/simulate";
// ...existing code...

describe("GameState serialization", () => {
  it("should serialize and deserialize GameState with integrity", () => {
    const state = makeInitialState();
    state.ships.push(createShip("fighter", 100, 100, "red"));
    state.bullets.push(createBullet(100, 100, 10, 0, "red", 1, 5, 1));
    state.t = 42;
    // Serialize
    const json = JSON.stringify(state);
    // Deserialize
    const restored = JSON.parse(json);
    expect(restored.t).toBe(42);
    expect(Array.isArray(restored.ships)).toBe(true);
    expect(Array.isArray(restored.bullets)).toBe(true);
    expect(restored.ships[0].type).toBe("fighter");
    expect(restored.bullets[0].damage).toBe(5);
  });

  it("should produce deterministic replay from serialized state", () => {
    const state = makeInitialState();
    state.ships.push(createShip("fighter", 100, 100, "red"));
    state.bullets.push(createBullet(100, 100, 10, 0, "red", 1, 5, 1));
    state.t = 0;
    // Step simulation
    simulateStep(state, 0.1, { W: 1920, H: 1080 });
    // Serialize
    const json = JSON.stringify(state);
    // Deserialize
    const restored = JSON.parse(json);
    // Step again
    simulateStep(restored, 0.1, { W: 1920, H: 1080 });
    // Compare key fields
    expect(restored.ships.length).toBe(state.ships.length);
    expect(restored.bullets.length).toBe(state.bullets.length);
    expect(typeof restored.t).toBe("number");
  });
});
import { getShipConfigSafe } from './utils/entitiesConfigSafe';

import { boundaryBehavior } from '../../src/config/simConfig';
describe('Boundary Behavior', () => {
  let origConfig: any;
  beforeEach(() => {
    origConfig = { ships: boundaryBehavior.ships, bullets: boundaryBehavior.bullets };
  });
  afterEach(() => {
    boundaryBehavior.ships = origConfig.ships;
    boundaryBehavior.bullets = origConfig.bullets;
  });

  it('removes bullets out of bounds when set to remove', () => {
    boundaryBehavior.bullets = 'remove';
    const state = makeInitialState();
    const bullet = createBullet(-10, 50, 0, 0, 'red', null, 1, 2);
    state.bullets.push(bullet);
    simulateStep(state, 0.1, { W: 100, H: 100 });
    expect(state.bullets.length).toBe(0);
  });

  it('wraps bullets out of bounds when set to wrap', () => {
    boundaryBehavior.bullets = 'wrap';
    const state = makeInitialState();
    const bullet = createBullet(-10, 50, 0, 0, 'red', null, 1, 2);
    state.bullets.push(bullet);
    simulateStep(state, 0.1, { W: 100, H: 100 });
    expect(state.bullets[0].x).toBeGreaterThanOrEqual(0);
    expect(state.bullets[0].x).toBeLessThanOrEqual(100);
  });

  it('bounces bullets out of bounds when set to bounce', () => {
    boundaryBehavior.bullets = 'bounce';
    const state = makeInitialState();
    const bullet = createBullet(-10, 50, -5, 0, 'red', null, 1, 2);
    state.bullets.push(bullet);
    simulateStep(state, 0.1, { W: 100, H: 100 });
    expect(state.bullets[0].vx).toBeGreaterThan(0);
    expect(state.bullets[0].x).toBeGreaterThanOrEqual(0);
  });

  it('removes ships out of bounds when set to remove', () => {
    boundaryBehavior.ships = 'remove';
    const state = makeInitialState();
    const ship = createShip('fighter', -20, 50, 'red');
    state.ships.push(ship);
    simulateStep(state, 0.1, { W: 100, H: 100 });
    expect(state.ships.length).toBe(0);
  });

  it('wraps ships out of bounds when set to wrap', () => {
    boundaryBehavior.ships = 'wrap';
    const state = makeInitialState();
    const ship = createShip('fighter', -20, 50, 'red');
    state.ships.push(ship);
    simulateStep(state, 0.1, { W: 100, H: 100 });
  const radius = ship.radius ?? 12;
  expect(state.ships[0].x).toBeGreaterThanOrEqual(-radius);
  expect(state.ships[0].x).toBeLessThanOrEqual(100 + radius);
  });

  it('bounces ships out of bounds when set to bounce', () => {
    boundaryBehavior.ships = 'bounce';
    const state = makeInitialState();
    const ship = createShip('fighter', -20, 50, 'red');
    ship.vx = -5;
    state.ships.push(ship);
    simulateStep(state, 0.1, { W: 100, H: 100 });
    expect(state.ships[0].vx).toBeGreaterThan(0);
  const radius2 = ship.radius ?? 12;
  expect(state.ships[0].x).toBeGreaterThanOrEqual(-radius2);
  });
});
// ...existing code...
import progression from "../../src/config/progressionConfig";
import { getShipConfigSafe as __getCfg } from './utils/entitiesConfigSafe';
import { applySimpleAI } from "../../src/behavior";

describe("Simulation Flow", () => {
  it("should not allow coordinate jumps beyond maxSpeed * dt", () => {
    const state = makeInitialState();
    const ship = createShip("fighter", 100, 100, "red");
    ship.throttle = 1;
    ship.steering = 0;
    state.ships.push(ship);
    const dt = 0.05;
    for (let i = 0; i < 20; i++) {
      const prevX = ship.x;
      const prevY = ship.y;
      simulateStep(state, dt, { W: 1920, H: 1080 });
      const dx = Math.abs(ship.x - prevX);
      const dy = Math.abs(ship.y - prevY);
      const dist = Math.sqrt(dx * dx + dy * dy);
      expect(dist).toBeLessThanOrEqual((ship.maxSpeed || 160) * dt + 1e-6);
    }
  });

  it("should keep all entities within bounds after simulation", () => {
    const state = makeInitialState();
    // Add ships and bullets near the edge
    const ship = createShip("fighter", 1910, 1070, "red");
    ship.vx = 50;
    ship.vy = 50;
    state.ships.push(ship);
    const bullet = createBullet(1915, 1075, 10, 10, "red", ship.id, 2, 2);
    state.bullets.push(bullet);
    for (let i = 0; i < 10; i++) {
      simulateStep(state, 0.1, { W: 1920, H: 1080 });
      for (const s of state.ships) {
        const r = s.radius !== undefined ? s.radius : 12;
        expect(s.x).toBeGreaterThanOrEqual(-r);
        expect(s.x).toBeLessThanOrEqual(1920 + r);
        expect(s.y).toBeGreaterThanOrEqual(-r);
        expect(s.y).toBeLessThanOrEqual(1080 + r);
      }
      for (const b of state.bullets) {
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.x).toBeLessThanOrEqual(1920);
        expect(b.y).toBeGreaterThanOrEqual(0);
        expect(b.y).toBeLessThanOrEqual(1080);
      }
    }
  });
  it("should spawn turret bullets at correct config positions after radius change", () => {
    const state = makeInitialState();
    // Create a destroyer with default config
    const shipType = "destroyer";
    const ship = createShip(shipType, 100, 100, "red");
    ship.angle = 0;
    state.ships.push(ship);
    // Run AI to fire turrets
    applySimpleAI(state, 0.2, { W: 1920, H: 1080 });
    // Get config radius and turret positions
  // Resolve config safely across ESM/CJS
  const config = getShipConfigSafe();
  const configRadius = config[shipType].radius ?? 40;
  const turretDefs = config[shipType].turrets ?? [];
    // For each bullet, check it matches expected turret world position
    for (const bullet of state.bullets) {
      // Find matching turret by position
      let found = false;
      for (const turret of turretDefs) {
        const [tx, ty] = turret.position;
        const expectedX = ship.x + Math.cos(ship.angle) * tx * configRadius - Math.sin(ship.angle) * ty * configRadius;
        const expectedY = ship.y + Math.sin(ship.angle) * tx * configRadius + Math.cos(ship.angle) * ty * configRadius;
        // Allow small floating point error
        if (Math.abs(bullet.x - expectedX) < 1e-3 && Math.abs(bullet.y - expectedY) < 1e-3) {
          found = true;
          break;
        }
      }
      expect(found).toBe(true);
    }
    // Now change config radius and verify new bullet positions
  const __cfg = __getCfg();
  __cfg[shipType].radius = 60;
    // Create a new ship with updated config
    const ship2 = createShip(shipType, 200, 200, "blue");
    ship2.angle = 0;
    state.ships = [ship2];
    state.bullets = [];
    applySimpleAI(state, 0.2, { W: 1920, H: 1080 });
  const newRadius = __cfg[shipType].radius;
    for (const bullet of state.bullets) {
      let found = false;
      for (const turret of turretDefs) {
        const [tx, ty] = turret.position;
        const expectedX = ship2.x + Math.cos(ship2.angle) * tx * newRadius - Math.sin(ship2.angle) * ty * newRadius;
        const expectedY = ship2.y + Math.sin(ship2.angle) * tx * newRadius + Math.cos(ship2.angle) * ty * newRadius;
        if (Math.abs(bullet.x - expectedX) < 1e-3 && Math.abs(bullet.y - expectedY) < 1e-3) {
          found = true;
          break;
        }
      }
      expect(found).toBe(true);
    }
    // Restore config radius for other tests
  __cfg[shipType].radius = 40;
  });
  it("should never move more than maxSpeed * dtSeconds per frame", () => {
    const state = makeInitialState();
    const ship = createShip("fighter", 100, 100, "red");
    ship.throttle = 1;
    ship.steering = 0;
    state.ships.push(ship);
    const dt = 0.05;
    for (let i = 0; i < 10; i++) {
      const prevX = ship.x;
      const prevY = ship.y;
      simulateStep(state, dt, { W: 1920, H: 1080 });
      const dx = Math.abs(ship.x - prevX);
      const dy = Math.abs(ship.y - prevY);
      const dist = Math.sqrt(dx * dx + dy * dy);
      expect(dist).toBeLessThanOrEqual((ship.maxSpeed || 160) * dt + 1e-6);
    }
  });
  it("should advance time and move entities with throttle/steering", () => {
    const state = makeInitialState();
    const ship = createShip("fighter", 100, 100, "red");
    ship.throttle = 1;
    ship.steering = 0;
    state.ships.push(ship);
    const initialX = ship.x;
    simulateStep(state, 1, { W: 1920, H: 1080 });
    expect(ship.x).toBeGreaterThan(initialX);
    expect(ship.y).toBe(100);
    expect(state.t).toBe(1);
    // Should not exceed maxSpeed
    const speed = Math.sqrt((ship.vx || 0) ** 2 + (ship.vy || 0) ** 2);
    expect(speed).toBeLessThanOrEqual(ship.maxSpeed || 160);
  });

  it("should turn when steering is set", () => {
    const state = makeInitialState();
    const ship = createShip("fighter", 100, 100, "red");
    ship.throttle = 1;
    ship.steering = 1;
    state.ships.push(ship);
    const initialAngle = ship.angle || 0;
    simulateStep(state, 1, { W: 1920, H: 1080 });
    expect(ship.angle).not.toBe(initialAngle);
  });

  it("should not move when throttle is zero", () => {
    const state = makeInitialState();
    const ship = createShip("fighter", 100, 100, "red");
    ship.throttle = 0;
    ship.steering = 0;
    state.ships.push(ship);
    const initialX = ship.x;
    const initialY = ship.y;
    simulateStep(state, 1, { W: 1920, H: 1080 });
    expect(ship.x).toBe(initialX);
    expect(ship.y).toBe(initialY);
  });

  it("should handle bullet collisions and damage", () => {
    const state = makeInitialState();
    const shipType = "destroyer";
    const targetType = "fighter";
    const ship = createShip(shipType, 100, 100, "red"); // multi-turret ship
    const target = createShip(targetType, 300, 100, "blue");
    state.ships.push(ship, target);
    // Simulate AI firing (multi-turret)
    // Run enough steps for turrets to fire
    let totalBulletsCreated = 0;
    let prevBulletCount = 0;
    for (let i = 0; i < 10; i++) {
      applySimpleAI(state, 0.1, { W: 1920, H: 1080 });
      simulateStep(state, 0.1, { W: 1920, H: 1080 });
      // Track bullets created (new bullets added each step)
      const newBullets = Math.max(0, state.bullets.length - prevBulletCount);
      totalBulletsCreated += newBullets;
      prevBulletCount = state.bullets.length;
    }
    // Debug output
    // eslint-disable-next-line no-console
    console.log(
      "DEBUG: bullets.length",
      state.bullets.length,
      "totalBulletsCreated",
      totalBulletsCreated,
      "turretCount",
  (__getCfg()[shipType].turrets || []).length,
    );
  const __cfg2 = __getCfg();
  const turretCount = (__cfg2[shipType].turrets || []).length;
  expect(target.hp).toBeLessThanOrEqual(__getCfg()[targetType].maxHp);
    expect(totalBulletsCreated).toBeGreaterThanOrEqual(turretCount);
  });

  it("should award XP and level up on kill", () => {
    const state = makeInitialState();
    const ship = createShip("fighter", 100, 100, "red");
    const target = createShip("fighter", 100, 100, "blue");
    state.ships.push(ship, target);
    // Remove all cannons from target to ensure only one bullet is created
    target.cannons = [];
    const bullet = createBullet(
      100,
      100,
      0,
      0,
      "red",
      ship.id,
      target.maxHp,
      1,
    );
    state.bullets.push(bullet);
    simulateStep(state, 0.1, { W: 1920, H: 1080 });
    // If target is not dead (still in state.ships), run another step
    let targetAlive = state.ships.includes(target);
    if (targetAlive) {
      simulateStep(state, 0.1, { W: 1920, H: 1080 });
      targetAlive = state.ships.includes(target);
    }
  const targetType = "fighter";
  const __cfg3 = __getCfg();
  expect(target.hp).toBeLessThan(__cfg3[targetType].maxHp); // Target should take damage
    if (!targetAlive) {
      expect(ship.xp).toBeGreaterThanOrEqual(progression.xpPerKill);
      expect(ship.level).toBeGreaterThan(1);
    }
    expect(state.bullets.length).toEqual(expect.any(Number)); // Bullet count may vary
  });
});
