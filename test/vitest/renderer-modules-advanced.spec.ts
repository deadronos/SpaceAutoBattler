import { describe, it, expect } from 'vitest';
import { createShieldEffect, updateShieldEffect, createShieldEffectState } from '../../src/renderer/effects/shieldEffect.js';
import { shieldVertexShader, createShieldFragmentShader } from '../../src/renderer/effects/shieldShaders.js';
import { createSynchronizerState, createSynchronizerGroups, syncEntities, updateTransforms } from '../../src/renderer/synchronizer.js';
import { createOverlayState, updateBillboardOverlays } from '../../src/renderer/overlay.js';
import { setupCamera } from '../../src/renderer/cameraManager.js';
import { createMeshFactoryState } from '../../src/renderer/meshFactory.js';
import { createMockGameState } from './setupTests.js';
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
      
      const state = createShieldEffectState();
      const shieldGroup = createShieldEffect(ship, state);
      
      expect(shieldGroup).toBeInstanceOf(THREE.Object3D);
      expect(shieldGroup.children.length).toBeGreaterThan(0);
      expect((shieldGroup as any).shieldMesh).toBeDefined();
    });

    it('should update shield effects without errors', () => {
      const ship = {
        id: 1,
        pos: { x: 10, y: 10, z: 10 },
        vel: { x: 0, y: 0, z: 0 },
        orientation: { pitch: 0, yaw: 0, roll: 0 },
        targetId: null,
        team: 'blue' as const,
        class: 'frigate' as const,
        health: 100,
        maxHealth: 100,
        armor: 2,
        shield: 80,
        maxShield: 100,
        shieldRegen: 5,
        speed: 120,
        turnRate: Math.PI * 0.8,
        turrets: [{ id: 'frigate-cannon-0', cooldownLeft: 0 }],
        kills: 0,
        level: { level: 1, xp: 0, nextLevelXp: 50 },
        lastShieldHitTime: Date.now() / 1000,
        lastShieldHitStrength: 25,
        lastShieldHitDir: { x: 1, y: 0, z: 0 }
      };
      
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
      state.ships.push({
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
      });
      
      const syncState = createSynchronizerState();
      const groups = createSynchronizerGroups();
      const meshFactoryState = createMeshFactoryState();
      const shieldEffectState = createShieldEffectState();
      
      // Mock factories
      const mockMeshFactory = {
        createShipMesh: () => new THREE.Object3D(),
        createHealthBarMesh: () => new THREE.Object3D(),
        updateHealthBarMesh: () => {}
      };
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
      state.ships.push({
        id: 1,
        pos: { x: 5, y: 5, z: 5 },
        vel: { x: 10, y: 0, z: 0 },
        orientation: { pitch: 0.1, yaw: 0.2, roll: 0.3 },
        targetId: null,
        team: 'blue' as const,
        class: 'corvette' as const,
        health: 80,
        maxHealth: 100,
        armor: 3,
        shield: 40,
        maxShield: 60,
        shieldRegen: 6,
        speed: 160,
        turnRate: Math.PI * 1.2,
        turrets: [{ id: 'corvette-cannon-0', cooldownLeft: 0 }],
        kills: 0,
        level: { level: 1, xp: 0, nextLevelXp: 50 }
      });
      
      const syncState = createSynchronizerState();
      const mesh = new THREE.Object3D();
      syncState.shipMeshes.set(1, mesh);
      const shieldEffectState = createShieldEffectState();
      
      const mockMeshFactory = {
        updateHealthBarMesh: () => {}
      };
      const mockShieldEffect = {
        updateShieldEffect: () => {}
      };
      
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