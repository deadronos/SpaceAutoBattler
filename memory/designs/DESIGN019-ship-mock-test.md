# Design: Playwright ship mock render tests

Created: 2025-09-30
Status: Proof-of-concept implemented (2025-12-15) — `test/playwright/pages/ship-renderer.js` now exposes `setOptions`; shield and engine glow tests were added and a baseline generator script (`scripts/generate-playwright-baselines.ts`) exists. Next steps: generate representative baselines, commit them, and add a CI job to run a representative subset of hull screenshot tests (tracked in TASK156).

Purpose: Describe a deterministic, maintainable approach to validating per-hull visual correctness (engine glow and shield bubble) by loading real `.glb` assets into a simplified/mocked scene and asserting both scene metadata and pixel-level output.

## Summary

Run Playwright-rendered screenshot tests for every configured ship hull. Each test loads the hull's `.glb` into a small deterministic test page that mounts the project's renderer, waits for a specific static frame, collects scene metadata, then captures a cropped canvas screenshot for visual comparison against a per-hull baseline image.

This design favors two-tier verification: (1) scene-introspection assertions (mesh existence, material types, key uniforms) as the fast primary guard; (2) screenshot diffs (pixel- or snapshot-based) for higher-confidence visual verification on a representative subset.

## EARS-style Requirements

- WHEN a hull `.glb` is loaded into the test page, THE SYSTEM SHALL instantiate the Ship and attach it to the test scene.  
  Acceptance: Playwright `waitForReady()` resolves and `getSceneSummary()` returns expected top-level meshes.

- WHEN the hull's shield is enabled in the renderer, THE SYSTEM SHALL expose a shield mesh/uniform visible to the test harness.  
  Acceptance: `getSceneSummary()` contains a shield mesh name and the shader uniform `shieldAlpha` > 0 (or configured threshold).

- WHEN engine thrust is activated, THE SYSTEM SHALL render engine glow via an emissive material or shader.  
  Acceptance: `getSceneSummary()` reports engine-related material/uniforms with emissive intensity > baseline; screenshot pixel samples in engine region exceed brightness threshold.

- WHEN the frame is fixed and RNG is seeded, THE SYSTEM SHALL render a deterministic frame for identical baseline comparison.  
  Acceptance: Repeated runs of the same hull/frame yield identical scene summaries and stable screenshot diffs within tolerance.

## High-level Approach

- Use Playwright (headless Chromium) to run an automated page that mounts a minimal Three.js scene and the project's ship instantiation code.
- Keep the page minimal and deterministic: fixed camera transform, locked lighting, fixed canvas size, seeded RNG, and ability to render a chosen frame number (query param `frame`).
- Expose lightweight test API on `window.__TEST__` allowing tests to await readiness and fetch serializable scene metadata for assertions.
- Capture a cropped canvas screenshot focused on the ship; compare against stored baseline images using Playwright snapshot API or pixelmatch with configurable tolerances.
- Maintain small, test-specific `.glb` fixtures when full assets are excessively large. Prefer real `.glb` files under `src/assets/ships/` where feasible.

## Test Page API (ship-renderer)

The test page must provide the following API on `window.__TEST__`:

- `waitForReady(): Promise<{frameRendered: number}>`  
  Resolves when GLTF load + any required static baking/frame step completes and the renderer has drawn the target frame.

- `getSceneSummary(): Promise<SceneSummary>`  
  Returns a JSON-serializable object with:
  - hullId
  - mesh list (name, boundingBox, visible)
  - materials list (name, type, key properties like emissive/intensity)
  - relevant shader uniform values (e.g., shieldAlpha, shieldRadius, engineEmission)

- `setOptions(options): Promise<void>`  
  Allows toggling test-specific options: shield on/off, engine on/off, postprocessing on/off, frame number.

## Verification Strategy (two-tier)

1. Scene-graph & uniform assertions (fast, primary):
   - Mesh presence by name (e.g., `engineGlow`, `shieldBubble` or hull-configured names).
   - Material type checks and reasonable ranges for key properties/uniforms (e.g., `shieldAlpha > 0.05`).
   - Numeric assertions use small tolerances.

2. Visual snapshot assertions (slower, representative subset):
   - Capture cropped screenshot around ship area and compare to baseline using Playwright snapshots or `pixelmatch`.
   - Use small image sizes (e.g., 512×320) and restrict comparison to a tight crop to reduce noise.
   - Configure `maxDiffPixelRatio` and color thresholds; start permissive and tighten with CI iteration.

When both tiers pass, the hull is considered visually validated.

## Determinism & Stability

- Seed any RNG using the repository's seeded RNG utility (`src/utils/rng.ts`) or provide a deterministic pseudo-seed in query params.
- Fix the camera transform, lights, and render buffer size. Accept a `frame` query parameter to select an animation frame to render (or animate to a fixed time value).
- Use postprocessing toggles: run tests with postprocessing both off (for stable functional validation) and on (for visual validation) depending on the acceptance target.
- Prefer SwiftShader or consistent Chromium flags in CI if GPU variation causes flaky diffs.

## Baselines & Update Flow

- Baselines stored in `test/playwright/baselines/<hullId>.png`.
- Baseline generation helpers:
  - `scripts/generate-playwright-baselines.ts` — runs the Playwright harness in baseline mode to write images.
  - Provide a documented workflow:
    1. Developer runs `npm run test:playwright -u` or the provided script to update baselines locally.
    2. Created artifacts are reviewed and committed via a PR referencing visual changes.
- Keep production-run CI tests read-only for baselines; only developer-triggered updates change baselines.

## Failure Diagnostics

On a visual failure, tests will collect and persist to `test/playwright/debug/<hullId>-<timestamp>/`:

- Full-page screenshot
- Cropped ship screenshot (actual)
- Diff image (actual vs baseline)
- `scene-summary.json` (the output of `getSceneSummary()`)
- A short `failure.md` explaining which tier(s) failed and suggested next steps

These artifacts simplify root-cause analysis (mesh missing vs uniform mismatch vs rendering difference).

## CI Integration

- Add a dedicated job `playwright-ship-screenshots` to run the Playwright suite.
- For CI, run visual snapshot tests only for a representative subset (e.g., small, medium, large hulls) to limit flakiness and runtime; run full-per-hull snapshot tests nightly or on-demand.
- Chromium flags to consider for reproducible headless GL:
  - Try default headless Chromium first.
  - If GPU differences appear, use: `--use-gl=egl` or `--use-gl=swiftshader`, and `--disable-gpu` where appropriate.
- Limit concurrency to 1–2 workers for these tests in CI to avoid resource contention.

## Assets & Fixtures

- Prefer real `.glb` files from `src/assets/ships/` for highest fidelity.
- If large assets slow tests, create minimal fixtures that preserve:
  - Mesh node names used by renderer (engine glow, shield bubble)
  - Material types and shader uniform names
  - Basic UVs and minimal textures (1×1 placeholder textures)
- Place test fixtures in `test/playwright/fixtures/` when created.

## Files to Add (implementation list)

- `test/playwright/pages/ship-renderer.html` — minimal page that mounts Three.js and exposes `window.__TEST__`.
- `test/playwright/pages/ship-renderer.js` — runtime logic, loader, deterministic scene setup, and `__TEST__` implementation.
- `test/playwright/ship-hulls.spec.ts` — Playwright test iterating hull list and performing tiered assertions + screenshot diffs.
- `test/playwright/hulls-list.json` (or dynamic loader from `src/config/hulls.ts`) — canonical list of hulls to test.
- `test/playwright/baselines/` — directory with per-hull baseline PNGs.
- `scripts/generate-playwright-baselines.ts` — dev helper to create baselines.
- `test/playwright/debug/` — test artifact output folder for failed runs.
- `memory/tasks/TASK-playwright-ship-screenshots.md` — task file tracking the work.

## Implementation status (2025-12-15)

- Proof-of-concept implemented: `test/playwright/pages/ship-renderer.js` now supports runtime `setOptions` for dynamic hull/option switching, `test/playwright/ship-hulls.spec.ts` includes engine & shield checks, and `test/playwright/shield-visual-baseline.spec.ts` supports baseline generation and comparison.  
- A baseline generation helper script exists at `scripts/generate-playwright-baselines.ts`.  
- Next tracked action: validate PoC locally, generate representative baselines (fighter/frigate/carrier), commit selected baselines, and add `playwright-ship-screenshots` CI job (see TASK156).

## Implementation Plan (phased)

1. PoC (low-effort):
   - Build `ship-renderer.html` and JS to load one hull `.glb` and expose `__TEST__`.
   - Add a single Playwright spec to load that page, call `waitForReady()`, get `getSceneSummary()`, and capture a screenshot.
   - Store the baseline for that hull and iterate until stable.

2. Extend to full harness:
   - Add hull list iteration, crop utility, and debug artifact collection.
   - Implement scene-introspection assertions and screenshot diffing with tolerances.

3. Baseline & CI:
   - Add baseline generation script and document update workflow.
   - Add CI job with tuned Chromium flags and a representative subset run.

4. Hardening:
   - Add nightly full-hull visual runs and failure triage automation.
   - Add per-hull configuration for special-case tolerances.

## Acceptance Criteria

- [ ] The Playwright harness loads each configured hull without GLTF loader errors.
- [ ] Scene introspection assertions pass for every hull (expected mesh names and uniform ranges).
- [ ] Visual snapshot tests pass for representative hulls within configured tolerances.
- [ ] Baseline update workflow is documented and reproducible by developers.
- [ ] CI job runs reliably with documented flags and reasonable runtime.

## Risks & Mitigations

- GPU/driver differences across CI machines may cause flaky pixel diffs.  
  Mitigation: rely on scene-introspection as primary verification; use SwiftShader or tuned Chromium flags; run visual diffs for a small representative set in CI and full set nightly.

- Large or complex `.glb` assets slow test runs.  
  Mitigation: add minimal test fixtures preserving render-critical nodes; cache assets and reuse WebServer with aggressive caching headers.

- Postprocessing (bloom, filmgrain) increases fragility.  
  Mitigation: run functional assertions with postprocessing off and produce a separate visual test run with postprocessing on for visuals only.

## Next Steps

- Implement the PoC (single-hull Playwright spec + test page) and iterate until stable.
- Create `memory/tasks/TASK-playwright-ship-screenshots.md` and update `memory/tasks/_index.md` referencing this design.

---

Design authored by automation to support reproducible visual testing of ship hulls.
