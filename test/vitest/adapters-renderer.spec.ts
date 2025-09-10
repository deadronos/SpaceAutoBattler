import { describe, it, expect, beforeEach } from 'vitest';
import {
  RendererAdapter,
  NoopRendererAdapter,
  VisualDescriptor,
  Transform,
  EffectDescriptor,
  CameraParams,
  RendererInitOptions,
  RendererStats,
} from '../../src/core/adapters/rendererAdapter.js';
import { createMockShip, createMockBullet } from './setupTests.js';

describe('RendererAdapter', () => {
  describe('NoopRendererAdapter', () => {
    let adapter: NoopRendererAdapter;

    beforeEach(() => {
      adapter = new NoopRendererAdapter();
    });

    it('should initialize correctly', async () => {
      expect(adapter.isInitialized()).toBe(false);

      const canvas = document.createElement('canvas');
      const options: RendererInitOptions = {
        antialias: true,
        shadows: true,
        quality: 'medium',
      };

      await adapter.init(canvas, options);
      expect(adapter.isInitialized()).toBe(true);
    });

    it('should manage entities', () => {
      const entityId = 42;
      const visual: VisualDescriptor = {
        type: 'ship',
        modelPath: 'ship.gltf',
        color: { r: 1, g: 0, b: 0 },
        scale: { x: 1, y: 1, z: 1 },
      };

      expect(adapter.hasEntity(entityId)).toBe(false);

      adapter.addEntity(entityId, visual);
      expect(adapter.hasEntity(entityId)).toBe(true);

      adapter.updateEntity(entityId, { color: { r: 0, g: 1, b: 0 } });
      expect(adapter.hasEntity(entityId)).toBe(true);

      adapter.removeEntity(entityId);
      expect(adapter.hasEntity(entityId)).toBe(false);
    });

    it('should support legacy ship/bullet methods', () => {
      const ship = createMockShip({ id: 1 });
      const bullet = createMockBullet({ id: 2 });

      // These should not throw
      adapter.ensureMeshForShip(ship);
      expect(adapter.hasEntity(1)).toBe(true);

      adapter.updateMeshFromShip(ship);
      adapter.removeShip(1);
      expect(adapter.hasEntity(1)).toBe(false);

      adapter.ensureMeshForBullet(bullet);
      expect(adapter.hasEntity(2)).toBe(true);

      adapter.updateMeshFromBullet(bullet);
      adapter.removeBullet(2);
      expect(adapter.hasEntity(2)).toBe(false);
    });

    it('should manage camera settings', () => {
      const cameraParams: CameraParams = {
        position: { x: 10, y: 5, z: 15 },
        target: { x: 0, y: 0, z: 0 },
        fov: 60,
        zoom: 1.0,
      };

      adapter.setCamera(cameraParams);
      const retrieved = adapter.getCamera();

      expect(retrieved.position).toEqual(cameraParams.position);
      expect(retrieved.target).toEqual(cameraParams.target);
      expect(retrieved.fov).toBe(60);
      expect(retrieved.zoom).toBe(1.0);
    });

    it('should manage transforms', () => {
      const entityId = 42;
      const transform: Transform = {
        position: { x: 5, y: 10, z: 15 },
        rotation: { x: 0, y: Math.PI / 2, z: 0 },
        scale: { x: 2, y: 2, z: 2 },
      };

      expect(adapter.getTransform(entityId)).toBeNull();

      adapter.setTransform(entityId, transform);
      const retrieved = adapter.getTransform(entityId);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.position).toEqual(transform.position);
      expect(retrieved!.rotation).toEqual(transform.rotation);
      expect(retrieved!.scale).toEqual(transform.scale);
    });

    it('should manage effects', () => {
      const entityId = 42;
      const effect: EffectDescriptor = {
        type: 'explosion',
        position: { x: 0, y: 0, z: 0 },
        scale: 2.0,
        duration: 1.5,
        color: { r: 1, g: 0.5, b: 0 },
      };

      const effectId = adapter.playEffect(entityId, effect);
      expect(typeof effectId).toBe('string');
      expect(effectId.length).toBeGreaterThan(0);

      // Remove specific effect
      adapter.removeEffect(entityId, effectId);

      // Play multiple effects
      const effect1Id = adapter.playEffect(entityId, effect);
      const effect2Id = adapter.playEffect(entityId, { ...effect, type: 'shield-hit' });

      expect(effect1Id).not.toBe(effect2Id);

      // Clear all effects for entity
      adapter.clearEffects(entityId);

      // Clear all effects globally
      adapter.playEffect(99, effect);
      adapter.clearEffects(); // Clear all
    });

    it('should handle frame rendering', () => {
      // These should not throw
      adapter.renderFrame(1000);
      adapter.resize(1920, 1080);
    });

    it('should provide performance stats', () => {
      const stats = adapter.getStats();

      expect(stats).toHaveProperty('fps');
      expect(stats).toHaveProperty('drawCalls');
      expect(stats).toHaveProperty('triangles');
      expect(stats).toHaveProperty('geometries');
      expect(stats).toHaveProperty('textures');
      expect(stats).toHaveProperty('memoryUsage');

      expect(typeof stats.fps).toBe('number');
      expect(typeof stats.drawCalls).toBe('number');
      expect(typeof stats.triangles).toBe('number');
    });

    it('should manage quality settings', () => {
      expect(adapter.getQuality()).toBe('medium'); // Default

      adapter.setQuality('high');
      expect(adapter.getQuality()).toBe('high');

      adapter.setQuality('low');
      expect(adapter.getQuality()).toBe('low');
    });

    it('should handle scene operations', () => {
      const entityId = 42;
      adapter.addEntity(entityId, { type: 'ship' });
      expect(adapter.hasEntity(entityId)).toBe(true);

      adapter.clearScene();
      expect(adapter.hasEntity(entityId)).toBe(false);

      // These should not throw
      adapter.setBackground({ r: 0.2, g: 0.3, b: 0.5 });
      adapter.setBackground('#ff0000');
    });

    it('should dispose cleanly', () => {
      const entityId = 42;
      adapter.addEntity(entityId, { type: 'ship' });
      adapter.setTransform(entityId, {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
      });
      adapter.playEffect(entityId, { type: 'explosion', position: { x: 0, y: 0, z: 0 } });

      adapter.dispose();

      expect(adapter.isInitialized()).toBe(false);
      expect(adapter.hasEntity(entityId)).toBe(false);
      expect(adapter.getTransform(entityId)).toBeNull();
    });

    it('should clean up effects when entity is removed', () => {
      const entityId = 42;
      adapter.addEntity(entityId, { type: 'ship' });

      const effectId = adapter.playEffect(entityId, {
        type: 'explosion',
        position: { x: 0, y: 0, z: 0 },
      });

      adapter.removeEntity(entityId);

      // Effects should be cleaned up automatically
      expect(adapter.hasEntity(entityId)).toBe(false);
    });
  });

  describe('Interface compliance', () => {
    it('should implement all required methods', () => {
      const adapter = new NoopRendererAdapter();

      const requiredMethods = [
        'init',
        'dispose',
        'isInitialized',
        'addEntity',
        'updateEntity',
        'removeEntity',
        'hasEntity',
        'ensureMeshForShip',
        'updateMeshFromShip',
        'removeShip',
        'ensureMeshForBullet',
        'updateMeshFromBullet',
        'removeBullet',
        'setCamera',
        'getCamera',
        'setTransform',
        'getTransform',
        'playEffect',
        'removeEffect',
        'clearEffects',
        'renderFrame',
        'resize',
        'getStats',
        'setQuality',
        'getQuality',
        'clearScene',
        'setBackground',
      ];

      for (const method of requiredMethods) {
        expect(typeof (adapter as any)[method]).toBe('function');
      }
    });

    it('should have correct type structure for VisualDescriptor', () => {
      const visual: VisualDescriptor = {
        type: 'ship',
        modelPath: 'model.gltf',
        texture: 'texture.jpg',
        color: { r: 0.8, g: 0.2, b: 0.1 },
        scale: { x: 1.5, y: 1.5, z: 1.5 },
        opacity: 0.9,
        material: 'metallic',
      };

      expect(visual.type).toBe('ship');
      expect(visual.modelPath).toBe('model.gltf');
      expect(visual.texture).toBe('texture.jpg');
      expect(visual.color).toEqual({ r: 0.8, g: 0.2, b: 0.1 });
      expect(visual.scale).toEqual({ x: 1.5, y: 1.5, z: 1.5 });
      expect(visual.opacity).toBe(0.9);
      expect(visual.material).toBe('metallic');
    });

    it('should have correct type structure for Transform', () => {
      const transform: Transform = {
        position: { x: 1, y: 2, z: 3 },
        rotation: { x: 0, y: Math.PI, z: 0 },
        scale: { x: 2, y: 2, z: 2 },
      };

      expect(transform.position).toEqual({ x: 1, y: 2, z: 3 });
      expect(transform.rotation).toEqual({ x: 0, y: Math.PI, z: 0 });
      expect(transform.scale).toEqual({ x: 2, y: 2, z: 2 });
    });

    it('should have correct type structure for EffectDescriptor', () => {
      const effect: EffectDescriptor = {
        type: 'explosion',
        position: { x: 0, y: 0, z: 0 },
        scale: 1.5,
        duration: 2.0,
        color: { r: 1, g: 0.5, b: 0 },
        params: { intensity: 0.8, sparks: true },
      };

      expect(effect.type).toBe('explosion');
      expect(effect.position).toEqual({ x: 0, y: 0, z: 0 });
      expect(effect.scale).toBe(1.5);
      expect(effect.duration).toBe(2.0);
      expect(effect.color).toEqual({ r: 1, g: 0.5, b: 0 });
      expect(effect.params).toEqual({ intensity: 0.8, sparks: true });
    });

    it('should have correct type structure for CameraParams', () => {
      const camera: CameraParams = {
        position: { x: 10, y: 20, z: 30 },
        target: { x: 0, y: 0, z: 0 },
        fov: 75,
        near: 0.1,
        far: 1000,
        zoom: 1.2,
      };

      expect(camera.position).toEqual({ x: 10, y: 20, z: 30 });
      expect(camera.target).toEqual({ x: 0, y: 0, z: 0 });
      expect(camera.fov).toBe(75);
      expect(camera.near).toBe(0.1);
      expect(camera.far).toBe(1000);
      expect(camera.zoom).toBe(1.2);
    });

    it('should have correct type structure for RendererStats', () => {
      const adapter = new NoopRendererAdapter();
      const stats = adapter.getStats();

      expect(typeof stats.fps).toBe('number');
      expect(typeof stats.drawCalls).toBe('number');
      expect(typeof stats.triangles).toBe('number');
      expect(typeof stats.geometries).toBe('number');
      expect(typeof stats.textures).toBe('number');
      expect(typeof stats.memoryUsage).toBe('number');
    });
  });

  describe('Error handling', () => {
    let adapter: NoopRendererAdapter;

    beforeEach(() => {
      adapter = new NoopRendererAdapter();
    });

    it('should handle operations on non-existent entities gracefully', () => {
      const nonExistentId = 999;

      expect(adapter.getTransform(nonExistentId)).toBeNull();
      expect(adapter.hasEntity(nonExistentId)).toBe(false);

      // These should not throw
      expect(() => adapter.updateEntity(nonExistentId, { type: 'ship' })).not.toThrow();
      expect(() => adapter.removeEntity(nonExistentId)).not.toThrow();
      expect(() =>
        adapter.setTransform(nonExistentId, {
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
        }),
      ).not.toThrow();
      expect(() => adapter.removeEffect(nonExistentId, 'fake-effect')).not.toThrow();

      // After setting transform, it should exist even for non-existent entity
      expect(adapter.getTransform(nonExistentId)).not.toBeNull();
      expect(adapter.hasEntity(nonExistentId)).toBe(false); // Entity itself still doesn't exist
    });

    it('should handle multiple disposals gracefully', () => {
      adapter.dispose();

      // Should not throw when disposing again
      expect(() => adapter.dispose()).not.toThrow();
    });
  });
});
