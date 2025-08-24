# Asset Pooling: status, gaps, and immediate plan

Summary
-------
This note replaces and tightens the previous draft. It records what we implemented, what remains, and the smallest, highest-value change to land next. Work already done: canonical GameState alignment, a small PooledFactory API and helpers, canvas-renderer wiring for renderer-owned transient visuals, and factory-level edge-case tests. The main outstanding risk is missing per-key pool bookkeeping and disposer semantics for GPU assets (textures) plus WebGL-instrumented tests to validate create/delete behavior.

Current status (short)
----------------------
- Type alignment (canonical GameState): Done — code imports the centralized `GameState` type.
- Pooled factory helpers: Done — `PooledFactory<T>`, `createPooledFactory` and helpers live in `src/entities.ts` with unit tests.
- Canvas renderer wiring: Done (renderer-owned effects) — `canvasrenderer` uses `acquireEffect`/`releaseEffect` for transient visuals and rehydrates on acquire.
- Tests (factory-level): Done — factory/edge-case tests added and passing locally.
- Texture / WebGL semantics: Partial → Most important gaps remain here (per-key allocated counts, overflow policies, disposer invocation, GL mock tests).

Requirements coverage (condensed)
--------------------------------
- Design / structure: Done
- PooledFactory API: Done
- Sprite/effect pooling (canvas): Partial (renderer uses pooled effects; sim still has legacy pools)
- Texture pooling semantics (per-key bookkeeping, overflow, disposer): Missing / high priority
- WebGL-instrumented tests (create/delete counts, disposer): Missing
- Thread/worker ownership model: Missing (document-only work exists; tests & protocol needed)

What we shipped already (concrete)
---------------------------------
- Centralized GameState usage across modules.
- A minimal, ergonomic pooled-factory API and helper functions in `src/entities.ts`.
- Canvas renderer wired to use pooled effects for transient visuals (explosions, flashes, particles where appropriate) with reset-on-acquire semantics.
- Unit tests covering pooled-factory correctness (reuse, reset, double-free protection, churn) added under `test/vitest/` and passing locally.
- Removed a duplicate simulation invocation in `GameManager.step` (fix for double-simulating per frame).

Remaining high-priority gaps (actionable)
----------------------------------------
1) Per-key PoolEntry metadata + disposer semantics (PR #1 - highest priority)
   - Introduce per-key PoolEntry in `GameState.assetPool`:
     - freeList: T[]
     - allocated: number
     - config?: { max?: number, strategy?: 'discard-oldest' | 'grow' | 'error' }
     - disposer?: (item: T) => void
   - Update `acquire*` / `release*` to honor allocated vs freeList and implement strategies (discard-oldest -> call disposer, grow -> allow with cap, error -> throw/log).
   - Add unit tests that mock GL and assert createTexture/deleteTexture and disposer invocations.

2) WebGL test instrumentation (PR #2)
   - Add a test GL stub that counts create/delete operations and exposes a simple mocked context for tests.
   - Use it to validate `acquireTexture`/`releaseTexture` under different strategies and churn.

3) Simulation → Renderer migration & ownership model (PR #3)
   - Finalize docs recommending: renderer owns render-only transient visuals; simulation owns persistent simulation state.
   - Migrate a single visual (explosion) to renderer-owned pooling (spawn/lease API + integration test) to validate the pattern.

4) Worker/thread model and CI guard rails
   - Document and test that GL ops run on main thread; design simple lease/message protocol for worker-driven visual requests.
   - Add `npx tsc --noEmit` to CI and add the new assetPool semantics tests to CI.

Concrete next step I recommend we land first (PR #1)
-------------------------------------------------
Why: it fixes the highest-risk correctness issue (texture pooling math and missing disposer calls) in a small, testable change.

What I'll implement in that PR:
- Extend `GameState.assetPool` to use per-key PoolEntry shape described above.
- Implement bounded allocation and overflow strategies in `acquireTexture`/`releaseTexture` (and mirror that in the sprite/effect helpers where applicable).
- Add unit tests that use a GL stub to verify createTexture/deleteTexture counts and disposer invocation under each strategy.

If you want that, I'll implement PR #1 next (small patch + tests). If you prefer, I can instead prepare the GL mock harness first (PR #2) and then make the PoolEntry changes against the harness.

How to run locally (short)
--------------------------
Install dependencies:

```powershell
npm ci
```

Run the pooled-factory tests (fast):

```powershell
npx vitest run test/vitest/pooled_factory.spec.ts
```

Run the full test suite:

```powershell
npm test
```

Type check:

```powershell
npx tsc --noEmit
```

Notes & rationale (brief)
------------------------
- The current implementation intentionally kept additions small and optional to avoid broad breaking changes. Making per-key metadata first-class (and initialized by the state factory) is the right corrective step.
- The most immediate correctness bug is relying on array length as a proxy for allocated objects. Explicit allocated counters plus tests that stub GL create/delete will make the behavior deterministic and auditable.
- Migrating simulation visuals to renderer-owned pooling requires a concise spawn/lease API; we can prototype that when PR #1 is complete and tested.

Next question
-------------
Do you want me to implement PR #1 (per-key PoolEntry + disposer + tests) next, or would you prefer I create the GL test harness first (PR #2) and then implement PR #1? I can start coding immediately for either choice.

