// Canonical pool-related types used across the codebase.
// Keep runtime-free (type-only) so importing this file won't cause circular
// runtime dependencies. Other modules should import these with `import type`.
export type OverflowStrategy = 'discard-oldest' | 'grow' | 'error';

// Standardized pool configuration shared by different pool implementations.
export type PoolConfig = {
  // Maximum number of items allowed in the pool. Undefined means unlimited.
  max?: number;
  // Strategy to apply when the pool would overflow.
  strategy?: OverflowStrategy;
  // Optional minimum reserved size (implementation-defined semantics).
  min?: number;
};

// Disposer may be synchronous or asynchronous depending on the resource (e.g. WebGL
// texture deletion is synchronous, but some pools may perform async cleanup).
export type Disposer<T> = (item: T) => void | Promise<void>;

export type PoolEntry<T> = {
  freeList: T[];
  allocated: number;
  config?: PoolConfig;
  disposer?: Disposer<T>;
};

export type TexturePoolEntry = PoolEntry<WebGLTexture>;

// Keep the module runtime-free: an explicit empty export makes this file a module
// but doesn't introduce a runtime value (unlike `export default {}`).
export {};
