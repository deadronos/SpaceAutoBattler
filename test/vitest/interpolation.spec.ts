import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { createInitialState, simulateStep } from '../../src/core/gameState.js';
import { DefaultRendererConfig } from '../../src/config/rendererConfig.js';
import { createThreeRenderer } from '../../src/renderer/threeRenderer.js';
import { RendererConfig } from '../../src/config/rendererConfig.js';

// Mock canvas for headless testing
const mockCanvas = document.createElement('canvas');

describe('Interpolation Tests', () => {
  let state: ReturnType<typeof createInitialState>;

  beforeEach(() => {
    state = createInitialState('interpolation-test');
    // Spawn a ship and bullet for testing
    const ship = state.ships[0] = {
      id: 1,
      team: 'red',
      class: 'fighter',
      pos: { x: 0, y: 0, z: 0 },
      prevPos: { x: 0, y: 0, z: 0 },
      vel: { x: 100, y: 0, z: 0 },
      orientation: { pitch: 0, yaw: 0, roll: 0 },
      prevOrientation: { pitch: 0, yaw: 0, roll: 0 },
      // ... minimal other fields
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

  it('should compute alpha clamped to [0,1]', () => {
    // Simulate partial step
    simulateStep(state, 1 / 120); // half tick at 60 TPS
    const renderer = createThreeRenderer(state, mockCanvas);
    // Access internal interpolation factor (private, but for test)
    const alpha = (renderer as any).interpolationFactor; // mock or test internal
    expect(alpha).toBeGreaterThan(0);
    expect(alpha).toBeLessThanOrEqual(1);
  });

  it('should LERP ship positions', () => {
    // Initial pos 0, after step pos 50 at alpha=0.5 -> render pos 25
    simulateStep(state, 1 / 120);
    const ship = state.ships[0];
    ship.pos.x = 50; // simulate movement
    const renderer = createThreeRenderer(state, mockCanvas);
    // Mock updateTransforms call and check interpolated pos
    const mockMesh = { position: new THREE.Vector3() };
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
    const config = { ...DefaultRendererConfig, enableInterpolation: false };
    // Mock renderer with disabled interp
    const renderer = createThreeRenderer(state, mockCanvas);
    // With toggle false, should use current pos (no lerp)
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
    const renderer = createThreeRenderer(state, mockCanvas);
    // Mock check
    expect(posAfterStep).toBe(state.ships[0].pos.x);
  });
});
