import * as THREE from 'three';

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

  allocate(shipId: number, className: string, team?: string): boolean {
    if (!this.scene || !this.rootParent) return false;
    let group = this.groups.get(className);
    if (!group) {
      group = this.createGroup(className, team);
      this.groups.set(className, group);
    }
    if (group.idToIndex.has(shipId)) return true;
    if (group.freeIndices.length === 0) this.growGroup(group);
    const idx = group.freeIndices.pop();
    if (idx === undefined) return false;
    group.idToIndex.set(shipId, idx);
    group.indexToId.set(idx, shipId);
    const identity = new THREE.Matrix4();
    for (const m of group.meshes) m.setMatrixAt(idx, identity);
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
        const clear = new THREE.Matrix4(); clear.makeScale(0, 0, 0);
        for (const m of group.meshes) m.setMatrixAt(idx, clear);
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
      const m = new THREE.Matrix4();
      m.compose(new THREE.Vector3(pos.x, pos.y, pos.z), quat, new THREE.Vector3(scale, scale, scale));
      for (const mesh of g.meshes) mesh.setMatrixAt(idx, m);
      g.matricesNeedUpdate = true;
      return true;
    }
    return false;
  }

  markMatricesNeedUpdate() { for (const g of this.groups.values()) g.matricesNeedUpdate = true; }

  sync() { for (const g of this.groups.values()) { if (!g.matricesNeedUpdate) continue; for (const m of g.meshes) m.instanceMatrix.needsUpdate = true; g.matricesNeedUpdate = false; } }

  dispose() {
    for (const g of this.groups.values()) {
      for (const m of g.meshes) {
        try { m.geometry.dispose(); } catch (_) { void _;/* no-op */ }
        try { if (Array.isArray(m.material)) (m.material as any).forEach((x: any) => x.dispose()); else (m.material as any).dispose(); } catch (_) { void _;/* no-op */ }
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
      im.frustumCulled = true;
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
  allocate: (shipId: number, className: string, team?: string) => impl.allocate(shipId, className, team),
  free: (shipId: number) => impl.free(shipId),
  hasShip: (shipId: number) => impl.hasShip(shipId),
  updateTransform: (shipId: number, pos: { x: number; y: number; z: number }, quat: THREE.Quaternion, scale: number) => impl.updateTransform(shipId, pos, quat, scale),
  markMatricesNeedUpdate: () => impl.markMatricesNeedUpdate(),
  sync: () => impl.sync(),
  dispose: () => impl.dispose(),
  getStats: () => impl.getStats(),
  isReady: () => impl.isReady,
} as const;

