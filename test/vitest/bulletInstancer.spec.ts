import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BulletInstancer } from '../../src/renderer/bulletInstancer.js';
import type { Bullet } from '../../src/types/index.js';
import { RendererConfig } from '../../src/config/rendererConfig.js';

// Mock Three.js for instancer tests
vi.mock('three', () => ({
  SphereGeometry: vi.fn(),
  MeshBasicMaterial: vi.fn(),
  InstancedMesh: vi.fn().mockImplementation((geometry, material, capacity) => ({
    setMatrixAt: vi.fn(),
    getMatrixAt: vi.fn(),
    instanceMatrix: { needsUpdate: false },
    geometry: { dispose: vi.fn() },
    material: { dispose: vi.fn() },
    parent: null,
    capacity
  })),
  Matrix4: vi.fn().mockImplementation(() => ({
    compose: vi.fn(),
    makeScale: vi.fn()
  })),
  Vector3: vi.fn().mockImplementation(() => ({
    set: vi.fn(),
    copy: vi.fn()
  })),
  Quaternion: vi.fn().mockImplementation(() => ({})),
  Group: vi.fn().mockImplementation(() => ({
    add: vi.fn(),
    remove: vi.fn()
  }))
}));

describe('BulletInstancer', () => {
  let mockScene: any;
  let mockBulletsGroup: any;
  let bulletInstancer: BulletInstancer;

  beforeEach(() => {
    mockScene = {
      add: vi.fn(),
      remove: vi.fn()
    };
    
    mockBulletsGroup = {
      add: vi.fn(),
      remove: vi.fn()
    };

    bulletInstancer = new BulletInstancer(mockScene, mockBulletsGroup);
  });

  it('should initialize with correct capacity', () => {
    const stats = bulletInstancer.getStats();
    expect(stats.capacity).toBe(RendererConfig.instancing.bullets.initialCapacity);
    expect(stats.used).toBe(0);
    expect(stats.free).toBe(RendererConfig.instancing.bullets.initialCapacity);
  });

  it('should allocate instances for bullets', () => {
    const bulletId1 = 1;
    const bulletId2 = 2;

    const success1 = bulletInstancer.allocateInstance(bulletId1);
    const success2 = bulletInstancer.allocateInstance(bulletId2);

    expect(success1).toBe(true);
    expect(success2).toBe(true);
    expect(bulletInstancer.hasBullet(bulletId1)).toBe(true);
    expect(bulletInstancer.hasBullet(bulletId2)).toBe(true);

    const stats = bulletInstancer.getStats();
    expect(stats.used).toBe(2);
    expect(stats.free).toBe(RendererConfig.instancing.bullets.initialCapacity - 2);
  });

  it('should not allocate duplicate instances', () => {
    const bulletId = 1;
    
    const success1 = bulletInstancer.allocateInstance(bulletId);
    const success2 = bulletInstancer.allocateInstance(bulletId);

    expect(success1).toBe(true);
    expect(success2).toBe(true); // Returns true but doesn't create duplicate
    
    const stats = bulletInstancer.getStats();
    expect(stats.used).toBe(1); // Only one instance allocated
  });

  it('should free instances correctly', () => {
    const bulletId = 1;
    
    bulletInstancer.allocateInstance(bulletId);
    expect(bulletInstancer.hasBullet(bulletId)).toBe(true);
    
    const freed = bulletInstancer.freeInstance(bulletId);
    expect(freed).toBe(true);
    expect(bulletInstancer.hasBullet(bulletId)).toBe(false);
    
    const stats = bulletInstancer.getStats();
    expect(stats.used).toBe(0);
    expect(stats.free).toBe(RendererConfig.instancing.bullets.initialCapacity);
  });

  it('should handle freeing non-existent instances', () => {
    const bulletId = 999;
    
    const freed = bulletInstancer.freeInstance(bulletId);
    expect(freed).toBe(false);
  });

  it('should update bullet transforms', () => {
    const bulletId = 1;
    const bullet: Bullet = {
      id: bulletId,
      pos: { x: 10, y: 20, z: 30 },
      vel: { x: 1, y: 0, z: 0 },
      ownerTeam: 'red',
      weaponId: 'test'
    };

    bulletInstancer.allocateInstance(bulletId);
    const success = bulletInstancer.updateBulletTransform(bullet);
    
    expect(success).toBe(true);
  });

  it('should not update transforms for non-existent bullets', () => {
    const bullet: Bullet = {
      id: 999,
      pos: { x: 10, y: 20, z: 30 },
      vel: { x: 1, y: 0, z: 0 },
      ownerTeam: 'red',
      weaponId: 'test'
    };

    const success = bulletInstancer.updateBulletTransform(bullet);
    expect(success).toBe(false);
  });

  it('should mark matrix as needing update', () => {
    const mockInstancedMesh = bulletInstancer['instancedMesh'];
    
    bulletInstancer.markMatrixNeedsUpdate();
    expect(mockInstancedMesh.instanceMatrix.needsUpdate).toBe(true);
  });

  it('should track active bullet IDs correctly', () => {
    const bulletIds = [1, 2, 3, 4, 5];
    
    // Allocate bullets
    bulletIds.forEach(id => bulletInstancer.allocateInstance(id));
    
    const activeBulletIds = bulletInstancer.getActiveBulletIds();
    expect(activeBulletIds).toHaveLength(5);
    bulletIds.forEach(id => expect(activeBulletIds).toContain(id));
    
    // Free some bullets
    bulletInstancer.freeInstance(2);
    bulletInstancer.freeInstance(4);
    
    const updatedActiveBulletIds = bulletInstancer.getActiveBulletIds();
    expect(updatedActiveBulletIds).toHaveLength(3);
    expect(updatedActiveBulletIds).toContain(1);
    expect(updatedActiveBulletIds).toContain(3);
    expect(updatedActiveBulletIds).toContain(5);
    expect(updatedActiveBulletIds).not.toContain(2);
    expect(updatedActiveBulletIds).not.toContain(4);
  });

  it('should provide accurate statistics', () => {
    const initialStats = bulletInstancer.getStats();
    expect(initialStats.usagePercent).toBe(0);
    
    // Allocate 10 bullets
    for (let i = 1; i <= 10; i++) {
      bulletInstancer.allocateInstance(i);
    }
    
    const stats = bulletInstancer.getStats();
    expect(stats.used).toBe(10);
    expect(stats.capacity).toBe(RendererConfig.instancing.bullets.initialCapacity);
    expect(stats.free).toBe(RendererConfig.instancing.bullets.initialCapacity - 10);
    expect(stats.usagePercent).toBe(Math.round((10 / RendererConfig.instancing.bullets.initialCapacity) * 100));
  });

  it('should dispose resources properly', () => {
    const mockInstancedMesh = bulletInstancer['instancedMesh'];
    
    bulletInstancer.dispose();
    
    expect(mockInstancedMesh.geometry.dispose).toHaveBeenCalled();
    expect(mockInstancedMesh.material.dispose).toHaveBeenCalled();
    
    const stats = bulletInstancer.getStats();
    expect(stats.used).toBe(0);
    expect(bulletInstancer.getActiveBulletIds()).toHaveLength(0);
  });
});