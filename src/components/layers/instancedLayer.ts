import { InstancedBufferAttribute, DynamicDrawUsage, Matrix4, Color } from 'three';
import type { InstancedMesh } from 'three';
import { InstanceAllocator } from './instanceAllocator.js';

export const HIDDEN_MATRIX = new Matrix4().makeScale(0, 0, 0);

export interface InstancedLayerOptions {
  capacity: number;
  supportsInstanceColor?: boolean;
  baseColor?: Color;
}

/**
 * Lightweight manager that encapsulates common instanced-layer boilerplate.
 * - owns an InstanceAllocator
 * - initializes instanced mesh attributes (instanceMatrix, instanceColor)
 * - provides beginFrame / allocate / release / endFrame lifecycle
 */
export class InstancedLayerManager<K> {
  public readonly meshRef: { current: InstancedMesh | null };
  private readonly allocator: InstanceAllocator<K>;
  private readonly capacity: number;
  private readonly supportsInstanceColor: boolean;
  private readonly baseColor?: Color;
  private maxIndex = -1;

  constructor(meshRef: { current: InstancedMesh | null }, options: InstancedLayerOptions) {
    this.meshRef = meshRef;
    this.capacity = Math.max(1, options.capacity);
    this.allocator = new InstanceAllocator<K>(this.capacity);
    this.supportsInstanceColor = !!options.supportsInstanceColor;
    this.baseColor = options.baseColor;
    // Note: mesh initialization is performed lazily when a mesh is attached.
  }

  initMesh(): void {
    const mesh = this.meshRef.current;
    if (!mesh) return;
    mesh.count = 0;
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    mesh.instanceMatrix.needsUpdate = true;
    if (this.supportsInstanceColor && !mesh.instanceColor) {
      mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(this.capacity * 3), 3);
      if (this.baseColor) {
        for (let i = 0; i < this.capacity; i += 1) {
          mesh.setColorAt(i, this.baseColor);
        }
      }
      mesh.instanceColor.needsUpdate = true;
    }
  }

  beginFrame(): void {
    this.allocator.beginFrame();
    this.maxIndex = -1;
  }

  allocate(key: K): number | null {
    return this.allocator.allocate(key);
  }

  release(key: K): number | null {
    const idx = this.allocator.release(key);
    if (idx != null) this.hideIndex(idx);
    return idx;
  }

  setMatrixAt(index: number, matrix: Matrix4): void {
    const mesh = this.meshRef.current;
    if (!mesh) return;
    mesh.setMatrixAt(index, matrix);
    mesh.instanceMatrix.needsUpdate = true;
    if (index > this.maxIndex) this.maxIndex = index;
  }

  setColorAt(index: number, color: Color): void {
    const mesh = this.meshRef.current as (InstancedMesh & { setColorAt?: (i: number, c: Color) => void }) | null;
    if (!mesh || !mesh.instanceColor || typeof mesh.setColorAt !== 'function') return;
    mesh.setColorAt!(index, color);
    mesh.instanceColor.needsUpdate = true;
  }

  private hideIndex(index: number): void {
    const mesh = this.meshRef.current;
    if (!mesh) return;
    mesh.setMatrixAt(index, HIDDEN_MATRIX);
    if (mesh.instanceColor && this.baseColor) {
      mesh.setColorAt(index, this.baseColor);
    }
  }

  endFrame(): { released: number[]; saturated: boolean; count: number } {
    const mesh = this.meshRef.current;
    if (!mesh) return { released: [], saturated: false, count: 0 };

    const summary = this.allocator.endFrame();
    for (const released of summary.released) {
      mesh.setMatrixAt(released, HIDDEN_MATRIX);
      if (mesh.instanceColor && this.baseColor) {
        mesh.setColorAt(released, this.baseColor);
      }
    }

    const maxIndex = Math.max(this.maxIndex, summary.maxIndex);
    const count = maxIndex >= 0 ? Math.min(maxIndex + 1, this.capacity) : 0;
    mesh.count = count;
    mesh.visible = count > 0;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    return { released: summary.released, saturated: summary.saturated, count };
  }

  get capacityValue(): number {
    return this.capacity;
  }

  dispose(): void {
    const mesh = this.meshRef.current;
    if (!mesh) return;
    if (mesh.instanceColor) mesh.instanceColor = null;
  }
}

export function createInstancedLayerManager<K>(
  meshRef: { current: InstancedMesh | null },
  options: InstancedLayerOptions,
): InstancedLayerManager<K> {
  const m = new InstancedLayerManager<K>(meshRef, options);
  // if mesh already attached, initialize now
  m.initMesh();
  return m;
}
