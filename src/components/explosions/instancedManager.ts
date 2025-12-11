import type { InstancedMesh } from 'three';

import { createInstancedLayerManager } from '../layers/instancedLayer.js';
import type { InstancedLayerManager } from '../layers/types.js';
export interface InstancedMeshRefs {
  flash: InstancedMesh | null;
  shockwave: InstancedMesh | null;
  fireball: InstancedMesh | null;
  debris: InstancedMesh | null;
  sparks: InstancedMesh | null;
  plasma: InstancedMesh | null;
  smoke: InstancedMesh | null;
}

export interface EffectCounts {
  flash: number;
  shockwave: number;
  fireball: number;
  debris: number;
  sparks: number;
  plasma: number;
  smoke: number;
}

export type EffectKey = keyof EffectCounts;

interface PoolState {
  manager: InstancedLayerManager<string> | null;
  capacity: number;
}

interface CommitSummary {
  count: number;
  saturated: boolean;
}

const EFFECT_KEYS: EffectKey[] = [
  'flash',
  'shockwave',
  'fireball',
  'debris',
  'sparks',
  'plasma',
  'smoke',
];

function createZeroedCounts(): EffectCounts {
  return {
    flash: 0,
    shockwave: 0,
    fireball: 0,
    debris: 0,
    sparks: 0,
    plasma: 0,
    smoke: 0,
  };
}

function sanitizeCapacity(value: number | undefined): number {
  if (!Number.isFinite(value) || (value ?? 0) <= 0) {
    return 0;
  }
  return Math.floor(value as number);
}

function markMatrixDirty(mesh: InstancedMesh): void {
  mesh.instanceMatrix.needsUpdate = true;
}

function markColorDirty(mesh: InstancedMesh): void {
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }
}

export class ExplosionsInstancedManager {
  private pools: Record<EffectKey, PoolState>;

  private counts: EffectCounts = createZeroedCounts();

  private saturation: Record<EffectKey, boolean> = {
    flash: false,
    shockwave: false,
    fireball: false,
    debris: false,
    sparks: false,
    plasma: false,
    smoke: false,
  };

  constructor(capacities: Partial<Record<EffectKey, number>>) {
    // Create a lightweight InstancedLayerManager for each effect. We pass a
    // meshRef wrapper (with current initially null) so the manager can be
    // attached later when meshes are available.
    this.pools = EFFECT_KEYS.reduce<Record<EffectKey, PoolState>>(
      (acc, key) => {
        const cap = sanitizeCapacity(capacities[key]);
        // create manager with a null-ref placeholder; it will be initialized
        // lazily when attach() is called and the real mesh refs are provided.
        const placeholderRef = { current: null as InstancedMesh | null };
        const mgr = createInstancedLayerManager(placeholderRef, { capacity: cap });
        acc[key] = { manager: mgr, capacity: cap };
        return acc;
      },
      {} as Record<EffectKey, PoolState>,
    );
  }

  /**
   * Binds the instanced mesh references for the current frame.
   * Returns false if any required mesh is missing.
   */
  attach(refs: InstancedMeshRefs): boolean {
    let ready = true;
    for (const key of EFFECT_KEYS) {
      const mesh = refs[key];
      const pool = this.pools[key];
      if (!pool.manager) continue;
      // bind the real mesh ref to the manager and initialize attributes
      pool.manager.meshRef.current = mesh;
      pool.manager.initMesh();
      ready &&= Boolean(mesh);
    }
    return ready;
  }

  beginFrame(): void {
    this.counts = createZeroedCounts();
    for (const key of EFFECT_KEYS) {
      this.saturation[key] = false;
      const mgr = this.pools[key].manager;
      if (mgr) mgr.beginFrame();
    }
  }

  getEffectManager(key: EffectKey): InstancedLayerManager<string> | null {
    return this.pools[key].manager;
  }

  getCapacity(key: EffectKey): number {
    return this.pools[key].capacity;
  }

  getMesh(key: EffectKey): InstancedMesh {
    const mgr = this.pools[key].manager;
    const mesh = mgr?.meshRef.current ?? null;
    if (!mesh) {
      throw new Error(`Instanced mesh for effect "${key}" is not attached.`);
    }
    return mesh;
  }

  getStartIndex(key: EffectKey): number {
    return this.counts[key];
  }

  commit(key: EffectKey, summary: CommitSummary): void {
    this.counts[key] += summary.count;
    if (summary.saturated) {
      this.saturation[key] = true;
    }
  }

  finalize(): void {
    for (const key of EFFECT_KEYS) {
      const { manager, capacity } = this.pools[key];
      if (!manager) continue;
      const mesh = manager.meshRef.current;
      if (!mesh) continue;
      // finalize the underlying manager and read its summary
      const summary = manager.endFrame();
      // Support legacy commit-based counts: prefer explicit committed counts
      // if present, otherwise fall back to allocator-derived count.
      const committed = this.counts[key] ?? 0;
      const count = Math.min(Math.max(summary.count, committed), capacity);
      mesh.count = count;
      mesh.visible = count > 0;
      markMatrixDirty(mesh);
      markColorDirty(mesh);
      if (summary.saturated) this.saturation[key] = true;
    }
  }

  wasSaturated(key: EffectKey): boolean {
    return this.saturation[key];
  }

  anySaturated(): boolean {
    return EFFECT_KEYS.some((key) => this.saturation[key]);
  }

  snapshotCounts(): EffectCounts {
    return { ...this.counts };
  }
}
