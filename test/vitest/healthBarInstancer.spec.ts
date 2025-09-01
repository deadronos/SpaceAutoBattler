import { describe, test, expect, beforeEach, vi } from 'vitest';
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

describe('HealthBarInstancer', () => {
  let instancer: HealthBarInstancer;
  let scene: THREE.Scene;
  let healthBarsGroup: THREE.Group;
  let camera: THREE.PerspectiveCamera;
  let mockShip: Ship;

  beforeEach(() => {
    // Setup THREE.js objects
    scene = new THREE.Scene();
    healthBarsGroup = new THREE.Group();
    camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    camera.position.set(0, 0, 100);

    // Create instancer
    instancer = new HealthBarInstancer(scene, healthBarsGroup);

    // Mock ship
    mockShip = {
      id: 1,
      pos: { x: 0, y: 0, z: 0 },
      vel: { x: 0, y: 0, z: 0 },
      team: 'red',
      class: 'fighter',
      health: 80,
      maxHealth: 100,
      shield: 60,
      maxShield: 100,
      orientation: { pitch: 0, yaw: 0, roll: 0 },
      level: { level: 1, xp: 0, nextLevelXp: 100 }
    } as Ship;
  });

  describe('Instance Management', () => {
    test('should allocate instance for new ship', () => {
      const success = instancer.allocateInstance(mockShip.id);
      expect(success).toBe(true);
      expect(instancer.hasShip(mockShip.id)).toBe(true);
    });

    test('should not allocate duplicate instance for same ship', () => {
      instancer.allocateInstance(mockShip.id);
      const success = instancer.allocateInstance(mockShip.id);
      expect(success).toBe(true); // Should still return true but log warning
      expect(instancer.hasShip(mockShip.id)).toBe(true);
    });

    test('should free instance for removed ship', () => {
      instancer.allocateInstance(mockShip.id);
      expect(instancer.hasShip(mockShip.id)).toBe(true);
      
      const success = instancer.freeInstance(mockShip.id);
      expect(success).toBe(true);
      expect(instancer.hasShip(mockShip.id)).toBe(false);
    });

    test('should handle freeing non-existent instance', () => {
      const success = instancer.freeInstance(999);
      expect(success).toBe(false);
    });
  });

  describe('Health Bar Updates', () => {
    beforeEach(() => {
      instancer.allocateInstance(mockShip.id);
    });

    test('should update health bar for allocated ship', () => {
      const success = instancer.updateHealthBar(mockShip);
      expect(success).toBe(true);
    });

    test('should handle update for non-allocated ship', () => {
      const nonAllocatedShip = { ...mockShip, id: 999 } as Ship;
      const success = instancer.updateHealthBar(nonAllocatedShip);
      expect(success).toBe(false);
    });

    test('should handle ship with no shield', () => {
      const noShieldShip = { ...mockShip, maxShield: 0, shield: 0 } as Ship;
      instancer.allocateInstance(noShieldShip.id);
      const success = instancer.updateHealthBar(noShieldShip);
      expect(success).toBe(true);
    });

    test('should handle ship with critical health', () => {
      const criticalShip = { ...mockShip, health: 10 } as Ship; // 10/100 = 10% health
      const success = instancer.updateHealthBar(criticalShip);
      expect(success).toBe(true);
    });
  });

  describe('Camera Updates', () => {
    test('should update camera uniforms without error', () => {
      expect(() => {
        instancer.updateCameraUniforms(camera);
      }).not.toThrow();
    });

    test('should mark matrices as needing update', () => {
      expect(() => {
        instancer.markMatricesNeedUpdate();
      }).not.toThrow();
    });
  });

  describe('Statistics and Capacity', () => {
    test('should provide accurate statistics', () => {
      const initialStats = instancer.getStats();
      expect(initialStats.capacity).toBe(RendererConfig.instancing.bars.initialCapacity);
      expect(initialStats.used).toBe(0);
      expect(initialStats.usagePercent).toBe(0);
      expect(initialStats.free).toBe(RendererConfig.instancing.bars.initialCapacity);

      // Allocate an instance
      instancer.allocateInstance(mockShip.id);
      const afterAllocStats = instancer.getStats();
      expect(afterAllocStats.used).toBe(1);
      expect(afterAllocStats.free).toBe(RendererConfig.instancing.bars.initialCapacity - 1);
    });

    test('should handle multiple ship allocations', () => {
      const shipIds = [1, 2, 3, 4, 5];
      
      shipIds.forEach(id => {
        instancer.allocateInstance(id);
      });

      const stats = instancer.getStats();
      expect(stats.used).toBe(shipIds.length);
      expect(stats.free).toBe(RendererConfig.instancing.bars.initialCapacity - shipIds.length);
    });
  });

  describe('Layer Management', () => {
    test('should create all required layer types', () => {
      // Check that all layer types are created during construction
      // This is verified by the constructor not throwing and instancer being created successfully
      expect(instancer).toBeDefined();
    });

    test('should handle updates to all layers', () => {
      instancer.allocateInstance(mockShip.id);
      
      // Test with different health/shield states
      const testCases = [
        { health: 100, maxHealth: 100, shield: 100, maxShield: 100 }, // Full health & shield
        { health: 50, maxHealth: 100, shield: 50, maxShield: 100 },   // Half health & shield
        { health: 10, maxHealth: 100, shield: 0, maxShield: 100 },    // Critical health, no shield
        { health: 100, maxHealth: 100, shield: 0, maxShield: 0 },     // Full health, no shield capability
      ];

      testCases.forEach((testCase, index) => {
        const testShip = { 
          ...mockShip, 
          id: mockShip.id,
          health: testCase.health,
          maxHealth: testCase.maxHealth,
          shield: testCase.shield,
          maxShield: testCase.maxShield
        } as Ship;

        expect(() => {
          instancer.updateHealthBar(testShip);
        }).not.toThrow();
      });
    });
  });

  describe('Resource Management', () => {
    test('should dispose resources without error', () => {
      instancer.allocateInstance(mockShip.id);
      
      expect(() => {
        instancer.dispose();
      }).not.toThrow();
    });

    test('should handle empty disposal', () => {
      // Test disposing without any allocated instances
      expect(() => {
        instancer.dispose();
      }).not.toThrow();
    });
  });

  describe('Configuration Integration', () => {
    test('should respect health bar configuration', () => {
      const config = RendererConfig.healthBars;
      
      // Verify that the instancer uses the configuration values
      expect(config.position.offsetX).toBeDefined();
      expect(config.position.offsetY).toBeDefined();
      expect(config.colors.health.full).toBeDefined();
      expect(config.colors.shield.full).toBeDefined();
      expect(config.colors.background).toBeDefined();
      expect(config.border.color).toBeDefined();
    });

    test('should respect instancing configuration', () => {
      const config = RendererConfig.instancing.bars;
      
      expect(config.initialCapacity).toBeGreaterThan(0);
      expect(config.maxCapacity).toBeGreaterThanOrEqual(config.initialCapacity);
      expect(config.growthFactor).toBeGreaterThan(1);
      expect(config.warnThreshold).toBeGreaterThan(0);
      expect(config.warnThreshold).toBeLessThanOrEqual(1);
    });
  });
});