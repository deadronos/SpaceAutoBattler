import type { InstancedMesh, Matrix4, Color } from 'three';

/**
 * Minimal interface describing the parts of InstancedLayerManager used by
 * renderers and effect updaters. Placing this in a tiny neutral module
 * prevents cyclic type imports and keeps runtime imports (class/factory)
 * separate from the shape used for typing.
 */
export interface IInstancedLayerManager<K> {
  readonly meshRef: { current: InstancedMesh | null };
  beginFrame(): void;
  allocate(key: K): number | null;
  release(key: K): number | null;
  setMatrixAt(index: number, matrix: Matrix4): void;
  setColorAt(index: number, color: Color): void;
  endFrame(): { released: number[]; saturated: boolean; count: number };
  initMesh(): void;
  dispose(): void;
  get capacityValue(): number;
}

// Export a friendly alias named `InstancedLayerManager` so existing type
// references across the codebase can be updated with minimal churn.
export type InstancedLayerManager<K> = IInstancedLayerManager<K>;
