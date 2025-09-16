# Handover — Miniplex spatial-index prototype (for next agent)

This document is a compact, actionable handover for the next agentic session. It summarizes what was implemented, where to find the code, what to run to validate, and the next high-value steps to complete the migration from the legacy spatial index to the new Miniplex + UniformGrid prototype.

Date: 2025-09-16
Branch: explosionparticles (feature branch)

## High-level summary

- Goal: introduce a deterministic, fast entity index using Miniplex for attribute indexing and a small UniformGrid (3D) for spatial candidate reduction. Make it optional on `GameState` and wire lifecycle hooks so it can replace legacy spatial scans incrementally.
- Status: Prototype implemented and wired into spawn/move/destroy callsites. Basic unit tests for spawn and spatial functionality passed locally. The full typecheck and test suite passed earlier in this workstream.

## Where the work lives

- Prototype index implementation:
  - `src/core/entityIndex.ts` — exports `initEntityIndex(bucketSize)` and `EntityIndexAPI` (contains `world` (Miniplex World), `grid` (UniformGrid), and methods: `add`, `update`, `remove`, `queryNeighbors`).

- Game state / lifecycle wiring:
  - `src/core/gameState.ts` — spawn helper and simulation loop were updated to:
    - register newly spawned ships in `state.entityIndex` (if present),
    - update `state.entityIndex` positions inside `updateSpatialGrid`,
    - update `state.entityIndex` after boundary cleanup teleports,
    - remove entries from `state.entityIndex` when ships die (best-effort cleanup).

  - `src/core/systems/spawnSystem.ts` — spawn registration now calls `state.entityIndex.add(...)` and `removeShip` calls `state.entityIndex.remove(...)` (best-effort, try/catch guarded).

- Tests and dependencies:
  - `test/vitest/*` — spatial and spawn tests were executed (focused runs passed). Full test suite passed earlier during prototyping.
  - `package.json` had `miniplex` added as a dependency for the prototype.

## Key design & integration notes

- Canonical state: All runtime state remains on `GameState`. The index is optional and attached as `state.entityIndex?: EntityIndexAPI` to avoid invasive changes.
- Determinism: The index returns deterministic candidate order (IDs are sorted) so existing tests relying on deterministic behavior remain valid.
- Best-effort safety: All calls to `state.entityIndex` are wrapped in try/catch so the simulation works even if the index is missing or errors.
- Adapter approach: Miniplex entities are bridged to numeric game entity ids via a local `byId` map in the prototype so we don't force Miniplex internal ids on the rest of the codebase.

## Validation & how to run locally

1. Install deps (if needed):

   ```pwsh
   npm install
   ```

2. Run typecheck:

   ```pwsh
   npm run typecheck
   ```

3. Run tests (full suite):

   ```pwsh
   npm test
   ```

4. Quick targeted tests we used in this session:

   ```pwsh
   npx vitest test/vitest/systems-spawn.spec.ts
   npx vitest test/vitest/spatial-functional.spec.ts
   ```

## What to watch for (logs / warnings)

- Headless test runs emit renderer fallbacks/warnings (e.g., 2D canvas fallback). These messages are expected and informational for CI.
- If `miniplex` is missing in package.json or node_modules, TypeScript will fail to resolve imports — install with `npm install`.

## Next immediate tasks (priority order)

1. Initialize the entity index on state creation
   - Decide when to create `state.entityIndex` (e.g., in `createInitialState` when `enableSpatialIndex` is true). If desired, call `state.entityIndex = initEntityIndex(bucketSize)`.

2. Migrate one heavy consumer end-to-end
   - Candidate: projectile collision in `updateBullets` inside `src/core/gameState.ts` or turret targeting in `fireTurrets`.
   - Replace the existing grid/full-scan lookup with `state.entityIndex.queryNeighbors(x,y,z,radius,{team:..., filter:...})` and assert parity with legacy behavior via tests.

3. Add configuration and tuning
   - Add `entityIndex.bucketSize` or extend `simConfig.spatialGrid` to expose `bucketSize` so we can tune grid resolution.
   - Add microbenchmarks to `test/vitest/` to sweep bucket sizes and entity densities.

4. Tests & benchmarks
   - Add tests that assert exact parity (same entities returned) vs legacy `spatialGrid.forEachInRadius` for several densities and radii.
   - Add performance benchmarks (small, deterministic) to measure index vs linear scan.

5. Integrate Zustand for UI (separate task)
   - Keep simulation state solely on `GameState`. Create a small Zustand store for UI/inspector state and wire the renderer to read from it.

## Developer tips & gotchas

- Keep the `state.entityIndex` mutation localized to lifecycle points (spawn, authoritative movement updates, removal). Avoid calling `entityIndex.update` from many ad-hoc places — prefer authoritative single-point updates for position (e.g., after physics sync or AI movement step).
- Preserve deterministic RNG usage: do not introduce non-deterministic operations (Date.now, Math.random) in any simulation path; use `state.rng` for seeded randomness.
- When removing entities, prefer marking and sweeping (the current code marks via sentinel `maxHealth=0` and later filters). The entityIndex cleanup runs as best-effort to avoid tight coupling.

## Files to inspect first (for next agent)

- `src/core/entityIndex.ts` — understand the API and adapters (`world`, `grid`, `add/update/remove/queryNeighbors`).
- `src/core/gameState.ts` — look at `spawnShip`, `updateSpatialGrid`, `processDeathsAndXP`, and `runBoundaryCleanup` to see where the index is used.
- `src/core/systems/spawnSystem.ts` — spawn and remove flows.
- `test/vitest/` — spatial and spawn tests to extend for parity and benchmarks.

## Acceptance criteria for finishing Phase 1→2 migration

1. `state.entityIndex` is created in `createInitialState` when spatial indexing is enabled.
2. Spawning, authoritative movement updates, teleports, and removals consistently maintain the index (tests cover these paths).
3. One major consumer (projectiles or turrets) is migrated to use `entityIndex.queryNeighbors` with tests demonstrating parity.
4. Full typecheck and test suite pass on CI.

## Contact points / decisions made during this session

- Prototype: Miniplex `World` + UniformGrid (deterministic numeric bucket keys) with a local `byId` mapping.
- Non-invasive: index attached as `state.entityIndex?: EntityIndexAPI`.
- Sorting of candidate ids is used to keep deterministic ordering.

## Recent commands & test results (snapshot)

- Focused tests run: `npx vitest test/vitest/systems-spawn.spec.ts` and `npx vitest test/vitest/spatial-functional.spec.ts` — both passed (27 tests total in those focused runs).
- Earlier in this work session a full test run passed (651/651). If you see failures on your machine, run `npm install` then rerun `npm test` and report failures.

## Handoff — immediate next action for the new agent

1. (Small) Add initialization of `state.entityIndex` inside `createInitialState` guarded by the same `enableSpatialIndex` flag, e.g.:

   ```ts
   import { initEntityIndex } from '../core/entityIndex.js';

   if (state.behaviorConfig?.globalSettings.enableSpatialIndex) {
     state.entityIndex = initEntityIndex(state.simConfig.spatialGrid.bucketSize || 50);
   }
   ```

2. Run full test suite (`npm run typecheck && npm test`).
3. Pick one consumer to migrate (projectiles recommended) and create a small PR migrating that code path and adding parity tests.

If you want, I can continue and do steps 1–3 now and open a draft PR. Tell me which consumer to migrate first (projectiles or turrets) and whether you prefer the `entityIndex` created by default when `enableSpatialIndex` is true.

---

End of handover.
