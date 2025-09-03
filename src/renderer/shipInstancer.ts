import * as THREE from 'three';
import { defaultSVGConfig, getShipSVGUrl } from '../config/svgConfig.js';
import { ShipVisualConfig } from '../config/shipVisualConfig.js';

type Float3 = { x: number; y: number; z: number };

type GroupData = {
  className: string;
  team?: string;
  meshes: THREE.InstancedMesh[];
  capacity: number;
  freeIndices: number[];
  idToIndex: Map<number, number>;
  indexToId: Map<number, number>;
  matricesNeedUpdate: boolean;
  prototypeGeometries: THREE.BufferGeometry[];
  prototypeMaterials: THREE.Material[];
  parentGroup: THREE.Group;
  // Track per-instance world positions for coarse bounds/culling
  positions: Map<number, THREE.Vector3>;
  boundsCenter: THREE.Vector3;
  boundsRadius: number;
  boundsDirty: boolean;
};

class ShipInstancerImpl {
  private scene?: THREE.Scene;
  private rootParent?: THREE.Group;
  // Readiness signalling
  public isReady = false;
  private readyCallbacks: Array<() => void> = [];
  private groups = new Map<string, GroupData>();
  private defaultCapacity = 64;
  private growthFactor = 1.5;
  private fallbackGeometry?: THREE.BufferGeometry;
  private fallbackMaterial?: THREE.MeshStandardMaterial;

  private prototypeRegistry = new Map<string, { geometries: THREE.BufferGeometry[]; materials: THREE.Material[] }>();
  // Temporary objects for culling/bounds computation to avoid per-frame allocations
  private frustum = new THREE.Frustum();
  private projScreenMatrix = new THREE.Matrix4();
  private tmpSphere = new THREE.Sphere();
  private tmpVec = new THREE.Vector3();
  private tmpScale = new THREE.Vector3();
  // Reusable temporaries to avoid per-frame allocations
  private tmpMatrix = new THREE.Matrix4();
  private tmpQuat = new THREE.Quaternion();

  init(scene: THREE.Scene, parent: THREE.Group) {
    this.scene = scene;
    this.rootParent = parent;
    if (!this.fallbackGeometry) this.fallbackGeometry = new THREE.ConeGeometry(0.4, 1.4, 6);
    if (!this.fallbackMaterial) this.fallbackMaterial = new THREE.MeshStandardMaterial({ color: 0x8888ff });
  }

  onReady(cb: () => void): void {
    if (this.isReady) {
      try { cb(); } catch (_) { void _;/* no-op */ }
      return;
    }
    this.readyCallbacks.push(cb);
  }

  registerPrototype(className: string, geometries: THREE.BufferGeometry | THREE.BufferGeometry[], materials?: THREE.Material | THREE.Material[]) {
    const geoms = Array.isArray(geometries) ? geometries : [geometries];
    const mats = materials ? (Array.isArray(materials) ? materials : [materials]) : geoms.map(() => this.fallbackMaterial!.clone());
    const padded = mats.length < geoms.length ? [...mats, ...Array(geoms.length - mats.length).fill(mats[mats.length - 1].clone())] : mats.slice(0, geoms.length);
    this.prototypeRegistry.set(className, { geometries: geoms, materials: padded });
    // If init() has already been called and this is the first prototype,
    // mark the instancer as ready so consumers can switch to instanced paths.
    if (!this.isReady && this.rootParent) {
      this.isReady = true;
      for (const cb of this.readyCallbacks) {
        try { cb(); } catch (_e) { void _e;/* ignore callback errors */ }
      }
      this.readyCallbacks.length = 0;
    }
  }

  /**
   * Update an already-registered prototype (or register if missing) and
   * update any existing groups to use the new prototype geometries/materials.
   */
  updatePrototype(className: string, geometries: THREE.BufferGeometry | THREE.BufferGeometry[], materials?: THREE.Material | THREE.Material[]) {
    const geoms = Array.isArray(geometries) ? geometries : [geometries];
    const mats = materials ? (Array.isArray(materials) ? materials : [materials]) : geoms.map(() => this.fallbackMaterial!.clone());
    const padded = mats.length < geoms.length ? [...mats, ...Array(geoms.length - mats.length).fill(mats[mats.length - 1].clone())] : mats.slice(0, geoms.length);
    this.prototypeRegistry.set(className, { geometries: geoms, materials: padded });
    // If a group already exists for this class, replace its meshes so future
    // instance allocations and existing instances use the new geometry/material.
    const group = this.groups.get(className);
    if (!group) return;
    // Capture old usages
    const oldMeshes = group.meshes.slice();
    const oldCapacity = group.capacity;
    // Build new instanced meshes with the same capacity and copy existing matrices
    const newMeshes: THREE.InstancedMesh[] = [];
    for (let i = 0; i < geoms.length; i++) {
      const geom = geoms[i];
      const mat = (padded[i] || padded[0]).clone();
      const im = new THREE.InstancedMesh(geom, mat, oldCapacity);
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.name = `Instanced_${className}_submesh_updated_${i}`;
      im.frustumCulled = false;
      // copy existing matrices where available
      const tmp = new THREE.Matrix4();
      const src = oldMeshes[i] || oldMeshes[0];
      for (let idx = 0; idx < oldCapacity; idx++) {
        try { src.getMatrixAt(idx, tmp); im.setMatrixAt(idx, tmp); } catch (_) { void _; }
      }
      group.parentGroup.add(im);
      newMeshes.push(im);
    }
    // Remove old meshes from scene
    for (const om of oldMeshes) { try { if (om.parent) om.parent.remove(om); } catch (_) { void _; } }
    group.meshes = newMeshes;
    group.prototypeGeometries = geoms.slice();
    group.prototypeMaterials = padded.slice();
    group.matricesNeedUpdate = true;
  }

  // If `state` is provided, allocate will attempt to register a prototype from state.assetPool
  // when none is currently registered for `className` so instanced allocations can use
  // preloaded rasterized assets on-demand.
  allocate(shipId: number, className: string, team?: string, state?: any): boolean {
    if (!this.scene || !this.rootParent) return false;
    let group = this.groups.get(className);
    if (!group) {
      // If we don't have a prototype yet but were given a state with preloaded assets,
      // try to build a prototype from the asset pool before creating the group.
      try {
        if (!this.prototypeRegistry.has(className) && state && state.assetPool) {
          try {
            const svgUrl = getShipSVGUrl(className, defaultSVGConfig as any);
            const asset = state.assetPool.get(svgUrl);
            if (asset && asset.imageBitmap) {
              // Build lightweight geometries/materials similar to meshFactory
              const size = (ShipVisualConfig.ships as any)[className]?.collisionRadius ?? 16;
              const tex = new THREE.Texture(asset.imageBitmap);
              tex.needsUpdate = true;
              tex.generateMipmaps = false;
              tex.minFilter = THREE.LinearFilter;
              tex.magFilter = THREE.LinearFilter;
              const texturedMaterial = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.05, side: THREE.DoubleSide });
              const teamMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1.0, side: THREE.DoubleSide });
              const bodyGeometry = new THREE.CylinderGeometry(size * 0.3, size * 0.4, size * 0.8, 8);
              const noseGeometry = new THREE.ConeGeometry(size * 0.3, size * 0.5, 8);
              const wingGeometry = new THREE.PlaneGeometry(size * 0.6, size * 0.4);
              const sidePanelGeometry = new THREE.PlaneGeometry(size * 0.8, size * 0.3);
              const rearPanelGeometry = new THREE.PlaneGeometry(size * 0.6, size * 0.6);
              const rearFinGeometry = new THREE.PlaneGeometry(size * 0.3, size * 0.2);
              const geoms = [bodyGeometry, noseGeometry, wingGeometry, wingGeometry, sidePanelGeometry, sidePanelGeometry, rearPanelGeometry, rearFinGeometry, rearFinGeometry];
              const mats = [texturedMaterial, teamMaterial, texturedMaterial, texturedMaterial, texturedMaterial, texturedMaterial, texturedMaterial, texturedMaterial, texturedMaterial];
              this.registerPrototype(className, geoms, mats);
            }
          } catch (_e) { void _e; }
        }
      } catch (_e) { void _e; }
      group = this.createGroup(className, team);
      this.groups.set(className, group);
    }
    if (group.idToIndex.has(shipId)) return true;
    if (group.freeIndices.length === 0) this.growGroup(group);
    const idx = group.freeIndices.pop();
    if (idx === undefined) return false;
    group.idToIndex.set(shipId, idx);
    group.indexToId.set(idx, shipId);
  // Reuse a shared identity matrix to avoid allocations
  this.tmpMatrix.identity();
  for (const m of group.meshes) m.setMatrixAt(idx, this.tmpMatrix);
    // initialize tracked position
    group.positions.set(shipId, new THREE.Vector3());
    group.boundsDirty = true;
    group.matricesNeedUpdate = true;
    return true;
  }

  free(shipId: number): boolean {
    for (const group of this.groups.values()) {
      if (group.idToIndex.has(shipId)) {
        const idx = group.idToIndex.get(shipId)!;
        group.idToIndex.delete(shipId);
        group.indexToId.delete(idx);
    group.freeIndices.push(idx);
  // remove tracked position and mark bounds dirty
  group.positions.delete(shipId);
  group.boundsDirty = true;
  // Reuse tmpMatrix for clearing the instance (scale to zero)
  this.tmpMatrix.makeScale(0, 0, 0);
  for (const m of group.meshes) m.setMatrixAt(idx, this.tmpMatrix);
        group.matricesNeedUpdate = true;
        return true;
      }
    }
    return false;
  }

  hasShip(shipId: number): boolean { for (const g of this.groups.values()) if (g.idToIndex.has(shipId)) return true; return false; }

  updateTransform(shipId: number, pos: Float3, quat: THREE.Quaternion, scale: number): boolean {
    for (const g of this.groups.values()) {
      const idx = g.idToIndex.get(shipId);
      if (idx === undefined) continue;
  // Reuse temporary vectors/matrix to avoid allocations
  this.tmpVec.set(pos.x, pos.y, pos.z);
  this.tmpScale.set(scale, scale, scale);
  this.tmpMatrix.compose(this.tmpVec, quat, this.tmpScale);
  for (const mesh of g.meshes) mesh.setMatrixAt(idx, this.tmpMatrix);
      g.matricesNeedUpdate = true;
      // update coarse position and mark bounds dirty
      const tr = g.positions.get(shipId);
      if (tr) { tr.copy(this.tmpVec); g.boundsDirty = true; }
      return true;
    }
    return false;
  }

  // Compute group bounds (simple bounding sphere) when needed
  private computeBounds(group: GroupData) {
    if (!group.boundsDirty) return;
    if (group.positions.size === 0) {
      group.boundsCenter.set(0, 0, 0);
      group.boundsRadius = 0;
      group.boundsDirty = false;
      return;
    }
    // center = average of positions
    group.boundsCenter.set(0, 0, 0);
    let count = 0;
    for (const p of group.positions.values()) { group.boundsCenter.add(p); count++; }
    group.boundsCenter.multiplyScalar(1 / Math.max(1, count));
    let maxR = 0;
    for (const p of group.positions.values()) maxR = Math.max(maxR, p.distanceTo(group.boundsCenter));
    group.boundsRadius = maxR + 5; // padding
    group.boundsDirty = false;
  }

  // Cull groups against camera frustum; toggles group.parentGroup.visible
  cull(camera: THREE.Camera) {
    this.projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.projScreenMatrix);
    for (const group of this.groups.values()) {
      this.computeBounds(group);
      if (group.positions.size === 0) { group.parentGroup.visible = false; continue; }
      this.tmpSphere.center.copy(group.boundsCenter);
      this.tmpSphere.radius = group.boundsRadius;
      group.parentGroup.visible = this.frustum.intersectsSphere(this.tmpSphere);
    }
  }

  markMatricesNeedUpdate() { for (const g of this.groups.values()) g.matricesNeedUpdate = true; }

  sync() { for (const g of this.groups.values()) { if (!g.matricesNeedUpdate) continue; for (const m of g.meshes) m.instanceMatrix.needsUpdate = true; g.matricesNeedUpdate = false; } }

  dispose() {
    for (const g of this.groups.values()) {
      for (const m of g.meshes) {
        try { m.geometry.dispose(); } catch (_) { void _;/* no-op */ }
        try {
          // Dispose material(s) safely without `any` casts
          const mat = m.material as THREE.Material | THREE.Material[] | undefined;
          if (Array.isArray(mat)) {
            for (const mm of mat) {
              try { mm.dispose(); } catch (_) { void _; }
            }
          } else if (mat && typeof (mat as unknown as { dispose?: unknown }).dispose === 'function') {
            try { (mat as THREE.Material).dispose(); } catch (_) { void _; }
          }
        } catch (_) { void _;/* no-op */ }
        try { if (m.parent) m.parent.remove(m); } catch (_) { void _;/* no-op */ }
      }
      try { if (g.parentGroup && g.parentGroup.parent) g.parentGroup.parent.remove(g.parentGroup); } catch (_) { void _;/* no-op */ }
    }
    this.groups.clear();
  }

  getStats() {
    const out: Record<string, { capacity: number; used: number; meshes: number }> = {};
    for (const [k, g] of this.groups.entries()) out[k] = { capacity: g.capacity, used: g.idToIndex.size, meshes: g.meshes.length };
    return { totalGroups: this.groups.size, groups: out };
  }

  private createGroup(className: string, team?: string): GroupData {
    const proto = this.prototypeRegistry.get(className);
    const geoms = proto ? proto.geometries : [this.fallbackGeometry!.clone()];
    const mats = proto ? proto.materials : [this.fallbackMaterial!.clone()];
    const capacity = this.defaultCapacity;
    const parentGroup = new THREE.Group();
    parentGroup.name = `ShipInstancer_${className}_group`;
    if (this.rootParent) this.rootParent.add(parentGroup);
    const meshes = geoms.map((g, i) => {
      const mat = (mats[i] || mats[0]).clone();
      const im = new THREE.InstancedMesh(g, mat, capacity);
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.name = `Instanced_${className}_submesh_${i}`;
      // Instanced meshes don't have correct per-instance frustum culling
      // so disable automatic frustum culling here and handle culling at
      // a higher level if needed.
      im.frustumCulled = false;
      parentGroup.add(im);
      return im;
    });
    const free: number[] = [];
    for (let i = capacity - 1; i >= 0; i--) free.push(i);
    const group: GroupData = {
      className,
      team,
      meshes,
      capacity,
      freeIndices: free,
      idToIndex: new Map(),
      indexToId: new Map(),
      matricesNeedUpdate: false,
      prototypeGeometries: geoms.slice(),
      prototypeMaterials: mats.slice(),
      parentGroup,
      positions: new Map(),
      boundsCenter: new THREE.Vector3(),
      boundsRadius: 0,
      boundsDirty: false,
    };
    // If this is the first created group and the instancer hasn't signaled ready,
    // mark it ready now so consumers relying on createGroup can begin using instanced paths.
    if (!this.isReady) {
      this.isReady = true;
      for (const cb of this.readyCallbacks) {
        try { cb(); } catch (_e) { void _e;/* ignore */ }
      }
      this.readyCallbacks.length = 0;
    }
    return group;
  }

  private growGroup(group: GroupData) {
    const oldCap = group.capacity;
    const newCap = Math.max(Math.ceil(oldCap * this.growthFactor), oldCap + 1);
    const newMeshes: THREE.InstancedMesh[] = [];
    for (let i = 0; i < group.prototypeGeometries.length; i++) {
      const geom = group.prototypeGeometries[i];
      const mat = (group.prototypeMaterials[i] || group.prototypeMaterials[0]).clone();
      const newMesh = new THREE.InstancedMesh(geom, mat, newCap);
      newMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      newMesh.name = `${group.className}_grown_submesh_${i}`;
      newMesh.frustumCulled = true;
      const oldMesh = group.meshes[i];
      const tmp = new THREE.Matrix4();
      for (let idx = 0; idx < oldCap; idx++) { oldMesh.getMatrixAt(idx, tmp); newMesh.setMatrixAt(idx, tmp); }
      group.parentGroup.add(newMesh);
      newMeshes.push(newMesh);
    }
    for (const old of group.meshes) { try { if (old.parent) old.parent.remove(old); } catch (_) { void _;/* no-op */ } }
    group.meshes = newMeshes;
    for (let i = newCap - 1; i >= oldCap; i--) group.freeIndices.push(i);
    group.capacity = newCap;
    group.matricesNeedUpdate = true;
  }
}

const impl = new ShipInstancerImpl();

export const shipInstancer = {
  init: (scene: THREE.Scene, parent: THREE.Group) => impl.init(scene, parent),
  onReady: (cb: () => void) => impl.onReady(cb),
  registerPrototype: (className: string, geometries: THREE.BufferGeometry | THREE.BufferGeometry[], materials?: THREE.Material | THREE.Material[]) => impl.registerPrototype(className, geometries, materials),
  updatePrototype: (className: string, geometries: THREE.BufferGeometry | THREE.BufferGeometry[], materials?: THREE.Material | THREE.Material[]) => impl.updatePrototype(className, geometries, materials),
  allocate: (shipId: number, className: string, team?: string) => impl.allocate(shipId, className, team),
  free: (shipId: number) => impl.free(shipId),
  hasShip: (shipId: number) => impl.hasShip(shipId),
  updateTransform: (shipId: number, pos: { x: number; y: number; z: number }, quat: THREE.Quaternion, scale: number) => impl.updateTransform(shipId, pos, quat, scale),
  markMatricesNeedUpdate: () => impl.markMatricesNeedUpdate(),
  sync: () => impl.sync(),
  cull: (camera: THREE.Camera) => impl.cull(camera),
  dispose: () => impl.dispose(),
  getStats: () => impl.getStats(),
  isReady: () => impl.isReady,
} as const;

