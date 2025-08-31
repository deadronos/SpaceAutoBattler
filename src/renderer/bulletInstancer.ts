import * as THREE from 'three';
import type { Bullet } from '../types/index.js';
import { RendererConfig } from '../config/rendererConfig.js';
import * as logger from '../utils/logger.js';

/**
 * BulletInstancer manages bullet rendering using THREE.InstancedMesh for improved performance
 * when there are many bullets. This replaces individual Mesh objects with a single instanced mesh.
 */
export class BulletInstancer {
  private instancedMesh: THREE.InstancedMesh;
  private capacity: number;
  private activeBullets = new Map<number, number>(); // bulletId -> instanceIndex
  private freeIndices: number[] = [];
  private usedCount = 0;
  private hasWarned = false;

  // Temporary objects for matrix calculations to avoid allocations
  private tempMatrix = new THREE.Matrix4();
  private tempPosition = new THREE.Vector3();
  private tempScale = new THREE.Vector3(1, 1, 1);
  private tempQuaternion = new THREE.Quaternion();

  constructor(scene: THREE.Scene, bulletsGroup: THREE.Group) {
    this.capacity = RendererConfig.instancing.bullets.initialCapacity;
    
    // Create shared geometry and material for all bullet instances
    const geometry = new THREE.SphereGeometry(2.2, 8, 8);
    const material = new THREE.MeshBasicMaterial({ color: 0xffdd88 });
    
    // Create the instanced mesh
    this.instancedMesh = new THREE.InstancedMesh(geometry, material, this.capacity);
    
    // Initialize free indices pool
    for (let i = 0; i < this.capacity; i++) {
      this.freeIndices.push(i);
    }
    
    // Hide unused instances by setting them to zero scale
    this.hideUnusedInstances();
    
    // Add to scene
    bulletsGroup.add(this.instancedMesh);
    
    logger.info(`BulletInstancer initialized with capacity ${this.capacity}`);
  }

  /**
   * Allocate an instance for a new bullet
   */
  allocateInstance(bulletId: number): boolean {
    // Check if bullet already has an instance
    if (this.activeBullets.has(bulletId)) {
      logger.warn(`Bullet ${bulletId} already has an allocated instance`);
      return true;
    }

    // Check if we need to grow capacity
    if (this.freeIndices.length === 0) {
      if (!this.growCapacity()) {
        return false;
      }
    }

    // Allocate from free indices
    const instanceIndex = this.freeIndices.pop()!;
    this.activeBullets.set(bulletId, instanceIndex);
    this.usedCount++;

    // Check if we should warn about capacity usage
    const usage = this.usedCount / this.capacity;
    if (!this.hasWarned && usage > RendererConfig.instancing.bullets.warnThreshold) {
      logger.warn(`Bullet instancer usage high: ${Math.round(usage * 100)}% (${this.usedCount}/${this.capacity})`);
      this.hasWarned = true;
    }

    return true;
  }

  /**
   * Free an instance for a removed bullet
   */
  freeInstance(bulletId: number): boolean {
    const instanceIndex = this.activeBullets.get(bulletId);
    if (instanceIndex === undefined) {
      return false;
    }

    // Hide the instance by setting scale to zero
    this.tempMatrix.makeScale(0, 0, 0);
    this.instancedMesh.setMatrixAt(instanceIndex, this.tempMatrix);

    // Return to free pool
    this.freeIndices.push(instanceIndex);
    this.activeBullets.delete(bulletId);
    this.usedCount--;

    // Reset warning flag if usage is low again
    if (this.hasWarned && this.usedCount / this.capacity < RendererConfig.instancing.bullets.warnThreshold * 0.8) {
      this.hasWarned = false;
    }

    return true;
  }

  /**
   * Update bullet transform
   */
  updateBulletTransform(bullet: Bullet): boolean {
    const instanceIndex = this.activeBullets.get(bullet.id);
    if (instanceIndex === undefined) {
      return false;
    }

    // Set position and identity rotation/scale
    this.tempPosition.set(bullet.pos.x, bullet.pos.y, bullet.pos.z);
    this.tempMatrix.compose(this.tempPosition, this.tempQuaternion, this.tempScale);
    this.instancedMesh.setMatrixAt(instanceIndex, this.tempMatrix);

    return true;
  }

  /**
   * Call this once per frame after all updates
   */
  markMatrixNeedsUpdate(): void {
    this.instancedMesh.instanceMatrix.needsUpdate = true;
  }

  /**
   * Check if a bullet has an allocated instance
   */
  hasBullet(bulletId: number): boolean {
    return this.activeBullets.has(bulletId);
  }

  /**
   * Get all active bullet IDs
   */
  getActiveBulletIds(): number[] {
    return Array.from(this.activeBullets.keys());
  }

  /**
   * Get current usage statistics
   */
  getStats() {
    return {
      capacity: this.capacity,
      used: this.usedCount,
      free: this.freeIndices.length,
      usagePercent: Math.round((this.usedCount / this.capacity) * 100),
    };
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.instancedMesh.geometry.dispose();
    if (Array.isArray(this.instancedMesh.material)) {
      this.instancedMesh.material.forEach(mat => mat.dispose());
    } else {
      this.instancedMesh.material.dispose();
    }
    this.activeBullets.clear();
    this.freeIndices.length = 0;
    logger.info('BulletInstancer disposed');
  }

  /**
   * Grow the capacity of the instanced mesh
   */
  private growCapacity(): boolean {
    const newCapacity = Math.min(
      Math.ceil(this.capacity * RendererConfig.instancing.bullets.growthFactor),
      RendererConfig.instancing.bullets.maxCapacity
    );

    if (newCapacity <= this.capacity) {
      logger.error(`Cannot grow bullet instancer capacity beyond ${this.capacity} (max: ${RendererConfig.instancing.bullets.maxCapacity})`);
      return false;
    }

    logger.info(`Growing bullet instancer capacity from ${this.capacity} to ${newCapacity}`);

    // Create new instanced mesh with larger capacity
    const oldInstancedMesh = this.instancedMesh;
    const geometry = oldInstancedMesh.geometry;
    const material = oldInstancedMesh.material;
    
    this.instancedMesh = new THREE.InstancedMesh(geometry, material, newCapacity);
    
    // Copy existing matrices
    for (let i = 0; i < this.capacity; i++) {
      oldInstancedMesh.getMatrixAt(i, this.tempMatrix);
      this.instancedMesh.setMatrixAt(i, this.tempMatrix);
    }

    // Add new free indices
    for (let i = this.capacity; i < newCapacity; i++) {
      this.freeIndices.push(i);
    }

    // Hide new unused instances
    this.hideUnusedInstances(this.capacity);

    // Replace in scene
    const parent = oldInstancedMesh.parent;
    if (parent) {
      parent.remove(oldInstancedMesh);
      parent.add(this.instancedMesh);
    }

    this.capacity = newCapacity;
    this.instancedMesh.instanceMatrix.needsUpdate = true;

    return true;
  }

  /**
   * Hide unused instances by setting them to zero scale
   */
  private hideUnusedInstances(startIndex = 0): void {
    this.tempMatrix.makeScale(0, 0, 0);
    for (let i = startIndex; i < this.capacity; i++) {
      this.instancedMesh.setMatrixAt(i, this.tempMatrix);
    }
  }
}