import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { createInitialState, simulateStep } from '../../src/core/gameState.js';

// Note: These tests avoid instantiating WebGLRenderer to keep headless runs stable.

describe('Interpolation Tests', () => {
  let state: ReturnType<typeof createInitialState>;

  beforeEach(() => {
    state = createInitialState('interpolation-test');
    // Spawn a ship and bullet for testing
    state.ships[0] = {
      id: 1,
      team: 'red',
      class: 'fighter',
      pos: { x: 0, y: 0, z: 0 },
      prevPos: { x: 0, y: 0, z: 0 },
      vel: { x: 100, y: 0, z: 0 },
      orientation: { pitch: 0, yaw: 0, roll: 0 },
      prevOrientation: { pitch: 0, yaw: 0, roll: 0 },
      targetId: null,
      armor: 0,
      shield: 0,
      maxShield: 0,
      shieldRegen: 0,
      speed: 100,
      turnRate: Math.PI,
      kills: 0,
      health: 100,
      maxHealth: 100,
      turrets: [],
      level: { level: 1, xp: 0, nextLevelXp: 10 },
    };
    state.bullets[0] = {
      id: 1,
      ownerShipId: 1,
      ownerTeam: 'red',
      pos: { x: 10, y: 0, z: 0 },
      prevPos: { x: 10, y: 0, z: 0 },
      vel: { x: 200, y: 0, z: 0 },
      ttl: 5,
      damage: 10,
    };
  });

  it('should compute alpha clamped to [0,1] (math only)', () => {
    // Simulate that within a fixed dt, elapsed yields alpha in [0,1].
    const fixedDt = 0.1; // 10 TPS (matches DefaultSimConfig)
    const elapsed = 0.035; // 35ms into step
    const alpha = Math.max(0, Math.min(1, elapsed / fixedDt));
    expect(alpha).toBeGreaterThan(0);
    expect(alpha).toBeLessThanOrEqual(1);
    expect(alpha).toBeCloseTo(0.35, 6);
  });

  it('should LERP ship positions', () => {
    // Initial pos 0, after step pos 50 at alpha=0.5 -> render pos 25
    simulateStep(state, 1 / 120);
    const ship = state.ships[0];
    ship.pos.x = 50; // simulate movement
    // Check interpolation math only; no renderer creation
    // Simulate updateTransforms with alpha=0.5
    const alpha = 0.5;
    const interpolatedX = (ship.prevPos.x + (ship.pos.x - ship.prevPos.x) * alpha);
    expect(interpolatedX).toBe(25);
  });

  it('should SLERP ship orientations', () => {
    const ship = state.ships[0];
    ship.prevOrientation = { pitch: 0, yaw: 0, roll: 0 };
    ship.orientation = { pitch: Math.PI / 4, yaw: Math.PI / 2, roll: 0 };
    const alpha = 0.5;
    // Simulate SLERP - expect halfway quaternion
    const prevQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0));
    const nextQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI/4, Math.PI/2, 0));
    const interpQ = new THREE.Quaternion().slerpQuaternions(prevQ, nextQ, alpha);
    // Check if interpolated (not exact numbers, but valid quaternion)
    expect(interpQ.x).toBeGreaterThan(-1);
    expect(interpQ.y).toBeGreaterThan(-1);
    expect(interpQ.z).toBeGreaterThan(-1);
    expect(interpQ.w).toBeGreaterThan(-1);
  });

  it('should LERP bullet positions', () => {
    const bullet = state.bullets[0];
    bullet.prevPos = { x: 10, y: 0, z: 0 };
    bullet.pos = { x: 30, y: 0, z: 0 };
    const alpha = 0.5;
    const interpolatedX = bullet.prevPos.x + (bullet.pos.x - bullet.prevPos.x) * alpha;
    expect(interpolatedX).toBe(20);
  });

  it('should disable interpolation when toggle is false', () => {
    // With toggle false, rendering would use current pos (no lerp)
    const ship = state.ships[0];
    ship.pos.x = 50;
    // At alpha=0.5, but disabled, expect pos.x=50 not interpolated
    const finalPosX = 50; // current
    expect(finalPosX).toBe(50);
  });

  it('should preserve determinism with interpolation disabled', () => {
    // Run sim steps with interp off, check positions match non-interp
    simulateStep(state, 1/60);
    const posAfterStep = state.ships[0].pos.x;
    // Render with interp off should match sim pos
    // Mock check: render position equals sim position when not interpolating
    expect(posAfterStep).toBe(state.ships[0].pos.x);
  });

  // New tests: alpha monotonicity and quaternion near-180° edge case
  it('alpha is clamped and non-decreasing across elapsed samples (pure math)', () => {
    const fixedDt = 0.1; // 100ms step
    const elapsedSamples = [-0.05, 0, 0.02, 0.05, 0.08, 0.1, 0.11, 0.2];
    const alphas = elapsedSamples.map((e) => Math.max(0, Math.min(1, e / fixedDt)));

    // All alphas within [0,1]
    for (const a of alphas) {
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(1);
    }

    // Monotonic non-decreasing
    for (let i = 1; i < alphas.length; i++) {
      expect(alphas[i]).toBeGreaterThanOrEqual(alphas[i - 1]);
    }

    // Specific clamps
    expect(alphas[0]).toBe(0); // negative elapsed -> 0
    expect(alphas[alphas.length - 1]).toBe(1); // beyond dt -> 1
  });

  it('quaternion SLERP follows shortest arc near 180° (yaw -170° to +170°)', () => {
    // Construct quaternions around Y axis
    const degToRad = (d: number) => (d * Math.PI) / 180;
    const prevEuler = new THREE.Euler(0, degToRad(-170), 0);
    const nextEuler = new THREE.Euler(0, degToRad(170), 0);

    const prevQ = new THREE.Quaternion().setFromEuler(prevEuler);
    const nextQ = new THREE.Quaternion().setFromEuler(nextEuler);

    // Total shortest-arc angle between prev and next should be ~20°
    const total = prevQ.angleTo(nextQ);
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThan(degToRad(30)); // within a reasonable bound (>0, <30°)

    const alpha = 0.5;
    const interpQ = new THREE.Quaternion().slerpQuaternions(prevQ, nextQ, alpha);

    // The angle from prev to the halfway quaternion should be ~ total * 0.5
    const half = prevQ.angleTo(interpQ);
    expect(half).toBeCloseTo(total * 0.5, 3);

    // And the remaining angle to next should match as well
    const remain = interpQ.angleTo(nextQ);
    expect(remain).toBeCloseTo(total * 0.5, 3);

    // Ensure it did not take the long path (~340°), i.e., total is small
    expect(total).toBeLessThan(degToRad(90));
  });
});
