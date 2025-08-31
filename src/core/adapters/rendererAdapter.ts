import type { Ship, Bullet, Vector3, EntityId } from '../../types/index.js';

/**
 * Visual descriptor for creating entity visuals
 */
export interface VisualDescriptor {
  type: 'ship' | 'bullet' | 'effect';
  modelPath?: string;
  texture?: string;
  color?: { r: number; g: number; b: number };
  scale?: Vector3;
  opacity?: number;
  material?: string;
}

/**
 * Transform information for positioning entities
 */
export interface Transform {
  position: Vector3;
  rotation: Vector3; // Euler angles in radians
  scale?: Vector3;
}

/**
 * Effect descriptor for visual effects
 */
export interface EffectDescriptor {
  type: 'explosion' | 'shield-hit' | 'thruster' | 'muzzle-flash' | 'heal';
  position: Vector3;
  scale?: number;
  duration?: number;
  color?: { r: number; g: number; b: number };
  params?: Record<string, any>;
}

/**
 * Camera parameters for scene view
 */
export interface CameraParams {
  position?: Vector3;
  target?: Vector3;
  fov?: number;
  near?: number;
  far?: number;
  zoom?: number;
}

/**
 * Renderer initialization options
 */
export interface RendererInitOptions {
  antialias?: boolean;
  shadows?: boolean;
  postprocessing?: boolean;
  quality?: 'low' | 'medium' | 'high';
}

/**
 * Renderer performance statistics
 */
export interface RendererStats {
  fps: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  memoryUsage?: number;
}

/**
 * Enhanced RendererAdapter providing comprehensive rendering operations
 * with complete lifecycle management and effects support.
 */
export interface RendererAdapter {
  // Scene lifecycle
  init(canvas: HTMLCanvasElement, options?: RendererInitOptions): Promise<void>;
  dispose(): void;
  isInitialized(): boolean;

  // Entity visuals
  addEntity(entityId: EntityId, visual: VisualDescriptor): void;
  updateEntity(entityId: EntityId, visualPatch: Partial<VisualDescriptor>): void;
  removeEntity(entityId: EntityId): void;
  hasEntity(entityId: EntityId): boolean;

  // Legacy ship/bullet support for backward compatibility
  ensureMeshForShip(ship: Ship): void;
  updateMeshFromShip(ship: Ship): void;
  removeShip(id: number): void;
  ensureMeshForBullet(bullet: Bullet): void;
  updateMeshFromBullet(bullet: Bullet): void;
  removeBullet(id: number): void;

  // Camera and transforms
  setCamera(params: CameraParams): void;
  getCamera(): CameraParams;
  setTransform(entityId: EntityId, transform: Transform): void;
  getTransform(entityId: EntityId): Transform | null;

  // Effects
  playEffect(entityId: EntityId, effect: EffectDescriptor): string; // returns effect ID
  removeEffect(entityId: EntityId, effectId: string): void;
  clearEffects(entityId?: EntityId): void; // clear all effects or for specific entity

  // Frame control
  renderFrame(time: number): void;
  resize(width: number, height: number): void;
  getStats(): RendererStats;

  // Quality and settings
  setQuality(quality: 'low' | 'medium' | 'high'): void;
  getQuality(): 'low' | 'medium' | 'high';

  // Scene management
  clearScene(): void;
  setBackground(color: { r: number; g: number; b: number } | string): void;

  // Camera / scene helpers (optional - for backward compatibility)
  setCameraTarget?(pos: Vector3): void;
  render?(dt: number): void;
}

/**
 * No-op adapter for tests or headless runs.
 */
export class NoopRendererAdapter implements RendererAdapter {
  private initialized = false;
  private entities = new Set<EntityId>();
  private effects = new Map<EntityId, Map<string, EffectDescriptor>>();
  private transforms = new Map<EntityId, Transform>();
  private camera: CameraParams = {};
  private quality: 'low' | 'medium' | 'high' = 'medium';

  async init(_canvas: HTMLCanvasElement, _options?: RendererInitOptions): Promise<void> {
    this.initialized = true;
  }

  dispose(): void {
    this.initialized = false;
    this.entities.clear();
    this.effects.clear();
    this.transforms.clear();
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  addEntity(entityId: EntityId, _visual: VisualDescriptor): void {
    this.entities.add(entityId);
  }

  updateEntity(_entityId: EntityId, _visualPatch: Partial<VisualDescriptor>): void {}

  removeEntity(entityId: EntityId): void {
    this.entities.delete(entityId);
    this.effects.delete(entityId);
    this.transforms.delete(entityId);
  }

  hasEntity(entityId: EntityId): boolean {
    return this.entities.has(entityId);
  }

  // Legacy support
  ensureMeshForShip(ship: Ship): void {
    this.addEntity(ship.id, { type: 'ship' });
  }
  updateMeshFromShip(_ship: Ship): void {}
  removeShip(id: number): void {
    this.removeEntity(id);
  }
  ensureMeshForBullet(bullet: Bullet): void {
    this.addEntity(bullet.id, { type: 'bullet' });
  }
  updateMeshFromBullet(_bullet: Bullet): void {}
  removeBullet(id: number): void {
    this.removeEntity(id);
  }

  setCamera(params: CameraParams): void {
    this.camera = { ...this.camera, ...params };
  }

  getCamera(): CameraParams {
    return { ...this.camera };
  }

  setTransform(entityId: EntityId, transform: Transform): void {
    this.transforms.set(entityId, { ...transform });
  }

  getTransform(entityId: EntityId): Transform | null {
    return this.transforms.get(entityId) ?? null;
  }

  playEffect(entityId: EntityId, effect: EffectDescriptor): string {
    if (!this.effects.has(entityId)) {
      this.effects.set(entityId, new Map());
    }
    const effectId = `effect_${Date.now()}_${Math.random()}`;
    this.effects.get(entityId)!.set(effectId, effect);
    return effectId;
  }

  removeEffect(entityId: EntityId, effectId: string): void {
    this.effects.get(entityId)?.delete(effectId);
  }

  clearEffects(entityId?: EntityId): void {
    if (entityId !== undefined) {
      this.effects.delete(entityId);
    } else {
      this.effects.clear();
    }
  }

  renderFrame(_time: number): void {}

  resize(_width: number, _height: number): void {}

  getStats(): RendererStats {
    return {
      fps: 60,
      drawCalls: this.entities.size,
      triangles: this.entities.size * 100, // Mock triangle count
      geometries: this.entities.size,
      textures: 1,
      memoryUsage: this.entities.size * 1024,
    };
  }

  setQuality(quality: 'low' | 'medium' | 'high'): void {
    this.quality = quality;
  }

  getQuality(): 'low' | 'medium' | 'high' {
    return this.quality;
  }

  clearScene(): void {
    this.entities.clear();
    this.effects.clear();
    this.transforms.clear();
  }

  setBackground(_color: { r: number; g: number; b: number } | string): void {}

  // Legacy optional methods
  setCameraTarget?(_pos: Vector3): void {}
  render?(_dt: number): void {}
}
