import * as THREE from 'three';
import type { GameState, Ship, Bullet } from '../types/index.js';
import { RendererConfig } from '../config/rendererConfig.js';
import { ShipVisualConfig } from '../config/shipVisualConfig.js';
import type { MeshFactoryState } from './meshFactory.js';
import type { ShieldEffectState } from './effects/shieldEffect.js';
import type { HealthBarInstancer } from './healthBarInstancer.js';

/**
 * Entity synchronizer - maps GameState to Three.js scene objects
 * Extracted from threeRenderer.ts for SRP compliance
 */

export interface SynchronizerState {
  shipMeshes: Map<number, THREE.Object3D>;
  bulletMeshes: Map<number, THREE.Object3D>;
  healthBarMeshes: Map<number, THREE.Object3D>;
  shieldEffectMeshes: Map<number, THREE.Object3D>;
}

export interface SynchronizerGroups {
  shipsGroup: THREE.Group;
  bulletsGroup: THREE.Group;
  healthBarsGroup: THREE.Group;
  shieldEffectsGroup: THREE.Group;
}

export interface Synchronizer {
  createSynchronizerState(): SynchronizerState;
  createSynchronizerGroups(): SynchronizerGroups;
  syncEntities(
    state: GameState, 
    syncState: SynchronizerState, 
    groups: SynchronizerGroups,
    meshFactory: MeshFactory,
    shieldEffect: ShieldEffect,
    meshFactoryState: MeshFactoryState,
    shieldEffectState: ShieldEffectState,
    camera?: THREE.Camera,
    healthBarInstancer?: HealthBarInstancer
  ): void;
  updateTransforms(
    state: GameState, 
    syncState: SynchronizerState,
    meshFactory: MeshFactory,
    shieldEffect: ShieldEffect,
    shieldEffectState: ShieldEffectState,
    camera?: THREE.Camera,
    healthBarInstancer?: HealthBarInstancer
  ): void;
  disposeSynchronizer(syncState: SynchronizerState): void;
}

// Minimal typed interfaces for mesh factory and shield effect to avoid explicit any usage
export interface MeshFactory {
  createShipMesh(ship: Ship, state: GameState, parent: THREE.Group, map: Map<number, THREE.Object3D>): THREE.Object3D;
  createBulletMesh(b: Bullet): THREE.Object3D;
  createHealthBarMesh(s: Ship, factoryState: MeshFactoryState): THREE.Object3D;
  updateHealthBarMesh(s: Ship, bar: THREE.Object3D): void;
  getPooledBillboardMaterial?: (color: THREE.Color, alpha: number, factoryState: MeshFactoryState) => THREE.ShaderMaterial;
  disposeMeshFactory?: (factoryState: MeshFactoryState) => void;
}

export interface ShieldEffect {
  createShieldEffect(ship: Ship, state: ShieldEffectState): THREE.Object3D;
  updateShieldEffect(ship: Ship, shield: THREE.Object3D, currentTime: number, state: ShieldEffectState): void;
  disposeShieldEffect(shield: THREE.Object3D): void;
}

/**
 * Creates the synchronizer state
 */
export function createSynchronizerState(): SynchronizerState {
  return {
    shipMeshes: new Map<number, THREE.Object3D>(),
    bulletMeshes: new Map<number, THREE.Object3D>(),
    healthBarMeshes: new Map<number, THREE.Object3D>(),
    shieldEffectMeshes: new Map<number, THREE.Object3D>()
  };
}

/**
 * Creates the Three.js groups for organizing entities
 */
export function createSynchronizerGroups(): SynchronizerGroups {
  return {
    shipsGroup: new THREE.Group(),
    bulletsGroup: new THREE.Group(),
    healthBarsGroup: new THREE.Group(),
    shieldEffectsGroup: new THREE.Group()
  };
}

/**
 * Synchronizes entities between GameState and Three.js scene
 */
export function syncEntities(
  state: GameState, 
  syncState: SynchronizerState, 
  groups: SynchronizerGroups,
  meshFactory: MeshFactory,
  shieldEffect: ShieldEffect,
  meshFactoryState: MeshFactoryState,
  shieldEffectState: ShieldEffectState,
  camera?: THREE.Camera,
  healthBarInstancer?: HealthBarInstancer
): void {
  const useHealthBarInstancing = RendererConfig.instancing.enableBars && healthBarInstancer;

  // Update camera uniforms for health bar instancer if enabled
  if (useHealthBarInstancing && camera) {
    healthBarInstancer!.updateCameraUniforms(camera);
  }

  // Ships
  for (const s of state.ships) {
    if (!syncState.shipMeshes.has(s.id)) {
      const m = meshFactory.createShipMesh(s, state, groups.shipsGroup, syncState.shipMeshes);
      syncState.shipMeshes.set(s.id, m); 
      groups.shipsGroup.add(m);
    }
    
    // Health bars
    if (RendererConfig.visual.enableHealthBars) {
      if (useHealthBarInstancing) {
        // Use health bar instancer
        if (!healthBarInstancer!.hasShip(s.id)) {
          healthBarInstancer!.allocateInstance(s.id);
        }
      } else {
        // Use traditional mesh factory approach
        if (!syncState.healthBarMeshes.has(s.id)) {
          const bar = meshFactory.createHealthBarMesh(s, meshFactoryState);
          syncState.healthBarMeshes.set(s.id, bar); 
          groups.healthBarsGroup.add(bar);
        }
      }
    }
    
    // Shield effects
    if (RendererConfig.visual.enableShieldEffects && s.maxShield > 0 && !syncState.shieldEffectMeshes.has(s.id)) {
      const shield = shieldEffect.createShieldEffect(s, shieldEffectState);
      syncState.shieldEffectMeshes.set(s.id, shield); 
      groups.shieldEffectsGroup.add(shield);
    }
  }

  // Remove ships that no longer exist
  for (const [id, m] of syncState.shipMeshes) {
    if (!state.ships.find(s => s.id === id)) {
      groups.shipsGroup.remove(m); 
      syncState.shipMeshes.delete(id);
      
      // Also remove health bar
      if (useHealthBarInstancing) {
        healthBarInstancer!.freeInstance(id);
      } else {
        const bar = syncState.healthBarMeshes.get(id);
        if (bar) { 
          groups.healthBarsGroup.remove(bar); 
          syncState.healthBarMeshes.delete(id); 
        }
      }
      
      // Also remove shield effect
      const shield = syncState.shieldEffectMeshes.get(id);
      if (shield) { 
        shieldEffect.disposeShieldEffect(shield);
        groups.shieldEffectsGroup.remove(shield); 
        syncState.shieldEffectMeshes.delete(id); 
      }
    }
  }

  // Remove health bars for ships that no longer exist (non-instanced only)
  if (!useHealthBarInstancing) {
    for (const [id, bar] of syncState.healthBarMeshes) {
      if (!state.ships.find(s => s.id === id)) {
        groups.healthBarsGroup.remove(bar); 
        syncState.healthBarMeshes.delete(id);
      }
    }
  }

  // Remove shield effects for ships that no longer exist or have no shield
  for (const [id, shield] of syncState.shieldEffectMeshes) {
    const ship = state.ships.find(s => s.id === id);
    if (!ship || ship.maxShield <= 0) {
      shieldEffect.disposeShieldEffect(shield);
      groups.shieldEffectsGroup.remove(shield); 
      syncState.shieldEffectMeshes.delete(id);
    }
  }

  // Bullets
  for (const b of state.bullets) {
    if (!syncState.bulletMeshes.has(b.id)) {
      const m = meshFactory.createBulletMesh(b);
      syncState.bulletMeshes.set(b.id, m); 
      groups.bulletsGroup.add(m);
    }
  }

  // Remove bullets that no longer exist
  for (const [id, m] of syncState.bulletMeshes) {
    if (!state.bullets.find(b => b.id === id)) { 
      groups.bulletsGroup.remove(m); 
      syncState.bulletMeshes.delete(id); 
    }
  }

  // Mark instancer matrices as needing update
  if (useHealthBarInstancing) {
    healthBarInstancer!.markMatricesNeedUpdate();
  }
}

/**
 * Updates transform properties of all entities
 */
export function updateTransforms(
  state: GameState, 
  syncState: SynchronizerState,
  meshFactory: MeshFactory,
  shieldEffect: ShieldEffect,
  shieldEffectState: ShieldEffectState,
  camera?: THREE.Camera,
  healthBarInstancer?: HealthBarInstancer
): void {
  // Use the simulation/game time so visuals driven from game state (e.g. lastShieldHitTime)
  // use the same timebase as the renderer uniforms. This prevents mismatches where
  // effects that rely on timestamps (hit times) would appear permanent or vanish.
  const currentTime = state.time; // seconds
  const useHealthBarInstancing = RendererConfig.instancing.enableBars && healthBarInstancer;
  
  // Update ships
  for (const s of state.ships) {
    const m = syncState.shipMeshes.get(s.id);
    if (!m) continue;
    
    m.position.set(s.pos.x, s.pos.y, s.pos.z);
    
    // Set 3D rotation using ship's orientation
    // Ships are modeled pointing along +X axis, so we need to adjust
    // Order: first yaw (Y-axis), then pitch (X-axis), then roll (Z-axis)
    m.rotation.set(s.orientation.pitch, s.orientation.yaw - Math.PI/2, s.orientation.roll);
    
    const scale = ShipVisualConfig.ships[s.class]?.scale ?? RendererConfig.defaultScale;
    m.scale.setScalar(scale);

    // Update health bar
    if (RendererConfig.visual.enableHealthBars) {
      if (useHealthBarInstancing) {
        // Update through health bar instancer
        healthBarInstancer!.updateHealthBar(s);
      } else {
        // Update through traditional mesh factory
        const bar = syncState.healthBarMeshes.get(s.id);
        if (bar) {
          meshFactory.updateHealthBarMesh(s, bar);
        }
      }
    }

    // Update shield effect
    if (RendererConfig.visual.enableShieldEffects && s.maxShield > 0) {
      const shield = syncState.shieldEffectMeshes.get(s.id);
      if (shield) {
        shieldEffect.updateShieldEffect(s, shield, currentTime, shieldEffectState);
      }
    }
  }

  // Update bullets
  for (const b of state.bullets) {
    const m = syncState.bulletMeshes.get(b.id);
    if (!m) continue;
    m.position.set(b.pos.x, b.pos.y, b.pos.z);
  }

  // Update health bar positions to follow ships (non-instanced only)
  if (!useHealthBarInstancing) {
    for (const s of state.ships) {
      const bar = syncState.healthBarMeshes.get(s.id);
      if (bar) {
        bar.position.set(
          s.pos.x + RendererConfig.healthBars.position.offsetX,
          s.pos.y + RendererConfig.healthBars.position.offsetY,
          s.pos.z + ShipVisualConfig.healthBar.offset.z // Above the ship
        );
      }
    }
  }

  // Mark instancer matrices as needing update
  if (useHealthBarInstancing) {
    healthBarInstancer!.markMatricesNeedUpdate();
  }
}

/**
 * Disposes synchronizer resources
 */
export function disposeSynchronizer(syncState: SynchronizerState): void {
  syncState.shipMeshes.clear();
  syncState.bulletMeshes.clear();
  syncState.healthBarMeshes.clear();
  syncState.shieldEffectMeshes.clear();
}

/**
 * Default synchronizer implementation
 */
export const synchronizer: Synchronizer = {
  createSynchronizerState,
  createSynchronizerGroups,
  syncEntities,
  updateTransforms,
  disposeSynchronizer
};