# Implement Miniplex (entity DB) + Zustand (UI) Integration

Status: Proposed

## Goal

Introduce Miniplex as the canonical in-memory entity collection + a lightweight 3D uniform grid spatial index to accelerate neighbor and hit queries. Use Zustand for UI/transient state only. Preserve deterministic simulation behavior and keep all runtime simulation state on the canonical `GameState`.

## Scope

- Add Miniplex collection(s) and a `UniformGrid` spatial index under `src/core/`.
- Wire entity lifecycle (spawn, move, destroy) to update both Miniplex and the grid.
- Replace existing neighbor/hit ad-hoc queries in select locations with the new query API (start with a single canonical consumer — e.g., turret targeting or projectile hit test — then expand).
- Add Vitest unit tests and microbenchmarks comparing naive vs grid+Miniplex approaches.
- Add a small Zustand store for UI state (debug toggles, selected entity), keep sim state unchanged.

## Constraints & Rules

- Follow repository rules: Edit only TypeScript in `src/`.
- Preserve determinism: do not rely on Map/Set iteration order; stabilize outputs (sort by id) where needed.
- Keep canonical sim state on `GameState` as defined in `src/types/index.ts` (add an `entityIndex` member if needed).
- If physics/hits occur in `simWorker.ts`, instantiate Miniplex/grid inside the worker.

## Implementation Plan (phases)

Phase 0 — Prep (quick)

- Add dependencies to `package.json`: `miniplex` and `zustand` (dev-deps unnecessary). Run `npm install`.
- Add configuration parameter `simConfig.spatial.bucketSize` in `src/config/simConfig.ts`.

Phase 1 — Core index implementation (1-2 days)

- Create `src/core/entityIndex.ts`:
  - Export `EntityRef` TS type mirroring the bare-minimum index fields (id, x,y,z,team,type,radius).
  - Implement `initEntityIndex()` factory that creates a Miniplex collection and a `UniformGrid` instance and returns a small API: `add(e)`, `update(e)`, `remove(id)`, `queryNeighbors(center,radius,opts)`, `hitQuery(bullet, opts)`.
  - Implement `UniformGrid` class (deterministic bucket keys stringified from integer coordinates). Provide `add`, `remove`, `update`, `queryCandidates`.
  - Keep output ordering deterministic (sort by id before returning lists).

Phase 2 — Type updates & GameState integration (0.5 day)

- Update `src/types/index.ts` to add an optional `entityIndex?: { collection: Collection<EntityRef>, grid: UniformGrid }` member on `GameState`.
- Ensure types are exported for code that will use them.

Phase 3 — Hook into lifecycle (0.5-1 day)

- Find entity spawn/move/destroy callsites in `src/core/` and/or `src/simWorker.ts`.
- Add calls to `gameState.entityIndex.add/update/remove` corresponding to spawn/move/destroy.
- If the sim worker is authoritative, create the index inside the worker and populate it during initial state hydration.

Phase 4 — Replace a single consumer (1 day)

- Select one canonical consumer (example: turret targeting or projectile hit detection). Replace its neighbor/hit query with `gameState.entityIndex.queryNeighbors`/`hitQuery`.
- Add unit tests that assert identical behavior with original code for a fixed scenario. Ensure deterministic ordering.

Phase 5 — Expand & refactor codebase (1-2 days)

- Replace other neighbor/hit queries across the codebase.
- Remove duplicated ad-hoc spatial helpers where applicable.

Phase 6 — Tests, bench, tune (1-2 days)

- Add Vitest tests:
  - correctness tests for neighbor/hit queries
  - determinism test (repeat simulation snapshot yields same query results)
  - microbenchmark comparing naive full-scan vs grid+miniplex for increasing N and densities
- Tune `bucketSize` and add default in `src/config/simConfig.ts`.

Phase 7 — Docs, PR & rollout (0.5 day)

- Add docs to `docs/` and `memory/tasks/` describing the entity index API and migration steps.
- Add examples and migration notes to `README.md` or `AGENTS.md` as needed.

## Files to add/modify

- Add: `src/core/entityIndex.ts` (Miniplex + UniformGrid + query API)
- Modify: `src/types/index.ts` (add entityIndex to `GameState`)
- Modify: entity lifecycle callsites in `src/core/` and/or `src/simWorker.ts` (spawn/move/destroy)
- Modify: one consumer file (e.g., turret targeting module or projectile handler) to use new API
- Add tests: `test/vitest/spatial-index.spec.ts`
- Add config: `src/config/simConfig.ts` default bucket size (if not present)
- Add docs: `docs/entity-index.md` and `plan/implement-miniplex-zustand.md` (this file)

## Acceptance criteria

- All existing unit tests pass.
- New tests for the spatial index and neighbor/hit queries pass.
- Microbenchmarks show improved median latency for neighbor queries in typical scenarios.
- No nondeterministic behavior introduced; deterministic tests pass.
- Simulation correctness unchanged for the canonical consumer replaced in Phase 4.

## Rollout strategy

1. Implement entirely inside a branch (`explosionparticles` already used). Keep changes behind a feature flag if desired.
2. Start by replacing a single consumer and run the full test suite and manual smoke tests.
3. Incrementally replace other consumers while running tests.
4. Merge when tests and benchmarks look good.

## Backout plan

- Keep old query code paths around behind a small adapter (`useEntityIndex: boolean`) initially.
- If behavior/regression is detected, toggle the adapter and revert the replacement commit.

## Open questions

- Which exact consumer should be the first replacement? (turrets, projectiles, or AI target selection). Recommendation: projectile hit tests (clear correctness, well-contained).
- Should the index live inside the sim worker (recommended) or main thread? If physics/hits are calculated in the worker, keep index in the worker.

## Estimated effort

- Prototype + tests: 2-4 days
- Full integration + docs: 3-6 days total depending on number of query sites

## Contact & next steps

If you want I can now implement Phase 1 and Phase 2 (prototype `src/core/entityIndex.ts` + types change + tests). Tell me to proceed and I will run `npm run typecheck` and `npm test` and iterate until green.
