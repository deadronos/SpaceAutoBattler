# Performance Pass Plan — SpaceAutoBattler

Goal

- Reduce main-thread frame time and p95 frame latency for high-entity scenarios (200–1000 ships).
- Deliver five prioritized, test-backed improvements that target the largest hot code paths: physics messaging, AI queries, renderer instancing, effects pipeline, and asset/textures.

Context

- Existing instrumentation: `perf` hotpath meter (enable with `?debugPerf=1`). Measured subsystems follow the pattern in `docs/performance-profiling.md`.
- Prior work: `simWorker.ts` exists and already supports Float32Array transfer in `main.ts` paths; `shipInstancer.ts` contains disabled frustum culling and per-instance updates; `ai` has batched queries but can be further optimized.

Acceptance criteria

- Reduction in p95 frame time by at least 20% on a 500-ship stress test compared to baseline (baseline captured via `?debugPerf=1&showPerf=1`).
- No visual correctness regressions for targeting and spawning; automated smoke tests pass.
- All changes accompanied by unit tests for functionality and a short performance harness demonstrating improvement.

Top-5 prioritized improvements (deliverable PRs)

1) Sim worker transferable transforms (PR #1)

- Why: Avoid JSON/object payloads and extra allocations when returning physics transforms from `simWorker` to main thread.

- Files: `src/simWorker.ts`, `src/main.ts`

- Outcome: Worker posts a compact Float32Array buffer (one entry per ship: id, px, py, pz, vx, vy, vz) and the main thread consumes it without copying.

- Impact/Effort: 28% / 12%

- Tests: Add a unit test that sim worker step returns a buffer and main updates ship positions correctly. Capture perf metrics before/after.

1) AI batching + throttled per-ship ticks (PR #2)

- Why: Per-ship AI queries are expensive; batching and adaptive tick rates reduce per-frame CPU.

- Files: `src/core/ai/controller.ts`, `src/core/ai/batchedQueries.ts`, `src/core/spatialIndex.ts`

- Outcome: Bulk nearest-neighbor API; adaptive tick scheduler for AI LOD (distance-based). Optionally prototype spatial worker if needed.

- Impact/Effort: 24% / 18%

- Tests: Synthetic benchmark for 200/500/1000 ships and unit tests comparing batch results to current per-ship results.

1) Instancer culling and dirty matrix updates (PR #3)

- Why: Avoid updating instance matrices for culled groups or unchanged instances.

- Files: `src/renderer/shipInstancer.ts`, `src/renderer/threeRenderer.ts`

- Outcome: Re-enable group-level frustum culling, add per-instance last-pos tracking and update only when changed beyond epsilon; minimize instanceMatrix.needsUpdate toggles.

- Impact/Effort: 20% / 15%

- Tests: Visual smoke test and perf comparison; unit tests for `updateTransform` behavior.

1) Effects QoS and particle scaling (PR #4)

- Why: Visual effects are expensive but often dispensable under heavy load. Adaptive quality restores FPS.

- Files: `src/renderer/unifiedEffectsManager.ts`, `src/renderer/threeRenderer.ts`, `src/config/rendererConfig.ts`

- Outcome: Simple perf-based governor toggles effect passes or reduces render resolution/passes when avgFrameMs exceeds budget.

- Impact/Effort: 14% / 10%

- Tests: Stress scenario verifies `renderer.effects` CPU reduces and FPS recovers.

1) SVG raster/texture caching (PR #5)

- Why: Avoid repeated `THREE.Texture` creation and repeated material creation when allocating many ships.

- Files: `src/core/svgLoader.ts`, `src/main.ts`, `src/renderer/shipInstancer.ts`

- Outcome: Cache `THREE.Texture` / prototype materials in `state.assetPool` and reuse them when registering prototypes.

- Impact/Effort: 10% / 8%

- Tests: Heap snapshots and allocation tests during spawning; visual smoke tests.

Plan & Tasks

- Phase 0 — Baseline
  - Task 0.1: Reproduce baseline with `?debugPerf=1&showPerf=1` under 200/500/1000 ships; capture p95 & avg frame times and per-subsystem breakdown.
  - Task 0.2: Add a `test/perf` harness (if not present) that automates running a scenario and collecting `perf.getSummary()` result.

- Phase 1 — PR #1 (Sim worker Float32Array)
  - Task 1.1: Implement buffer packing in `src/simWorker.ts` (`collectTransforms` -> Float32Array) and `postMessage` with transferable.
  - Task 1.2: Simplify main handler in `src/main.ts` to parse typed array and update ships without allocations.
  - Task 1.3: Add unit test & perf harness; run `npm run typecheck && npm test`.
  - Task 1.4: Measure perf delta; document results.

- Phase 2 — PR #2 (AI batching & throttle)
  - Task 2.1: Add bulk query API in `src/core/spatialIndex.ts` that accepts Float32Array positions and returns nearest ids.
  - Task 2.2: Implement adaptive tick scheduler in `src/core/ai/controller.ts` and integrate batch queries.
  - Task 2.3: Add unit tests for correctness and benchmark.

- Phase 3 — PR #3 (Instancer improvements)
  - Task 3.1: Re-enable proper frustum culling in `shipInstancer.cull()` and fix any correctness issues observed earlier.
  - Task 3.2: Add per-instance lastPos store and epsilon comparators in `updateTransform` to skip writes.
  - Task 3.3: Batch instance attribute updates and avoid `needsUpdate` unless changed.
  - Task 3.4: Add regression visuals tests and perf harness.

- Phase 4 — PR #4 (Effects QoS)
  - Task 4.1: Add simple governor to toggle effects when avgFrameMs > threshold for N frames.
  - Task 4.2: Expose runtime knobs in `RendererConfig`.
  - Task 4.3: Add unit smoke tests and measure improvement.

- Phase 5 — PR #5 (SVG caching)
  - Task 5.1: Create `getOrCreateTextureForSVG(url)` in `src/core/svgLoader.ts` which caches `THREE.Texture` in `state.assetPool`.
  - Task 5.2: Adjust `shipInstancer.allocate` to reuse cached texture/material prototypes.
  - Task 5.3: Bench and snapshot memory.

Quality gates & verification

- Per PR: `npx tsc --noEmit` (or `npm run typecheck`) and `npm test` must pass.
- PRs must include a small perf harness or instructions and a before/after metric in the PR description.
- Smoke manual tests: spawn fleets, toggle effects, check targeting and collisions.

Bench harness & how to run

- Dev server / build: `npm run build && npm run serve:dist` or run via dev server in repo.
- Perf overlay: open app URL with `?debugPerf=1&showPerf=1` and run scenario.
- Suggested automated harness (simple headless script outline):

  - script creates GameState with N ships, runs for M frames, calls `perf.getSummary()` and writes JSON to disk.

PR checklist (for each PR)

- [ ] Unit tests added/updated
- [ ] TypeScript typecheck passes
- [ ] Perf harness and before/after metrics included
- [ ] Small migration notes or config flags for toggles
- [ ] Visual smoke test instructions

Risks & mitigations

- Worker buffer format mismatch: add version header or assert layout in both sides. Use tests to verify.
- AI throttling may cause behavior regressions: keep throttling conservative and add unit tests for key behaviors (target acquisition, turret firing cadence).
- Culling correctness: add visual smoke tests and fallback toggle to disable the new culling if regression found.

Next steps

- Implement PR #1 (Sim worker transferable transforms) as the highest-value, low-risk first change.
- After PR #1 lands and metrics confirm improvement, proceed with PR #2.
- Update this plan with measured deltas after each PR and iterate.

Owner

- Primary: repo maintainer (deadronos)
- Implementer: available contributor

Timeline (rough)

- Baseline & PR #1: 1–2 days
- PR #2: 2–4 days
- PR #3: 2–4 days
- PR #4: 1–2 days
- PR #5: 1–2 days

