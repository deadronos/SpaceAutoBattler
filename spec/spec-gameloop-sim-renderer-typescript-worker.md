
## SpaceAutoBattler — Architecture Draft (TypeScript + Worker-based sim + Renderer)

Status & purpose
----------------
This is an updated, actionable architecture spec that complements `spec/spec-gameloop-sim-renderer.md`. It preserves the TypeScript worker-oriented migration notes and adds the recent implementation details introduced in the codebase:

- A canonical `GameState.assetPool` contract and pooling helpers (textures, sprites, effects).
- Renderer wiring to prefer pooled allocations (with safe fallback to direct allocation).
- Deterministic GL stub used by unit tests to validate create/delete/disposer behavior.

Goals
-----

- Deterministic simulation (seeded RNG) in-worker or on main thread.
- Typed, small message protocol between main ↔ sim-worker.
- Keep snapshots simple (structured-clone) and introduce a transfer-optimized mode later if needed.
- Make pooling and renderer-owned transient resource rules explicit and test-covered.

High-level architecture
-----------------------

- Main thread: UI, input, renderer (Canvas2D or WebGL). Orchestrates the sim worker and consumes snapshots.
- Sim worker: runs `simulateStep(state, dtSeconds, bounds)` deterministically. Owns the RNG seed and canonical simulation state.
- Optional renderer worker: runs WebGL with OffscreenCanvas and may expose `providesOwnLoop` / `isRunning()` semantics.

Core additions since previous draft
----------------------------------

- GameState.assetPool (canonical):
  - `assetPool` is an object with per-kind maps, for example:
    - `textures: Record<string, PoolEntry<Texture>>`
    - `sprites: Record<string, PoolEntry<SpriteInstance>>`
    - `effects: Record<string, PoolEntry<EffectInstance>>`
  - PoolEntry shape (conceptual):
    - `freeList: T[]` — pooled free entries
    - `allocated: number` — currently allocated count
    - `config?: { max?: number; strategy?: 'discard-oldest'|'grow'|'error' }`
    - `disposer?: (item: T) => void` — called when item is trimmed

- PooledFactory and helpers (src/entities.ts):
  - `createPooledFactory<T>(factoryFn, opts?)` returns { acquire(state, key), release(state, key, item) }
  - High-level helpers: `acquireTexture`, `releaseTexture`, `acquireSprite`, `releaseSprite`, `acquireEffect`, `releaseEffect`.

- Renderer wiring:
  - Renderers should call acquire/release helpers when creating transient visuals.
  - When `GameState` is unavailable, renderers fall back to direct creation and must still call the disposer on release.

- Pooling strategies and acceptance criteria:
  - Prevent double-free.
  - Respect `max` and chosen `strategy` (discard-oldest to free space, grow to ignore max, error to surface over-allocation).
  - Invoke `disposer` on trimmed items.

Testing additions (GL stub + pooling)
----------------------------------

- Deterministic GL stub: `test/vitest/utils/glStub.ts` — counts createTexture/deleteTexture and records disposed ids. Use this in unit tests instead of a real GL context.
- New tests to add:
  - `test/vitest/pooling/texture_pool.spec.ts` — assert create/delete counts under high churn and per-key trimming for each strategy.
  - `test/sim.worker.determinism.test.ts` — worker vs in-process determinism comparison (60 steps snapshot equality).
  - `test/vitest/renderer/pool_integration.spec.ts` — ensure WebGLRenderer calls acquireTexture and that disposers run on trimming.

Worker message protocol (summary)
--------------------------------

Keep the same small typed messages (structured-clone friendly): init, start, stop, snapshotRequest, stepRequest, setSeed. When moving to transferables, keep message kinds and change payloads.

Example (main -> worker):

- `{ type: 'init', seed, bounds, state?, simDtMs? }`
- `{ type: 'start' }`, `{ type: 'stop' }`, `{ type: 'stepRequest', maxSteps? }`

Worker -> Main:

- `{ type: 'ready' }`, `{ type: 'snapshot', state }`, `{ type: 'error', message }`

Transfer strategy reminder
-------------------------

- Start with structured clone snapshots. Add `transferOptimized` mode later (typed arrays + transferables) if profiling shows it is necessary.

Determinism & RNG
-----------------

- Sim worker must call `srand(seed)` on `init` and use only seeded RNG helpers (`srange`, `srangeInt`, `srandom`) for any simulation logic.
- Renderer cosmetic randomness is permitted but should not affect the authoritative sim state.

Renderer ownership & safety rules
--------------------------------

- Renderer-owned transient GPU resources (textures, sprite instances, effect instances) should be allocated via `GameState.assetPool` helpers when `GameState` is present.
- Renderers must:
  - Acquire from pool when creating transient visuals and call release when finished.
  - Rehydrate pooled items on acquire (reset state to known initial values).
  - Never double-release an item.
  - Fall back to safe direct allocation when `GameState` is absent (e.g., during early init or in some test harnesses) and still honor the disposer contract.

Migration and TypeScript notes
-----------------------------

- Keep `allowJs` in `tsconfig.json` during migration. New files (entry points and tests) should be TypeScript-first.
- `src/main.ts` and `src/simWorker.ts` act as typed entrypoints that may delegate to existing JS modules while tests are updated.

Files to create / update (concrete)
----------------------------------

- `src/simWorker.ts` — typed worker entry (wire simulateStep + RNG + snapshot posting).
- `src/entities.ts` — pooled factory helpers (already added; validate API surface).
- `src/webglrenderer.ts` — ensure it calls `acquireTexture`/`releaseTexture` when `GameState` present and falls back safely.
- `test/vitest/utils/glStub.ts` — deterministic GL stub (already present; use it in new tests).
- `test/vitest/pooling/texture_pool.spec.ts` — new pooling unit tests.
- `test/sim.worker.determinism.test.ts` — worker determinism integration test.

Next steps (short)
------------------

1. Add targeted unit tests for pooling strategies (discard-oldest, grow, error) using the GL stub.
2. Add the worker determinism integration test comparing 60-step snapshots.
3. Run `npx tsc --noEmit` and the Vitest suite; fix any issues exposed by the tests.

Acceptance criteria (for the changes described above)
---------------------------------------------------

- Pooling API is present and used by renderers with safe fallback.
- Deterministic simulateStep behavior is preserved when running in-worker or in-process given the same seed.
- Unit tests for pooling and worker determinism pass locally.

---

End of TypeScript + worker oriented spec.
