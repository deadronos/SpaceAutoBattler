import { describe, it, expect } from 'vitest';
import { createShieldEffect, updateShieldEffect, createShieldEffectState } from '../../src/renderer/effects/shieldEffect.js';
import { shieldVertexShader, createShieldFragmentShader } from '../../src/renderer/effects/shieldShaders.js';
import { createSynchronizerState, createSynchronizerGroups, syncEntities, updateTransforms } from '../../src/renderer/synchronizer.js';
import { createOverlayState, updateBillboardOverlays } from '../../src/renderer/overlay.js';
import { setupCamera } from '../../src/renderer/cameraManager.js';
import { createMeshFactoryState } from '../../src/renderer/meshFactory.js';
import { createMockGameState, createMockShip } from './setupTests.js';
import { getShipClassConfig } from '../../src/config/entitiesConfig.js';
import * as THREE from 'three';

// Tests for the effects, synchronizer, and overlay modules
describe('Additional Renderer Modules', () => {

  describe('Shield Effect Module', () => {
    it('should create shield effect state', () => {
      const state = createShieldEffectState();
      
      expect(state.recentShieldHits).toBeInstanceOf(Map);
      expect(state.recentShieldHits.size).toBe(0);
    });

    it('should create shield effects for ships', () => {
      // Use createMockShip to derive consistent defaults from config
      const ship = createMockShip({ id: 1, pos: { x: 0, y: 0, z: 0 }, team: 'red' });
      
      const state = createShieldEffectState();
      const shieldGroup = createShieldEffect(ship, state);
      
      expect(shieldGroup).toBeInstanceOf(THREE.Object3D);
      expect(shieldGroup.children.length).toBeGreaterThan(0);
  expect((shieldGroup as unknown as { shieldMesh?: THREE.Mesh }).shieldMesh).toBeDefined();
    });

    it('should update shield effects without errors', () => {
      const frigateCfg = getShipClassConfig('frigate');
      const ship = createMockShip({
        id: 1,
        pos: { x: 10, y: 10, z: 10 },
        team: 'blue',
        class: 'frigate',
        health: frigateCfg.baseHealth,
        maxHealth: frigateCfg.baseHealth,
        shield: frigateCfg.shield ?? 0,
        maxShield: frigateCfg.shield ?? 0,
        shieldRegen: frigateCfg.shieldRegen ?? 0,
        turnRate: frigateCfg.turnRate,
        turrets: (frigateCfg.turrets || []).map((t: any, idx: number) => ({ id: `${t.id}-${idx}`, cooldownLeft: 0 })),
        lastShieldHitTime: Date.now() / 1000,
        lastShieldHitStrength: 25,
        lastShieldHitDir: { x: 1, y: 0, z: 0 }
      });
      
      const state = createShieldEffectState();
      const shieldGroup = createShieldEffect(ship, state);
      const currentTime = Date.now() / 1000;
      
      expect(() => updateShieldEffect(ship, shieldGroup, currentTime, state)).not.toThrow();
      
      // Position should be updated
      expect(shieldGroup.position.x).toBe(10);
      expect(shieldGroup.position.y).toBe(10);
      expect(shieldGroup.position.z).toBe(10);
    });

    it('should have valid shader source code', () => {
      expect(shieldVertexShader).toContain('varying vec3 vNormal');
      expect(shieldVertexShader).toContain('gl_Position');
      
      const fragmentShader = createShieldFragmentShader(4);
      expect(fragmentShader).toContain('uniform vec3 uColor');
      expect(fragmentShader).toContain('gl_FragColor');
      expect(fragmentShader).toContain('for (int i = 0; i < 4; i++)');
    });
  });

  describe('Synchronizer Module', () => {
    it('should create synchronizer state and groups', () => {
      const syncState = createSynchronizerState();
      const groups = createSynchronizerGroups();
      
      expect(syncState.shipMeshes).toBeInstanceOf(Map);
      expect(syncState.bulletMeshes).toBeInstanceOf(Map);
      expect(syncState.healthBarMeshes).toBeInstanceOf(Map);
      expect(syncState.shieldEffectMeshes).toBeInstanceOf(Map);
      
      expect(groups.shipsGroup).toBeInstanceOf(THREE.Group);
      expect(groups.bulletsGroup).toBeInstanceOf(THREE.Group);
      expect(groups.healthBarsGroup).toBeInstanceOf(THREE.Group);
      expect(groups.shieldEffectsGroup).toBeInstanceOf(THREE.Group);
    });

    it('should sync entities with mocked factories', () => {
      const state = createMockGameState();
      state.ships.push(createMockShip({ id: 1, pos: { x: 0, y: 0, z: 0 }, team: 'red' }));
      
      const syncState = createSynchronizerState();
      const groups = createSynchronizerGroups();
      const meshFactoryState = createMeshFactoryState();
      const shieldEffectState = createShieldEffectState();
      
      // Mock factories
      const mockMeshFactory = ({
        createShipMesh: () => new THREE.Object3D(),
        createHealthBarMesh: () => new THREE.Object3D(),
        updateHealthBarMesh: () => {}
      } as unknown) as import('../../src/renderer/meshFactory.js').MeshFactory;
      const mockShieldEffect = {
        createShieldEffect: () => new THREE.Object3D(),
        updateShieldEffect: () => {},
        disposeShieldEffect: () => {}
      };
      
      expect(() => syncEntities(
        state, 
        syncState, 
        groups, 
        mockMeshFactory, 
        mockShieldEffect, 
        meshFactoryState, 
        shieldEffectState
      )).not.toThrow();
      
      // Should have created ship mesh
      expect(syncState.shipMeshes.size).toBe(1);
      expect(groups.shipsGroup.children.length).toBe(1);
    });

    it('should update transforms with mocked factories', () => {
      const state = createMockGameState();
      const corvetteCfg = getShipClassConfig('corvette');
      state.ships.push(createMockShip({
        id: 1,
        pos: { x: 5, y: 5, z: 5 },
        vel: { x: 10, y: 0, z: 0 },
        orientation: { pitch: 0.1, yaw: 0.2, roll: 0.3 },
        team: 'blue',
        class: 'corvette',
        health: corvetteCfg.baseHealth,
        maxHealth: corvetteCfg.baseHealth,
        armor: corvetteCfg.armor ?? 0,
        shield: corvetteCfg.shield ?? 0,
        maxShield: corvetteCfg.shield ?? 0,
        shieldRegen: corvetteCfg.shieldRegen ?? 0,
        speed: corvetteCfg.speed,
        turnRate: corvetteCfg.turnRate,
        turrets: (corvetteCfg.turrets || []).map((t: any, idx: number) => ({ id: `${t.id}-${idx}`, cooldownLeft: 0 })),
      }));
      
      const syncState = createSynchronizerState();
      const mesh = new THREE.Object3D();
      syncState.shipMeshes.set(1, mesh);
      const shieldEffectState = createShieldEffectState();
      
      type ShipType = import('../../src/types/index.js').Ship;
      type BulletType = import('../../src/types/index.js').Bullet;
      type MeshFactoryType = import('../../src/renderer/meshFactory.js').MeshFactory;
      type ShieldEffectType = import('../../src/renderer/synchronizer.js').ShieldEffect;

      const mockMeshFactory = ({
        createShipMesh: (_ship: ShipType) => new THREE.Object3D(),
        createBulletMesh: (_b: BulletType) => new THREE.Object3D(),
        createHealthBarMesh: (_s: ShipType) => new THREE.Object3D(),
        updateHealthBarMesh: () => {}
      } as unknown) as MeshFactoryType;
      const mockShieldEffect = ({
        createShieldEffect: (_ship: ShipType, _state: import('../../src/renderer/effects/shieldEffect.js').ShieldEffectState) => new THREE.Object3D(),
        updateShieldEffect: () => {},
        disposeShieldEffect: (_s: THREE.Object3D) => {}
      } as unknown) as ShieldEffectType;
      
      expect(() => updateTransforms(
        state, 
        syncState, 
        mockMeshFactory, 
        mockShieldEffect, 
        shieldEffectState
      )).not.toThrow();
      
      // Position should be updated
      expect(mesh.position.x).toBe(5);
      expect(mesh.position.y).toBe(5);
      expect(mesh.position.z).toBe(5);
    });
  });

  describe('Overlay Module', () => {
    it('should create overlay state', () => {
      const state = createOverlayState();
      
      expect(state.GPU_BILLBOARD).toBe(true);
    });

    it('should update billboard overlays', () => {
      const gameState = createMockGameState();
      const cameraState = setupCamera(gameState);
      const factoryState = createMeshFactoryState();
      const overlayState = createOverlayState();
      const healthBarMeshes = new Map<number, THREE.Object3D>();
      
      // Add some test health bars
      healthBarMeshes.set(1, new THREE.Object3D());
      healthBarMeshes.set(2, new THREE.Object3D());
      
      expect(() => updateBillboardOverlays(
        healthBarMeshes,
        cameraState,
        factoryState,
        overlayState
      )).not.toThrow();
    });
  });

  describe('Module Integration', () => {
    it('should work together as a complete system', () => {
      const gameState = createMockGameState();
      
      // Create all module states
      const cameraState = setupCamera(gameState);
      const meshFactoryState = createMeshFactoryState();
      const shieldEffectState = createShieldEffectState();
      const syncState = createSynchronizerState();
      const groups = createSynchronizerGroups();
      const overlayState = createOverlayState();
      
      // All modules should initialize without errors
      expect(cameraState.camera).toBeInstanceOf(THREE.PerspectiveCamera);
      expect(meshFactoryState.billboardMaterials).toBeInstanceOf(Set);
      expect(shieldEffectState.recentShieldHits).toBeInstanceOf(Map);
      expect(syncState.shipMeshes).toBeInstanceOf(Map);
      expect(groups.shipsGroup).toBeInstanceOf(THREE.Group);
      expect(overlayState.GPU_BILLBOARD).toBe(true);
    });
  });
});