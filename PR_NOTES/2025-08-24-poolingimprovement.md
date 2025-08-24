# Asset Pooling Plan Coverage

> **Summary:**  
> This document reviews the current status, gaps, and next steps for asset pooling in SpaceAutoBattler. It covers design, implementation, integration, edge cases, and recommendations for safe, incremental improvements.

---

## Design & Structure

| Area                | Status   | Evidence |
|---------------------|----------|----------|
| GameState.assetPool | Done     | `entities.ts`: `Map<string, T[]>` for textures/sprites/effects; config block present |
| Maps for Assets     | Done     | Maps exist, keyed by string |

---


## Pooling Logic

### Texture Pooling

- **Status:** Partial

- **Evidence:** `acquireTexture`/`releaseTexture` in `entities.ts`, used by `WebGLRenderer` (`webglrenderer.ts`) during bake/dispose

- **Gaps:**
  - No capacity enforcement or overflow policy
  - Uses `arr.length` (free list) as total capacity; does not track total created per key
  - Overflow path returns `arr.shift()`, which can be empty (yields `undefined`)
  - No disposer/deleter callback for textures on overflow

### Sprite/Effect Pooling

- **Status:** Partial

- **Evidence:** `acquireSprite`/`releaseSprite`, `acquireEffect`/`releaseEffect` exist

- **Gaps:**
  - Not integrated or called anywhere
  - No reset/rehydration semantics (missing `Object.assign`-style logic)
  - No capacity/overflow policy

### Pool Size Configurability & Overflow Logic

- **Status:** Missing

- **Evidence:** Only a single numeric limit per kind (`texturePoolSize`, etc.); no min/max range or strategy setting; no overflow handling

---

## Integration with Simulation & Renderer

- **Status:** Partial
- **Evidence:**
  - **Renderer:** Textures go through pool (try/catch fallback to direct creation)
  - **Simulation:** Uses standalone JS pools for bullets/explosions/shield/health/particles in `gamemanager.ts`; does not use `GameState.assetPool` for sprites/effects
- **Note:** If "assets" are scoped to GPU/renderer resources, simulation pools can remain separate—but sprites/effects pooling still isn’t wired

---

## Asset Return & Disposal on Full Pool

- **Status:** Partial/Missing
- **Evidence:** Renderer returns textures to pool on `dispose()`. No disposal-on-overflow path in any `release*` helpers; no release points outside renderer shutdown; shapes remain cached until renderer dispose

---

## Memory Leak & Duplication Prevention

- **Status:** Partial
- **Evidence:** `release*` helpers guard against double-push with `includes`. No reference counting; no drop/disposal of overflow; no lint/test guardrails on leaks

---

## Unit Tests for Asset Pool

- **Status:** Missing for new `GameState.assetPool`
- **Evidence:** Current pooling tests (`pooling.spec.ts`) cover gamemanager’s legacy pools (bullets/effects), not the new `GameState.assetPool`. WebGL tests validate caching/dispose speed but not pooling limits/overflow strategies

---

## Asset Pool API & Migration Docs

- **Status:** Partial
- **Evidence:** `IMPLEMENTATION_STATUS.md` briefly mentions pooling integration; no explicit API/migration doc

---


## Edge Cases & Risks

### Renderer and Simulation Must Use Pool

- **Status:** Partial (renderer only for textures)

### Pool Must Handle All Asset Types in High-Frequency Events

- **Status:** Missing (sprite/effect pooling not exercised; bullets/explosions remain outside new pool)

### Thread-Safety (Workers)

- **Status:** Missing (no locking/ownership model; current code assumes same-thread use)

### Unit Tests for Large Battles & Rapid Churn

- **Status:** Missing for `GameState.assetPool` (some gamemanager pooling tests exist, but not for new pool)

### Additional Risks & Correctness Issues

- **Pool math bug:** `acquireTexture` uses `arr.length` (free list) as "total" and, on "full," returns `arr.shift()!`. If `arr` is empty, this yields `undefined`. Renderer’s `bakeShapeToTexture` try/catch masks this by falling back to direct creation, but it defeats the pool and hides logic errors
- **Capacity not enforced on release:** `releaseTexture` doesn’t prune to max or dispose extras—free lists can grow unbounded per key
- **API cohesion:** Canonical `GameState` type is defined in `index.ts`, but `WebGLRenderer` imports `GameState` from `./entities`. That diverges from your "canonical GameState" rule and risks drift

---

## Requirements Coverage Summary

| Area                | Status   | Notes |
|---------------------|----------|-------|
| Design/structure    | Done     |       |
| Texture pooling     | Partial  | Logic present but flawed; no overflow policy |
| Sprite/effect pool  | Partial  | API present, unused; no reset/overflow |
| Config (min/max/strategy) | Missing | |
| Integration (renderer/sim) | Partial | Renderer-for-textures only |
| Cleanup/overflow disposal | Missing | |
| Leak prevention/duplication | Partial | Basic guards only |
| Tests (pool behavior/perf/overflow) | Missing | |
| Docs/migration      | Partial  |       |
| Edge cases (thread-safety, high-frequency, churn tests) | Missing | |

---


## Recommended Next Steps

**Short, Safe, Incremental Plan:**


1. **Fix Core Pool Semantics**

- Track per-key free list + per-key in-use count or total allocated
- Add overflow strategies: discard-oldest (with dispose callback), grow (with upper bound), error
- Provide optional disposer (e.g., for textures: `gl.deleteTexture`) invoked when trimming to max


1. **Integrate Sprites/Effects**

- Decide owner: renderer-side transient objects vs. sim-side objects
- Wire renderer to use `acquireSprite`/`acquireEffect` for any runtime drawable/effect instances; implement reset/rehydrate on acquire


1. **Align Types**

- Import `GameState` from `index.ts` everywhere (including `WebGLRenderer`)
- Remove duplicate `GameState` in `entities.ts` or make entities depend on the canonical type


1. **Tests**

- Unit tests for `acquire*`/`release*` covering:
  - Happy path reuse
  - Double-free prevention
  - Capacity limit with each strategy
  - Overflow disposal (verify deleter called)
  - Large-churn scenario across many keys
- Extend WebGL tests to assert pool reuse vs. fresh create (e.g., count deletions/creations via instrumented GL stubs)



1. **Docs**

- Add a short API doc: data shapes, strategies, ownership model (renderer owns GPU assets; all requests via pool), and migration steps
- Note threading: if/when sim runs in a worker, restrict pool to main-thread GL assets or add message-based leasing
