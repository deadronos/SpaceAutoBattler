// Canonical pool-related types used across the codebase.
// Keep runtime-free (type-only) so importing this file won't cause circular
// runtime dependencies. Other modules should import these with `import type`.
export type OverflowStrategy = 'discard-oldest' | 'grow' | 'error';

export type PoolEntry<T> = {
  freeList: T[];
  allocated: number;
  config?: { max?: number; strategy?: OverflowStrategy };
  disposer?: (item: T) => void;
};

export type TexturePoolEntry = PoolEntry<WebGLTexture>;

export default {};
