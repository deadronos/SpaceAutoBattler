import Rapier from '@dimforge/rapier3d-compat';

/**
 * Wraps an async initialiser so concurrent and later callers share a single run. A rejected
 * run is forgotten so the next caller can retry.
 */
export function createInitOnce(init: () => Promise<void>): () => Promise<void> {
  let pending: Promise<void> | null = null;
  return () => {
    pending ??= init().catch((error: unknown) => {
      pending = null;
      throw error;
    });
    return pending;
  };
}

/**
 * Initialises the Rapier WASM module exactly once per JS realm.
 *
 * rapier3d-compat's `init()` only records the module's exports after instantiation resolves,
 * so overlapping calls (React StrictMode mounts `GameProvider` twice in dev) instantiate the
 * module twice. The later instance replaces the exports that earlier worlds were created
 * against, and those worlds then fail every step with "recursive use of an object detected"
 * or out-of-bounds memory traps. This shared promise is process-wide WASM state, not game
 * state, so it intentionally lives at module scope.
 */
export const ensureRapierInitialized = createInitOnce(() => Rapier.init());
