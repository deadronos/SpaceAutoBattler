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
| Commit            | `4c218f862cdcd529aa045f557e2ed691e950a52e` | `git rev-parse HEAD` — the **measured revision**      |
| Node (measured)   | `v24.21.0`                                 | `node -v`                                             |
| pnpm              | `10.33.0`                                  | `pnpm -v`                                             |
| OS / arch         | `Darwin arm64`                             | `uname -sm`                                           |
| CPU               | `Apple M4`                                 | `sysctl -n machdep.cpu.brand_string`                  |
| Second Node major | `v26.10.0`                                 | `/opt/homebrew/bin/node --version`                    |
| Node 22           | **not available**                          | no `nvm`/`fnm`/`volta`; only Node 24 and 26 installed |

The measured Node (`v24.21.0`) is the one on `PATH` via `~/.vite-plus/bin/node`,
which is what `pnpm run …` resolves to. The recorded `Commit` is the **measured
revision** — the tree the numbers below were captured on — not this document's own
HEAD. The historical figures in
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

Three consecutive runs (Task 2, commit `0f8eaf33`):

```
[ai-budget] ships=450 ticks=200 avgTick=14.416ms budget=3.500ms
[ai-budget] FAIL: average AI tick 14.416ms exceeds budget 3.500ms
[ai-budget] ships=450 ticks=200 avgTick=14.461ms budget=3.500ms
[ai-budget] FAIL: average AI tick 14.461ms exceeds budget 3.500ms
[ai-budget] ships=450 ticks=200 avgTick=14.820ms budget=3.500ms
[ai-budget] FAIL: average AI tick 14.820ms exceeds budget 3.500ms
```

**Load-sensitive / indicative.** This configuration is CPU-bound and sensitive to
background load and thermal state, so its absolute values are less reproducible
than the default gate. Five fresh runs on the same machine and Node
(`4c218f86`):

```
[ai-budget] ships=450 ticks=200 avgTick=14.649ms budget=3.500ms
[ai-budget] ships=450 ticks=200 avgTick=14.836ms budget=3.500ms
[ai-budget] ships=450 ticks=200 avgTick=14.911ms budget=3.500ms
[ai-budget] ships=450 ticks=200 avgTick=14.740ms budget=3.500ms
[ai-budget] ships=450 ticks=200 avgTick=14.813ms budget=3.500ms
```

An independent reviewer machine measured `16.97 / 17.67 / 17.93` ms for the same
configuration, i.e. ~15–20% higher — consistent with load sensitivity, not a code
difference. Treat these absolute values as **indicative**; the default 300/160
configuration is the stable gate.

| Metric               | Task 2 (3 runs)                   | Re-run (5 runs)                   |
| -------------------- | --------------------------------- | --------------------------------- |
| min / median / max   | `14.416` / `14.461` / `14.820` ms | `14.649` / `14.813` / `14.911` ms |
| budget               | 3.500 ms                          | 3.500 ms                          |
| utilization (median) | **413.2%**                        | **423.2%**                        |
| verdict              | **FAIL** (exit code 1)            | **FAIL** (exit code 1)            |

The extended run fails far worse (≈4.2× over budget) than the default run (1.26×),
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
**indicative** CPU cost only. This harness is functionally unchanged since the
v2.0.6b review; its only later edit (`8f68b013`, the Vite-Plus migration) was a
formatting change with no effect on the measured paths.

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

## Task 3 resolution — Branch B: one targeted `queryNearest` optimization

Task 2 left the gate red and asked Task 3 to pick between re-baselining
(Branch A) and one targeted optimization (Branch B).

**Branch decision: B — one targeted optimization. Branch A was invalidated by
Task 2's evidence.** Re-baselining is only justified when the gap is environment
drift; Task 2's same-machine/same-Node A/B (old code `≈0.46 ms` vs current
`≈3.2 ms` for an identical 3200-decision workload) shows the extra cost is in
the measured AI workload, not the environment. Raising the budget would therefore
have masked a real regression, so the budget was **left at 2.5 ms**.

With the gate green again (see below), the stale `|| echo "…known issue with test
harness"` swallow was removed from `.github/workflows/experiment-metrics.yml`
(its "known issue" no longer exists). That workflow's `push`/`pull_request`
triggers remain commented out — it runs on `workflow_dispatch` only — because the
absolute budget is machine-specific; enforce it deliberately rather than on every
push.

### The optimization

`src/utils/spatialGrid.ts` — `queryNearest` only. The method expanded Chebyshev
cell shells `r = 0, 1, 2, …` until its distance early-out fired. For candidates
that sit several cells away (the far tail in this harness: 22 ships terminate at
ring 9 ≈ 5 800 empty-cell `Map.get`s each) the shell enumerates vastly more empty
cells than the grid actually populates.

The change keeps the shell for the cheap close case and, once the shell has
probed more cells than the grid populates (`(2r+1)^3 > cells.size`), finishes
with an **exact linear scan** over the populated cells from the current
incumbent. Both paths minimise the same global `(distanceSq, rank)` key, and the
shell's early-out is provably optimal, so the cutoff is a **pure performance
knob**: it cannot change the result. The change adds **no result buffers and no
per-item allocation** — a single incumbent is retained; the only new allocation is
the `Map` iterator created by the linear finish's `cells.values()` (one per bailed
query, not per item) — and it does not touch the decision system, RNG, or
`GameState`.

Correctness scope note: for a _non-injective_ `rank` the `(distanceSq, rank)`
minimum is not unique and the two paths could pick different items; every real
caller (`refreshBlackboard` → unique ship id → unique `ships` index) ranks
injectively, so results are identical. The equivalence specs below pin this.

### Before / after (same machine, Node `v24.21.0`, Apple M4)

Default harness (300 ships / 160 ticks / 2.5 ms):

```
# before — Task 2, commit 0f8eaf33 (5 runs)
[ai-budget] ships=300 ticks=160 avgTick=3.148ms budget=2.500ms  FAIL
[ai-budget] ships=300 ticks=160 avgTick=3.250ms budget=2.500ms  FAIL
[ai-budget] ships=300 ticks=160 avgTick=3.116ms budget=2.500ms  FAIL
[ai-budget] ships=300 ticks=160 avgTick=3.098ms budget=2.500ms  FAIL
[ai-budget] ships=300 ticks=160 avgTick=3.259ms budget=2.500ms  FAIL

# after — Task 3 (5 runs, same machine)
[ai-budget] ships=300 ticks=160 avgTick=0.668ms budget=2.500ms  PASS
[ai-budget] ships=300 ticks=160 avgTick=0.689ms budget=2.500ms  PASS
[ai-budget] ships=300 ticks=160 avgTick=0.669ms budget=2.500ms  PASS
[ai-budget] ships=300 ticks=160 avgTick=0.642ms budget=2.500ms  PASS
[ai-budget] ships=300 ticks=160 avgTick=0.670ms budget=2.500ms  PASS
```

| Metric               | Before (Task 2)                | After (Task 3)                 |
| -------------------- | ------------------------------ | ------------------------------ |
| min / median / max   | `3.098` / `3.148` / `3.259` ms | `0.642` / `0.669` / `0.689` ms |
| budget               | 2.500 ms                       | 2.500 ms                       |
| utilization (median) | **125.9%**                     | **26.8%**                      |
| verdict              | **FAIL** (exit 1)              | **PASS** (exit 0)              |
| speed-up (median)    | —                              | **≈4.7×**                      |

(An earlier, busier-machine run of the same "after" code measured
`0.771–0.812 ms`; the verdict is stable, only the absolute value drifts with
load.)

Extended load (450 ships / 200 ticks / 3.5 ms) — **load-sensitive / indicative**
(see the extended-load note above; a reviewer machine measured `~17–18 ms` for the
same "before" configuration):

```
# before — Task 2 (3 runs): 14.416 / 14.461 / 14.820 ms                          FAIL
# before — re-run (5 runs): 14.649 / 14.836 / 14.911 / 14.740 / 14.813 ms       FAIL
# after  — Task 3 (5 runs): 1.198 / 1.206 / 1.321 / 1.194 / 1.203 ms             PASS
```

| Metric      | Before (re-run, 5) | After (Task 3, 5) |
| ----------- | ------------------ | ----------------- |
| median      | `14.813` ms        | `1.203` ms        |
| utilization | **423.2%**         | **34.4%**         |
| verdict     | FAIL               | PASS              |
| speed-up    | —                  | **≈12.3×**        |

The extended run improves the most, which is expected: its far tail is where the
shell enumeration dominated.

### Determinism evidence

The optimization changes no simulation result. The **behavioural evidence is the
equivalence specs**, which compare the new path against the old/independent
reference:

- `test/vitest/nearest-enemy-grid.spec.ts` — the sensor-grid `queryNearest` path
  must produce byte-identical `nearestEnemy` maps to the legacy O(N²) double-loop
  fallback, including cross-cell exact-distance ties resolved by `ships` index.
  **green.**
- `test/utils/spatial-grid.spec.ts` — `queryNearest` must match a brute-force
  nearest over a 5×5×3 query sweep, including exact ties resolved by `rank`.
  **green.**
- A temporary probe compared the new method against the previous shell algorithm
  for all 300 harness ships: identical winners (`sink` hash identical), then the
  probe was deleted.

Run-to-run **reproducibility** is covered separately by `pnpm test`, which includes
`test/vitest/ai-determinism.spec.ts` (exact per-ship command/intent snapshots over
40 ticks) and `test/vitest/sim-state-isolation.spec.ts` — both **green**. Note that
`ai-determinism.spec.ts` runs the same (new) code twice and compares, so it proves
deterministic reproducibility, **not** old-vs-new equivalence; the two specs above
are the equivalence evidence.

### Commands run (Task 3)

| Command                   | Result                                                                          |
| ------------------------- | ------------------------------------------------------------------------------- |
| `pnpm run typecheck`      | PASS (no output)                                                                |
| `pnpm exec vp check`      | PASS — 0 errors, 46 pre-existing warnings (360 files)                           |
| `pnpm test`               | PASS — 193 passed + 1 skipped (194 files); 1184 passed + 1 skipped (1185 tests) |
| `pnpm run perf:ai-budget` | **PASS** — `0.642–0.689 ms` (was FAIL)                                          |
| `AI_BUDGET_SHIPS=450 …`   | **PASS** — `1.203 ms` median of 5 (was FAIL)                                    |
| `pnpm run build`          | PASS — `built in 945ms`, `real 9.06 s`                                          |

No new spec file → CI floor stays at 194 files. No `dist/` edit.

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
  `BufferGeometry` in a module-level `geometryCache` Map (line 10) and attaches
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

1. **`SpatialGrid.queryNearest` is the dominant AI cost.** CPU profiles of the
   default harness attribute the dominant share of self samples to
   `queryNearest` (`src/utils/spatialGrid.ts:195-256`) — **≈64%** in Task 2's
   profile and **≈59%** in an independent reviewer profile, so the exact figure is
   **indicative**. The method expands Chebyshev cell shells `r = 0, 1, 2, …` and
   decrements `remaining` per populated cell. In this harness the blue and red
   grids are interleaved over a wide span (they overlap on X) and the adaptive
   `cellSize` resolves to 40, so most ships find a nearest enemy within one cell —
   but a tail sits 3–9 cells away, where the shell walks thousands of empty cells
   and the early-out `bestDistSq < r*r*cellSizeSq` is only reachable after several
   rings. It is called per ship from
   `src/game/systems/decision/blackboard/refreshBlackboard.ts:131`
   with the sensor grid (`cellSize` 40–300, `src/game/systems/sensors.ts:19-21`).
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
   **Resolved in Task 3** (Branch B): one `queryNearest` optimization brings the
   default run to `0.642–0.689 ms` (**26.8% utilization, PASS**) — see
   [Task 3 resolution](#task-3-resolution--branch-b-one-targeted-querynearest-optimization).
2. **`queryNearest` dominates the AI tick** (≈59–64% of profile self-time,
   `src/utils/spatialGrid.ts:195-256`). Severity: high — this is the actionable
   cause. **Resolved in Task 3** by bailing from empty-shell enumeration to an
   exact linear scan once the shell probes more cells than the grid populates.
3. **AI cost scales super-linearly**: 450 ships ≈ 14.8 ms/tick (423% of the 3.5 ms
   extended budget). Severity: medium. **Resolved in Task 3**: the extended run is
   now `1.203 ms` (34.4% of the 3.5 ms extended budget; load-sensitive).
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
   workload — a measured ratio of **≈1.55×** — so the harness is
   workload-specifically Node-sensitive. Crucially, **Node 22 is not
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
3. **Direct A/B on identical hardware/Node** — the decisive experiment. Both sides
   are detached worktrees sharing this repo's `node_modules`, run with the _same_
   Node 24 binary (`v24.21.0`) and the _same_ `tsx` shim. Exact commands and raw
   output:

   ```
   # v2.0.6b side — scripts/perf/assert-ai-budget.ts @ 6b96fcae,
   # which imports `__aiTestHooks.updateDecisionSystem` (the pre-Task-1 form).
   $ WT=/private/var/folders/mn/p9h8gvw12zgbk49ydw6qjgy80000gq/T/opencode
   $ git worktree add --detach "$WT/sab-ab-6b96fcae" 6b96fcae
   $ ln -s "$PWD/node_modules" "$WT/sab-ab-6b96fcae/node_modules"
   $ cd "$WT/sab-ab-6b96fcae"
   $ ./node_modules/.bin/tsx scripts/perf/assert-ai-budget.ts
   [ai-budget] booting harness
   [ai-budget] ships=300 ticks=160 avgTick=0.450ms budget=2.500ms
   [ai-budget] PASS: average AI tick 0.450ms within budget 2.500ms
   [ai-budget] ships=300 ticks=160 avgTick=0.458ms budget=2.500ms
   [ai-budget] PASS: average AI tick 0.458ms within budget 2.500ms
   [ai-budget] ships=300 ticks=160 avgTick=0.458ms budget=2.500ms
   [ai-budget] PASS: average AI tick 0.458ms within budget 2.500ms

   # current side — scripts/perf/assert-ai-budget.ts @ 4c218f86 (Task 1 repair,
   # public `updateDecisionSystem` export).
   $ git worktree add --detach "$WT/sab-ab-4c218f86" 4c218f86
   $ ln -s "$PWD/node_modules" "$WT/sab-ab-4c218f86/node_modules"
   $ cd "$WT/sab-ab-4c218f86"
   $ ./node_modules/.bin/tsx scripts/perf/assert-ai-budget.ts
   [ai-budget] booting harness
   [ai-budget] ships=300 ticks=160 avgTick=3.294ms budget=2.500ms
   [ai-budget] FAIL: average AI tick 3.294ms exceeds budget 2.500ms
   [ai-budget] ships=300 ticks=160 avgTick=3.223ms budget=2.500ms
   [ai-budget] FAIL: average AI tick 3.223ms exceeds budget 2.500ms
   [ai-budget] ships=300 ticks=160 avgTick=3.398ms budget=2.500ms
   [ai-budget] FAIL: average AI tick 3.398ms exceeds budget 2.500ms
   [ai-budget] ships=300 ticks=160 avgTick=3.170ms budget=2.500ms
   [ai-budget] FAIL: average AI tick 3.170ms exceeds budget 2.500ms
   [ai-budget] ships=300 ticks=160 avgTick=3.180ms budget=2.500ms
   [ai-budget] FAIL: average AI tick 3.180ms exceeds budget 2.500ms
   ```

   | Code                 | Runs (ms)                                   | min / median / max          |
   | -------------------- | ------------------------------------------- | --------------------------- |
   | v2.0.6b (`6b96fcae`) | `0.450`, `0.458`, `0.458`                   | `0.450` / `0.458` / `0.458` |
   | current (`4c218f86`) | `3.294`, `3.223`, `3.398`, `3.170`, `3.180` | `3.170` / `3.223` / `3.398` |

   Both process the same 3200 decisions. So the **current decision workload is
   ≈7× more expensive per identical unit of work** on the same machine (median
   `3.223 / 0.458 = 7.0×`; Task 2's earlier runs gave ≈6.6×).

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
   heuristic for the non-nearest path), then re-measure. **Done in Task 3**
   (Branch B): the shell now bails to an exact linear scan once it has probed more
   cells than the grid populates.
4. **Decide the budget** in Task 3 against the evidence above (default and
   extended), explicitly separating "intended feature growth" from "regression".
   **Decided in Task 3:** the budget is unchanged (`2.5 ms` / `3.5 ms`); the
   regression was fixed at source (Branch B) rather than re-baselined.

## Determinism statement

Tasks 1–2 change **no** simulation logic and **no** budgets/thresholds. Task 1
repaired the harness import only; Task 2 is measurement + documentation only. No
seeded RNG paths, `GameState` shapes, or system behaviour are modified. The
`1.493 ms`, `2.5 ms`, and `3.5 ms` figures are quoted, not changed.

Task 3 changes one method (`SpatialGrid.queryNearest`) for speed only. Its linear
finish minimises the same `(distanceSq, rank)` key as the shell walk it replaces,
and every caller ranks by a unique id → index, so the selected item is identical.
No `GameState`, budget, threshold, or RNG path is touched. The grid **equivalence**
specs (`nearest-enemy-grid.spec.ts`, `spatial-grid.spec.ts`) pin old-vs-new
behaviour and pass unchanged; `ai-determinism.spec.ts` and
`sim-state-isolation.spec.ts` pin run-to-run reproducibility and also pass.

## See also

- `docs/performance-best-practices.md` — hot-path allocation and iteration rules.
- `docs/renderer-instancing-audit.md` — draw-call reduction plan.
- `docs/postprocessing-pipeline.md` — postprocessing pipeline.
