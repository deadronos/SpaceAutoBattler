# Vitest — Configuration Coverage Report

Date: 2025-09-04

This document summarizes how well the Vitest suite exercises configuration-driven behavior from `src/config/*`. It lists important test files (or groups), assigns a percent score for how well each one captures the codebase and configured values, and gives concise rationale and recommendations.

## Summary

- Total Vitest files scanned: ~152
- Files that directly import `/src/config/*`: ~30
- Files that use `createMockGameState` or otherwise derive state from config: ~40–50
- Tests with very little or no config coverage: ~60–80

Aggregate estimate: ~40% effective coverage of config-driven behavior across the whole test suite.

---

## Scoring rubric

- 90–100%: Excellent — directly verifies many config values, derives expectations from config, resists hard-coded literals, and tests config-driven behavior end-to-end.
- 60–89%: Good — imports config or uses fixtures derived from config; covers some config-driven behaviors but misses edge-cases or integration points.
- 30–59%: Partial — touches config or uses mock state but mostly asserts implementation details or hard-coded values rather than config-driven outcomes.
- 0–29%: Low/None — no real config coverage (utility/unit tests for pure algorithms or rendering stubs).

---

## High-value tests (direct config consumers)

- `test/vitest/config-entities.spec.ts` — 95%
  - Rationale: Canonical validator of `entitiesConfig`. Imports `TURRET_CONFIGS` and `SHIP_CLASS_CONFIGS`, uses getters, derives expectations (no magic numbers), validates structure and scaling relationships.
  - Recommendation: Keep as-is; consider adding property range checks for newly added turret keys.

- `test/vitest/turret-accuracy-config.spec.ts` — 85%
  - Rationale: Tests turret accuracy scaling using `DEFAULT_BEHAVIOR_CONFIG` values. Validates per-level scaling and caps.
  - Recommendation: Parameterize with turret values pulled from `TURRET_CONFIGS` and add explicit cap edge-case checks.

- `test/vitest/setupTests.ts` (fixtures) — 90%
  - Rationale: Central fixture file; derives ship, bullet, and game state defaults from `getShipClassConfig`, `TURRET_CONFIGS`, and `DEFAULT_BEHAVIOR_CONFIG` so many tests become implicitly config-aware.
  - Recommendation: Add a small guard test ensuring fixtures are always derived from config (prevents drifting to hard-coded defaults).

- `test/vitest/renderer-orchestrator.spec.ts` — 72%
  - Rationale: Uses `getShipClassConfig` and `TURRET_CONFIGS` to build renderer inputs. Good coupling to config but limited assertions for config-driven rendering branches.
  - Recommendation: Add tests toggling `rendererConfig` flags and assert distinct code paths.

- `test/vitest/renderer-modules.spec.ts` & `renderer-modules-advanced.spec.ts` — 70–75%
  - Rationale: Dynamically import renderer-related configs and run module-level tests. Good base; needs parameterized runs to exercise alternate renderer configs.
  - Recommendation: add `describe.each` variants for LOD/instancing flags.

- `test/vitest/renderer-module-extraction.spec.ts` — 75%
  - Rationale: Validates extraction logic using `getShipClassConfig` and `TURRET_CONFIGS`.
  - Recommendation: Add tests for different `shipVisualConfig` options.

- `test/vitest/projectile-sampling.integration.spec.ts` — 80%
  - Rationale: Imports `entitiesConfig` and `DEFAULT_BEHAVIOR_CONFIG`, overrides `simConfig` values; good integration coverage.
  - Recommendation: test multiple `bulletLifetime` and `tickRate` cases.

- `test/vitest/healthBarInstancer.unit.spec.ts` / `healthBarInstancer.spec.ts` — 65–75%
  - Rationale: Use `getShipClassConfig` and `RendererConfig`. Mostly structural checks; add tests that verify different renderer configs change outputs.

- `test/vitest/designerTurretBehavior.spec.ts` — 80%
  - Rationale: Uses `TURRET_CONFIGS` to validate turret behavior; focused and useful.

`test/vitest/core-entities.spec.ts` — 80%
  - Rationale: Uses `getShipClassConfig` for entity defaults and validates core entity logic.

`test/vitest/systems-spawn.spec.ts` — 80%
  - Rationale: Mutates `gameState.behaviorConfig.globalSettings.enableSpawnJitter` and asserts spawn behavior — good feature flag testing.

`test/vitest/spatial-*.spec.ts` (integration/functional/benchmark) — 75–85% across files
  - Rationale: Many spatial tests toggle `enableSpatialIndex` and rely on `simConfig.simBounds`/`spatialGrid.cellSize`. They explicitly toggle config flags and validate behavior differences.
  - Recommendation: Add parameterized cases for `spatialGrid.cellSize` and `simBounds` sizes to validate edge-case bucketization.

If you want, I can:

- Produce a per-file CSV with a 1-line rating for all ~152 tests (automated scan and output). This will enumerate exact files and suggested edits.
- Implement a few of the prioritized test changes (small patches) and run the test suite.

- `test/vitest/ai-separation.spec.ts` — 70%
  - Rationale: Imports `DefaultSimConfig` and tests separation thresholds; good but could include more `behaviorConfig` cluster thresholds.

- `test/vitest/engagement-debug*.spec.ts` — 60–70%
  - Rationale: Import `DEFAULT_BEHAVIOR_CONFIG` but mostly exercise debug flows; weaker assertions on production behavior.

---

## Tests with implicit config coverage (via fixtures)

Many tests use `createMockGameState` from `setupTests.ts`, which seeds the mock state from `DEFAULT_BEHAVIOR_CONFIG` and `getShipClassConfig`. These tests are implicitly config-aware but occasionally assert hard-coded numbers instead of deriving expected values from the same config objects. This reduces resilience to configuration changes.

Suggested change: prefer deriving expected values from `getShipClassConfig` / `TURRET_CONFIGS` inside tests to avoid brittle assertions.

Examples: many renderer and AI system tests — average: 65% config-awareness.

---

## Tests that do NOT cover config (utilities/math/pure algorithms)

Examples: `vector3.spec.ts`, `utils-rng.spec.ts`, some `spatial-benchmark` files. These are essential for correctness but do not guard config changes. Keep them as-is.

Average coverage in this group: 0–20% (intentionally low).

---

## Gaps & prioritized next steps (concrete)

1. Parametrize `turret-accuracy-config.spec.ts` to pull base turret accuracies from `TURRET_CONFIGS` and test max reduction edge-cases.
2. Add smoke tests for `fleetConfig.ts`, `physicsConfig.ts`, `cameraConfig.ts`, `rendererEffectsConfig.ts` to assert key keys exist and values fall in sensible ranges (e.g., `tickRate > 0`, `simBounds.width > 0`). Low risk, quick wins.
3. Convert 3 integration tests to `describe.each` over multiple `behaviorConfig` permutations: toggle `enableSpatialIndex`, `enableSpawnJitter`, and change `simBounds` sizes.
4. Add a `fixtures-guard.spec.ts` that asserts `createMockGameState()` uses `getShipClassConfig` / `DEFAULT_BEHAVIOR_CONFIG` for derived defaults (prevents fixture drift).
5. Replace a handful of hard-coded numeric expects with computed expectations derived from config in the most brittle tests (renderer sizing, turret damage, bullet TTL tests).

---

## Appendix — short file list (representative, not exhaustive)

- High coverage / canonical: `config-entities.spec.ts`, `turret-accuracy-config.spec.ts`, `setupTests.ts` (fixtures)
- Good coverage: `projectile-sampling.integration.spec.ts`, `core-entities.spec.ts`, `designerTurretBehavior.spec.ts`, `systems-spawn.spec.ts`
- Moderate coverage (renderer / visual): `renderer-orchestrator.spec.ts`, `renderer-modules*.spec.ts`, `renderer-module-extraction.spec.ts`, `healthBarInstancer*.spec.ts`
- Spatial & AI tests that toggle config flags: `spatial-*.spec.ts`, `scout-*.spec.ts`, `ai-separation.spec.ts`, `ai-unification-smoke.spec.ts`
- Utility-only tests: `vector3.spec.ts`, `utils-rng.spec.ts`, `spatial-benchmark.spec.ts` (benchmarks)

---

## Closing notes

Overall the suite has strong pockets of configuration-aware tests (entities, turret accuracy, spatial toggles, spawn jitter), and a solid fixture foundation in `setupTests.ts` that helps many tests remain implicitly config-aware. The main opportunities are: wider parametric tests across configuration permutations, replacing brittle hard-coded expectations with config-derived expectations, and adding small smoke tests for under-covered config modules.

If you want, I can:
- Produce a per-file CSV with a 1-line rating for all ~152 tests (automated scan and output). This will enumerate exact files and suggested edits.
- Implement a few of the prioritized test changes (small patches) and run the test suite.

---

Generated by repository analysis (Vitest files and `src/config/*`), 2025-09-04.
