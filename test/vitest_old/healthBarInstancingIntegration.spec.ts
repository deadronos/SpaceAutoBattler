import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import { HealthBarInstancer } from '../../src/renderer/healthBarInstancer.js';
import { RendererConfig } from '../../src/config/rendererConfig.js';
import type { Ship } from '../../src/types/index.js';

// Mock logger to avoid console spam during tests
vi.mock('../../src/utils/logger.js', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

describe('HealthBarInstancer Integration', () => {
  let scene: THREE.Scene;
  let healthBarsGroup: THREE.Group;
  let camera: THREE.PerspectiveCamera;
  let originalEnableBars: boolean;

  beforeEach(() => {
    // Store original config and enable health bar instancing for test
    originalEnableBars = RendererConfig.instancing.enableBars;
    (RendererConfig.instancing as any).enableBars = true;

    // Create THREE.js objects (no renderer needed for these tests)
    scene = new THREE.Scene();
    healthBarsGroup = new THREE.Group();
    scene.add(healthBarsGroup);

    camera = new THREE.PerspectiveCamera(75, 800 / 600, 0.1, 1000);
    camera.position.set(0, 0, 100);
  });

  afterEach(() => {
    // Restore original config
    (RendererConfig.instancing as any).enableBars = originalEnableBars;
  });

  describe('Performance Benefits', () => {
    test('should manage many ships efficiently', () => {
      const instancer = new HealthBarInstancer(scene, healthBarsGroup);

      // Create many test ships
      const numShips = 50;
      const ships: Ship[] = [];

      for (let i = 0; i < numShips; i++) {
        const ship: Ship = {
          id: i,
          pos: { x: Math.random() * 100, y: Math.random() * 100, z: 0 },
          prevPos: { x: Math.random() * 100, y: Math.random() * 100, z: 0 }, // Initialize for interpolation
          vel: { x: 0, y: 0, z: 0 },
          team: i % 2 === 0 ? 'red' : 'blue',
          class: 'fighter',
          health: 80 + Math.random() * 20,
          maxHealth: 100,
          shield: 60 + Math.random() * 40,
          maxShield: 100,
          orientation: { pitch: 0, yaw: 0, roll: 0 },
          prevOrientation: { pitch: 0, yaw: 0, roll: 0 }, // Initialize for interpolation
          level: { level: 1, xp: 0, nextLevelXp: 100 },
        } as Ship;
        ships.push(ship);
      }

      // Allocate instances for all ships
      ships.forEach((ship) => {
        const success = instancer.allocateInstance(ship.id);
        expect(success).toBe(true);
      });

      // Update health bars
      ships.forEach((ship) => {
        const success = instancer.updateHealthBar(ship);
        expect(success).toBe(true);
      });

      instancer.updateCameraUniforms(camera);
      instancer.markMatricesNeedUpdate();

      // Check that instancer has correct statistics
      const stats = instancer.getStats();
      expect(stats.used).toBe(numShips);
      expect(stats.capacity).toBeGreaterThanOrEqual(numShips);

      // Verify scene structure - should have 4 instanced meshes (one per layer type)
      // instead of numShips * 4 individual meshes
      expect(healthBarsGroup.children.length).toBe(4); // background, health, shield, border layers

      // Each child should be an InstancedMesh
      healthBarsGroup.children.forEach((child) => {
        expect(child).toBeInstanceOf(THREE.InstancedMesh);
        const instancedMesh = child as THREE.InstancedMesh;
        expect(instancedMesh.count).toBeGreaterThanOrEqual(numShips);
      });

      instancer.dispose();
    });

    test('should handle dynamic ship addition and removal efficiently', () => {
      const instancer = new HealthBarInstancer(scene, healthBarsGroup);

      // Start with some ships
      const initialShipIds = [1, 2, 3, 4, 5];
      initialShipIds.forEach((id) => {
        instancer.allocateInstance(id);
      });

      let stats = instancer.getStats();
      expect(stats.used).toBe(initialShipIds.length);

      // Add more ships
      const additionalShipIds = [6, 7, 8, 9, 10];
      additionalShipIds.forEach((id) => {
        instancer.allocateInstance(id);
      });

      stats = instancer.getStats();
      expect(stats.used).toBe(initialShipIds.length + additionalShipIds.length);

      // Remove some ships
      [1, 3, 5].forEach((id) => {
        instancer.freeInstance(id);
      });

      stats = instancer.getStats();
      expect(stats.used).toBe(7); // 5 + 5 - 3 = 7

      // Verify correct ships are still tracked
      expect(instancer.hasShip(2)).toBe(true);
      expect(instancer.hasShip(4)).toBe(true);
      expect(instancer.hasShip(6)).toBe(true);
      expect(instancer.hasShip(1)).toBe(false); // Removed
      expect(instancer.hasShip(3)).toBe(false); // Removed
      expect(instancer.hasShip(5)).toBe(false); // Removed

      instancer.dispose();
    });

    test('should handle ships with different health states efficiently', () => {
      const instancer = new HealthBarInstancer(scene, healthBarsGroup);

      // Create ships with various health states
      const testCases = [
        { id: 1, health: 100, maxHealth: 100, shield: 100, maxShield: 100 }, // Full health & shield
        { id: 2, health: 75, maxHealth: 100, shield: 50, maxShield: 100 }, // Good health, damaged shield
        { id: 3, health: 25, maxHealth: 100, shield: 25, maxShield: 100 }, // Critical health & shield
        { id: 4, health: 10, maxHealth: 100, shield: 0, maxShield: 100 }, // Critical health, no shield
        { id: 5, health: 100, maxHealth: 100, shield: 0, maxShield: 0 }, // Full health, no shield capability
      ];

      testCases.forEach((testCase) => {
        instancer.allocateInstance(testCase.id);

        const ship: Ship = {
          id: testCase.id,
          pos: { x: testCase.id * 10, y: 0, z: 0 },
          prevPos: { x: testCase.id * 10, y: 0, z: 0 }, // Initialize for interpolation
          vel: { x: 0, y: 0, z: 0 },
          team: 'red',
          class: 'fighter',
          health: testCase.health,
          maxHealth: testCase.maxHealth,
          shield: testCase.shield,
          maxShield: testCase.maxShield,
          orientation: { pitch: 0, yaw: 0, roll: 0 },
          prevOrientation: { pitch: 0, yaw: 0, roll: 0 }, // Initialize for interpolation
          level: { level: 1, xp: 0, nextLevelXp: 100 },
        } as Ship;

        expect(instancer.updateHealthBar(ship)).toBe(true);
      });

      instancer.updateCameraUniforms(camera);
      instancer.markMatricesNeedUpdate();

      const stats = instancer.getStats();
      expect(stats.used).toBe(testCases.length);

      instancer.dispose();
    });
  });

  describe('Feature Flag Integration', () => {
    test('should respect the enableBars configuration flag', () => {
      // Test with flag enabled (default for this test)
      expect(RendererConfig.instancing.enableBars).toBe(true);

      const instancer = new HealthBarInstancer(scene, healthBarsGroup);
      expect(instancer).toBeDefined();

      // Verify instancer works when enabled
      const success = instancer.allocateInstance(1);
      expect(success).toBe(true);

      instancer.dispose();
    });

    test('should handle capacity warnings appropriately', () => {
      const instancer = new HealthBarInstancer(scene, healthBarsGroup);
      const initialCapacity = RendererConfig.instancing.bars.initialCapacity;
      const warnThreshold = RendererConfig.instancing.bars.warnThreshold;
      const warnCount = Math.floor(initialCapacity * warnThreshold) + 1;

      // Allocate up to warning threshold
      for (let i = 0; i < warnCount; i++) {
        instancer.allocateInstance(i);
      }

      const stats = instancer.getStats();
      expect(stats.usagePercent).toBeGreaterThan(warnThreshold * 100);

      instancer.dispose();
    });
  });

  describe('Instancing vs Traditional Approach Comparison', () => {
    test('should create fewer scene objects than traditional approach', () => {
      const instancer = new HealthBarInstancer(scene, healthBarsGroup);
      const numShips = 20;

      // With instancing: allocate instances for many ships
      for (let i = 0; i < numShips; i++) {
        instancer.allocateInstance(i);
      }

      // With instancing, we should have exactly 4 InstancedMesh objects (layers)
      // vs traditional approach which would have numShips * 4 individual meshes
      expect(healthBarsGroup.children.length).toBe(4);

      // Each layer should be an InstancedMesh capable of rendering numShips instances
      healthBarsGroup.children.forEach((child) => {
        expect(child).toBeInstanceOf(THREE.InstancedMesh);
        const instancedMesh = child as THREE.InstancedMesh;
        expect(instancedMesh.count).toBeGreaterThanOrEqual(numShips);
      });

      // This represents a significant reduction in scene complexity:
      // Traditional: 20 ships * 4 layers = 80 mesh objects
      // Instanced: 4 InstancedMesh objects total
      const instancedObjectCount = healthBarsGroup.children.length;
      const traditionalObjectCount = numShips * 4;

      expect(instancedObjectCount).toBeLessThan(traditionalObjectCount);
      expect(instancedObjectCount / traditionalObjectCount).toBeLessThan(0.1); // At least 90% reduction

      instancer.dispose();
    });
  });
});
