## Plan: Clean Up AI Scenario Harness Shims

TL;DR: Confirm `test/support/aiScenarioHarness` as the canonical test-only API, prune obsolete/duplicate shims, and enforce no runtime coupling. All changes will be validated via Vitest.

**Phases 4**

1. **Phase 1: Discover and Classify Harness Shims**
   - **Objective:** Enumerate harness modules and classify symbols by usage to drive safe changes.
   - **Files/Functions to Modify/Create:** None (read-only). Inspect `test/support/aiScenarioHarness.ts`, `test/support/aiScenarioHarness/**`, `test/vitest/ai-scenario-harness.spec.ts`, `src/**`, `scripts/**`.
   - **Tests to Write:** None; output is classification used by later phases.
   - **Steps:**
     1. Enumerate harness-related files and exports.
     2. Find usages in `test/**`, `src/**`, `scripts/**`.
     3. Classify each symbol as `CANONICAL_HARNESS_API`, `TEST_ONLY_WRAPPER`, `DUPLICATE_BUILDER`, `UNUSED`, or `RUNTIME_LEAK`.
     4. Use this map as input for Phases 2–4.

2. **Phase 2: Protect Canonical Boundaries with Tests**
   - **Objective:** Lock in the harness public API and enforce test-only usage.
   - **Files/Functions to Modify/Create:** `test/vitest/ai-scenario-harness.spec.ts`, small helper under `test/support/` if needed.
   - **Tests to Write:**
     - Assert harness exports (`runAIScenario`, `collectTestMetrics`, relevant types).
     - Vitest-based guard that fails if any `src/**` file imports from `test/support/aiScenarioHarness`.
   - **Steps:**
     1. Add/extend tests that assert expected harness exports.
     2. Add Vitest test that scans for forbidden imports under `src/**`.
     3. Run Vitest to confirm green; adjust if any violations exist.

3. **Phase 3: Remove Unused and Duplicate Shims**
   - **Objective:** Simplify harness internals; keep minimal custom shims required for headless determinism.
   - **Files/Functions to Modify/Create:** Identified `UNUSED` and `DUPLICATE_BUILDER` items in `test/support/aiScenarioHarness/**`.
   - **Tests to Write:**
     - Ensure existing golden-log tests (escort, bomber intercept, artillery retreat) still pass.
     - Add/adjust tests if needed for edge scenarios covered by removed shims.
   - **Steps:**
     1. Remove unused diagnostics/shims and rerun Vitest.
     2. For duplicate builders, refactor to delegate to canonical production helpers where safe.
     3. Keep only minimal Rapier/GameState shims that are essential for harness operation.

4. **Phase 4: Finalize Boundaries and Documentation**
   - **Objective:** Ensure no runtime leaks and document the harness as stable, minimal, and test-only.
   - **Files/Functions to Modify/Create:** Any leaking `src/**` usage (if found), `docs/ai-v2-rollout.md`, `memory/core-aiScenarioHarness.md`.
   - **Tests to Write:**
     - Keep and rely on the Vitest guard enforcing no `test/support/aiScenarioHarness` imports from `src/**`.
   - **Steps:**
     1. Fix any runtime leaks discovered by the guard.
     2. Update docs/memory to reflect the cleaned-up, minimal harness.
     3. Run Vitest to confirm all checks passing.

**Open Questions**

- Resolved by user:
  - Keep minimal custom shims where needed.
  - No external tools depend on harness internals.
  - Use a Vitest-based guard for runtime import violations.
  - Remove unused diagnostics where safe.
