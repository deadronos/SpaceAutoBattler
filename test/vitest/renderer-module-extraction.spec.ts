import { describe, it, expect } from 'vitest';
import { setupScene, updateSkyboxAnimation, disposeScene } from '../../src/renderer/sceneSetup.js';
import { setupCamera, updateCameraPosition, setCameraDistance, getCameraDistance } from '../../src/renderer/cameraManager.js';
import { createMeshFactoryState, createShipMesh, createBulletMesh, createHealthBarMesh, getPooledBillboardMaterial } from '../../src/renderer/meshFactory.js';
import { createMockGameState, createMockShip, TEST_DEFAULTS } from './setupTests.js';
import { getShipClassConfig, TURRET_CONFIGS } from '../../src/config/entitiesConfig.js';
import * as THREE from 'three';

// Tests for the newly extracted renderer modules
describe('Extracted Renderer Modules', () => {

  describe('Scene Setup Module', () => {
    it('should create scene elements properly', () => {
      const state = createMockGameState();
      const elements = setupScene(state);
      
      expect(elements.scene).toBeInstanceOf(THREE.Scene);
      expect(elements.ambientLight).toBeInstanceOf(THREE.AmbientLight);
      expect(elements.directionalLight).toBeInstanceOf(THREE.DirectionalLight);
      expect(elements.boundaryWireframe).toBeInstanceOf(THREE.LineSegments);
      expect(elements.skybox).toBeInstanceOf(THREE.Mesh);
      expect(elements.animatedSkyboxTexture).toBeInstanceOf(THREE.CubeTexture);
      expect(elements.skyboxCanvases).toBeInstanceOf(Array);
      expect(elements.skyboxTextures).toBeInstanceOf(Array);
    });

    it('should handle skybox animation updates', () => {
      const state = createMockGameState();
      const elements = setupScene(state);
      
      expect(() => updateSkyboxAnimation(elements, 16)).not.toThrow();
    });

    it('should dispose scene resources properly', () => {
      const state = createMockGameState();
      const elements = setupScene(state);
      
      expect(() => disposeScene(elements)).not.toThrow();
    });
  });

  describe('Camera Manager Module', () => {
    it('should create camera state properly', () => {
      const state = createMockGameState();
      const cameraState = setupCamera(state);
      
      expect(cameraState.camera).toBeInstanceOf(THREE.PerspectiveCamera);
      expect(cameraState.rotation).toHaveProperty('x');
      expect(cameraState.rotation).toHaveProperty('y');
      expect(cameraState.rotation).toHaveProperty('z');
      expect(cameraState.target).toHaveProperty('x');
      expect(cameraState.target).toHaveProperty('y');
      expect(cameraState.target).toHaveProperty('z');
      expect(cameraState.distance).toBeTypeOf('number');
    });

    it('should update camera position correctly', () => {
      const state = createMockGameState();
      const cameraState = setupCamera(state);
      
      const initialPosition = cameraState.camera.position.clone();
      cameraState.rotation.x = Math.PI / 4;
      updateCameraPosition(cameraState);
      
      // Position should have changed after rotation update
      expect(cameraState.camera.position.equals(initialPosition)).toBe(false);
    });

    it('should handle camera distance changes', () => {
      const state = createMockGameState();
      const cameraState = setupCamera(state);
      
      const initialDistance = getCameraDistance(cameraState);
      setCameraDistance(cameraState, 200);
      
      expect(getCameraDistance(cameraState)).toBe(200);
      expect(getCameraDistance(cameraState)).not.toBe(initialDistance);
    });
  });

  describe('Mesh Factory Module', () => {
    it('should create factory state properly', () => {
      const factoryState = createMeshFactoryState();
      
      expect(factoryState.billboardMaterials).toBeInstanceOf(Set);
      expect(factoryState.billboardMaterialPool).toBeInstanceOf(Map);
      expect(factoryState.GPU_BILLBOARD).toBe(true);
    });

    it('should create bullet meshes correctly', () => {
      const defaultDamage = (TURRET_CONFIGS['fighter-cannon'] && TURRET_CONFIGS['fighter-cannon'].damage) || 1;
      const bullet = {
        id: 1,
        ownerShipId: 1,
        ownerTeam: 'red' as const,
        pos: { x: TEST_DEFAULTS.simBounds.width * 0.02, y: TEST_DEFAULTS.simBounds.height * 0.02, z: TEST_DEFAULTS.simBounds.depth * 0.02 },
        vel: { x: 100, y: 0, z: 0 },
        ttl: 3,
        damage: defaultDamage
      };
      
      const mesh = createBulletMesh(bullet);
      
  expect(mesh).toBeInstanceOf(THREE.Object3D);
  expect(mesh.position.x).toBeCloseTo(TEST_DEFAULTS.simBounds.width * 0.02, 6);
  expect(mesh.position.y).toBeCloseTo(TEST_DEFAULTS.simBounds.height * 0.02, 6);
  expect(mesh.position.z).toBeCloseTo(TEST_DEFAULTS.simBounds.depth * 0.02, 6);
    });

    it('should create ship meshes with placeholders', () => {
      const fighterCfg = getShipClassConfig('fighter');
      const ship = createMockShip({
  id: 1,
  pos: { x: TEST_DEFAULTS.simBounds.width * 0.1, y: TEST_DEFAULTS.simBounds.height * 0.1, z: TEST_DEFAULTS.simBounds.depth * 0.1 },
        team: 'blue',
        class: 'fighter',
        health: fighterCfg.baseHealth,
        maxHealth: fighterCfg.baseHealth,
        armor: fighterCfg.armor ?? 0,
        shield: fighterCfg.shield ?? 0,
        maxShield: fighterCfg.shield ?? 0,
        shieldRegen: fighterCfg.shieldRegen ?? 0,
        speed: fighterCfg.speed,
        turnRate: fighterCfg.turnRate,
  turrets: (fighterCfg.turrets || []).map((t: { id?: string }, idx: number) => ({ id: `${t.id ?? 'turret'}-${idx}`, cooldownLeft: 0 })),
      });
      
      const state = createMockGameState();
      const shipsGroup = new THREE.Group();
      const shipMeshes = new Map<number, THREE.Object3D>();
      
      const mesh = createShipMesh(ship, state, shipsGroup, shipMeshes);
      
  expect(mesh).toBeInstanceOf(THREE.Object3D);
  expect(mesh.position.x).toBeCloseTo(TEST_DEFAULTS.simBounds.width * 0.1, 6);
  expect(mesh.position.y).toBeCloseTo(TEST_DEFAULTS.simBounds.height * 0.1, 6);
  expect(mesh.position.z).toBeCloseTo(TEST_DEFAULTS.simBounds.depth * 0.1, 6);
    });

    it('should create health bar meshes', () => {
      const ship = createMockShip({ id: 1, pos: { x: 0, y: 0, z: 0 }, team: 'red' });
      
      const factoryState = createMeshFactoryState();
      const healthBar = createHealthBarMesh(ship, factoryState);
      
      expect(healthBar).toBeInstanceOf(THREE.Object3D);
      expect(healthBar.children.length).toBeGreaterThan(0);
      
  // Should have stored mesh references
  const hb = healthBar as unknown as { healthMesh?: unknown; shieldMesh?: unknown; bgMesh?: unknown };
  expect(hb.healthMesh).toBeDefined();
  expect(hb.shieldMesh).toBeDefined(); // Ship has shield
  expect(hb.bgMesh).toBeDefined();
    });

    it('should pool billboard materials correctly', () => {
      const factoryState = createMeshFactoryState();
      const color1 = new THREE.Color(0xff0000);
      const color2 = new THREE.Color(0xff0000);
      const color3 = new THREE.Color(0x00ff00);
      
      const mat1 = getPooledBillboardMaterial(color1, 1.0, factoryState);
      const mat2 = getPooledBillboardMaterial(color2, 1.0, factoryState); // Same color/alpha
      const mat3 = getPooledBillboardMaterial(color3, 1.0, factoryState); // Different color
      
      // Same color/alpha should return the same material instance
      expect(mat1).toBe(mat2);
      
      // Different color should return different material
      expect(mat1).not.toBe(mat3);
      
      // Should be tracked in the sets
      expect(factoryState.billboardMaterials.has(mat1)).toBe(true);
      expect(factoryState.billboardMaterials.has(mat3)).toBe(true);
      expect(factoryState.billboardMaterialPool.size).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Module Integration', () => {
    it('should work together without conflicts', () => {
      const state = createMockGameState();
      
      // Setup scene
      const sceneElements = setupScene(state);
      
      // Setup camera
      const cameraState = setupCamera(state);
      
      // Create mesh factory
      const factoryState = createMeshFactoryState();
      
      // All should be independent and not interfere
      expect(sceneElements.scene).toBeInstanceOf(THREE.Scene);
      expect(cameraState.camera).toBeInstanceOf(THREE.PerspectiveCamera);
      expect(factoryState.billboardMaterials).toBeInstanceOf(Set);
      
      // Cleanup should work without errors
      expect(() => disposeScene(sceneElements)).not.toThrow();
    });
  });
});