# [TASK154] - Playwright Ship Mock Render Tests

**Status:** In Progress  
**Added:** 2025-09-30  
**Updated:** 2025-09-30

## Original Request

Implement the design document `memory/designs/design-ship-mock-test.md` which describes a deterministic, maintainable approach to validating per-hull visual correctness (engine glow and shield bubble) by loading real `.glb` assets into a simplified/mocked scene and asserting both scene metadata and pixel-level output.

## Thought Process

This task implements a two-tier verification strategy for ship rendering:

1. **Scene-graph & uniform assertions** - Fast, primary guard using scene introspection to verify mesh presence, material types, and shader uniform values
2. **Visual snapshot assertions** - Slower, higher-confidence verification using screenshot comparison for a representative subset

The implementation follows a phased approach:
- **Phase 1 (PoC)**: Establish basic infrastructure with a single hull test
- **Phase 2 (Harness)**: Extend to full hull iteration with comprehensive assertions
- **Phase 3 (Baseline & CI)**: Add baseline management and CI integration
- **Phase 4 (Hardening)**: Production-ready with nightly runs and advanced diagnostics

Key design decisions:
- Use Playwright for headless browser testing with deterministic rendering
- Expose minimal `window.__TEST__` API for test coordination
- Maintain baselines in version control with documented update workflow
- Prefer real `.glb` assets from `src/assets/ships/` for highest fidelity
- Use scene introspection as primary verification to reduce flakiness
- Configure tolerances for pixel-based comparisons

## Implementation Plan

### Phase 1: PoC (low-effort)
- Build minimal test page with Three.js integration
- Implement `window.__TEST__` API
- Create single-hull Playwright spec
- Establish baseline storage and iteration workflow

### Phase 2: Extend to full harness
- Add hull list iteration from configuration
- Implement screenshot crop utilities
- Add debug artifact collection for failures
- Implement comprehensive scene-introspection assertions
- Add screenshot diffing with configurable tolerances

### Phase 3: Baseline & CI
- Create baseline generation script
- Document baseline update workflow for developers
- Add CI job with Chromium tuning
- Configure representative subset for CI runs

### Phase 4: Hardening
- Add nightly full-hull visual test runs
- Implement failure triage automation
- Add per-hull tolerance configuration

## Progress Tracking

**Overall Status:** In Progress - 70%

### Subtasks

| ID | Description | Status | Updated | Notes |
|----|-------------|--------|---------|-------|
| 1.1 | Create ship-renderer.html test page | Complete | 2025-09-30 | Created with canvas, status display, error handling |
| 1.2 | Create ship-renderer.js with Three.js scene | Complete | 2025-09-30 | Fixed camera/lights, GLTF loader, scene setup |
| 1.3 | Implement window.__TEST__ API | Complete | 2025-09-30 | waitForReady, getSceneSummary, setOptions implemented |
| 1.4 | Create single-hull Playwright spec | Complete | 2025-09-30 | Full test suite with all hulls, scene introspection |
| 1.5 | Add baseline storage and iteration | Complete | 2025-09-30 | Screenshot comparison with baselines directory |
| 2.1 | Add hull list iteration | Complete | 2025-09-30 | All 5 hulls tested via loop |
| 2.2 | Implement screenshot crop utility | Complete | 2025-09-30 | Canvas locator for focused screenshots |
| 2.3 | Add debug artifact collection | Complete | 2025-09-30 | Full/canvas screenshots, JSON, failure notes |
| 2.4 | Implement scene-introspection assertions | Complete | 2025-09-30 | Mesh, material, uniform validation |
| 2.5 | Add screenshot diffing with tolerances | Complete | 2025-09-30 | Playwright snapshots with configurable thresholds |
| 3.1 | Create baseline generation script | Complete | 2025-09-30 | scripts/generate-playwright-baselines.ts with CLI args |
| 3.2 | Document baseline update workflow | Complete | 2025-09-30 | test/playwright/README-ship-tests.md |
| 3.3 | Add CI job configuration | Not Started | 2025-09-30 | .github/workflows/ integration |
| 3.4 | Tune Chromium flags for determinism | Not Started | 2025-09-30 | Test SwiftShader, GPU flags |
| 3.5 | Configure representative subset for CI | Complete | 2025-09-30 | Fighter/frigate/carrier subset in spec |
| 4.1 | Add nightly full-hull visual runs | Not Started | 2025-09-30 | Scheduled workflow |
| 4.2 | Add failure triage automation | Not Started | 2025-09-30 | Automated diagnostics |
| 4.3 | Add per-hull tolerance configuration | Not Started | 2025-09-30 | Hull-specific diff thresholds |

## Progress Log

### 2025-09-30 (Phase 1 & 2 Complete)

- Created task file TASK154 based on design document
- Implemented Phase 1 (PoC):
  * Created test/playwright/pages/ship-renderer.html with canvas, status display, and error handling
  * Created test/playwright/pages/ship-renderer.js with Three.js scene, GLTF loader, fixed camera/lights
  * Implemented window.__TEST__ API: waitForReady(), getSceneSummary(), setOptions()
  * Created test/playwright/ship-hulls.spec.ts with full hull iteration and two-tier validation
  * Added baseline screenshot storage and comparison with Playwright snapshots
  
- Implemented Phase 2 (Full Harness):
  * Added hull list iteration for all 5 hulls (fighter, corvette, frigate, destroyer, carrier)
  * Implemented canvas screenshot cropping via Playwright locators
  * Added comprehensive debug artifact collection (fullpage.png, canvas.png, scene-summary.json, failure.md)
  * Implemented scene-introspection assertions (mesh names, materials, uniforms, bounding boxes)
  * Added screenshot diffing with configurable tolerances (maxDiffPixelRatio, threshold)
  
- Implemented Phase 3 (Baseline & CI):
  * Created scripts/generate-playwright-baselines.ts with CLI args (--hull=)
  * Documented baseline update workflow in test/playwright/README-ship-tests.md
  * Configured representative CI subset (fighter/frigate/carrier)
  * Added npm scripts: test:playwright:ship, generate-baselines
  * Created test/playwright/hulls-list.json for hull metadata
  
- Decision: Deferred subtasks 3.3 (CI job) and 3.4 (Chromium flags) pending validation
- TypeScript compilation successful (`npm run typecheck` passes)
- Pre-existing Vitest test failures are unrelated (React.act issues in postprocessing tests)

### Status Summary

**Completed:**
- ✅ Phase 1 (PoC): Test page, renderer, API, basic spec, baselines (5/5 subtasks)
- ✅ Phase 2 (Harness): Hull iteration, cropping, debug artifacts, assertions, diffing (5/5 subtasks)
- ✅ Phase 3 (Partial): Baseline script, documentation, CI subset configuration (3/5 subtasks)

**Pending:**
- ⏸️ Phase 3: CI job integration (3.3) - needs .github/workflows/ update
- ⏸️ Phase 3: Chromium flags tuning (3.4) - needs local validation run
- ⏸️ Phase 4: All hardening tasks (3/3 subtasks) - awaiting Phase 3 completion

**Next Steps:**
1. Validate the test harness locally: `npm run build && npm run serve` then `npm run test:playwright:ship`
2. Generate initial baselines: `npm run generate-baselines`
3. Review generated screenshots and scene summaries
4. Add CI job configuration to `.github/workflows/`
5. Tune Chromium flags for determinism if needed

## Files to Add

Based on the design document, the following files will be created:

- `test/playwright/pages/ship-renderer.html` - Minimal page mounting Three.js
- `test/playwright/pages/ship-renderer.js` - Runtime logic, loader, scene setup, and `__TEST__` API
- `test/playwright/ship-hulls.spec.ts` - Main test suite iterating hull list
- `test/playwright/hulls-list.json` - Canonical list of hulls to test (or dynamic loader)
- `test/playwright/baselines/` - Directory with per-hull baseline PNGs
- `scripts/generate-playwright-baselines.ts` - Dev helper to create baselines
- `test/playwright/debug/` - Test artifact output folder for failed runs

## Acceptance Criteria

From the design document:

- [ ] The Playwright harness loads each configured hull without GLTF loader errors
- [ ] Scene introspection assertions pass for every hull (expected mesh names and uniform ranges)
- [ ] Visual snapshot tests pass for representative hulls within configured tolerances
- [ ] Baseline update workflow is documented and reproducible by developers
- [ ] CI job runs reliably with documented flags and reasonable runtime

## EARS-style Requirements

From the design document:

1. **GLTF Loading**: WHEN a hull `.glb` is loaded into the test page, THE SYSTEM SHALL instantiate the Ship and attach it to the test scene.  
   Acceptance: Playwright `waitForReady()` resolves and `getSceneSummary()` returns expected top-level meshes.

2. **Shield Rendering**: WHEN the hull's shield is enabled in the renderer, THE SYSTEM SHALL expose a shield mesh/uniform visible to the test harness.  
   Acceptance: `getSceneSummary()` contains a shield mesh name and the shader uniform `shieldAlpha` > 0.

3. **Engine Glow**: WHEN engine thrust is activated, THE SYSTEM SHALL render engine glow via an emissive material or shader.  
   Acceptance: `getSceneSummary()` reports engine-related material/uniforms with emissive intensity > baseline.

4. **Determinism**: WHEN the frame is fixed and RNG is seeded, THE SYSTEM SHALL render a deterministic frame for identical baseline comparison.  
   Acceptance: Repeated runs yield identical scene summaries and stable screenshot diffs within tolerance.

## Risks & Mitigations

- **GPU/driver differences** may cause flaky pixel diffs  
  → Rely on scene-introspection as primary; use SwiftShader or tuned Chromium flags; visual diffs for small representative set

- **Large .glb assets** slow test runs  
  → Add minimal test fixtures preserving render-critical nodes; cache assets with aggressive headers

- **Postprocessing (bloom, filmgrain)** increases fragility  
  → Run functional assertions with postprocessing off; separate visual test run with postprocessing on
