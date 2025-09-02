import * as THREE from 'three';
import type { Ship } from '../types/index.js';
import { RendererConfig } from '../config/rendererConfig.js';
import * as logger from '../utils/logger.js';

/**
 * Health bar layer types for separate InstancedMesh objects
 */
export type HealthBarLayer = 'background' | 'health' | 'shield' | 'border';

/**
 * HealthBarInstancer manages health and shield bar rendering using InstancedMesh for improved performance.
 * Uses separate InstancedMesh objects for each layer type (background, health, shield, border).
 */
export class HealthBarInstancer {
  private instancedMeshes = new Map<HealthBarLayer, THREE.InstancedMesh>();
  private capacity: number;
  private activeShips = new Map<number, number>(); // shipId -> instanceIndex
  private freeIndices: number[] = [];
  private usedCount = 0;
  private hasWarned = false;
  // Readiness signalling: set to true once instanced meshes are created and added to the scene
  public isReady = false;
  private readyCallbacks: Array<() => void> = [];

  // Shared camera uniforms that need to be updated per frame
  private cameraUniforms = {
    cameraRight: new THREE.Vector3(1, 0, 0),
    cameraUp: new THREE.Vector3(0, 1, 0)
  };

  // Camera forward vector used to offset billboards slightly toward the camera to avoid z-fighting
  private cameraForward = new THREE.Vector3(0, 0, -1);

  // Extra temp vector to avoid allocations when adjusting world position for z-offset
  private tempPosition2 = new THREE.Vector3();

  // Temporary objects for matrix calculations to avoid allocations
  private tempMatrix = new THREE.Matrix4();
  private tempPosition = new THREE.Vector3();
  private tempScale = new THREE.Vector3(1, 1, 1);
  private tempQuaternion = new THREE.Quaternion();

  constructor(scene: THREE.Scene, healthBarsGroup: THREE.Group) {
    this.capacity = RendererConfig.instancing.bars.initialCapacity;
    
    // Initialize free indices pool
    for (let i = 0; i < this.capacity; i++) {
      this.freeIndices.push(i);
    }

    // Create InstancedMesh for each layer
    this.createLayerInstances(healthBarsGroup);
    
    // Mark as ready and notify any listeners
    this.isReady = true;
    for (const cb of this.readyCallbacks) {
      try {
        cb();
      } catch (_e) { void _e;logger.error('Error in HealthBarInstancer readiness callback', _e);
      }
    }
    this.readyCallbacks.length = 0;

    logger.info(`HealthBarInstancer initialized with capacity ${this.capacity}`);
  }

  /**
   * Return renderOrder for each layer so we can control draw order for transparent billboards
   */
  private layerRenderOrder(layer: HealthBarLayer): number {
    switch (layer) {
      case 'background': return 0;
      case 'health': return 1;
      case 'shield': return 2;
      case 'border': return 3;
      default: return 0;
    }
  }

  /**
   * Register a callback to be invoked when the instancer is ready.
   * If the instancer is already ready the callback is invoked immediately.
   */
  onReady(cb: () => void): void {
    if (this.isReady) {
      try {
        cb();
      } catch (_e) { void _e;logger.error('Error in HealthBarInstancer readiness callback', _e);
      }
      return;
    }
    this.readyCallbacks.push(cb);
  }

  /**
   * Update camera uniforms - call once per frame with current camera
   */
  updateCameraUniforms(camera: THREE.Camera): void {
    // cameraForward will point from the camera into the scene (camera -Z)
    camera.getWorldDirection(this.cameraForward);

    // Calculate camera right and up vectors for billboard rendering
    this.cameraUniforms.cameraRight.setFromMatrixColumn(camera.matrixWorld, 0);
    this.cameraUniforms.cameraUp.setFromMatrixColumn(camera.matrixWorld, 1);

    // Update uniforms in all layer materials
    for (const instancedMesh of this.instancedMeshes.values()) {
      const material = instancedMesh.material as THREE.ShaderMaterial;
      if (material.uniforms) {
        material.uniforms.cameraRight.value.copy(this.cameraUniforms.cameraRight);
        material.uniforms.cameraUp.value.copy(this.cameraUniforms.cameraUp);
      }
    }
  }

  /**
   * Allocate an instance for a new ship's health bar
   */
  allocateInstance(shipId: number): boolean {
    // Check if ship already has an instance
    if (this.activeShips.has(shipId)) {
      logger.warn(`Ship ${shipId} already has an allocated health bar instance`);
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
    this.activeShips.set(shipId, instanceIndex);
    this.usedCount++;

    // Check if we should warn about capacity usage
    const usage = this.usedCount / this.capacity;
    if (!this.hasWarned && usage > RendererConfig.instancing.bars.warnThreshold) {
      logger.warn(`Health bar instancer usage high: ${Math.round(usage * 100)}% (${this.usedCount}/${this.capacity})`);
      this.hasWarned = true;
    }

    return true;
  }

  /**
   * Free an instance for a removed ship
   */
  freeInstance(shipId: number): boolean {
    const instanceIndex = this.activeShips.get(shipId);
    if (instanceIndex === undefined) {
      return false;
    }

    // Hide all layer instances by setting scale to zero
    this.tempMatrix.makeScale(0, 0, 0);
    for (const instancedMesh of this.instancedMeshes.values()) {
      instancedMesh.setMatrixAt(instanceIndex, this.tempMatrix);
    }

    // Return to free pool
    this.freeIndices.push(instanceIndex);
    this.activeShips.delete(shipId);
    this.usedCount--;

    // Reset warning flag if usage is low again
    if (this.hasWarned && this.usedCount / this.capacity < RendererConfig.instancing.bars.warnThreshold * 0.8) {
      this.hasWarned = false;
    }

    return true;
  }

  /**
   * Update health bar instance for a ship
   */
  updateHealthBar(ship: Ship): boolean {
    const instanceIndex = this.activeShips.get(ship.id);
    if (instanceIndex === undefined) {
      return false;
    }

    const config = RendererConfig.healthBars;
    
    // Calculate position above ship
    this.tempPosition.set(
      ship.pos.x + config.position.offsetX,
      ship.pos.y + config.position.offsetY,
      ship.pos.z + 10 // Above the ship in 3D space
    );

    // Update background layer
    this.updateLayerInstance('background', instanceIndex, this.tempPosition, 1.0, config.colors.background);

    // Update health layer with health percentage
    const healthPercent = Math.max(0, ship.health / ship.maxHealth);
    const healthColor = healthPercent > 0.5 ? config.colors.health.full : 
                       healthPercent > 0.25 ? config.colors.health.damaged : 
                       config.colors.health.critical;
    this.updateLayerInstance('health', instanceIndex, this.tempPosition, healthPercent, healthColor);

    // Update shield layer if ship has shields
    if (ship.maxShield > 0) {
      const shieldPercent = Math.max(0, ship.shield / ship.maxShield);
      const shieldColor = shieldPercent > 0.5 ? config.colors.shield.full : config.colors.shield.damaged;
      
      // Offset shield slightly forward
      this.tempPosition.z += 0.1;
      this.updateLayerInstance('shield', instanceIndex, this.tempPosition, shieldPercent, shieldColor);
      this.tempPosition.z -= 0.1; // Reset for border
    } else {
      // Hide shield layer
      this.tempMatrix.makeScale(0, 0, 0);
      this.instancedMeshes.get('shield')!.setMatrixAt(instanceIndex, this.tempMatrix);
    }

    // Update border layer
    this.tempPosition.z += 0.2;
    this.updateLayerInstance('border', instanceIndex, this.tempPosition, 1.0, config.border.color);

    return true;
  }

  /**
   * Call this once per frame after all updates
   */
  markMatricesNeedUpdate(): void {
    for (const instancedMesh of this.instancedMeshes.values()) {
      instancedMesh.instanceMatrix.needsUpdate = true;
    }
  }

  /**
   * Check if a ship has an allocated instance
   */
  hasShip(shipId: number): boolean {
    return this.activeShips.has(shipId);
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
   * Debug helper (DEV only): return the X scale value for the health layer
   * instance for the given shipId, or null if not allocated.
   */
  debugGetInstanceScale(shipId: number): number | null {
    const idx = this.activeShips.get(shipId);
    if (idx === undefined) return null;
    const instancedMesh = this.instancedMeshes.get('health');
    if (!instancedMesh) return null;
    const m = new THREE.Matrix4();
    instancedMesh.getMatrixAt(idx, m);
    const s = new THREE.Vector3();
    m.decompose(new THREE.Vector3(), new THREE.Quaternion(), s);
    return s.x;
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    for (const [_layer, instancedMesh] of this.instancedMeshes) {
      instancedMesh.geometry.dispose();
      if (Array.isArray(instancedMesh.material)) {
        instancedMesh.material.forEach(mat => mat.dispose());
      } else {
        instancedMesh.material.dispose();
      }
    }
    this.instancedMeshes.clear();
    this.activeShips.clear();
    this.freeIndices.length = 0;
    logger.info('HealthBarInstancer disposed');
  }

  /**
   * Create InstancedMesh for each health bar layer
   */
  private createLayerInstances(healthBarsGroup: THREE.Group): void {
    const config = RendererConfig.healthBars;
    
    // Background layer - full width
    this.createLayerInstance('background', config.width, config.position.height, config.colors.background, 1.0, healthBarsGroup);
    
    // Health layer - variable width based on health percentage
    this.createLayerInstance('health', config.width - 2, config.position.height - 2, config.colors.health.full, 1.0, healthBarsGroup);
    
    // Shield layer - variable width based on shield percentage
    this.createLayerInstance('shield', config.width - 2, config.position.height - 2, config.colors.shield.full, 0.8, healthBarsGroup);
    
    // Border layer - ring geometry
    this.createBorderLayerInstance(healthBarsGroup);
  }

  /**
   * Create an InstancedMesh for a specific layer
   */
  private createLayerInstance(
    layer: HealthBarLayer, 
    width: number, 
    height: number, 
    color: string, 
    alpha: number,
    parent: THREE.Group
  ): void {
    if (layer === 'border') return; // Border uses special geometry

    const geometry = new THREE.PlaneGeometry(width, height);
    
    // Add instanced buffer attributes
    const scaleXArray = new Float32Array(this.capacity);
    const colorArray = new Float32Array(this.capacity * 3);
    
    // Initialize with default values
    for (let i = 0; i < this.capacity; i++) {
      scaleXArray[i] = 1.0;
      const colorObj = new THREE.Color(color);
      colorArray[i * 3] = colorObj.r;
      colorArray[i * 3 + 1] = colorObj.g;
      colorArray[i * 3 + 2] = colorObj.b;
    }
    
    geometry.setAttribute('aScaleX', new THREE.InstancedBufferAttribute(scaleXArray, 1));
    geometry.setAttribute('aColor', new THREE.InstancedBufferAttribute(colorArray, 3));
    
    const material = this.createBillboardMaterial(color, alpha);
    const instancedMesh = new THREE.InstancedMesh(geometry, material, this.capacity);
    // Ensure transparent layers render in a predictable order and avoid depth-test artifacts
    instancedMesh.renderOrder = this.layerRenderOrder(layer);
    // Many runtimes use a single shared material; make sure depthTest is disabled so
    // overlapping transparent billboards don't cull each other when facing away.
    if (Array.isArray(instancedMesh.material)) {
      instancedMesh.material.forEach((m: THREE.Material) => { (m as THREE.Material & { depthTest?: boolean }).depthTest = false; });
    } else {
      (instancedMesh.material as THREE.Material & { depthTest?: boolean }).depthTest = false;
    }
    
    // Hide all instances initially
    this.hideUnusedInstances(instancedMesh);
    
    this.instancedMeshes.set(layer, instancedMesh);
    parent.add(instancedMesh);
  }

  /**
   * Create border layer with ring geometry
   */
  private createBorderLayerInstance(parent: THREE.Group): void {
    const config = RendererConfig.healthBars;
    const geometry = new THREE.RingGeometry(
      config.width/2 - config.border.width/2, 
      config.width/2 + config.border.width/2, 
      8
    );
    
    // Add instanced buffer attributes for border
    const scaleXArray = new Float32Array(this.capacity);
    const colorArray = new Float32Array(this.capacity * 3);
    
    // Initialize with default values
    for (let i = 0; i < this.capacity; i++) {
      scaleXArray[i] = 1.0;
      const colorObj = new THREE.Color(config.border.color);
      colorArray[i * 3] = colorObj.r;
      colorArray[i * 3 + 1] = colorObj.g;
      colorArray[i * 3 + 2] = colorObj.b;
    }
    
    geometry.setAttribute('aScaleX', new THREE.InstancedBufferAttribute(scaleXArray, 1));
    geometry.setAttribute('aColor', new THREE.InstancedBufferAttribute(colorArray, 3));
    
  const material = this.createBillboardMaterial(config.border.color, 0.5);
  const instancedMesh = new THREE.InstancedMesh(geometry, material, this.capacity);
  instancedMesh.renderOrder = this.layerRenderOrder('border');
  (instancedMesh.material as THREE.Material & { depthTest?: boolean }).depthTest = false;
    
    // Hide all instances initially
    this.hideUnusedInstances(instancedMesh);
    
    this.instancedMeshes.set('border', instancedMesh);
    parent.add(instancedMesh);
  }

  /**
   * Create billboard material with instanced attributes
   */
  private createBillboardMaterial(color: string, alpha: number): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        cameraRight: { value: this.cameraUniforms.cameraRight.clone() },
        cameraUp: { value: this.cameraUniforms.cameraUp.clone() },
        uDefaultColor: { value: new THREE.Color(color) },
        uAlpha: { value: alpha },
      },
      vertexShader: `
        uniform vec3 cameraRight;
        uniform vec3 cameraUp;
        uniform float uAlpha;
        attribute float aScaleX;
        attribute vec3 aColor;
        
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
          // Get center position from instance matrix
          vec3 center = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          
          // Apply per-instance scale to position
          vec3 scaledPos = position;
          scaledPos.x *= aScaleX;
          
          // Create billboard position
          vec3 worldPos = center + cameraRight * scaledPos.x + cameraUp * scaledPos.y;
          gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
          
          vColor = aColor;
          vAlpha = uAlpha;
        }
      `,
      fragmentShader: `
        uniform vec3 uDefaultColor;
        uniform float uAlpha;
        varying vec3 vColor;
        varying float vAlpha;
        
        void main() {
          gl_FragColor = vec4(vColor, vAlpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }

  /**
   * Update a specific layer instance
   */
  private updateLayerInstance(
    layer: HealthBarLayer, 
    instanceIndex: number, 
    position: THREE.Vector3, 
    scaleX: number, 
    color: string
  ): void {
    const instancedMesh = this.instancedMeshes.get(layer);
    if (!instancedMesh) return;

    // Set transform matrix
    this.tempScale.set(scaleX, 1, 1);

    // Apply a tiny camera-facing offset so the billboard sits slightly in front of other overlapping
    // transparent layers. This avoids z-fighting without globally disabling depth testing.
    const OFFSET_DISTANCE = RendererConfig.healthBars.zOffset ?? 0.002; // configurable
    this.tempPosition2.copy(position).addScaledVector(this.cameraForward, -OFFSET_DISTANCE);
    this.tempMatrix.compose(this.tempPosition2, this.tempQuaternion, this.tempScale);
    instancedMesh.setMatrixAt(instanceIndex, this.tempMatrix);

    // Update color attribute if it exists
    const geometry = instancedMesh.geometry;
    if (geometry.attributes.aColor) {
      const colorAttr = geometry.attributes.aColor as THREE.InstancedBufferAttribute;
      const colorObj = new THREE.Color(color);
      colorAttr.setXYZ(instanceIndex, colorObj.r, colorObj.g, colorObj.b);
      colorAttr.needsUpdate = true;
    }

    // Update scale attribute if it exists
    if (geometry.attributes.aScaleX) {
      const scaleAttr = geometry.attributes.aScaleX as THREE.InstancedBufferAttribute;
      scaleAttr.setX(instanceIndex, scaleX);
      scaleAttr.needsUpdate = true;
    }
  }

  /**
   * Grow the capacity of all instanced meshes
   */
  private growCapacity(): boolean {
    const newCapacity = Math.min(
      Math.ceil(this.capacity * RendererConfig.instancing.bars.growthFactor),
      RendererConfig.instancing.bars.maxCapacity
    );

    if (newCapacity <= this.capacity) {
      logger.error(`Cannot grow health bar instancer capacity beyond ${this.capacity} (max: ${RendererConfig.instancing.bars.maxCapacity})`);
      return false;
    }

    logger.info(`Growing health bar instancer capacity from ${this.capacity} to ${newCapacity}`);

    // Create new instanced meshes for each layer
    const newInstancedMeshes = new Map<HealthBarLayer, THREE.InstancedMesh>();
    
    for (const [layer, oldInstancedMesh] of this.instancedMeshes) {
      const geometry = oldInstancedMesh.geometry;
      const material = oldInstancedMesh.material;
      const newInstancedMesh = new THREE.InstancedMesh(geometry, material, newCapacity);
      
      // Copy existing matrices
      for (let i = 0; i < this.capacity; i++) {
        oldInstancedMesh.getMatrixAt(i, this.tempMatrix);
        newInstancedMesh.setMatrixAt(i, this.tempMatrix);
      }

      // Hide new unused instances
      this.hideUnusedInstances(newInstancedMesh, this.capacity);
      
      // Replace in scene
      const parent = oldInstancedMesh.parent;
      if (parent) {
        parent.remove(oldInstancedMesh);
        parent.add(newInstancedMesh);
      }

      newInstancedMeshes.set(layer, newInstancedMesh);
    }

    this.instancedMeshes = newInstancedMeshes;

    // Add new free indices
    for (let i = this.capacity; i < newCapacity; i++) {
      this.freeIndices.push(i);
    }

    this.capacity = newCapacity;
    this.markMatricesNeedUpdate();

    return true;
  }

  /**
   * Hide unused instances by setting them to zero scale
   */
  private hideUnusedInstances(instancedMesh: THREE.InstancedMesh, startIndex = 0): void {
    this.tempMatrix.makeScale(0, 0, 0);
    for (let i = startIndex; i < this.capacity; i++) {
      instancedMesh.setMatrixAt(i, this.tempMatrix);
    }
  }
}

