import type { InstancedMesh } from 'three';

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
  mesh: InstancedMesh | null;
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
    this.pools = EFFECT_KEYS.reduce<Record<EffectKey, PoolState>>(
      (acc, key) => {
        acc[key] = { mesh: null, capacity: sanitizeCapacity(capacities[key]) };
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
      this.pools[key].mesh = mesh;
      ready &&= Boolean(mesh);
    }
    return ready;
  }

  beginFrame(): void {
    this.counts = createZeroedCounts();
    for (const key of EFFECT_KEYS) {
      this.saturation[key] = false;
    }
  }

  getCapacity(key: EffectKey): number {
    return this.pools[key].capacity;
  }

  getMesh(key: EffectKey): InstancedMesh {
    const mesh = this.pools[key].mesh;
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
      const { mesh, capacity } = this.pools[key];
      if (!mesh) {
        continue;
      }
      const count = Math.min(this.counts[key], capacity);
      mesh.count = count;
      mesh.visible = count > 0;
      markMatrixDirty(mesh);
      markColorDirty(mesh);
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
