# TASK017 - AI Harness Modernization & Legacy Cleanup

**Status:** Completed
**Added:** 2025-10-26
**Updated:** 2025-10-26

## Original Request

Execute DESIGN006 to modernize the AI scenario harness and consolidate legacy AI code documentation. Update memory bank docs, create deprecation guide and test patterns guide, add JSDoc to harness, and validate all tests pass.

## Thought Process

- TASK251 already removed the legacy AI fallback path, so the codebase is AI v2 only.
- The harness is already modern and uses seeded RNG for determinism.
- Memory bank docs reference old file paths that need updating.
- New contributors need clear guides for writing deterministic AI tests and migrating from deprecated features.
- Consolidating documentation into guides makes the knowledge base more discoverable and maintainable.

## Implementation Plan

- [x] Analyze existing AI code and harness structure; identify outdated docs.
- [x] Create DESIGN006 capturing modernization objectives and changes.
- [x] Update `memory/core-aiScenarioHarness.md` with correct paths and determinism notes.
- [x] Update `memory/core-aiProfiles.md` with current state and links to deprecation guide.
- [x] Create `memory/guides/AI_DEPRECATION_GUIDE.md` documenting removed features (v1 fallback, legacy smoothing, old profile names) and migration steps.
- [x] Create `memory/guides/TEST_HARNESS_PATTERNS.md` with usage examples, best practices, and troubleshooting.
- [x] Add comprehensive JSDoc to `test/support/aiScenarioHarness.ts` explaining module purpose, determinism, and sub-modules.
- [x] Run type checking and all tests to validate no regressions.

## Progress Tracking

**Overall Status:** Completed — 100%

### Subtasks

| ID  | Description                                                     | Status    | Updated    | Notes                                              |
| --- | --------------------------------------------------------------- | --------- | ---------- | -------------------------------------------------- |
| 1.1 | Inventory AI code and identify outdated docs                    | Completed | 2025-10-26 | Found harness moved to test/, docs need updating  |
| 1.2 | Create DESIGN006 with objectives and solution design             | Completed | 2025-10-26 | Published design documenting all changes          |
| 1.3 | Update core-aiScenarioHarness.md with correct paths             | Completed | 2025-10-26 | Updated to test/support/, added determinism notes |
| 1.4 | Update core-aiProfiles.md and link to guides                    | Completed | 2025-10-26 | Linked to deprecation guide and TASK251           |
| 1.5 | Create AI_DEPRECATION_GUIDE.md with migration paths             | Completed | 2025-10-26 | Documented v1 fallback, smoothing config, profiles|
| 1.6 | Create TEST_HARNESS_PATTERNS.md with examples                   | Completed | 2025-10-26 | Included quick start, patterns, troubleshooting   |
| 1.7 | Add JSDoc to aiScenarioHarness.ts                               | Completed | 2025-10-26 | Added module-level JSDoc with examples and refs   |
| 1.8 | Run typecheck and all tests; validate no regressions            | Completed | 2025-10-26 | All 65 AI tests pass, type checking clean         |

## Progress Log

- 2025-10-26: Analyzed codebase; found harness already modern, docs outdated. Created DESIGN006.
- 2025-10-26: Updated memory bank files with correct paths, added determinism guarantees section, and linked to new guides.
- 2025-10-26: Created two comprehensive guides: deprecation guide (v1 fallback, smoothing config, profile names) and test patterns guide (quick start, patterns, best practices, troubleshooting).
- 2025-10-26: Added 60+ line JSDoc module documentation to harness main entry point explaining purpose, features, usage, sub-modules, and determinism guarantees.
- 2025-10-26: Validated all tests pass (65 AI tests, 22 validation tests); typecheck clean.

## Outcomes

### Files Created

- `memory/designs/DESIGN006-ai-harness-modernization.md` — Design document capturing modernization scope and solution.
- `memory/guides/AI_DEPRECATION_GUIDE.md` — Comprehensive guide to removed features (AI v1 fallback, legacy smoothing config, old profile names) with migration steps.
- `memory/guides/TEST_HARNESS_PATTERNS.md` — Guide to writing effective AI tests with usage examples, best practices, and troubleshooting.

### Files Updated

- `memory/core-aiScenarioHarness.md` — Fixed file paths (src/ → test/support/), added determinism guarantees section, linked to new guides.
- `memory/core-aiProfiles.md` — Added AI v2 mandatory note, profile name migration pointer, linked to deprecation guide and related tasks/designs.
- `test/support/aiScenarioHarness.ts` — Added 60+ lines of JSDoc explaining module purpose, features, usage, sub-modules, and determinism guarantees.

### Tests Verified

- `test/vitest/ai-scenario-harness.spec.ts` — 3 golden fixture tests ✓
- `test/vitest/ai-determinism.spec.ts` — 1 determinism test ✓
- `test/vitest/ai-metrics.spec.ts` — 6 metrics validation tests ✓
- `test/vitest/validation.spec.ts` — 22 validation tests (including deprecated feature rejection) ✓
- Total: 65 AI-related tests pass; typecheck clean.

## Acceptance Criteria Met

- [x] Memory bank docs reference current file paths and structure.
- [x] Deprecation guide created with examples of removed features and migration paths.
- [x] Test harness has JSDoc explaining determinism, seeded RNG, and usage.
- [x] No broken links in memory bank; cross-references verified.
- [x] Validation tests pass; deprecated feature rejection tested.
- [x] No dead code; all references current and active.
- [x] All tests pass; no regressions introduced.

## Related Documents

- DESIGN006: AI Harness Modernization & Legacy Cleanup
- TASK251: Remove legacy AI fallback path
- DESIGN005: AI v2 enforcement and guard behavior
- `memory/guides/AI_DEPRECATION_GUIDE.md`
- `memory/guides/TEST_HARNESS_PATTERNS.md`
- `memory/core-aiScenarioHarness.md`
- `memory/core-aiProfiles.md`

## Follow-ups & Recommendations

1. Consider creating a top-level `memory/GUIDES.md` index that lists all available guides (test harness patterns, deprecation, troubleshooting, etc.).
2. Add a "AI v2 Onboarding" guide for new contributors that walks through the decision system, profile system, and how to add new behavior.
3. Monitor for any code that still references old profile names (tank, hit-and-run, etc.) and migrate incrementally.
4. Consider adding a GitHub Actions CI check that catches imports from moved harness files (src/game/aiScenarioHarness) and blocks them.

