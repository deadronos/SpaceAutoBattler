import { describe, it, expect } from 'vitest';
// We'll test individual components since the full orchestrator requires complex WebGL mocking
import { setupScene, updateSkyboxAnimation, disposeScene } from '../../src/renderer/sceneSetup.js';
import { setupCamera, updateCameraPosition, setCameraDistance, getCameraDistance } from '../../src/renderer/cameraManager.js';
import { createMeshFactoryState, meshFactory } from '../../src/renderer/meshFactory.js';
import { createShieldEffectState, shieldEffect } from '../../src/renderer/effects/shieldEffect.js';
import { createSynchronizerState, createSynchronizerGroups } from '../../src/renderer/synchronizer.js';
import { createOverlayState, updateBillboardBars } from '../../src/renderer/overlay.js';
import { createMockGameState } from './setupTests.js';
import * as THREE from 'three';

// Test the new orchestrator renderer components
describe('New Orchestrator Renderer Components', () => {

  describe('Module Integration', () => {
    it('should initialize all modules without conflicts', () => {
      const state = createMockGameState();
      
      // Initialize all module states (simulating what the orchestrator does)
      const sceneElements = setupScene(state);
      const cameraState = setupCamera(state);
      const meshFactoryState = createMeshFactoryState();
      const shieldEffectState = createShieldEffectState();
      const syncState = createSynchronizerState();
      const groups = createSynchronizerGroups();
      const overlayState = createOverlayState();
      
      // All modules should initialize successfully
      expect(sceneElements.scene).toBeInstanceOf(THREE.Scene);
      expect(cameraState.camera).toBeInstanceOf(THREE.PerspectiveCamera);
      expect(meshFactoryState.billboardMaterials).toBeInstanceOf(Set);
      expect(shieldEffectState.recentShieldHits).toBeInstanceOf(Map);
      expect(syncState.shipMeshes).toBeInstanceOf(Map);
      expect(groups.shipsGroup).toBeInstanceOf(THREE.Group);
      expect(overlayState.GPU_BILLBOARD).toBe(true);
      
      // Groups can be added to scene
      sceneElements.scene.add(groups.shipsGroup);
      sceneElements.scene.add(groups.bulletsGroup);
      sceneElements.scene.add(groups.healthBarsGroup);
      sceneElements.scene.add(groups.shieldEffectsGroup);
      
      expect(sceneElements.scene.children.length).toBeGreaterThanOrEqual(4);
      
      // Cleanup should work
      expect(() => disposeScene(sceneElements)).not.toThrow();
    });

    it('should coordinate camera and scene updates', () => {
      const state = createMockGameState();
      const sceneElements = setupScene(state);
      const cameraState = setupCamera(state);
      
      const initialDistance = getCameraDistance(cameraState);
      const initialPosition = cameraState.camera.position.clone();
      
      setCameraDistance(cameraState, 150);
      
      expect(getCameraDistance(cameraState)).toBe(150);
      expect(getCameraDistance(cameraState)).not.toBe(initialDistance);
      
      // Position should have changed due to distance change (setCameraDistance calls updateCameraPosition)
      expect(cameraState.camera.position.equals(initialPosition)).toBe(false);
      
      // Skybox animation should work
      expect(() => updateSkyboxAnimation(sceneElements, 16)).not.toThrow();
    });

    it('should coordinate mesh factory and synchronizer', () => {
      const state = createMockGameState();
      const meshFactoryState = createMeshFactoryState();
      const shieldEffectState = createShieldEffectState();
      const syncState = createSynchronizerState();
      const groups = createSynchronizerGroups();
      
      // Create a ship
      const ship = {
        id: 1,
        pos: { x: 0, y: 0, z: 0 },
        vel: { x: 0, y: 0, z: 0 },
        orientation: { pitch: 0, yaw: 0, roll: 0 },
        targetId: null,
        team: 'red' as const,
        class: 'fighter' as const,
        health: 100,
        maxHealth: 100,
        armor: 2,
        shield: 50,
        maxShield: 50,
        shieldRegen: 5,
        speed: 140,
        turnRate: Math.PI,
        turrets: [{ id: 'fighter-cannon-0', cooldownLeft: 0 }],
        kills: 0,
        level: { level: 1, xp: 0, nextLevelXp: 50 }
      };
      
      // Test individual factory functions
      const shipMesh = meshFactory.createShipMesh(ship, state, groups.shipsGroup, syncState.shipMeshes);
      const bulletMesh = meshFactory.createBulletMesh({
        id: 1,
        ownerShipId: 1,
        ownerTeam: 'red',
        pos: { x: 10, y: 10, z: 10 },
        vel: { x: 100, y: 0, z: 0 },
        ttl: 3,
        damage: 6
      });
      const healthBar = meshFactory.createHealthBarMesh(ship, meshFactoryState);
      const shieldEffectMesh = shieldEffect.createShieldEffect(ship, shieldEffectState);
      
      expect(shipMesh).toBeInstanceOf(THREE.Object3D);
      expect(bulletMesh).toBeInstanceOf(THREE.Object3D);
      expect(healthBar).toBeInstanceOf(THREE.Object3D);
      expect(shieldEffectMesh).toBeInstanceOf(THREE.Object3D);
      
      // Test health bar updates
      expect(() => meshFactory.updateHealthBarMesh(ship, healthBar)).not.toThrow();
      
      // Test shield effect updates
      expect(() => shieldEffect.updateShieldEffect(ship, shieldEffectMesh, Date.now() / 1000, shieldEffectState)).not.toThrow();
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain updateBillboardBars function', () => {
      const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
      const bar1 = new THREE.Object3D();
      const bar2 = new THREE.Object3D();
      const bars = [bar1, bar2];
      
      expect(() => updateBillboardBars(bars, camera)).not.toThrow();
      
      // Both bars should have the same orientation (facing camera)
      expect(bar1.quaternion.equals(bar2.quaternion)).toBe(true);
    });
  });

  describe('Interface Validation', () => {
    it('should export the same interface as the original renderer', async () => {
      const module = await import('../../src/renderer/threeRenderer.js');
      
      expect(module.createThreeRenderer).toBeTypeOf('function');
      
      // Function signature should be compatible
      expect(module.createThreeRenderer.length).toBe(2); // state, canvas parameters
    });
  });

  describe('Resource Management', () => {
    it('should properly dispose all module resources', () => {
      const state = createMockGameState();
      
      const sceneElements = setupScene(state);
      const meshFactoryState = createMeshFactoryState();
      
      // Add some resources to the factory state
      const color = new THREE.Color(0xff0000);
      meshFactory.getPooledBillboardMaterial(color, 1.0, meshFactoryState);
      
      expect(meshFactoryState.billboardMaterialPool.size).toBeGreaterThan(0);
      
      // Dispose should clean up resources
      expect(() => disposeScene(sceneElements)).not.toThrow();
      expect(() => meshFactory.disposeMeshFactory(meshFactoryState)).not.toThrow();
      
      // Resources should be cleared
      expect(meshFactoryState.billboardMaterialPool.size).toBe(0);
      expect(meshFactoryState.billboardMaterials.size).toBe(0);
    });
  });
});