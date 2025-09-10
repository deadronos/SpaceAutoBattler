import * as THREE from 'three';
import * as logger from '../utils/logger.js';
import { defaultSVGConfig, getShipSVGUrl } from '../config/svgConfig.js';
import { ShipVisualConfig } from '../config/shipVisualConfig.js';
import type { GameState } from '../types/index.js';

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
  // Helper to create a stable map key for class+team grouping
  private makeGroupKey(className: string, team?: string) {
    return `${className}_${team ?? 'neutral'}`;
  }
  private defaultCapacity = 64;
  private growthFactor = 1.5;
  private fallbackGeometry?: THREE.BufferGeometry;
  private fallbackMaterial?: THREE.MeshStandardMaterial;

  private prototypeRegistry = new Map<
    string,
    { geometries: THREE.BufferGeometry[]; materials: THREE.Material[] }
  >();
  // Expose prototype metadata in a read-only shape for tests and debugging
  getPrototypeMetadata(className: string) {
    const entry = this.prototypeRegistry.get(className);
    if (!entry) return null;
    return { geometries: entry.geometries.map((g) => g), materials: entry.materials.map((m) => m) };
  }
  /**
   * Return a richer, serializable view of a registered prototype useful for tests:
   * - per-submesh geometry vertex counts and attribute names
   * - per-submesh material type, name, uuid
   */
  getPrototypeInfo(className: string) {
    const entry = this.prototypeRegistry.get(className);
    if (!entry) return null;
    try {
      const subs = entry.geometries.map((geom, i) => {
        const attrNames: string[] = [];
        try {
          const attrs = (geom as unknown as { attributes?: Record<string, unknown> }).attributes;
          if (attrs) for (const k of Object.keys(attrs)) attrNames.push(k);
        } catch (_e) {
          void _e;
        }
        const vertexCount = (() => {
          try {
            const posAttr = (geom as unknown as { attributes?: { position?: { count?: number } } })
              .attributes?.position;
            if (posAttr && typeof posAttr.count === 'number') return posAttr.count;
          } catch (_e) {
            void _e;
          }
          return -1;
        })();
        const mat = entry.materials[i] ?? entry.materials[0];
        const matInfo = mat
          ? {
              type: (mat as unknown as { type?: string }).type ?? 'Material',
              name: (mat as unknown as { name?: string }).name ?? '',
              uuid: (mat as unknown as { uuid?: string }).uuid ?? '',
            }
          : null;
        return { vertexCount, attributes: attrNames, material: matInfo };
      });
      return { className, submeshes: subs };
    } catch (_e) {
      void _e;
      return null;
    }
  }
  /**
   * List all registered prototype class names
   */
  listPrototypes() {
    return Array.from(this.prototypeRegistry.keys());
  }
  // NOTE: Three.js already supports an InstancedMesh "instanceColor" attribute.
  // If material.vertexColors is true and an InstancedBufferAttribute named
  // "instanceColor" exists, core shader chunks add the attribute & varying and
  // multiply it into the final color (via USE_INSTANCING_COLOR). Our earlier
  // manual shader injection caused duplicate declarations -> redefinition
  // errors. We now simply ensure vertexColors is enabled; no custom patching.
  private applyInstanceColorPatch(mat: THREE.Material) {
    try {
      // For materials that support vertex colors, enable vertexColors so
      // the built-in instancing color path (USE_INSTANCING_COLOR) is active.
      const m = mat as unknown as { vertexColors?: boolean; needsUpdate?: boolean };
      if (typeof m.vertexColors === 'undefined' || m.vertexColors === false) m.vertexColors = true;
      m.needsUpdate = true;
    } catch (_e) {
      void _e;
    }
  }
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
    console.log(`ShipInstancer.init called with scene: ${!!scene}, parent: ${!!parent}`);
    this.scene = scene;
    this.rootParent = parent;
    console.log(`After init: this.rootParent = ${!!this.rootParent}`);

    // Add any existing groups that were created before init() was called
    let addedGroups = 0;
    for (const group of this.groups.values()) {
      if (!group.parentGroup.parent) {
        this.rootParent.add(group.parentGroup);
        addedGroups++;
        console.log(`Added existing group ${group.parentGroup.name} to scene`);
        console.log(
          `After adding: ${group.parentGroup.name} parent is now ${!!group.parentGroup.parent}`,
        );
      }
    }
    if (addedGroups > 0) {
      console.log(`Added ${addedGroups} existing groups to scene after init`);
    }

    if (!this.fallbackGeometry) this.fallbackGeometry = new THREE.ConeGeometry(0.4, 1.4, 6);
    if (!this.fallbackMaterial)
      this.fallbackMaterial = new THREE.MeshStandardMaterial({ color: 0x8888ff });
  }

  onReady(cb: () => void): void {
    if (this.isReady) {
      try {
        cb();
      } catch (_) {
        void _; /* no-op */
      }
      return;
    }
    this.readyCallbacks.push(cb);
  }

  registerPrototype(
    className: string,
    geometries: THREE.BufferGeometry | THREE.BufferGeometry[],
    materials?: THREE.Material | THREE.Material[],
  ) {
    const geoms = Array.isArray(geometries) ? geometries : [geometries];
    const mats = materials
      ? Array.isArray(materials)
        ? materials
        : [materials]
      : geoms.map(() => this.fallbackMaterial!.clone());
    const padded =
      mats.length < geoms.length
        ? [...mats, ...Array(geoms.length - mats.length).fill(mats[mats.length - 1].clone())]
        : mats.slice(0, geoms.length);
    this.prototypeRegistry.set(className, { geometries: geoms, materials: padded });
    // If init() has already been called and this is the first prototype,
    // mark the instancer as ready so consumers can switch to instanced paths.
    if (!this.isReady && this.rootParent) {
      this.isReady = true;
      for (const cb of this.readyCallbacks) {
        try {
          cb();
        } catch (_e) {
          void _e; /* ignore callback errors */
        }
      }
      this.readyCallbacks.length = 0;
    }
  }

  /**
   * Update an already-registered prototype (or register if missing) and
   * update any existing groups to use the new prototype geometries/materials.
   */
  updatePrototype(
    className: string,
    geometries: THREE.BufferGeometry | THREE.BufferGeometry[],
    materials?: THREE.Material | THREE.Material[],
  ) {
    const geoms = Array.isArray(geometries) ? geometries : [geometries];
    const mats = materials
      ? Array.isArray(materials)
        ? materials
        : [materials]
      : geoms.map(() => this.fallbackMaterial!.clone());
    const padded =
      mats.length < geoms.length
        ? [...mats, ...Array(geoms.length - mats.length).fill(mats[mats.length - 1].clone())]
        : mats.slice(0, geoms.length);
    this.prototypeRegistry.set(className, { geometries: geoms, materials: padded });
    // If groups exist for this class (possibly per-team), replace their meshes
    // so future instance allocations and existing instances use the new geometry/material.
    const groupsToUpdate = Array.from(this.groups.values()).filter(
      (g) => g.className === className,
    );
    if (groupsToUpdate.length === 0) return;
    for (const group of groupsToUpdate) {
      // Capture old usages
      const oldMeshes = group.meshes.slice();
      const oldCapacity = group.capacity;
      // Build new instanced meshes with the same capacity and copy existing matrices
      const newMeshes: THREE.InstancedMesh[] = [];
      for (let i = 0; i < geoms.length; i++) {
        const geom = geoms[i];
        const mat = (padded[i] || padded[0]).clone();
        this.applyInstanceColorPatch(mat);
        try {
          (mat as unknown as { needsUpdate?: boolean }).needsUpdate = true;
        } catch (_e) {
          void _e;
        }
        const im = new THREE.InstancedMesh(geom, mat, oldCapacity);
        im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        im.name = `Instanced_${group.className}_${group.team ?? 'neutral'}_submesh_updated_${i}`;
        im.frustumCulled = false;
        // copy existing matrices where available
        const tmp = new THREE.Matrix4();
        const src = oldMeshes[i] || oldMeshes[0];
        for (let idx = 0; idx < oldCapacity; idx++) {
          try {
            src.getMatrixAt(idx, tmp);
            im.setMatrixAt(idx, tmp);
          } catch (_) {
            void _;
          }
        }
        // copy instanceColor attribute if present on source
        try {
          const srcAttr = (src as unknown as { instanceColor?: THREE.InstancedBufferAttribute })
            .instanceColor as THREE.InstancedBufferAttribute | undefined;
          if (srcAttr && srcAttr.array) {
            const newArr = new Float32Array(oldCapacity * 3);
            newArr.set(
              srcAttr.array instanceof Float32Array
                ? srcAttr.array
                : new Float32Array(srcAttr.array),
            );
            const newAttr = new THREE.InstancedBufferAttribute(newArr, 3, false);
            im.geometry.setAttribute('instanceColor', newAttr);
            (im as unknown as { instanceColor?: THREE.InstancedBufferAttribute }).instanceColor =
              newAttr;
          } else {
            // initialize white
            const arr = new Float32Array(oldCapacity * 3);
            for (let c = 0; c < oldCapacity; c++) {
              arr[c * 3 + 0] = 1;
              arr[c * 3 + 1] = 1;
              arr[c * 3 + 2] = 1;
            }
            const newAttr = new THREE.InstancedBufferAttribute(arr, 3, false);
            im.geometry.setAttribute('instanceColor', newAttr);
            (im as unknown as { instanceColor?: THREE.InstancedBufferAttribute }).instanceColor =
              newAttr;
          }
        } catch (_e) {
          void _e;
        }
        group.parentGroup.add(im);
        newMeshes.push(im);
      }
      // Remove old meshes from scene
      for (const om of oldMeshes) {
        try {
          if (om.parent) om.parent.remove(om);
        } catch (_) {
          void _;
        }
      }
      group.meshes = newMeshes;
      group.prototypeGeometries = geoms.slice();
      group.prototypeMaterials = padded.slice();
      group.matricesNeedUpdate = true;
    }
  }

  // If `state` is provided, allocate will attempt to register a prototype from state.assetPool
  // when none is currently registered for `className` so instanced allocations can use
  // preloaded rasterized assets on-demand.
  allocate(shipId: number, className: string, team?: string, state?: GameState): boolean {
    if (!this.scene || !this.rootParent) return false;
    const key = this.makeGroupKey(className, team);
    let group = this.groups.get(key);
    if (!group) {
      // If we don't have a prototype yet but were given a state with preloaded assets,
      // try to build a prototype from the asset pool before creating the group.
      try {
        if (!this.prototypeRegistry.has(className) && state && state.assetPool) {
          try {
            // Prefer glTF prototype if present in the asset pool
            const gltfKeyTeam = `ship-${className}-${team}`;
            const gltfKey = `ship-${className}`;
            const gltfProto = state.assetPool.get(gltfKeyTeam) ?? state.assetPool.get(gltfKey);
            if (gltfProto && typeof gltfProto === 'object') {
              try {
                // If the loader extracted threePrototypes (geometries/materials), use them directly.
                const tp = (
                  gltfProto as unknown as {
                    threePrototypes?: { geometries?: unknown[]; materials?: unknown[] };
                  }
                ).threePrototypes;

                if (
                  tp &&
                  Array.isArray(tp.geometries) &&
                  Array.isArray(tp.materials) &&
                  tp.geometries.length > 0
                ) {
                  // Clone to avoid shared mutable state; use unknown guards to satisfy linter
                  const clonedGeoms = tp.geometries.map((g: unknown) => {
                    try {
                      const c = g as unknown as { clone?: (...args: unknown[]) => unknown };
                      if (g && typeof c.clone === 'function') return c.clone();
                    } catch (_e) {
                      void _e;
                    }
                    return g as unknown;
                  });
                  const clonedMats = tp.materials.map((m: unknown) => {
                    try {
                      const c = m as unknown as { clone?: (...args: unknown[]) => unknown };
                      if (m && typeof c.clone === 'function') return c.clone();
                    } catch (_e) {
                      void _e;
                    }
                    return m as unknown;
                  });
                  this.registerPrototype(
                    className,
                    clonedGeoms as unknown as THREE.BufferGeometry[],
                    clonedMats as unknown as THREE.Material[],
                  );
                } else if ('gltf' in Object(gltfProto)) {
                  // No pre-extracted prototypes but we have a raw glTF; fall back to a lightweight marker geometry so allocation can proceed.
                  const size =
                    (
                      ShipVisualConfig.ships as Partial<Record<string, { collisionRadius: number }>>
                    )[className]?.collisionRadius ?? 16;
                  const bodyGeometry = new THREE.CylinderGeometry(
                    size * 0.3,
                    size * 0.4,
                    size * 0.8,
                    8,
                  );
                  const mat = new THREE.MeshStandardMaterial({ color: 0x9999ff });
                  this.registerPrototype(className, [bodyGeometry], [mat]);
                }
              } catch (_e) {
                void _e; /* ignore errors and continue with other fallback paths */
              }
            } else {
              // No glTF proto; fallback to existing SVG rasterization path if available
              const svgUrl = getShipSVGUrl(className, defaultSVGConfig);
              const asset = state.assetPool.get(svgUrl) as
                | { imageBitmap?: ImageBitmap }
                | undefined;
              if (asset && asset.imageBitmap) {
                // Build lightweight geometries/materials similar to meshFactory
                const size =
                  (ShipVisualConfig.ships as Partial<Record<string, { collisionRadius: number }>>)[
                    className
                  ]?.collisionRadius ?? 16;
                const tex = new THREE.Texture(asset.imageBitmap);
                tex.needsUpdate = true;
                tex.generateMipmaps = false;
                tex.minFilter = THREE.LinearFilter;
                tex.magFilter = THREE.LinearFilter;
                const texturedMaterial = new THREE.MeshBasicMaterial({
                  map: tex,
                  transparent: true,
                  alphaTest: 0.05,
                  side: THREE.DoubleSide,
                });
                const teamMaterial = new THREE.MeshBasicMaterial({
                  color: 0xffffff,
                  transparent: true,
                  opacity: 1.0,
                  side: THREE.DoubleSide,
                });
                const bodyGeometry = new THREE.CylinderGeometry(
                  size * 0.3,
                  size * 0.4,
                  size * 0.8,
                  8,
                );
                const noseGeometry = new THREE.ConeGeometry(size * 0.3, size * 0.5, 8);
                const wingGeometry = new THREE.PlaneGeometry(size * 0.6, size * 0.4);
                const sidePanelGeometry = new THREE.PlaneGeometry(size * 0.8, size * 0.3);
                const rearPanelGeometry = new THREE.PlaneGeometry(size * 0.6, size * 0.6);
                const rearFinGeometry = new THREE.PlaneGeometry(size * 0.3, size * 0.2);
                const geoms = [
                  bodyGeometry,
                  noseGeometry,
                  wingGeometry,
                  wingGeometry,
                  sidePanelGeometry,
                  sidePanelGeometry,
                  rearPanelGeometry,
                  rearFinGeometry,
                  rearFinGeometry,
                ];
                const mats = [
                  texturedMaterial,
                  teamMaterial,
                  texturedMaterial,
                  texturedMaterial,
                  texturedMaterial,
                  texturedMaterial,
                  texturedMaterial,
                  texturedMaterial,
                  texturedMaterial,
                ];
                this.registerPrototype(className, geoms, mats);
              }
            }
          } catch (_e) {
            void _e;
          }
        }
      } catch (_e) {
        void _e;
      }
      group = this.createGroup(className, team);
      this.groups.set(key, group);
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
    // Write per-instance team color into instanceColor attribute if available
    try {
      const hex =
        team === 'red' ? defaultSVGConfig.teamColors.red : defaultSVGConfig.teamColors.blue;
      // convert '#rrggbb' to normalized floats
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      for (const mesh of group.meshes) {
        const instAttr = (mesh as unknown as { instanceColor?: THREE.InstancedBufferAttribute })
          .instanceColor;
        if (instAttr && instAttr.array && instAttr.count > idx) {
          const arr = instAttr.array as Float32Array;
          arr[idx * 3 + 0] = r;
          arr[idx * 3 + 1] = g;
          arr[idx * 3 + 2] = b;
          instAttr.needsUpdate = true;
        }
      }
    } catch (_e) {
      void _e;
    }
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

  hasShip(shipId: number): boolean {
    for (const g of this.groups.values()) if (g.idToIndex.has(shipId)) return true;
    return false;
  }

  updateTransform(shipId: number, pos: Float3, quat: THREE.Quaternion, scale: number): boolean {
    for (const g of this.groups.values()) {
      const idx = g.idToIndex.get(shipId);
      if (idx === undefined) continue;
      // Reuse temporary vectors/matrix to avoid allocations
      // Defensive: check for non-finite transform inputs and log offending id
      if (
        !pos ||
        !Number.isFinite(pos.x) ||
        !Number.isFinite(pos.y) ||
        !Number.isFinite(pos.z) ||
        !Number.isFinite(quat.x) ||
        !Number.isFinite(quat.y) ||
        !Number.isFinite(quat.z) ||
        !Number.isFinite(quat.w) ||
        !Number.isFinite(scale)
      ) {
        try {
          logger.error('[INSTANCER_ERROR][ShipInstancer] non-finite transform', {
            shipId,
            pos,
            quat,
            scale,
          });
        } catch (_e) {
          void _e;
        }
        return false;
      }

      this.tmpVec.set(pos.x, pos.y, pos.z);
      this.tmpScale.set(scale, scale, scale);
      this.tmpMatrix.compose(this.tmpVec, quat, this.tmpScale);
      for (const mesh of g.meshes) mesh.setMatrixAt(idx, this.tmpMatrix);
      g.matricesNeedUpdate = true;
      // update coarse position and mark bounds dirty
      const tr = g.positions.get(shipId);
      if (tr) {
        tr.copy(this.tmpVec);
        g.boundsDirty = true;
      }
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
    for (const p of group.positions.values()) {
      group.boundsCenter.add(p);
      count++;
    }
    group.boundsCenter.multiplyScalar(1 / Math.max(1, count));
    let maxR = 0;
    for (const p of group.positions.values())
      maxR = Math.max(maxR, p.distanceTo(group.boundsCenter));
    group.boundsRadius = maxR + 5; // padding
    group.boundsDirty = false;
  }

  // Cull groups against camera frustum; toggles group.parentGroup.visible
  cull(camera: THREE.Camera) {
    this.projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.projScreenMatrix);

    for (const group of this.groups.values()) {
      this.computeBounds(group);

      // If group has no ships, make it invisible
      if (group.positions.size === 0) {
        group.parentGroup.visible = false;
        continue;
      }

      // If group has ships, we need to make it visible
      // The original logic was too aggressive with frustum culling
      // For now, make all groups with ships visible to fix the visibility issue
      // TODO: Implement proper frustum culling that doesn't hide ships in view
      group.parentGroup.visible = true;

      // Original frustum culling code (temporarily disabled):
      // this.tmpSphere.center.copy(group.boundsCenter);
      // this.tmpSphere.radius = group.boundsRadius;
      // group.parentGroup.visible = this.frustum.intersectsSphere(this.tmpSphere);
    }
  }

  markMatricesNeedUpdate() {
    for (const g of this.groups.values()) g.matricesNeedUpdate = true;
  }

  sync() {
    for (const g of this.groups.values()) {
      if (!g.matricesNeedUpdate) continue;
      for (const m of g.meshes) m.instanceMatrix.needsUpdate = true;
      g.matricesNeedUpdate = false;
    }
  }

  // Debug helper: dump a sample instance matrix & material info for first active instance of each group
  debugDumpSample() {
    try {
      const debugEnabled = (globalThis as unknown as { DEBUG_SHIP_INSTANCER?: boolean })
        .DEBUG_SHIP_INSTANCER;
      if (!debugEnabled) return;
      for (const [key, g] of (
        this as unknown as { groups: Map<string, GroupData> }
      ).groups.entries()) {
        if (g.idToIndex.size === 0) continue;
        const firstId = g.idToIndex.values().next().value as number | undefined;
        if (firstId === undefined) continue;
        const idx = g.idToIndex.get(firstId);
        if (idx === undefined) continue;
        const mesh = g.meshes[0];
        const mat = mesh.material as THREE.Material;
        const m4 = new THREE.Matrix4();
        try {
          mesh.getMatrixAt(idx, m4);
        } catch (_e) {
          void _e;
        }
        const pos = new THREE.Vector3();
        const q = new THREE.Quaternion();
        const s = new THREE.Vector3();
        m4.decompose(pos, q, s);
        console.info(
          `[INST_DEBUG] Sample group=${key} firstShipId=${firstId} idx=${idx} pos=(${pos.x.toFixed(2)},${pos.y.toFixed(2)},${pos.z.toFixed(2)}) scale=${s.x.toFixed(2)} visPG=${g.parentGroup.visible} matType=${mat.type} op=${(mat as unknown as { opacity?: number }).opacity}`,
        );
      }
    } catch (_e) {
      void _e;
    }
  }

  dispose() {
    for (const g of this.groups.values()) {
      for (const m of g.meshes) {
        try {
          m.geometry.dispose();
        } catch (_) {
          void _; /* no-op */
        }
        try {
          // Dispose material(s) safely without `any` casts
          const mat = m.material as THREE.Material | THREE.Material[] | undefined;
          if (Array.isArray(mat)) {
            for (const mm of mat) {
              try {
                mm.dispose();
              } catch (_) {
                void _;
              }
            }
          } else if (
            mat &&
            typeof (mat as unknown as { dispose?: unknown }).dispose === 'function'
          ) {
            try {
              (mat as THREE.Material).dispose();
            } catch (_) {
              void _;
            }
          }
        } catch (_) {
          void _; /* no-op */
        }
        try {
          if (m.parent) m.parent.remove(m);
        } catch (_) {
          void _; /* no-op */
        }
      }
      try {
        if (g.parentGroup && g.parentGroup.parent) g.parentGroup.parent.remove(g.parentGroup);
      } catch (_) {
        void _; /* no-op */
      }
    }
    this.groups.clear();
  }

  getStats() {
    const out: Record<string, { capacity: number; used: number; meshes: number }> = {};
    for (const [k, g] of this.groups.entries())
      out[k] = { capacity: g.capacity, used: g.idToIndex.size, meshes: g.meshes.length };
    return { totalGroups: this.groups.size, groups: out };
  }

  private createGroup(className: string, team?: string): GroupData {
    const proto = this.prototypeRegistry.get(className);
    const geoms = proto ? proto.geometries : [this.fallbackGeometry!.clone()];
    const mats = proto ? proto.materials : [this.fallbackMaterial!.clone()];
    const capacity = this.defaultCapacity;
    const parentGroup = new THREE.Group();
    parentGroup.name = `ShipInstancer_${className}_${team ?? 'neutral'}_group`;
    // Prevent prototype parent groups from being visible by default. Prototypes
    // are used only as templates for instanced meshes; leaving them visible
    // during initialization can create stray visible artifacts (health-bar-like)
    // at the world origin/bounds. Hide by default; culling/visibility will be
    // driven later when instances are allocated and group.positions is non-empty.
    parentGroup.visible = false;
    // Note: removed diagnostic probe tags from prototype parent group
    if (this.rootParent) this.rootParent.add(parentGroup);
    const meshes = geoms.map((g, i) => {
      const mat = (mats[i] || mats[0]).clone();
      this.applyInstanceColorPatch(mat);
      try {
        (mat as unknown as { needsUpdate?: boolean }).needsUpdate = true;
      } catch (_e) {
        void _e;
      }
      const im = new THREE.InstancedMesh(g, mat, capacity);
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.name = `Instanced_${className}_${team ?? 'neutral'}_submesh_${i}`;
      // Create a default per-instance color attribute so downstream tools
      // and shaders that expect vertex colors or instanceColor won't see null.
      try {
        const colorArray = new Float32Array(capacity * 3);
        for (let c = 0; c < capacity; c++) {
          colorArray[c * 3 + 0] = 1;
          colorArray[c * 3 + 1] = 1;
          colorArray[c * 3 + 2] = 1;
        }
        const instColorAttr = new THREE.InstancedBufferAttribute(colorArray, 3, false);
        im.geometry.setAttribute('instanceColor', instColorAttr);
        (im as unknown as { instanceColor?: THREE.InstancedBufferAttribute }).instanceColor =
          instColorAttr;
      } catch (_e) {
        void _e;
      }
      // instanced mesh created
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
        try {
          cb();
        } catch (_e) {
          void _e; /* ignore */
        }
      }
      this.readyCallbacks.length = 0;
    }
    // If debug flag set, emit group summary after creation (must be inside method before returning)
    try {
      const debugEnabled = (globalThis as unknown as { DEBUG_SHIP_INSTANCER?: boolean })
        .DEBUG_SHIP_INSTANCER;
      if (debugEnabled)
        console.info(
          `[INST_DEBUG] Created group class=${className} team=${team} meshes=${meshes.length} capacity=${capacity}`,
        );
    } catch (_e) {
      void _e;
    }
    return group;
  }

  /**
   * Ensure a group exists for className/team. Creates an empty group if missing.
   */
  ensureGroup(className: string, team?: string) {
    const key = this.makeGroupKey(className, team);
    if (this.groups.has(key)) return this.groups.get(key)!;
    const g = this.createGroup(className, team);
    this.groups.set(key, g);
    return g;
  }

  private growGroup(group: GroupData) {
    const oldCap = group.capacity;
    const newCap = Math.max(Math.ceil(oldCap * this.growthFactor), oldCap + 1);
    const newMeshes: THREE.InstancedMesh[] = [];
    for (let i = 0; i < group.prototypeGeometries.length; i++) {
      const geom = group.prototypeGeometries[i];
      const mat = (group.prototypeMaterials[i] || group.prototypeMaterials[0]).clone();
      this.applyInstanceColorPatch(mat);
      try {
        (mat as unknown as { needsUpdate?: boolean }).needsUpdate = true;
      } catch (_e) {
        void _e;
      }
      const newMesh = new THREE.InstancedMesh(geom, mat, newCap);
      // Preserve or initialize instanceColor attribute
      const oldMesh = group.meshes[i];
      try {
        const oldAttr = (oldMesh as unknown as { instanceColor?: THREE.InstancedBufferAttribute })
          .instanceColor as THREE.InstancedBufferAttribute | undefined;
        if (oldAttr && oldAttr.array) {
          const newArr = new Float32Array(newCap * 3);
          newArr.set(
            oldAttr.array instanceof Float32Array ? oldAttr.array : new Float32Array(oldAttr.array),
          );
          for (let c = oldAttr.count; c < newCap; c++) {
            newArr[c * 3 + 0] = 1;
            newArr[c * 3 + 1] = 1;
            newArr[c * 3 + 2] = 1;
          }
          const newAttr = new THREE.InstancedBufferAttribute(newArr, 3, false);
          newMesh.geometry.setAttribute('instanceColor', newAttr);
          (newMesh as unknown as { instanceColor?: THREE.InstancedBufferAttribute }).instanceColor =
            newAttr;
          try {
            (newAttr as unknown as { needsUpdate?: boolean }).needsUpdate = true;
          } catch (_e) {
            void _e;
          }
        } else {
          const arr = new Float32Array(newCap * 3);
          for (let c = 0; c < newCap; c++) {
            arr[c * 3 + 0] = 1;
            arr[c * 3 + 1] = 1;
            arr[c * 3 + 2] = 1;
          }
          const newAttr = new THREE.InstancedBufferAttribute(arr, 3, false);
          newMesh.geometry.setAttribute('instanceColor', newAttr);
          (newMesh as unknown as { instanceColor?: THREE.InstancedBufferAttribute }).instanceColor =
            newAttr;
          try {
            (newAttr as unknown as { needsUpdate?: boolean }).needsUpdate = true;
          } catch (_e) {
            void _e;
          }
        }
      } catch (_e) {
        void _e;
      }
      newMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      newMesh.name = `${group.className}_grown_submesh_${i}`;
      newMesh.frustumCulled = true;
      const tmp = new THREE.Matrix4();
      for (let idx = 0; idx < oldCap; idx++) {
        oldMesh.getMatrixAt(idx, tmp);
        newMesh.setMatrixAt(idx, tmp);
      }
      group.parentGroup.add(newMesh);
      newMeshes.push(newMesh);
    }
    for (const old of group.meshes) {
      try {
        if (old.parent) old.parent.remove(old);
      } catch (_) {
        void _; /* no-op */
      }
    }
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
  registerPrototype: (
    className: string,
    geometries: THREE.BufferGeometry | THREE.BufferGeometry[],
    materials?: THREE.Material | THREE.Material[],
  ) => impl.registerPrototype(className, geometries, materials),
  updatePrototype: (
    className: string,
    geometries: THREE.BufferGeometry | THREE.BufferGeometry[],
    materials?: THREE.Material | THREE.Material[],
  ) => impl.updatePrototype(className, geometries, materials),
  ensureGroup: (className: string, team?: string) => impl.ensureGroup(className, team),
  allocate: (shipId: number, className: string, team?: string, state?: GameState) =>
    impl.allocate(shipId, className, team, state),
  free: (shipId: number) => impl.free(shipId),
  hasShip: (shipId: number) => impl.hasShip(shipId),
  updateTransform: (
    shipId: number,
    pos: { x: number; y: number; z: number },
    quat: THREE.Quaternion,
    scale: number,
  ) => impl.updateTransform(shipId, pos, quat, scale),
  markMatricesNeedUpdate: () => impl.markMatricesNeedUpdate(),
  sync: () => impl.sync(),
  cull: (camera: THREE.Camera) => impl.cull(camera),
  dispose: () => impl.dispose(),
  getStats: () => impl.getStats(),
  // Test helper: read-only view of prototype metadata
  getPrototypeMetadata: (className: string) => impl.getPrototypeMetadata(className),
  // Richer inspection helpers for tests
  getPrototypeInfo: (className: string) => impl.getPrototypeInfo(className),
  listPrototypes: () => impl.listPrototypes(),
  isReady: () => impl.isReady,
  // Debug helpers
  debugDumpSample: () => (impl as unknown as { debugDumpSample?: () => void }).debugDumpSample?.(),
} as const;
