# IMPLEMENTATION_STATUS.md

## Completed Goals

- All game balance, progression, visuals, and entity stats are centralized in config TypeScript files.
- Pure TypeScript codebase; all types in index.ts.
- Renderer and simulation logic read all tunables from config—no hardcoded gameplay or visual values remain.
- Config-driven architecture is complete; progression uses function-valued scalars for XP, HP, damage, shield, speed, and regen.
- Visual effects, particles, and UI overlays are parameterized via config.
- Unit and smoke tests for progression and scaling pass; build outputs and runtime verified.
- Config hygiene improved: STARS.background removed (use AssetsConfig.palette.background), arcWidth in SHIELD commented/TODO'd, TODO for unifying particle configs with assetsConfig.ts.
- **2025-08-23: Major type/config tightening:**
  - ShipSpec now requires `accel`, `radius`, and non-empty `cannons`.
  - CannonSpec requires `damage` and supports new optional fields (`angle`, `rate`, `spread`, `muzzleSpeed`, `bulletRadius`, `bulletTTL`, `ttl`, `reload`, `range`).
  - ShipConfigMap requires full ShipSpec objects (no partials).
  - Legacy fields (e.g., `dmg`) maintained for compatibility; fallback logic added.
  - All changes validated with TypeScript and tests.

## Current State

## Asset Pooling API & Edge Cases

### API Overview

- All asset pooling is centralized in `GameState.assetPool`, which contains per-kind maps for textures, sprites, and effects.
- Pooling helpers (`acquireTexture`, `releaseTexture`, `acquireSprite`, `releaseSprite`, `acquireEffect`, `releaseEffect`) enforce capacity, overflow strategy, and optional disposer callbacks.
- Factories and reset/rehydrate contracts are supported for pooled objects; see `PooledFactory` and `makePooled` in `entities.ts`.
- Ownership: Renderer owns transient GPU assets (textures, sprites, effects); simulation owns persistent game objects.
- All requests for pooled assets go through the helpers; direct allocation is discouraged except for fallback.

### Strategies

- `discard-oldest`: Trims free list to max capacity, disposing oldest resources via callback.
- `grow`: Allows pool to expand beyond configured size (for debugging or stress scenarios).
- `error`: Throws on acquire when exhausted; on release, does not retain extra.

### Edge Cases

- Double-free prevention: `release*` helpers guard against duplicate entries in free lists.
- Overflow disposal: When free list exceeds max, disposer callback is invoked for excess resources.
- Large-churn scenarios: Pools are stress-tested for rapid acquire/release across many keys.
- Thread-safety: Current pools assume single-threaded use; future migration to workers will require message-based leasing or main-thread restriction for GPU assets.

### Migration Steps

- All modules must import canonical `GameState` from `src/types/index.ts`.
- Legacy pools in simulation (bullets, explosions, etc.) should migrate to use assetPool for sprites/effects if/when renderer-side pooling is desired.

### Test Coverage

- Unit tests for pooling helpers cover reuse, double-free prevention, capacity/overflow, and disposal.
- WebGL tests assert pool reuse vs. fresh create by counting deletions/creations via instrumented stubs.

- All major subsystems are config-driven and tested.
- Renderer buffer logic and scaling are robust and consistent.
- Most test failures resolved; only edge cases remain.
- Config files reviewed for duplication/unused entries; hygiene improved.
- **Type/config migration complete; all configs match stricter requirements.**

### 2025-08-24

- Rebuilt `src/webglrenderer.ts` from scratch as a minimal, typed WebGL renderer that mirrors the legacy JS stub’s public API.
- Implemented simple shape-to-texture baking with an internal cache and full dispose lifecycle; added `hasCachedTexture` for tests.
- Verified full test suite: 77 tests passed locally; WebGL renderer texture and lifecycle tests green.

#### Pooling integration

- WebGLRenderer now routes texture creation through the canonical GameState asset pool via `acquireTexture` with a factory and returns textures via `releaseTexture` in `dispose()` when a state is available. Fallback path creates/deletes directly if no state is present.
- 2025-08-24 (Step 1): Strengthened asset pool semantics in `entities.ts`:
  - Added per-key total allocation tracking and overflow strategies (`discard-oldest` default, `grow`, `error`).
  - `releaseTexture`/`releaseSprite`/`releaseEffect` accept optional disposer callbacks and trim free lists to capacity.
  - Fixed edge case where empty pools returned `undefined` on exhaustion; now either create (grow) or throw (error) by strategy.
  - Renderer passes a GL texture disposer to allow safe trimming.

#### Optional scaffolding

- Added optional placeholders for textured-quad shader/VBO and FBO handles; currently unused by tests and guarded to avoid regressions.

## Short-term Goals

- Unify overlapping particle effect configs between gamemanagerConfig.ts and assetsConfig.ts.
- Ensure arcWidth in SHIELD is either used or removed.
- Expand edge case test coverage for config-driven logic.
- **Remove legacy fields (e.g., `dmg`) after all callers are updated.**
- **Document new required/optional fields in code comments and PR notes.**
- Integrate texture pooling with canonical `GameState` asset pool helpers for reuse across sessions (follow-up; not required for current tests).

## Notes: Test DOM environment migration

- 2025-08-24: Migrated test environment from `jsdom` to `happy-dom` in test config and setup.
  - Updated `vitest.config.js` to use `happy-dom`.
  - Updated `test/vitest/setupTests.ts` comments and ensured TextEncoder/TextDecoder polyfills remain.
  - Adjusted `src/main.ts` to create a fallback `canvas#world` when none exists in the provided document and to provide a no-op renderer when canvas/contexts are unavailable (helps DOM emulators).
  - Fixed `src/canvasrenderer.ts` comments and ensured the renderer uses a no-op 2D context when getContext is not available.
  - Ran the DOM-related unit test `test/vitest/main.dispose.spec.ts` and iterated until the test ran cleanly under `happy-dom`.

Notes: Local `npm install` encountered workspace and permission issues on this machine (EUNSUPPORTEDPROTOCOL for workspace: deps and EPERM cleaning node_modules). `happy-dom` was installed on-demand by the test runner for this session. To fully update lockfiles and CI, run `npm install` (or `npm ci`) in a clean environment and commit updated lockfiles.

## Long-term Goals

- Document and implement config unification steps.
- Run full Vitest and Playwright suites for regression and browser validation.
- Add more multi-level progression/scaling tests.
- Continue optimizing config hygiene and maintainability.
