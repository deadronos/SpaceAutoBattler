deadronos: identify 3 biggest legacy codepaths in src to remove/refactor out, report

GitHub Copilot: Created 4 todos

Starting (1/4) _Scan repository for legacy indicators_

Searched for files matching `**/src/**`, 20 matches

Searched text for `legacy|deprecated|TODO: legacy|// legacy|@deprecated|remove legacy|old system` (`**/src/**`), 9 results

Searched text for `legacy` (`**/src/**`), 6 results

Searched text for `Rapier|rapier|Ammo|physics|legacy physics|useRapier` (`**/src/**`), 20 results

Searched text for `@deprecated` (`**/src/**`), 2 results

Read [](file:///d%3A/GitHub/SpaceAutoBattler/src/game/aiScenarioHarness/stateBuilder.ts)

Read [](file:///d%3A/GitHub/SpaceAutoBattler/src/components/ExplosionRenderer.tsx)

Read [](file:///d%3A/GitHub/SpaceAutoBattler/src/renderer/starDiskMaterial.ts)

Read [](file:///d%3A/GitHub/SpaceAutoBattler/src/types/jsx-compat.d.ts)

Searched text for `patch|workaround|shim|polyfill|compat|fallback|legacy` (`**/src/**`), 200 results

Read [](file:///d%3A/GitHub/SpaceAutoBattler/src/game/aiScenarioHarness/rapierShim.ts)

Searched for files matching `**/src/game/aiScenarioHarness/**`, 10 matches

Read [](file:///d%3A/GitHub/SpaceAutoBattler/src/game/state.ts)

Starting (2/4) _Identify candidate legacy codepaths (top 10)_

Read [](file:///d%3A/GitHub/SpaceAutoBattler/src/game/systems/combat.ts)

Starting (3/4) _Analyze and prioritize top 3 for removal/refactor_

Completed (3/4) _Analyze and prioritize top 3 for removal/refactor_

I'll scan the codebase and recommend the three largest legacy code‑paths in src that you should remove or refactor (with rationale, risk, and migration suggestions).

## Summary — top 3 legacy codepaths to remove/refactor

1. Backwards-compatibility shims in core GameState & Miniplex facade
   - Key files: state.ts (Miniplex shims: `createEntity`/`destroyEntity`/`archetype`), combat.ts (compat re-export), and related defensive compatibility comments scattered across `src/game/*`.
   - Why it’s legacy: The project contains deliberate runtime shims that map old Miniplex APIs and older patterns to the current library shapes. These shims run in core game initialization and hide API mismatches between old code and current lib versions.
   - Impact (why remove/refactor):
     - Central, executed at runtime for every game instance — increases surface area for bugs and obscure behavior.
     - Hides real refactor work, prevents removing deprecated usage elsewhere.
     - Adds maintenance cost and makes reasoning about code harder (you have to remember the shim behavior).
   - Files touched (examples):
     - state.ts (major)
     - combat.ts (compat export facade)
     - Comments indicate other small compatibility fallbacks in config/metrics/others.
   - Recommended approach:
     1. Audit all call sites for the legacy Miniplex API (`createEntity`, `destroyEntity`, `archetype`, older query shapes like `.entities` on query objects).
     2. Replace usages with the current Miniplex API (`world.add`, `world.remove`, `world.with`, canonical query handling). Prefer automated codemods where possible (search + replace with verified patterns).
     3. Remove the shims from `createGameState()` only after all call sites are updated (remove in a separate commit/PR).
     4. Add unit tests exercising entity lifecycle and ensure no runtime regressions.
     5. Run `npx tsc --noEmit` and full test suite (`npm test`) between steps.
   - Effort & risk:
     - Effort: medium → large depending on how many old call sites exist across the codebase and tests.
     - Risk: high (touches core runtime). Do in small, validated steps: update code, run tests, remove shim.
   - Migration checklist:
     - Create codemods or automated search/replace tasks for obvious patterns.
     - Add integration tests that cover entity creation/removal and turret cleanup.
     - Stage removal: leave shim in place while converting all call sites, then remove in final PR.

2. AI scenario harness + Rapier shims (test harness living in aiScenarioHarness)
   - Key files: `src/game/aiScenarioHarness/*` (notably rapierShim.ts, stateFactory.ts, shipFactory.ts, stateBuilder.ts, integration.ts, metricsSummary.ts)
   - Why it’s legacy: The harness contains shimbed Rapier physics and legacy builders maintained for backward compatibility / test convenience. The folder mirrors runtime logic with simplified shims and includes deprecated stateBuilder.ts that re-exports older APIs purely for compatibility.
   - Impact (why remove/refactor):
     - Large chunk of code used for AI harness/testing; mixes production src with test/harness code.
     - Rapier shims are duplicative and easy to diverge from actual Rapier behavior. They can create a false sense of correctness in tests.
     - stateBuilder.ts is explicitly marked `@deprecated` and kept for backward compatibility — indicates this area is ripe for extraction or removal.
   - Files touched:
     - rapierShim.ts
     - stateFactory.ts
     - shipFactory.ts
     - stateBuilder.ts (exports deprecated items)
   - Recommended approach:
     1. Move the entire harness out of src to test (or a dedicated `tools/` or `dev-harness/` package) so it's not part of production imports/builds.
     2. Replace shimbed physics with small, explicit test doubles or rely on real Rapier in headless/fast-mode tests where appropriate.
     3. Remove stateBuilder.ts (deprecated) and update any consumers to import `shipFactory` and `stateFactory` directly from their new location.
     4. Tighten the harness API surface so it doesn’t accidentally get used by production code.
     5. Add tests that assert the harness behaves identically (or intentionally differently) to production code where needed.
   - Effort & risk:
     - Effort: medium.
     - Risk: medium. Mostly affects tests/harness code; production risk is low if you lift code out cleanly and update imports.
   - Migration checklist:
     - Search for any production imports of `aiScenarioHarness` content — convert to production-safe APIs or move consumers.
     - Create a `test/ai-harness/` or `tools/ai-harness/` location and update test runner configs if needed.
     - Run tsc and tests. Update CI to ensure harness is run where expected.

3. TypeScript JSX compatibility shims (global typing hacks)
   - Key files: jsx-compat.d.ts, jsx-shim.d.ts (temporary shims to make JSX and React types compatible after upgrades)
   - Why it’s legacy: These are permissive/global type shims that relax/disguise typing incompatibilities introduced by a React/types upgrade. They are intended to be temporary but affect type correctness across the codebase.
   - Impact (why remove/refactor):
     - Masks real typing issues and prevents moving to correct, stricter types (or to modern React typings).
     - Can allow subtle runtime typing mismatches to accumulate.
     - Affects many files through global declarations; removing requires migration of component return types and adjusting intrinsic element typings.
   - Files touched:
     - jsx-compat.d.ts
     - jsx-shim.d.ts
   - Recommended approach:
     1. Replace the permissive global shim with a minimal, correct typing setup aligned to the React version you’re targeting (e.g., upgrade `@types/react` or pin to types for React v19), or configure `tsconfig`/`types` resolution properly.
     2. Fix components that rely on `JSX.Element` misuse (update return types to `React.ReactElement` or `React.ReactNode` where appropriate).
     3. Add an incremental TypeScript strictness gate (enable stricter checks in CI for a subset or run `tsc` with strict flags locally to find problems).
     4. Remove shim files once the code compiles and tests pass without them.
   - Effort & risk:
     - Effort: small → medium (mostly compile/time fixes).
     - Risk: low → medium (type-only, but can reveal many places needing small edits).
   - Migration checklist:
     - Run `npx tsc --noEmit` with the shim removed to get the list of type errors.
     - Fix errors incrementally; add small PRs to avoid huge monolithic type churn.
     - Add `tsc` to CI for incremental enforcement.

---

## Secondary/other legacy candidates (short list)

These are useful follow-ups after the top 3 are addressed:

- patchGltfLoader.ts — runtime patch that modifies loader prototype to guard invalid URLs. Consider replacing with robust input validation or upstream bugfix; move to dev-only if not required in production.
- webglDebugPrototypePatch.ts — dev-only prototype patch to capture GL logs; move behind a dev-only entry or remove if not used.
- ExplosionRenderer.tsx and other re-export facades — small legacy facades kept for backward compatibility; replace imports in callers with the new modular paths and remove the wrappers.
- starDiskMaterial.ts — contains `LEGACY_BOUNDARY_SETTINGS` and fallback branch; if you standardize star boundary semantics you can simplify `deriveBoundaryUniform`.
- Any other `@deprecated` files or `Legacy` constants — look for `@deprecated` and `LEGACY_` occurrences (I found several).

---

## Suggested priority/order

1. Move the AI harness out of src (low impact on production, quick wins) — reduces accidental imports and clarifies test/production separation.
2. Remove compatibility facades & re-exports (small PRs): replace uses of combat.ts, `ExplosionRenderer` wrapper, etc. (medium risk).
3. Type migration: remove `jsx-compat` shims and fix TypeScript errors (low → medium risk, can be done incrementally).
4. Core runtime shims in state.ts: after other steps reduce surface area of compatibility concerns, then update all call sites and remove shims (highest risk; do last and in small, validated PRs).
5. Finally, remove runtime prototype patches (GLTF loader, WebGL patch) or gate them behind dev flags.

---

## Concrete migration examples & practical steps

- Find & replace old Miniplex usage:
  - Search for `.createEntity(` → replace with `world.add(`; verify call semantics and object shapes.
  - Search for `.destroyEntity(` → replace with `world.remove(` and ensure code passes the actual entity reference.
  - Search for `.archetype(` → replace with `world.with(...)` queries.

- Codemod approach:
  - Create a small script that runs regex replacements for the most common patterns but always create a PR with the automated changes reviewed by hand.
  - Example commands to help iterate locally:
    - Typecheck & run tests:
      ```bash
      npx tsc --noEmit
      npm test
      ```
    - Find all usages:
      ```bash
      rg "createEntity\(|destroyEntity\(|archetype\(" src | sed -n '1,200p'
      rg "aiScenarioHarness" src || true
      ```

- Moving AI harness:
  - Create `test/ai-harness/` or `tools/dev-harness/ai/` and move files over, update imports in tests and harness consumers.
  - Update package.json or test scripts if harness runs as part of CI tasks.
  - Remove harness from production build by ensuring no src import remains.

- Types:
  - Temporarily remove jsx-compat.d.ts, run `npx tsc --noEmit` to get errors and fix them incrementally.
  - Prefer explicitly typed components (return `React.ReactElement` or `JSX.Element` per updated types) and add missing props type definitions.

---

## Risks, tests & verification

- Core shim removal (state.ts) is highest risk — cover with:
  - Unit tests for entity lifecycle, turret registration/unregistration.
  - Integration tests that spawn/destroy ships and confirm no memory leaks or orphaned turrets.
  - CI runs: `npx tsc --noEmit` and `npm test` on each PR.

- Moving harness & removing deprecated re-exports:
  - Search for runtime imports before final removal.
  - Run full test suite — harness changes are mostly test-only so production risk is low.

- Types cleanup:
  - Run type-check on each change, do incremental PRs.
  - Add a CI job to enforce no re-introduction of permissive shim.

---

## Short actionable plan (next steps)

- Step A (quick, low-risk): Move aiScenarioHarness to `test/aiScenarioHarness` or `tools/ai-harness`. Update tests and import paths. Verify `npm test` passes.
- Step B (small PRs): Replace facades like combat.ts and ExplosionRenderer.tsx usages with direct imports from new modules; remove wrapper files when done.
- Step C (types): Remove jsx-compat.d.ts in a branch, fix TypeScript errors, iterate until clean.
- Step D (big PRs, last): Replace old Miniplex API call sites, update tests, then remove the shims in `createGameState()`.

---

## Files I inspected (examples)

- state.ts — backwards-compat shims and turret cleanup (core runtime).
- `src/game/aiScenarioHarness/*` — rapierShim, stateFactory, shipFactory, stateBuilder (deprecated).
- jsx-compat.d.ts and jsx-shim.d.ts — global type shims.
- ExplosionRenderer.tsx — deprecated facade re-export.
- starDiskMaterial.ts — LEGACY_BOUNDARY_SETTINGS and fallback code.
- patchGltfLoader.ts and webglDebugPrototypePatch.ts — runtime prototype patches.

---

## Closing and status (todo list)

I used a todo list while investigating and updated it as I progressed:

- [completed] Scan repository for legacy indicators
- [completed] Identify candidate legacy codepaths (top 10)
- [completed] Analyze and prioritize top 3 for removal/refactor
- [completed] Prepare report with rationale, risks, and migration suggestions

If you want, next I can:

- produce a prioritized, step-by-step PR plan with concrete codemod scripts (regexes or jscodeshift) for the Miniplex API changes, or
- generate the first codemod and a CI job change to move the `aiScenarioHarness` out of src to test and update imports automatically.

Which of those would you like me to do next?
