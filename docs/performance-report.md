# Performance Report (current)

Date: 2026-10-13

This is the canonical, code-grounded performance snapshot for SpaceAutoBattler. It
supersedes the versioned reviews in `docs/performance-review-*.md`, which were
written against earlier code and earlier toolchains. Nothing in this document is a
behaviour change: it is a read-only measurement + source audit of the current tree.
Where a number is **assumed** rather than **measured**, it is marked as such.

## Header / environment

| Item              | Value                                      | How obtained                                          |
| ----------------- | ------------------------------------------ | ----------------------------------------------------- |
| Date              | 2026-10-13                                 | —                                                     |
| Branch            | `perf/performance-report-184`              | `git branch --show-current`                           |
| Commit            | `4c218f862cdcd529aa045f557e2ed691e950a52e` | `git rev-parse HEAD`                                  |
| Node (measured)   | `v24.21.0`                                 | `node -v`                                             |
| pnpm              | `10.33.0`                                  | `pnpm -v`                                             |
| OS / arch         | `Darwin arm64`                             | `uname -sm`                                           |
| CPU               | `Apple M4`                                 | `sysctl -n machdep.cpu.brand_string`                  |
| Second Node major | `v26.10.0`                                 | `/opt/homebrew/bin/node --version`                    |
| Node 22           | **not available**                          | no `nvm`/`fnm`/`volta`; only Node 24 and 26 installed |

The measured Node (`v24.21.0`) is the one on `PATH` via `~/.vite-plus/bin/node`,
which is what `pnpm run …` resolves to. The historical figures in
`docs/performance-review-v2.0.6b.md` (2025-12-29) record **no Node version**, so the
historical runtime is unknown (see [Drift vs regression](#drift-vs-regression)).

## What is measured

1. **AI decision budget** — `scripts/perf/assert-ai-budget.ts` builds a synthetic
   `GameState` with `AI_BUDGET_SHIPS` ships (half `blue`, half `red`) and calls the
   public `updateDecisionSystem(state, dt)` export `AI_BUDGET_TICKS` times, timing
   the loop with `performance.now()`. It reports `avgTick` (ms) and exits non-zero
   when `avgTick > AI_BUDGET_MS`. Defaults: 300 ships / 160 ticks / 2.5 ms.
2. **Projectile instancing** — `scripts/bench/projectile-stress.mjs` compares a
   legacy per-draw path against an instanced path at 1000/5000/10000 projectiles.
3. **Production build** — `pnpm run build` (`vp build`, rolldown/Vite), timed
   wall-clock, plus `dist/` size.

## Measured budgets

### AI budget — default (300 ships / 160 ticks / 2.5 ms)

Command:

```
pnpm run perf:ai-budget
```

Five consecutive runs (raw `tail` of each):

```
[ai-budget] ships=300 ticks=160 avgTick=3.148ms budget=2.500ms
[ai-budget] FAIL: average AI tick 3.148ms exceeds budget 2.500ms
[ai-budget] ships=300 ticks=160 avgTick=3.250ms budget=2.500ms
[ai-budget] FAIL: average AI tick 3.250ms exceeds budget 2.500ms
[ai-budget] ships=300 ticks=160 avgTick=3.116ms budget=2.500ms
[ai-budget] FAIL: average AI tick 3.116ms exceeds budget 2.500ms
[ai-budget] ships=300 ticks=160 avgTick=3.098ms budget=2.500ms
[ai-budget] FAIL: average AI tick 3.098ms exceeds budget 2.500ms
[ai-budget] ships=300 ticks=160 avgTick=3.259ms budget=2.500ms
[ai-budget] FAIL: average AI tick 3.259ms exceeds budget 2.500ms
```

| Metric               | Value                               |
| -------------------- | ----------------------------------- |
| min / median / max   | `3.098` / `3.148` / `3.259` ms      |
| spread               | 0.161 ms (5.1% of median)           |
| budget               | 2.500 ms                            |
| utilization (median) | **125.9%** (min 123.9%, max 130.4%) |
| verdict              | **FAIL** (exit code 1)              |

### AI budget — extended load (450 ships / 200 ticks / 3.5 ms)

Command:

```
AI_BUDGET_SHIPS=450 AI_BUDGET_TICKS=200 AI_BUDGET_MS=3.5 pnpm run perf:ai-budget
```

Three consecutive runs:

```
[ai-budget] ships=450 ticks=200 avgTick=14.416ms budget=3.500ms
[ai-budget] FAIL: average AI tick 14.416ms exceeds budget 3.500ms
[ai-budget] ships=450 ticks=200 avgTick=14.461ms budget=3.500ms
[ai-budget] FAIL: average AI tick 14.461ms exceeds budget 3.500ms
[ai-budget] ships=450 ticks=200 avgTick=14.820ms budget=3.500ms
[ai-budget] FAIL: average AI tick 14.820ms exceeds budget 3.500ms
```

| Metric               | Value                             |
| -------------------- | --------------------------------- |
| min / median / max   | `14.416` / `14.461` / `14.820` ms |
| budget               | 3.500 ms                          |
| utilization (median) | **413.2%**                        |
| verdict              | **FAIL** (exit code 1)            |

The extended run fails far worse (4.1× over budget) than the default run (1.26×),
i.e. cost grows **super-linearly** with ship count: 300 → 450 ships is +50% ships
but ≈ +4.6× wall time. This is a scaling signal for Task 3 (budget/planner), not a
budget change here.

### Projectile instancing

Command:

```
pnpm run bench:projectiles
```

Raw output:

```
Projectile Instancing Stress Harness
===================================
count | groups | legacy draw | instanced draw | legacy ms | instanced ms | saturated
 1000 |      4 |         1000 |               4 |    0.011 |    0.067 |     no
 5000 |      4 |         5000 |               4 |    0.004 |    0.171 |     no
10000 |      4 |        10000 |               4 |    0.023 |    0.452 |     no
```

Interpretation: the instanced path collapses 1000/5000/10000 draw calls to 4, and
the per-frame instancing bookkeeping stays sub-millisecond at 10 000 projectiles
(0.452 ms) with no allocator saturation. The `legacy ms` column is a raw
array-iteration proxy, not a GPU draw-call measurement — treat it as an
**indicative** CPU cost only. This harness is unchanged since the v2.0.6b review.

### Build

Command (timed):

```
/usr/bin/time -p pnpm run build
```

Two consecutive runs (raw `tail` + time):

```
✓ built in 758ms
real 7.74
user 18.25
sys 0.47
```

```
✓ built in 794ms
real 7.61
user 18.18
sys 0.45
```

Bundle highlights (from the same build log):

```
dist/spaceautobattler.Cf9VkVLJ.js       321.34 kB │ gzip:    99.06 kB
dist/vendors.D7tuXs9Z.js                955.82 kB │ gzip:   343.03 kB
dist/rapier.BR_-CEU_.js               4,332.81 kB │ gzip: 1,669.30 kB
dist/workers/simulation.worker.D6YW9vXg.js  4,586.36 kB
dist/postprocessing.CKows2mI.js         823.21 kB │ gzip:   206.35 kB
```

| Metric               | Value                         |
| -------------------- | ----------------------------- |
| rolldown build phase | `758–794 ms`                  |
| wall-clock (`real`)  | `7.61–7.74 s`                 |
| `dist/` total        | `34 M` (`dist/assets` `13 M`) |

The v2.0.6b review recorded a ~45.2 s **webpack** build. The current toolchain is
Vite/rolldown (`vp build`), so build time is not comparable across those reports.

## Source audit vs. r3f / three / WebGL best practices

This is a read-only audit. Concrete anchors:

- **Canvas render loop / DPR** — `src/components/Battlefield.tsx:158-181`. `Canvas`
  uses `frameloop="always"`, `shadows`, and a **clamped** `dpr={[quality.dpr.min,
  quality.dpr.max]}` (line 168), plus a renderer hook
  `configureBattlefieldRenderer` (line 169, defined at 184+). Matches the r3f
  guidance to bound DPR and centralise renderer setup.
- **Adaptive quality** — `src/components/QualityController.tsx` uses drei's
  `PerformanceMonitor` (import line 3, mount ~line 91) to map FPS bands onto
  `detectedQualityTier`, and mirrors the resolved tier into
  `RENDERER_VISUAL_CONFIG.performanceTier` (lines 63-67) before children render so
  material factories compile with the right defines. `src/components/DynamicResScaler.tsx`
  drives DPR from an EMA of frame delta (`useFrame` at line 98, EMA at 101-107,
  DPR clamp/step at 117-134). Both are the recommended pattern (measure → adapt).
- **Sim loop budget / guards** — `src/components/BattlefieldSystems.tsx`. The
  accumulator loop clamps `maxSubSteps` via `clampSimulationSubsteps`
  (`MAX_ALLOWED_SIMULATION_SUBSTEPS = 5`, lines 9-25) and clamps the accumulator to
  `step * maxSteps` (line 66), then breaks the inner loop when
  `performance.now() - loopStart > SIMULATION_TIME_BUDGET_MS` (line 84,
  `SIMULATION_TIME_BUDGET_MS = 12`, line 15). This is a correct death-spiral guard.
- **Instancing / geometry reuse** — `src/utils/projectileGeometries.ts` caches
  `BufferGeometry` in a module-level `geometryCache` Map (line 8) and attaches
  render metadata to `geometry.userData`, so geometry is created once per
  bullet type. `scripts/bench/projectile-stress.mjs` exercises the instanced
  allocator; `docs/renderer-instancing-audit.md` documents the draw-call reduction
  plan.
- **Allocation hygiene** — `src/utils/tempVectors.ts` exposes a documented
  module-scoped scratch pool (`TEMP_VEC3_0…N`, `FORWARD`, `DEFAULT_FALLBACK`) with
  an explicit "do not retain references" contract; `src/utils/cappedBuffer.ts`
  provides `appendCappedMutable` for bounded buffers. `docs/performance-best-practices.md`
  codifies "no allocations in hot paths", "iterate over array methods", and "use
  temp vectors" (Core Principles, lines 5-11).
- **Postprocessing** — `src/components/PostprocessingLazy.tsx` splits the heavy
  postprocessing chunk behind `React.lazy` + `Suspense` (lines 3-11), keeping it
  out of the main bundle. `docs/postprocessing-pipeline.md` documents the pipeline.
- **Perf overlay** — `src/components/PerfMonitorOverlay.tsx` mounts `r3f-perf`'s
  `Perf` (import line 3, render ~line 133) behind a UI-store toggle so it is not
  always-on.

**Gaps found (source-level):**

1. **`SpatialGrid.queryNearest` is the dominant AI cost.** A CPU profile of the
   default harness attributes **64.2% of self samples** to
   `queryNearest` (`src/utils/spatialGrid.ts:195-256`). The method expands
   Chebyshev cell shells `r = 0, 1, 2, …` and decrements `remaining` per populated
   cell; for two far-apart fleets (this harness places blue/red ~640 units apart)
   the nearest-enemy search walks many shells, and the early-out
   `bestDistSq < r*r*cellSizeSq` is only reachable after several rings. It is
   called per ship from `src/game/systems/decision/blackboard/refreshBlackboard.ts:131`
   with the sensor grid (`cellSize` up to 300, `src/game/systems/sensors.ts:19-21`).
   This is the concrete hot path behind the AI budget failure.
2. **Super-linear scaling with ship count** — 300 → 450 ships costs ≈4.6×
   (see extended-load table). Consistent with (1): more ships → more populated
   cells and more `queryNearest` calls.
3. **`dist/rapier` and `dist/workers/simulation.worker` are large chunks** (4.33 MB
   / 4.59 MB). Both are inherently heavy (WASM physics / worker), so this is a
   note rather than a defect; `docs/renderer-instancing-audit.md` already tracks
   renderer-side wins.

## Top findings (ranked)

1. **AI budget fails, and the gap is not environment drift.** Measured default
   `avgTick` is `3.098–3.259 ms` vs the `2.500 ms` budget (**125.9% utilization,
   FAIL**), against `1.493 ms` recorded for v2.0.6b. A direct A/B (below) shows the
   v2.0.6b decision code measures `≈0.46 ms` on **this same machine and Node**, so
   the current code is **≈6.6× slower** for an identical workload. Severity: high.
2. **`queryNearest` dominates the AI tick** (64.2% of profile self-time,
   `src/utils/spatialGrid.ts:195-256`). Severity: high — this is the actionable
   cause.
3. **AI cost scales super-linearly**: 450 ships ≈ 14.5 ms/tick (413% of the 3.5 ms
   extended budget). Severity: medium (Task 3 concern).
4. **The AI harness was broken from PR #640 (2026-10-09) until Task 1**
   (`35461c72` removed `__aiTestHooks`; `4c218f86` restored the harness on the
   public `updateDecisionSystem` export). Any CI "green" for `perf:ai-budget`
   during that window was not a measurement. Severity: medium (process).
5. **Renderer best practices are broadly followed** — bounded DPR, adaptive
   quality, sim-loop budget guard, geometry caching, lazy postprocessing, opt-in
   perf overlay (see audit). Severity: low / informational.

## Drift vs regression

**Question.** The budget moved from `1.493 ms` (v2.0.6b, 2025-12-29) to
`≈3.1 ms` now. Is that environment drift (Node 24 / M4) or a genuine AI
regression?

**Evidence gathered.**

1. **Node-major sensitivity is real but does not explain the gap in the historical
   direction.** Running the _identical current harness_ on the second Node major
   installed here (`v26.10.0` via `/opt/homebrew/bin/node`):

   ```
   [ai-budget] ships=300 ticks=160 avgTick=4.881ms budget=2.500ms
   [ai-budget] ships=300 ticks=160 avgTick=4.723ms budget=2.500ms
   [ai-budget] ships=300 ticks=160 avgTick=4.955ms budget=2.500ms
   ```

   Node 26 is **slower** (~4.88 ms median) than Node 24 (~3.15 ms) for this
   workload, while a generic arithmetic benchmark is equal on both (~52 ms), so the
   harness is workload-specifically Node-sensitive. Crucially, **Node 22 is not
   available** (no `nvm`/`fnm`/`volta`; only Node 24 and 26 are installed), so the
   _older_ runtime used for the historical `1.493 ms` **cannot be reproduced here**.
   This confound is therefore **unresolved** — but see (3).

2. **The harness workload did not change.** `scripts/perf/assert-ai-budget.ts` was
   last meaningfully changed before the v2.0.6b measurement (created 2025-09-22,
   fixture import 2025-09-30) and only repaired by Task 1; `git log --follow` shows
   no workload change in between. Instrumented runs confirm **identical work**:
   both v2.0.6b and current code process `totalDecisions=3200`,
   `totalSkipped=0`, `tickIndex=160`, `lastSliceSize=20` (20 ships/tick × 160
   ticks) with the same fixture config (`tickInterval: 0.1`, `maxPerTick: 20`).
3. **Direct A/B on identical hardware/Node** — the decisive experiment. A detached
   worktree at the v2.0.6b review commit (`6b96fcae`) was run with the _same_
   Node 24 binary, the _same_ `tsx`, and the _same_ shared `node_modules`:

   | Code                 | Runs (ms)                                   | min / median / max          |
   | -------------------- | ------------------------------------------- | --------------------------- |
   | v2.0.6b (`6b96fcae`) | `0.460`, `0.478`, `0.459`                   | `0.459` / `0.460` / `0.478` |
   | current (`4c218f86`) | `3.148`, `3.250`, `3.116`, `3.098`, `3.259` | `3.098` / `3.148` / `3.259` |

   Both process the same 3200 decisions. So the **current decision workload is
   ≈6.6× more expensive per identical unit of work** on the same machine.

4. **The historical `1.493 ms` was measured on a _slower_ environment than this
   one.** The v2.0.6b code runs at `≈0.46 ms` here, ~3.2× faster than its own
   recorded `1.493 ms`. If environment drift were the cause of the current gap, the
   drift would have to make this M4/Node-24 machine _slower_ than the 2025
   environment — the A/B shows the opposite. Drift therefore pushes the current
   number **down**, not up.
5. **The AI decision code changed substantially** since the historical figure: 15
   commits touched `src/game/systems/decision/` since 2025-12-29, including the
   broad-phase nearest-enemy work `cca29a28` (#642) and `00a23320` (#642),
   scratch-temp pooling `37aff1e1` (#663), barrel extraction `4e2c15ee` (#676),
   plus large refactors (`5e0009cc`) and the Vite-Plus/dependency migration
   (`8f68b013`, `66f0e5ed`). Several of these were _intended as_ perf wins, which
   makes the measured 6.6× increase notable.

**Verdict: genuine cost increase in the measured AI workload — not explained by
environment drift (high confidence).** The same harness does the same 3200
decisions; the same machine/Node runs the old code ~6.6× faster; and drift would
move the number the wrong way. The residual uncertainty is _why_ it is slower:
whether the extra cost is intended AI-v2 feature growth or an unintended
regression is **not** determined here. The older-Node confound (the historical
`1.493 ms` was likely on Node ≤22) remains **unresolved because no Node 22 is
available offline**; it is not needed to reject drift as the dominant cause, but it
prevents reconstructing the exact historical number.

**Confidence:** high that this is a real in-workload cost increase; medium on
"regression vs intended feature growth"; the exact historical runtime is
unresolved.

## What would resolve this

1. **Install a second/older Node major** (Node 22 LTS) offline, then re-run
   `pnpm run perf:ai-budget` on both Node 22 and Node 24. This reconstructs the
   historical environment and pins the drift component exactly.
2. **Bisect the decision subsystem** between `6b96fcae` and HEAD with the A/B
   method used here (worktree + shared `node_modules`), to attribute the 6.6× to a
   specific commit/PR rather than "AI v2".
3. **Optimise or bypass `queryNearest`** for the far-fleet case (e.g. cache the
   nearest-enemy result across the sensor throttle window, or fall back to a
   linear scan when populated cells are few — `queryBroad` already implements that
   heuristic for the non-nearest path), then re-measure.
4. **Decide the budget** in Task 3 against the evidence above (default and
   extended), explicitly separating "intended feature growth" from "regression".

## Determinism statement

Tasks 1–2 change **no** simulation logic and **no** budgets/thresholds. Task 1
repaired the harness import only; Task 2 is measurement + documentation only. No
seeded RNG paths, `GameState` shapes, or system behaviour are modified. The
`1.493 ms`, `2.5 ms`, and `3.5 ms` figures are quoted, not changed.

## See also

- `docs/performance-best-practices.md` — hot-path allocation and iteration rules.
- `docs/renderer-instancing-audit.md` — draw-call reduction plan.
- `docs/postprocessing-pipeline.md` — postprocessing pipeline.
