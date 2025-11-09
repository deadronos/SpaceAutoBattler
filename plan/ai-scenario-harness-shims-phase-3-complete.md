## Phase 3 Complete: Prune Harness Shim Nondeterminism

Phase 3 removed a source of nondeterminism in the harness shims while leaving all ambiguous or fixture-sensitive internals intact.

**Files created/changed:**
- `test/support/aiScenarioHarness/rapierShim.ts`

**Functions created/changed:**
- Updated collider handle creation to use a deterministic constant instead of `Math.random()`.

**Tests created/changed:**
- `npm test` (including AI scenario harness specs and guard tests) confirmed passing after changes.

**Review Status:** APPROVED

**Git Commit Message:**
refactor: stabilize ai harness rapier shim

- Replace random collider handle with deterministic value in harness shim
- Preserve existing harness behaviour and golden fixtures
- Keep other harness internals unchanged for safety
