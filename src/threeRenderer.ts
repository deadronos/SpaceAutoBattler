import * as THREE from 'three';
import { SVGLoader } from 'three-stdlib';
import type { RendererContract } from './rendererContract';
import type { GameState } from './types';
import { getShipConfig } from './config/threeConfig.js';
import { ParticleSystem, ParticleEffects } from './effects/ParticleSystem.js';

export class ThreeRenderer implements RendererContract {
  private canvas: HTMLCanvasElement;
  private renderer: any = null;
  private scene: any = null;
  private camera: any = null;
  private defaultMaterial: any = null;
  // Instanced ships placeholder
  private shipGeom: any = null;
  private shipMat: any = null;
  private shipMesh: any = null; // THREE.InstancedMesh
  private shipCapacity = 0;
  
  // Archetype meshes for different ship types
  private archetypeMeshes: Map<string, any> = new Map();
  private archetypeGeometries: Map<string, any> = new Map();

  // Camera follow settings
  private cameraFollowEnabled = true;
  private cameraFollowSpeed = 0.05;
  private cameraFollowDistance = 400;
  private cameraFollowHeight = 200;
  private cameraTargetPosition = new THREE.Vector3();
  private cameraCurrentPosition = new THREE.Vector3();

  // Camera control modes
  private cameraMode: 'follow' | 'orbit' | 'free' = 'follow';
  private orbitTarget = new THREE.Vector3(0, 0, 0);
  private orbitDistance = 400;
  private orbitAngles = { theta: 0, phi: Math.PI / 4 }; // Azimuthal and polar angles
  
  // Mouse/touch controls
  private isMouseDown = false;
  private lastMousePosition = { x: 0, y: 0 };
  private mouseSensitivity = 0.005;
  private zoomSpeed = 1.1;

  // LOD (Level of Detail) settings
  private lodEnabled = true;
  private lodDistances = [100, 300, 600]; // Distance thresholds for LOD levels
  private lodGeometries: Map<string, any[]> = new Map(); // [type][lodLevel] = geometry

  // Spatial partitioning (Spatial Hash Grid)
  private spatialPartitioningEnabled = true;
  private gridCellSize = 50;
  private spatialGrid: Map<string, any[]> = new Map(); // Grid cell -> ships in that cell

  // Particle system for visual effects
  private particleSystem!: any; // ParticleSystem

  // Shield visualization
  private shieldGeometries: Map<string, any> = new Map(); // Shield geometries by type
  private shieldMaterials: Map<string, any> = new Map(); // Shield materials by team
  private shieldMeshes: Map<string, any> = new Map(); // Active shield meshes

  // Asset pipeline
  private assetCache: Map<string, any> = new Map(); // Asset URL -> loaded asset
  private gltfLoader: any = null;
  private assetLoadPromises: Map<string, Promise<any>> = new Map();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  init(canvas?: HTMLCanvasElement): boolean {
    try {
      if (canvas) this.canvas = canvas;
      try {
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
        this.renderer.setPixelRatio?.(typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1);
      } catch (e) {
        // Fallback minimal renderer
        this.renderer = {
          setPixelRatio: () => {},
          setSize: () => {},
          render: () => {},
          dispose: () => {},
        };
      }

      // Add camera control event listeners
      this.setupCameraControls();

      try {
        this.scene = new THREE.Scene();
        try { this.scene.background = new THREE.Color(0x001020); } catch {}
      } catch (e) {
        this.scene = { add: () => {}, remove: () => {}, traverse: () => {}, background: null } as any;
      }

      const w = this.canvas.width || 800;
      const h = this.canvas.height || 600;
      try {
        this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 10000);
        // Position camera to view the entire simulation area
        const bounds = { W: 1920, H: 1920 }; // Updated to cubic dimensions
        this.camera.position.set(bounds.W / 2, bounds.H / 2, 800);
        this.camera.lookAt(bounds.W / 2, bounds.H / 2, 0);
        // Initialize camera follow positions
        this.cameraCurrentPosition.set(bounds.W / 2, bounds.H / 2, 800);
        this.cameraTargetPosition.set(bounds.W / 2, bounds.H / 2, 0);
      } catch (e) {
        this.camera = { position: { set: () => {} }, updateProjectionMatrix: () => {}, updateMatrixWorld: () => {}, lookAt: () => {} } as any;
      }

      try {
        this.defaultMaterial = new THREE.MeshStandardMaterial({ color: 0xb0b7c3 });
      } catch {}

      // Initialize particle system
      try {
        this.particleSystem = new ParticleSystem(5000); // Support up to 5000 particles
        this.scene.add?.(this.particleSystem.getObject3D());
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('Particle system initialization failed:', e);
      }

      // Initialize shield visualization
      this.initializeShieldVisualization();

      try {
        this.scene.add?.(new THREE.AmbientLight(0xffffff, 0.6));
      } catch {}
      try {
        const dl = new THREE.DirectionalLight(0xffffff, 0.6);
        try { dl.position?.set?.(1, 1, 0.5)?.normalize?.(); } catch {}
        this.scene.add?.(dl);
      } catch {}

      try {
        // Minimal placeholder geometry/material for ships (unit box)
        this.shipGeom = new THREE.BoxGeometry(6, 2, 1);
        
        // Custom shader material that uses instance colors
        const vertexShader = `
          attribute vec3 position;
          attribute vec3 normal;
          attribute vec3 instanceColor;
          
          uniform mat4 modelViewMatrix;
          uniform mat4 projectionMatrix;
          uniform mat3 normalMatrix;
          
          varying vec3 vNormal;
          varying vec3 vColor;
          
          void main() {
            vNormal = normalize(normalMatrix * normal);
            vColor = instanceColor;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `;
        
        const fragmentShader = `
          uniform vec3 diffuse;
          uniform float opacity;
          
          varying vec3 vNormal;
          varying vec3 vColor;
          
          void main() {
            gl_FragColor = vec4(vColor * diffuse, opacity);
          }
        `;
        
        this.shipMat = new THREE.ShaderMaterial({
          vertexShader,
          fragmentShader,
          uniforms: {
            diffuse: { value: new THREE.Vector3(1, 1, 1) },
            opacity: { value: 1.0 }
          }
        });
        
        // Note: Archetype meshes are created in preloadAllAssets()
      } catch {}

      this.updateSize(w, h);
      return !!this.renderer;
    } catch (e) {
      // fail gracefully
      // eslint-disable-next-line no-console
      console.error('ThreeRenderer.init failed', e);
      return false;
    }
  }

  updateSize(width: number, height: number): void {
    if (!this.renderer || !this.camera) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  async preloadAllAssets(state?: GameState): Promise<void> {
    // Create archetype geometries for different ship types
    this.createArchetypeGeometries();
    
    // Create LOD geometries for performance
    this.createLODGeometries();
    
    // Create instanced meshes for each archetype
    this.createArchetypeMeshes();
    
    // Ensure all meshes are added to the scene
    this.ensureMeshesInScene();
    
    return;
  }

  renderState(state: GameState, _interpolation = 0): void {
    if (!this.renderer || !this.scene || !this.camera) return;
    try {
      // sync camera from GameState if available
      const cam = (state as any)?.camera;
      if (cam && this.camera) {
        if (cam.position) this.camera.position.set(cam.position.x, cam.position.y, cam.position.z);
        if (cam.target) this.camera.lookAt(cam.target.x, cam.target.y, cam.target.z);
        this.camera.updateMatrixWorld();
      } else if (this.cameraFollowEnabled) {
        // Use camera follow if no explicit camera state and follow is enabled
        const ships: any[] = Array.isArray((state as any).ships) ? (state as any).ships : [];
        this.updateCameraFollow(ships);
      }

      // Update instanced ship transforms and colors from state.ships
      const ships: any[] = Array.isArray((state as any).ships) ? (state as any).ships : [];
      
      // Update spatial grid for efficient queries
      this.updateSpatialGrid(ships);
      
      const visibleShips = this.frustumCullShips(ships);
      
      // Group ships by type and LOD level
      const shipsByTypeAndLOD = new Map<string, any[]>();
      for (const ship of visibleShips) {
        const type = ship.type || 'default';
        const distance = this.getDistanceToCamera(ship?.position || ship);
        const lodLevel = this.getLODLevel(distance);
        const key = `${type}_lod${lodLevel}`;
        
        if (!shipsByTypeAndLOD.has(key)) {
          shipsByTypeAndLOD.set(key, []);
        }
        shipsByTypeAndLOD.get(key)!.push({ ...ship, lodLevel, distance });
      }
      
      // Render each archetype with appropriate LOD
      for (const [key, typeShips] of shipsByTypeAndLOD) {
        const [type, lodKey] = key.split('_lod');
        const lodLevel = parseInt(lodKey);
        
        // Get or create mesh for this type and LOD level
        const meshKey = `${type}_lod${lodLevel}`;
        let mesh = this.archetypeMeshes.get(meshKey);
        
        if (!mesh) {
          // Create new mesh for this LOD level
          const geometries = this.lodGeometries.get(type);
          const geometry = geometries && geometries[lodLevel] ? geometries[lodLevel] : this.archetypeGeometries.get(type);
          
          if (geometry) {
            mesh = new (THREE as any).InstancedMesh(geometry, this.shipMat, 100);
            mesh.instanceMatrix.setUsage?.((THREE as any).DynamicDrawUsage ?? 35048);
            
            // Add color attribute for per-instance team colors
            const colorArray = new Float32Array(100 * 3);
            mesh.setAttribute('instanceColor', new THREE.InstancedBufferAttribute(colorArray, 3));
            
            mesh.count = 0;
            this.archetypeMeshes.set(meshKey, mesh);
            
            if (this.scene) this.scene.add(mesh);
          }
        }
        
        if (!mesh) continue;
        
        // Ensure capacity
        if (typeShips.length > mesh.capacity) {
          this.expandArchetypeMesh(meshKey, typeShips.length);
          mesh = this.archetypeMeshes.get(meshKey)!;
        }
        
        const tmpMat = new THREE.Matrix4();
        const colorAttr = mesh.getAttribute('instanceColor');
        const colorArray = colorAttr ? colorAttr.array as Float32Array : null;
        
        for (let i = 0; i < typeShips.length && i < mesh.capacity; i++) {
          const s = typeShips[i];
          const shipScale = s.scale || 1.0;
          
          // Create transform matrix with proper scaling
          const matrix = new THREE.Matrix4();
          matrix.makeScale(shipScale, shipScale, shipScale);
          
          // Apply rotation if quaternion is provided
          if (s.quaternion) {
            const quat = new THREE.Quaternion(s.quaternion.x, s.quaternion.y, s.quaternion.z, s.quaternion.w);
            const rotationMatrix = new THREE.Matrix4();
            rotationMatrix.makeRotationFromQuaternion(quat);
            matrix.multiply(rotationMatrix);
          }
          
          // Apply translation
          const translationMatrix = new THREE.Matrix4();
          translationMatrix.makeTranslation(s.position.x || 0, s.position.y || 0, s.position.z || 0);
          matrix.multiply(translationMatrix);
          
          mesh.setMatrixAt(i, matrix);
          
          // Set team color
          if (colorArray) {
            const color = this.getTeamColor(s.team);
            colorArray[i * 3] = color.r;
            colorArray[i * 3 + 1] = color.g;
            colorArray[i * 3 + 2] = color.b;
          }
        }
        
        mesh.count = Math.min(typeShips.length, mesh.capacity);
        if (mesh.instanceMatrix) mesh.instanceMatrix.needsUpdate = true;
        if (colorAttr) colorAttr.needsUpdate = true;
      }

      this.renderer.render(this.scene, this.camera);

      // Update particle system
      if (this.particleSystem) {
        const deltaTime = 1 / 60; // Assume 60 FPS for now
        this.particleSystem.update(deltaTime);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('ThreeRenderer.renderState', e);
    }
  }

  dispose(): void {
    if (this.renderer) {
      if (this.scene) {
        this.scene.traverse((o: any) => {
          const obj: any = o;
          if (obj.geometry) obj.geometry.dispose && obj.geometry.dispose();
          if (obj.material) {
            if (Array.isArray(obj.material)) (obj.material as any[]).forEach((m: any) => m.dispose && m.dispose());
            else obj.material.dispose && obj.material.dispose();
          }
        });
      }
      this.renderer.dispose();
      this.renderer = null;
    }
    
    // Dispose archetype meshes (including LOD variants)
    for (const mesh of this.archetypeMeshes.values()) {
      if (this.scene) {
        try { this.scene.remove(mesh); } catch {}
      }
      try { mesh.dispose && mesh.dispose(); } catch {}
    }
    this.archetypeMeshes.clear();
    this.archetypeGeometries.clear();
    this.lodGeometries.clear();
    
    // Clear asset cache
    this.assetCache.clear();
    this.assetLoadPromises.clear();
    
    if (this.shipMesh) {
      try { this.scene && this.scene.remove(this.shipMesh); } catch {}
      try { this.shipMesh.dispose && this.shipMesh.dispose(); } catch {}
    }
    this.scene = null;
    this.camera = null;
    this.defaultMaterial = null;
    this.shipGeom = null;
    this.shipMat = null;
    this.shipMesh = null;
    this.shipCapacity = 0;
  }

  supportsInstancing(): boolean {
    return true;
  }

  getStats(): any {
    const archetypeStats = Array.from(this.archetypeMeshes.entries()).map(([key, mesh]) => {
      const isLOD = key.includes('_lod');
      const type = isLOD ? key.split('_lod')[0] : key;
      const lodLevel = isLOD ? parseInt(key.split('_lod')[1]) : 0;
      
      return {
        key,
        type,
        lodLevel: isLOD ? lodLevel : null,
        count: mesh.count,
        capacity: mesh.capacity,
        visible: mesh.visible
      };
    });
    
    const lodStats = {
      enabled: this.lodEnabled,
      distances: this.lodDistances,
      totalLODMeshes: archetypeStats.filter(stat => stat.lodLevel !== null).length
    };
    
    const spatialStats = {
      enabled: this.spatialPartitioningEnabled,
      cellSize: this.gridCellSize,
      occupiedCells: this.spatialGrid.size,
      totalShipsInGrid: Array.from(this.spatialGrid.values()).reduce((sum, ships) => sum + ships.length, 0)
    };
    
    const assetStats = {
      cachedAssets: this.assetCache.size,
      pendingLoads: this.assetLoadPromises.size,
      cacheKeys: Array.from(this.assetCache.keys())
    };
    
    return {
      instances: this.shipMesh ? this.shipMesh.count : 0,
      capacity: this.shipCapacity,
      archetypes: archetypeStats,
      totalArchetypes: this.archetypeMeshes.size,
      totalInstances: archetypeStats.reduce((sum, stat) => sum + stat.count, 0),
      totalCapacity: archetypeStats.reduce((sum, stat) => sum + stat.capacity, 0),
      lod: lodStats,
      spatial: spatialStats,
      assets: assetStats
    };
  }

  private getTeamColor(team?: string): { r: number; g: number; b: number } {
    switch (team) {
      case 'red':
        return { r: 1.0, g: 0.2, b: 0.2 }; // Red team
      case 'blue':
        return { r: 0.2, g: 0.4, b: 1.0 }; // Blue team
      default:
        return { r: 0.6, g: 0.7, b: 1.0 }; // Default neutral color
    }
  }

  private calculateCenterOfInterest(ships: any[]): any {
    if (ships.length === 0) return new THREE.Vector3(0, 0, 0);
    
    let totalX = 0, totalY = 0, totalZ = 0;
    let count = 0;
    
    for (const ship of ships) {
      const pos = ship?.position || ship || {};
      const is2D = typeof ship.x === 'number' || typeof ship.y === 'number';
      const x = is2D ? (ship.x ?? 0) : (pos.x ?? 0);
      const y = is2D ? (ship.y ?? 0) : (pos.y ?? 0);
      const z = is2D ? 0 : (pos.z ?? 0);
      
      totalX += x;
      totalY += y;
      totalZ += z;
      count++;
    }
    
    return new THREE.Vector3(totalX / count, totalY / count, totalZ / count);
  }

  private updateCameraFollow(ships: any[]): void {
    if (!this.camera || !this.cameraFollowEnabled || this.cameraMode !== 'follow') return;
    
    // Calculate center of interest
    const centerOfInterest = this.calculateCenterOfInterest(ships);
    
    // Set target position (above the center of interest)
    this.cameraTargetPosition.copy(centerOfInterest);
    this.cameraTargetPosition.z += 800; // Fixed height above the action
    
    // Smoothly interpolate camera position
    this.cameraCurrentPosition.lerp(this.cameraTargetPosition, this.cameraFollowSpeed);
    
    // Update camera position and look at center of interest
    this.camera.position.copy(this.cameraCurrentPosition);
    this.camera.lookAt(centerOfInterest);
    this.camera.updateMatrixWorld();
  }

  // Public method to configure camera follow settings
  setCameraFollow(enabled: boolean, speed = 0.05, distance = 400, height = 200): void {
    this.cameraFollowEnabled = enabled;
    this.cameraFollowSpeed = Math.max(0.01, Math.min(1.0, speed));
    this.cameraFollowDistance = Math.max(50, distance);
    this.cameraFollowHeight = Math.max(10, height);
  }

  // Camera control mode methods
  setCameraMode(mode: 'follow' | 'orbit' | 'free'): void {
    this.cameraMode = mode;
    if (mode === 'orbit' && this.camera) {
      // Initialize orbit target to current look-at point
      this.orbitTarget.copy(this.cameraTargetPosition);
      this.orbitDistance = this.camera.position.distanceTo(this.orbitTarget);
      // Calculate initial angles from current camera position
      const direction = new THREE.Vector3().subVectors(this.camera.position, this.orbitTarget).normalize();
      this.orbitAngles.theta = Math.atan2(direction.x, direction.z);
      this.orbitAngles.phi = Math.acos(Math.max(-1, Math.min(1, direction.y)));
    }
  }

  getCameraMode(): 'follow' | 'orbit' | 'free' {
    return this.cameraMode;
  }

  // Mouse/touch event handlers for camera controls
  handleMouseDown(event: MouseEvent): void {
    this.isMouseDown = true;
    this.lastMousePosition.x = event.clientX;
    this.lastMousePosition.y = event.clientY;
  }

  handleMouseUp(): void {
    this.isMouseDown = false;
  }

  handleMouseMove(event: MouseEvent): void {
    if (!this.isMouseDown || !this.camera) return;

    const deltaX = event.clientX - this.lastMousePosition.x;
    const deltaY = event.clientY - this.lastMousePosition.y;

    if (this.cameraMode === 'orbit') {
      // Orbit controls
      this.orbitAngles.theta -= deltaX * this.mouseSensitivity;
      this.orbitAngles.phi += deltaY * this.mouseSensitivity;
      this.orbitAngles.phi = Math.max(0.1, Math.min(Math.PI - 0.1, this.orbitAngles.phi));
      
      this.updateOrbitCamera();
    } else if (this.cameraMode === 'free') {
      // Free camera pan (strafe)
      const right = new THREE.Vector3().crossVectors(this.camera.getWorldDirection(new THREE.Vector3()), this.camera.up).normalize();
      const up = this.camera.up.clone();
      
      right.multiplyScalar(-deltaX * this.mouseSensitivity * 10);
      up.multiplyScalar(deltaY * this.mouseSensitivity * 10);
      
      this.camera.position.add(right).add(up);
    }

    this.lastMousePosition.x = event.clientX;
    this.lastMousePosition.y = event.clientY;
  }

  handleWheel(event: WheelEvent): void {
    if (!this.camera) return;
    event.preventDefault();

    const zoomFactor = event.deltaY > 0 ? this.zoomSpeed : 1 / this.zoomSpeed;

    if (this.cameraMode === 'orbit') {
      this.orbitDistance *= zoomFactor;
      this.orbitDistance = Math.max(10, Math.min(2000, this.orbitDistance));
      this.updateOrbitCamera();
    } else if (this.cameraMode === 'free') {
      // Zoom in free mode by moving camera forward/backward
      const direction = this.camera.getWorldDirection(new THREE.Vector3()).normalize();
      direction.multiplyScalar((zoomFactor - 1) * 50);
      this.camera.position.add(direction);
    } else if (this.cameraMode === 'follow') {
      // Adjust follow distance
      this.cameraFollowDistance *= zoomFactor;
      this.cameraFollowDistance = Math.max(50, Math.min(1000, this.cameraFollowDistance));
    }
  }

  private updateOrbitCamera(): void {
    if (!this.camera) return;

    // Calculate camera position from spherical coordinates
    const x = this.orbitTarget.x + this.orbitDistance * Math.sin(this.orbitAngles.phi) * Math.sin(this.orbitAngles.theta);
    const y = this.orbitTarget.y + this.orbitDistance * Math.cos(this.orbitAngles.phi);
    const z = this.orbitTarget.z + this.orbitDistance * Math.sin(this.orbitAngles.phi) * Math.cos(this.orbitAngles.theta);

    this.camera.position.set(x, y, z);
    this.camera.lookAt(this.orbitTarget);
    this.camera.updateMatrixWorld();
  }

  // Set orbit target point
  setOrbitTarget(x: number, y: number, z: number): void {
    this.orbitTarget.set(x, y, z);
    if (this.cameraMode === 'orbit') {
      this.updateOrbitCamera();
    }
  }

  // Get current camera info for debugging/UI
  getCameraInfo(): any {
    if (!this.camera) return null;

    return {
      mode: this.cameraMode,
      position: this.camera.position.clone(),
      target: this.cameraMode === 'orbit' ? this.orbitTarget.clone() : this.cameraTargetPosition.clone(),
      followEnabled: this.cameraFollowEnabled,
      followDistance: this.cameraFollowDistance,
      followHeight: this.cameraFollowHeight,
      orbitDistance: this.orbitDistance,
      orbitAngles: { ...this.orbitAngles }
    };
  }

  // Particle effect methods
  createEngineTrail(shipPosition: any, shipVelocity: any): number {
    if (!this.particleSystem) return -1;

    const emitterConfig = {
      position: shipPosition.clone(),
      direction: shipVelocity.clone().normalize().negate(), // Opposite to velocity for trail
      effect: 'engineTrail'
    };

    return this.particleSystem.createEmitter(emitterConfig);
  }

  createExplosion(position: any, scale = 1.0): number {
    if (!this.particleSystem) return -1;

    const emitterConfig = {
      position: position.clone(),
      effect: 'explosion'
    };

    // Scale explosion based on ship size
    if (scale !== 1.0) {
      const effect = { ...ParticleEffects.explosion };
      effect.size *= scale;
      effect.count = Math.floor(effect.count * scale);
      // Create custom config without effect property
      const customConfig = {
        position: position.clone(),
        speed: effect.speed,
        speedVariance: effect.speedVariance,
        life: effect.life,
        lifeVariance: effect.lifeVariance,
        size: effect.size,
        sizeVariance: effect.sizeVariance,
        color: effect.color,
        count: effect.count,
        emitRate: effect.emitRate,
        spread: effect.spread
      };
      return this.particleSystem.createEmitter(customConfig);
    }

    return this.particleSystem.createEmitter(emitterConfig);
  }

  // Create enhanced multi-stage explosion
  createEnhancedExplosion(position: any, scale = 1.0, explosionType: 'ship' | 'missile' | 'torpedo' = 'ship'): void {
    if (!this.particleSystem) return;

    // Stage 1: Initial flash
    this.createExplosionFlash(position, scale);

    // Stage 2: Main explosion
    this.createExplosionMain(position, scale, explosionType);

    // Stage 3: Debris and smoke
    this.createExplosionDebris(position, scale);

    // Stage 4: Fire effects (for larger explosions)
    if (scale > 1.5) {
      this.createExplosionFire(position, scale);
    }
  }

  private createExplosionFlash(position: any, scale: number): number {
    if (!this.particleSystem) return -1;

    return this.particleSystem.createEmitter({
      position: position.clone(),
      direction: new THREE.Vector3(0, 0, 1),
      speed: 5,
      speedVariance: 2,
      life: 0.1,
      lifeVariance: 0.05,
      size: 8 * scale,
      sizeVariance: 2 * scale,
      color: new (THREE as any).Color(1.0, 1.0, 1.0), // Bright white flash
      count: Math.floor(20 * scale),
      emitRate: 0.001,
      spread: Math.PI * 2
    });
  }

  private createExplosionMain(position: any, scale: number, explosionType: string): number {
    if (!this.particleSystem) return -1;

    let color: any;
    let speed: number;
    let size: number;

    switch (explosionType) {
      case 'missile':
        color = new (THREE as any).Color(1.0, 0.3, 0.1);
        speed = 25;
        size = 2.0;
        break;
      case 'torpedo':
        color = new (THREE as any).Color(0.1, 0.8, 1.0);
        speed = 35;
        size = 3.0;
        break;
      case 'ship':
      default:
        color = new (THREE as any).Color(1.0, 0.5, 0.0);
        speed = 20;
        size = 4.0;
        break;
    }

    return this.particleSystem.createEmitter({
      position: position.clone(),
      direction: new THREE.Vector3(0, 0, 1),
      speed: speed * scale,
      speedVariance: speed * 0.3 * scale,
      life: 1.2 * scale,
      lifeVariance: 0.3 * scale,
      size: size * scale,
      sizeVariance: size * 0.5 * scale,
      color: color,
      count: Math.floor(40 * scale),
      emitRate: 0.005,
      spread: Math.PI * 2
    });
  }

  private createExplosionDebris(position: any, scale: number): number {
    if (!this.particleSystem) return -1;

    return this.particleSystem.createEmitter({
      position: position.clone(),
      direction: new THREE.Vector3(0, 0, 1),
      speed: 15 * scale,
      speedVariance: 8 * scale,
      life: 2.0 * scale,
      lifeVariance: 0.5 * scale,
      size: 1.0 * scale,
      sizeVariance: 0.6 * scale,
      color: new (THREE as any).Color(0.4, 0.4, 0.4), // Gray debris
      count: Math.floor(25 * scale),
      emitRate: 0.01,
      spread: Math.PI * 2
    });
  }

  private createExplosionFire(position: any, scale: number): number {
    if (!this.particleSystem) return -1;

    return this.particleSystem.createEmitter({
      position: position.clone(),
      direction: new THREE.Vector3(0, 0, 1),
      speed: 8 * scale,
      speedVariance: 4 * scale,
      life: 1.5 * scale,
      lifeVariance: 0.4 * scale,
      size: 2.5 * scale,
      sizeVariance: 1.0 * scale,
      color: new (THREE as any).Color(1.0, 0.2, 0.0), // Red-orange fire
      count: Math.floor(30 * scale),
      emitRate: 0.02,
      spread: Math.PI * 1.5
    });
  }

  // Create shockwave effect
  createShockwave(position: any, radius: number): number {
    if (!this.particleSystem) return -1;

    return this.particleSystem.createEmitter({
      position: position.clone(),
      direction: new THREE.Vector3(0, 0, 1),
      speed: radius / 2,
      speedVariance: radius / 4,
      life: 0.8,
      lifeVariance: 0.2,
      size: 0.5,
      sizeVariance: 0.2,
      color: new (THREE as any).Color(0.8, 0.8, 1.0), // Light blue shockwave
      count: Math.floor(radius * 2),
      emitRate: 0.001,
      spread: Math.PI * 2
    });
  }

  createBulletHit(position: any, direction?: any): number {
    if (!this.particleSystem) return -1;

    const emitterConfig = {
      position: position.clone(),
      direction: direction ? direction.clone() : new THREE.Vector3(0, 0, 1),
      effect: 'bulletHit'
    };

    return this.particleSystem.createEmitter(emitterConfig);
  }

  // Enhanced bullet effects
  createBulletTrail(startPosition: any, endPosition: any): number {
    if (!this.particleSystem) return -1;

    // Create a trail of particles from start to end position
    const direction = new THREE.Vector3().subVectors(endPosition, startPosition).normalize();
    const distance = startPosition.distanceTo(endPosition);
    const particleCount = Math.max(5, Math.floor(distance / 10)); // More particles for longer shots

    const emitterConfig = {
      position: startPosition.clone(),
      direction: direction,
      speed: 50,
      speedVariance: 10,
      life: 0.5,
      lifeVariance: 0.2,
      size: 0.5,
      sizeVariance: 0.2,
      color: new (THREE as any).Color(1.0, 0.8, 0.4), // Bright yellow trail
      count: particleCount,
      emitRate: 0.01,
      spread: 0.1
    };

    return this.particleSystem.createEmitter(emitterConfig);
  }

  createMuzzleFlash(turretPosition: any, fireDirection: any): number {
    if (!this.particleSystem) return -1;

    const emitterConfig = {
      position: turretPosition.clone(),
      direction: fireDirection.clone(),
      speed: 30,
      speedVariance: 15,
      life: 0.2,
      lifeVariance: 0.1,
      size: 2.0,
      sizeVariance: 0.5,
      color: new (THREE as any).Color(1.0, 0.6, 0.2), // Orange flash
      count: 12,
      emitRate: 0.01,
      spread: Math.PI * 0.3
    };

    return this.particleSystem.createEmitter(emitterConfig);
  }

  // Create enhanced bullet impact with multiple effects
  createEnhancedBulletImpact(position: any, direction: any, hitType: 'hull' | 'shield' | 'armor' = 'hull'): void {
    if (!this.particleSystem) return;

    // Main impact particles
    this.createBulletHit(position, direction);

    // Add secondary effects based on hit type
    switch (hitType) {
      case 'shield':
        // Shield impacts create more diffuse, cyan particles
        const shieldEmitter = this.particleSystem.createEmitter({
          position: position.clone(),
          direction: direction.clone(),
          speed: 25,
          speedVariance: 10,
          life: 0.8,
          lifeVariance: 0.3,
          size: 1.5,
          sizeVariance: 0.5,
          color: new (THREE as any).Color(0.3, 0.8, 1.0),
          count: 8,
          emitRate: 0.01,
          spread: Math.PI * 0.6
        });
        break;

      case 'armor':
        // Armor impacts create fewer, brighter sparks
        const armorEmitter = this.particleSystem.createEmitter({
          position: position.clone(),
          direction: direction.clone(),
          speed: 40,
          speedVariance: 15,
          life: 0.6,
          lifeVariance: 0.2,
          size: 1.2,
          sizeVariance: 0.3,
          color: new (THREE as any).Color(1.0, 0.9, 0.3),
          count: 6,
          emitRate: 0.01,
          spread: Math.PI * 0.4
        });
        break;

      case 'hull':
      default:
        // Hull impacts create debris particles
        const debrisEmitter = this.particleSystem.createEmitter({
          position: position.clone(),
          direction: direction.clone(),
          speed: 20,
          speedVariance: 12,
          life: 1.0,
          lifeVariance: 0.4,
          size: 0.8,
          sizeVariance: 0.4,
          color: new (THREE as any).Color(0.6, 0.6, 0.6),
          count: 10,
          emitRate: 0.01,
          spread: Math.PI * 0.5
        });
        break;
    }
  }

  createShieldHit(position: any, normal?: any): number {
    if (!this.particleSystem) return -1;

    const emitterConfig = {
      position: position.clone(),
      direction: normal ? normal.clone() : new THREE.Vector3(0, 0, 1),
      effect: 'shieldHit'
    };

    return this.particleSystem.createEmitter(emitterConfig);
  }

  // Update particle emitter position (useful for moving effects like engine trails)
  updateParticleEmitter(emitterId: number, config: any): void {
    if (this.particleSystem) {
      this.particleSystem.updateEmitter(emitterId, config);
    }
  }

  // Remove particle emitter
  removeParticleEmitter(emitterId: number): void {
    if (this.particleSystem) {
      this.particleSystem.removeEmitter(emitterId);
    }
  }

  // Get particle system stats for debugging
  getParticleStats(): any {
    if (!this.particleSystem) return null;

    return {
      particleCount: this.particleSystem.getParticleCount(),
      emitterCount: this.particleSystem.getEmitterCount()
    };
  }

  // Shield visualization methods
  createShield(ship: any): string {
    if (!ship || !ship.position) return '';

    const shipType = ship.type || 'default';
    const team = ship.team || 'neutral';
    const shieldId = `shield_${ship.id || Math.random().toString(36).substr(2, 9)}`;

    try {
      const geometry = this.shieldGeometries.get(shipType);
      const material = this.shieldMaterials.get(team);

      if (!geometry || !material) return '';

      const shieldMesh = new THREE.Mesh(geometry, material.clone());
      
      // Position shield at ship location
      const pos = ship.position;
      shieldMesh.position.set(pos.x || 0, pos.y || 0, pos.z || 0);
      
      // Scale shield based on ship size
      const scale = ship.scale || 1.0;
      shieldMesh.scale.setScalar(scale * 1.2); // Slightly larger than ship
      
      // Add shield to scene and track it
      this.scene.add(shieldMesh);
      this.shieldMeshes.set(shieldId, {
        mesh: shieldMesh,
        shipId: ship.id,
        lastPosition: pos,
        lastScale: scale,
        material: shieldMesh.material
      });

      return shieldId;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('Failed to create shield:', e);
      return '';
    }
  }

  updateShield(shieldId: string, ship: any): void {
    const shieldData = this.shieldMeshes.get(shieldId);
    if (!shieldData || !ship || !ship.position) return;

    try {
      const mesh = shieldData.mesh;
      const pos = ship.position;
      const scale = ship.scale || 1.0;
      const shieldStrength = ship.shieldStrength || 1.0;

      // Update position
      mesh.position.set(pos.x || 0, pos.y || 0, pos.z || 0);
      
      // Update scale
      mesh.scale.setScalar(scale * 1.2);
      
      // Update shield strength in material
      if (mesh.material && mesh.material.uniforms) {
        mesh.material.uniforms.shieldStrength.value = shieldStrength;
        mesh.material.uniforms.time.value += 0.016; // Increment time for animation
      }

      // Update tracking data
      shieldData.lastPosition = pos;
      shieldData.lastScale = scale;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('Failed to update shield:', e);
    }
  }

  removeShield(shieldId: string): void {
    const shieldData = this.shieldMeshes.get(shieldId);
    if (!shieldData) return;

    try {
      this.scene.remove(shieldData.mesh);
      shieldData.mesh.geometry.dispose();
      if (Array.isArray(shieldData.mesh.material)) {
        shieldData.mesh.material.forEach((m: any) => m.dispose());
      } else {
        shieldData.mesh.material.dispose();
      }
      this.shieldMeshes.delete(shieldId);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('Failed to remove shield:', e);
    }
  }

  // Create shield hit effect at specific position
  createShieldHitEffect(position: any, normal?: any): number {
    if (!this.particleSystem) return -1;

    // Create shield hit particle effect
    const emitterId = this.createShieldHit(position, normal);
    
    // Also create a brief flash effect on the shield
    // This could be extended to flash the actual shield mesh
    
    return emitterId;
  }

  // Get shield stats for debugging
  getShieldStats(): any {
    return {
      activeShields: this.shieldMeshes.size,
      shieldIds: Array.from(this.shieldMeshes.keys())
    };
  }

  // Setup mouse/touch event listeners for camera controls
  private setupCameraControls(): void {
    if (typeof window === 'undefined') return;

    // Mouse events
    this.canvas.addEventListener('mousedown', (event) => {
      event.preventDefault();
      this.handleMouseDown(event);
    });

    this.canvas.addEventListener('mouseup', (event) => {
      event.preventDefault();
      this.handleMouseUp();
    });

    this.canvas.addEventListener('mousemove', (event) => {
      event.preventDefault();
      this.handleMouseMove(event);
    });

    this.canvas.addEventListener('wheel', (event) => {
      this.handleWheel(event);
    });

    // Touch events for mobile support
    this.canvas.addEventListener('touchstart', (event) => {
      event.preventDefault();
      if (event.touches.length === 1) {
        const touch = event.touches[0];
        this.handleMouseDown({
          clientX: touch.clientX,
          clientY: touch.clientY
        } as MouseEvent);
      }
    });

    this.canvas.addEventListener('touchend', (event) => {
      event.preventDefault();
      this.handleMouseUp();
    });

    this.canvas.addEventListener('touchmove', (event) => {
      event.preventDefault();
      if (event.touches.length === 1) {
        const touch = event.touches[0];
        this.handleMouseMove({
          clientX: touch.clientX,
          clientY: touch.clientY
        } as MouseEvent);
      }
    });

    // Prevent context menu on right click
    this.canvas.addEventListener('contextmenu', (event) => {
      event.preventDefault();
    });
  }

  // Initialize shield visualization system
  private initializeShieldVisualization(): void {
    // Create shield geometries for different ship types
    this.shieldGeometries.set('fighter', new THREE.SphereGeometry(8, 16, 12));
    this.shieldGeometries.set('corvette', new THREE.SphereGeometry(12, 20, 15));
    this.shieldGeometries.set('frigate', new THREE.SphereGeometry(16, 24, 18));
    this.shieldGeometries.set('destroyer', new THREE.SphereGeometry(20, 28, 21));
    this.shieldGeometries.set('carrier', new THREE.SphereGeometry(28, 32, 24));
    this.shieldGeometries.set('default', new THREE.SphereGeometry(10, 18, 14));

    // Create shield materials for different teams
    this.shieldMaterials.set('red', this.createShieldMaterial(new THREE.Color(1.0, 0.2, 0.2)));
    this.shieldMaterials.set('blue', this.createShieldMaterial(new THREE.Color(0.2, 0.4, 1.0)));
    this.shieldMaterials.set('neutral', this.createShieldMaterial(new THREE.Color(0.6, 0.7, 1.0)));
  }

  // Create animated shield material
  private createShieldMaterial(baseColor: any): any {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        baseColor: { value: baseColor },
        opacity: { value: 0.3 },
        shieldStrength: { value: 1.0 }
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform vec3 baseColor;
        uniform float opacity;
        uniform float shieldStrength;
        
        varying vec3 vNormal;
        varying vec3 vPosition;
        
        void main() {
          // Create animated shield effect
          float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0, 0, 1))), 2.0);
          float pulse = sin(time * 3.0) * 0.1 + 0.9;
          float grid = sin(vPosition.x * 10.0 + time) * sin(vPosition.y * 10.0 + time) * 0.1 + 0.9;
          
          vec3 color = baseColor * (fresnel * pulse * grid * shieldStrength);
          gl_FragColor = vec4(color, opacity * fresnel);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });

    return material;
  }

  // Public method to configure LOD settings
  setLOD(enabled: boolean, distances = [100, 300, 600]): void {
    this.lodEnabled = enabled;
    this.lodDistances = distances;
  }

  // Public method to configure spatial partitioning
  setSpatialPartitioning(enabled: boolean, cellSize = 50): void {
    this.spatialPartitioningEnabled = enabled;
    this.gridCellSize = Math.max(10, cellSize);
  }

  // Public method to query ships in a radius (useful for AI, collision detection, etc.)
  queryShipsInRadius(centerX: number, centerY: number, centerZ: number, radius: number): any[] {
    return this.getShipsInRadius(centerX, centerY, centerZ, radius);
  }

  // Public method to get world position of a ship component
  getComponentWorldPosition(ship: any, componentLocalPos: { x: number; y: number; z: number }): any {
    const shipPos = ship.position || { x: 0, y: 0, z: 0 };
    const shipScale = ship.scale || 1.0;
    
    // Convert local component position to world position
    const worldPos = {
      x: shipPos.x + (componentLocalPos.x * shipScale),
      y: shipPos.y + (componentLocalPos.y * shipScale),
      z: shipPos.z + (componentLocalPos.z * shipScale)
    };
    
    // Apply ship rotation if quaternion is available
    if (ship.quaternion) {
      const quat = new THREE.Quaternion(
        ship.quaternion.x, 
        ship.quaternion.y, 
        ship.quaternion.z, 
        ship.quaternion.w
      );
      
      const localPos = new THREE.Vector3(componentLocalPos.x, componentLocalPos.y, componentLocalPos.z);
      localPos.multiplyScalar(shipScale);
      localPos.applyQuaternion(quat);
      
      worldPos.x = shipPos.x + localPos.x;
      worldPos.y = shipPos.y + localPos.y;
      worldPos.z = shipPos.z + localPos.z;
    }
    
    return worldPos;
  }

  // Public method to get all turret world positions for a ship
  getTurretPositions(ship: any): any[] {
    if (!ship.turrets || !Array.isArray(ship.turrets)) return [];
    
    return ship.turrets.map((turret: any) => 
      this.getComponentWorldPosition(ship, turret)
    );
  }

  // Asset pipeline methods
  private async loadGLTFAsset(url: string): Promise<any> {
    if (this.assetCache.has(url)) {
      return this.assetCache.get(url);
    }

    if (this.assetLoadPromises.has(url)) {
      return this.assetLoadPromises.get(url);
    }

    const loadPromise = new Promise<any>((resolve, reject) => {
      try {
        // Try to use GLTFLoader if available
        if (typeof window !== 'undefined' && (window as any).THREE?.GLTFLoader) {
          const loader = new (window as any).THREE.GLTFLoader();
          loader.load(
            url,
            (gltf: any) => {
              this.assetCache.set(url, gltf);
              resolve(gltf);
            },
            undefined,
            reject
          );
        } else {
          // Fallback: create a simple placeholder
          const placeholder = this.createPlaceholderGeometry();
          this.assetCache.set(url, placeholder);
          resolve(placeholder);
        }
      } catch (error) {
        reject(error);
      }
    });

    this.assetLoadPromises.set(url, loadPromise);
    
    try {
      const asset = await loadPromise;
      this.assetLoadPromises.delete(url);
      return asset;
    } catch (error) {
      this.assetLoadPromises.delete(url);
      throw error;
    }
  }

  private async loadSVGAsset(svgText: string, depth = 4): Promise<any> {
    const cacheKey = `svg_${svgText.length}_${depth}`;
    if (this.assetCache.has(cacheKey)) {
      return this.assetCache.get(cacheKey);
    }

    try {
      const group = this.extrudeSVG(svgText, depth);
      this.assetCache.set(cacheKey, group);
      return group;
    } catch (error) {
      // Fallback to placeholder
      const placeholder = this.createPlaceholderGeometry();
      this.assetCache.set(cacheKey, placeholder);
      return placeholder;
    }
  }

  private createPlaceholderGeometry(): any {
    // Create a simple ship-like geometry as fallback
    const geometry = new THREE.BoxGeometry(8, 3, 1.5);
    const material = new THREE.MeshStandardMaterial({ color: 0x666666 });
    const mesh = new THREE.Mesh(geometry, material);
    return mesh;
  }

  // Public method to preload assets for archetypes
  async preloadArchetypeAsset(archetypeName: string, assetUrl: string, assetType: 'gltf' | 'svg' = 'gltf'): Promise<void> {
    try {
      let asset;
      if (assetType === 'gltf') {
        asset = await this.loadGLTFAsset(assetUrl);
      } else {
        // Assume assetUrl is SVG text for SVG assets
        asset = await this.loadSVGAsset(assetUrl);
      }
      
      // Store asset for this archetype
      this.assetCache.set(`archetype_${archetypeName}`, asset);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn(`Failed to load asset for archetype ${archetypeName}:`, error);
    }
  }

  // Enhanced extrudeSVG method with better error handling
  extrudeSVG(svgText: string, depth = 4, material?: any): any {
    try {
      const loader = new SVGLoader();
      const data = loader.parse(svgText);
      const group = new THREE.Group();
      
      (data.paths as any[]).forEach((path: any) => {
        const shapes = (path as any).toShapes(true) as any[];
        shapes.forEach((shape: any) => {
          const geom = new THREE.ExtrudeBufferGeometry(shape, { 
            depth, 
            bevelEnabled: false,
            UVGenerator: (THREE as any).ExtrudeBufferGeometry?.WorldUVGenerator
          });
          const mat = material || this.defaultMaterial || new THREE.MeshStandardMaterial({ color: 0xb0b7c3 });
          const mesh = new THREE.Mesh(geom, mat as any);
          group.add(mesh);
        });
      });
      
      return group;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('SVG extrusion failed:', error);
      return this.createPlaceholderGeometry();
    }
  }

  private getGridKey(x: number, y: number, z: number): string {
    const gridX = Math.floor(x / this.gridCellSize);
    const gridY = Math.floor(y / this.gridCellSize);
    const gridZ = Math.floor(z / this.gridCellSize);
    return `${gridX},${gridY},${gridZ}`;
  }

  private updateSpatialGrid(ships: any[]): void {
    if (!this.spatialPartitioningEnabled) return;
    
    // Clear the grid
    this.spatialGrid.clear();
    
    // Place ships in grid cells
    for (const ship of ships) {
      const pos = ship?.position || ship || {};
      const is2D = typeof ship.x === 'number' || typeof ship.y === 'number';
      const x = is2D ? (ship.x ?? 0) : (pos.x ?? 0);
      const y = is2D ? (ship.y ?? 0) : (pos.y ?? 0);
      const z = is2D ? 0 : (pos.z ?? 0);
      
      const key = this.getGridKey(x, y, z);
      if (!this.spatialGrid.has(key)) {
        this.spatialGrid.set(key, []);
      }
      this.spatialGrid.get(key)!.push(ship);
    }
  }

  private getShipsInRadius(centerX: number, centerY: number, centerZ: number, radius: number): any[] {
    if (!this.spatialPartitioningEnabled) return [];
    
    const results: any[] = [];
    const radiusSquared = radius * radius;
    
    // Calculate grid cells to check (expand by 1 cell in each direction for safety)
    const minGridX = Math.floor((centerX - radius) / this.gridCellSize) - 1;
    const maxGridX = Math.floor((centerX + radius) / this.gridCellSize) + 1;
    const minGridY = Math.floor((centerY - radius) / this.gridCellSize) - 1;
    const maxGridY = Math.floor((centerY + radius) / this.gridCellSize) + 1;
    const minGridZ = Math.floor((centerZ - radius) / this.gridCellSize) - 1;
    const maxGridZ = Math.floor((centerZ + radius) / this.gridCellSize) + 1;
    
    // Check all relevant grid cells
    for (let gx = minGridX; gx <= maxGridX; gx++) {
      for (let gy = minGridY; gy <= maxGridY; gy++) {
        for (let gz = minGridZ; gz <= maxGridZ; gz++) {
          const key = `${gx},${gy},${gz}`;
          const cellShips = this.spatialGrid.get(key);
          if (cellShips) {
            for (const ship of cellShips) {
              const pos = ship?.position || ship || {};
              const is2D = typeof ship.x === 'number' || typeof ship.y === 'number';
              const shipX = is2D ? (ship.x ?? 0) : (pos.x ?? 0);
              const shipY = is2D ? (ship.y ?? 0) : (pos.y ?? 0);
              const shipZ = is2D ? 0 : (pos.z ?? 0);
              
              const dx = shipX - centerX;
              const dy = shipY - centerY;
              const dz = shipZ - centerZ;
              const distanceSquared = dx * dx + dy * dy + dz * dz;
              
              if (distanceSquared <= radiusSquared) {
                results.push(ship);
              }
            }
          }
        }
      }
    }
    
    return results;
  }

  private getNearbyShips(ship: any, radius: number): any[] {
    const pos = ship?.position || ship || {};
    const is2D = typeof ship.x === 'number' || typeof ship.y === 'number';
    const x = is2D ? (ship.x ?? 0) : (pos.x ?? 0);
    const y = is2D ? (ship.y ?? 0) : (pos.y ?? 0);
    const z = is2D ? 0 : (pos.z ?? 0);
    
    return this.getShipsInRadius(x, y, z, radius);
  }

  private createLODGeometries(): void {
    // Create different detail levels for each ship type
    const shipTypes = ['fighter', 'corvette', 'frigate', 'destroyer', 'carrier', 'default'];
    
    for (const type of shipTypes) {
      const geometries: any[] = [];
      
      // High detail (LOD 0) - full geometry
      geometries.push(this.archetypeGeometries.get(type));
      
      // Medium detail (LOD 1) - simplified geometry
      geometries.push(this.createSimplifiedGeometry(type, 0.7));
      
      // Low detail (LOD 2) - very simplified geometry
      geometries.push(this.createSimplifiedGeometry(type, 0.4));
      
      this.lodGeometries.set(type, geometries);
    }
  }

  private createSimplifiedGeometry(type: string, scale: number): any {
    const baseGeom = this.archetypeGeometries.get(type);
    if (!baseGeom) return new THREE.BoxGeometry(6 * scale, 2 * scale, 1 * scale);
    
    // Create a simplified version by scaling down
    const simplified = baseGeom.clone();
    simplified.scale(scale, scale, scale);
    return simplified;
  }

  private getLODLevel(distance: number): number {
    if (!this.lodEnabled) return 0;
    
    for (let i = 0; i < this.lodDistances.length; i++) {
      if (distance < this.lodDistances[i]) {
        return i;
      }
    }
    return this.lodDistances.length; // Use lowest detail for very far objects
  }

  private getDistanceToCamera(position: any): number {
    if (!this.camera) return 0;
    
    const is2D = typeof position.x === 'number' || typeof position.y === 'number';
    const x = is2D ? (position.x ?? 0) : (position.x ?? 0);
    const y = is2D ? (position.y ?? 0) : (position.y ?? 0);
    const z = is2D ? 0 : (position.z ?? 0);
    
    const shipPos = new THREE.Vector3(x, y, z);
    return this.camera.position.distanceTo(shipPos);
  }

  private createArchetypeGeometries(): void {
    // Create different geometries for different ship types
    // Using the new normalized scaling system
    this.archetypeGeometries.set('fighter', new THREE.BoxGeometry(1, 1, 1));    // Base 1x1x1, scaled by ship config
    this.archetypeGeometries.set('corvette', new THREE.BoxGeometry(1, 1, 1));   // Base 1x1x1, scaled by ship config
    this.archetypeGeometries.set('frigate', new THREE.BoxGeometry(1, 1, 1));    // Base 1x1x1, scaled by ship config
    this.archetypeGeometries.set('destroyer', new THREE.BoxGeometry(1, 1, 1));  // Base 1x1x1, scaled by ship config
    this.archetypeGeometries.set('carrier', new THREE.BoxGeometry(1, 1, 1));    // Base 1x1x1, scaled by ship config
    
    // Default geometry for unknown types
    this.archetypeGeometries.set('default', new THREE.BoxGeometry(1, 1, 1));
  }
  
  private createArchetypeMeshes(): void {
    // Create instanced meshes for each archetype
    for (const [type, geometry] of this.archetypeGeometries) {
      const mesh = new (THREE as any).InstancedMesh(geometry, this.shipMat, 100); // Start with capacity of 100
      mesh.instanceMatrix.setUsage?.((THREE as any).DynamicDrawUsage ?? 35048);
      
      // Add color attribute for per-instance team colors
      const colorArray = new Float32Array(100 * 3); // RGB per instance
      mesh.setAttribute('instanceColor', new THREE.InstancedBufferAttribute(colorArray, 3));
      
      mesh.count = 0;
      this.archetypeMeshes.set(type, mesh);
      
      if (this.scene) this.scene.add(mesh);
    }
  }

  private ensureMeshesInScene(): void {
    if (!this.scene) return;
    
    for (const [type, mesh] of this.archetypeMeshes) {
      if (!mesh.parent) {
        this.scene.add(mesh);
      }
    }
  }
  
  private expandArchetypeMesh(type: string, needed: number): void {
    const currentMesh = this.archetypeMeshes.get(type);
    if (!currentMesh) return;
    
    let newCapacity = currentMesh.capacity;
    while (newCapacity < needed) newCapacity = newCapacity << 1;
    
    const geometry = this.archetypeGeometries.get(type);
    if (!geometry) return;
    
    const newMesh = new (THREE as any).InstancedMesh(geometry, this.shipMat, newCapacity);
    newMesh.instanceMatrix.setUsage?.((THREE as any).DynamicDrawUsage ?? 35048);
    
    // Add color attribute for per-instance team colors
    const colorArray = new Float32Array(newCapacity * 3); // RGB per instance
    newMesh.setAttribute('instanceColor', new THREE.InstancedBufferAttribute(colorArray, 3));
    
    newMesh.count = 0;
    
    // Replace the old mesh
    if (this.scene) {
      this.scene.remove(currentMesh);
      this.scene.add(newMesh);
    }
    
    try { currentMesh.dispose && currentMesh.dispose(); } catch {}
    this.archetypeMeshes.set(type, newMesh);
  }
  
  private frustumCullShips(ships: any[]): any[] {
    if (!this.camera) return ships;
    
    const frustum = new THREE.Frustum();
    const cameraMatrix = new THREE.Matrix4();
    
    // Update camera matrix
    this.camera.updateMatrixWorld();
    cameraMatrix.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(cameraMatrix);
    
    return ships.filter(ship => {
      const pos = ship?.position || ship || {};
      const is2D = typeof ship.x === 'number' || typeof ship.y === 'number';
      const x = is2D ? (ship.x ?? 0) : (pos.x ?? 0);
      const y = is2D ? (ship.y ?? 0) : (pos.y ?? 0);
      const z = is2D ? 0 : (pos.z ?? 0);
      
      const shipPos = new THREE.Vector3(x, y, z);
      return frustum.containsPoint(shipPos);
    });
  }

  private ensureShipCapacity(needed: number) {
    const cap = this.shipCapacity | 0;
    if (cap >= needed && this.shipMesh) return;
    let newCap = Math.max(needed, cap > 0 ? cap : 1);
    while (newCap < needed) newCap = newCap << 1;
    const mesh = new (THREE as any).InstancedMesh(this.shipGeom, this.shipMat, newCap);
    mesh.instanceMatrix.setUsage?.((THREE as any).DynamicDrawUsage ?? 35048);
    
    // Add color attribute for per-instance team colors
    const colorArray = new Float32Array(newCap * 3); // RGB per instance
    mesh.setAttribute('instanceColor', new THREE.InstancedBufferAttribute(colorArray, 3));
    
    mesh.count = 0;
    if (this.shipMesh && this.scene) {
      try { this.scene.remove(this.shipMesh); } catch {}
      try { this.shipMesh.dispose && this.shipMesh.dispose(); } catch {}
    }
    this.shipMesh = mesh;
    this.shipCapacity = newCap;
    if (this.scene) this.scene.add(mesh);
  }
}

export default ThreeRenderer;

// --- Helpers ---

// Compute transform matrix for a ship that may be 2D (x,y,angle) or 3D (position/quaternion/scale)
export function computeShipMatrix(out: any, ship: any): any {
  const pos = ship?.position || ship || {};
  const is2D = typeof ship.x === 'number' || typeof ship.y === 'number';
  const x = is2D ? (ship.x ?? 0) : (pos.x ?? 0);
  const y = is2D ? (ship.y ?? 0) : (pos.y ?? 0);
  const z = is2D ? 0 : (pos.z ?? 0);
  const s = ship?.scale != null ? ship.scale : 1;
  const angle = is2D ? (ship.angle ?? ship.a ?? 0) : 0;

  // If quaternion provided, use it; else build from Z-rotation angle
  const quat = ship?.quaternion;
  const qx = quat?.x ?? 0, qy = quat?.y ?? 0, qz = quat?.z ?? Math.sin(angle * 0.5), qw = quat?.w ?? Math.cos(angle * 0.5);
  return out.compose(
    new (THREE as any).Vector3(x, y, z),
    new (THREE as any).Quaternion(qx, qy, qz, qw),
    new (THREE as any).Vector3(s, s, s)
  );
}
