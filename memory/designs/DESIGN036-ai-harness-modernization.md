# DESIGN006 — AI Harness Modernization & Legacy Cleanup

**Status:** Active (Implemented)
**Author:** Copilot
**Date:** 2025-10-26

## Executive Summary

This design documents the removal and consolidation of legacy AI code patterns and the modernization of the AI scenario test harness. The codebase has successfully transitioned from a dual-mode AI (v1 fallback + v2 primary) to AI v2 only, eliminating maintenance overhead and reducing testing surface. This design captures remaining cleanup opportunities and ensures the harness and memory bank reflect the current state.

---

## Problem Statement

### Current State

- **TASK251** successfully removed the `runLegacyShipBehavior` fallback pathway; AI v2 is now mandatory.
- The AI scenario harness (`test/support/aiScenarioHarness.ts`) is modern and deterministic, using seeded RNG for reproducible tests.
- Memory bank docs (`core-aiScenarioHarness.md`, `core-aiProfiles.md`) reference old file paths (`src/game/aiScenarioHarness.ts`) that no longer exist.
- Legacy motion smoothing config is deprecated but still validated with helpful error messages.
- No active dead code in core AI v2 implementation.

### Remaining Debt

1. **Outdated memory bank references** (e.g., "Files: `src/game/aiScenarioHarness.ts`" when it's actually at `test/support/aiScenarioHarness.ts`).
2. **No explicit deprecation guide** for developers migrating from legacy patterns (smoothing config, old profile names).
3. **Minimal documentation** linking the test harness, config knobs, and expected behavior for new contributors.
4. **Test harness utilities are scattered** across `test/support/aiScenarioHarness/*`; organization could be improved.

---

## Solution Design

### Objectives

1. Update memory bank docs to reflect current code structure and AI v2-only state.
2. Create a deprecation guide documenting removed/changed features (smoothing, fallback paths, old profile mappings).
3. Add inline documentation to the test harness explaining usage patterns and determinism guarantees.
4. Consolidate and rename memory bank entries to reduce confusion.

### Data Flow & Architecture

#### Current Structure

```text
src/game/
├── aiProfiles.ts          (Active: profile definitions + hull-to-profile mapping)
├── aiState.ts             (Active: AI state shape and types)
├── aiDoctrine.ts          (Active: doctrine/engagement logic)
├── aiTraits.ts            (Active: trait definitions and evaluation)
├── config.ts              (Active: AI decision config + feature flags)
└── systems/
    └── decision/          (Active: decision tree, intent scoring, vertical maneuvers)

test/support/
├── aiScenarioHarness.ts   (Main harness entry point)
└── aiScenarioHarness/     (Modules: types, factories, logging, metrics, integration)

test/vitest/
├── ai-scenario-harness.spec.ts  (Deterministic scenario tests with golden fixtures)
├── ai-metrics.spec.ts           (Harness scenario metrics validation)
├── ai-regression.spec.ts        (Smoke tests for AI decision behavior)
└── fixtures/ai-*.json           (Golden logs for scenario regression)
```

#### Legacy (Removed)

- `src/game/aiScenarioHarness.ts` — moved to `test/support/` in earlier refactor.
- `runLegacyShipBehavior` — removed in TASK251.
- AI v1 decision logic — removed when v2 became mandatory.

### Changes

#### 1. Update Memory Bank Docs

**File:** `memory/core-aiScenarioHarness.md`

- **Change:** Update file path references from `src/game/aiScenarioHarness.ts` to `test/support/aiScenarioHarness.ts`.
- **Change:** Clarify that the harness is test-only and not part of runtime.
- **Change:** Add note about determinism guarantees and seeded RNG usage.
- **Change:** Link to new deprecation guide.

**File:** `memory/core-aiProfiles.md`

- **Change:** Ensure paths are current and reference the active `src/game/aiProfiles.ts`.
- **Change:** Note that profiles are data-only; no functions or closures should be embedded.
- **Change:** Link to config knobs and decision system.

#### 2. Create Deprecation Guide

**New File:** `memory/guides/AI_DEPRECATION_GUIDE.md`

- Document removed features (AI v1 fallback, legacy smoothing, old profile names).
- Provide migration steps for each deprecated feature.
- Link to TASK251 and DESIGN005 for context.

**New File:** `memory/guides/TEST_HARNESS_PATTERNS.md`

- Explain how to write deterministic AI tests using the harness.
- Document seeded RNG usage and fixture generation.
- Show examples of scenario configs and expected assertions.

#### 3. Consolidate Harness Documentation

**File:** `test/support/aiScenarioHarness.ts`

- Add inline JSDoc explaining module purpose, seeded RNG guarantees, and common usage patterns.
- Clarify the role of each sub-module (types, factories, logging, metrics).

#### 4. Add Validation Coverage

- Ensure validation still rejects deprecated smoothing config and logs helpful error messages.
- Add tests for deprecated feature rejection.

---

## Acceptance Criteria

- [ ] All memory bank AI docs reference current file paths (`test/support/` for harness, `src/game/` for profiles).
- [ ] Deprecation guide created with examples of removed features and migration paths.
- [ ] Test harness has JSDoc explaining determinism, seeded RNG, and usage.
- [ ] No broken links in memory bank; all cross-references verified.
- [ ] Validation tests pass; deprecated feature rejection is tested.
- [ ] No dead code or false references remaining.

---

## Implementation Steps

1. **Update `memory/core-aiScenarioHarness.md`**: Fix path references, add determinism note, link to guides.
2. **Update `memory/core-aiProfiles.md`**: Verify paths and add clarifications.
3. **Create `memory/guides/AI_DEPRECATION_GUIDE.md`**: Document removed features and migration.
4. **Create `memory/guides/TEST_HARNESS_PATTERNS.md`**: Show usage examples and best practices.
5. **Add JSDoc to `test/support/aiScenarioHarness.ts`**: Explain module purpose and seeded RNG guarantees.
6. **Run tests**: Ensure all suites pass; validate no regressions.

---

## Testing & Validation

- **Unit Tests**: Existing Vitest suites cover AI decision behavior; no new unit tests required (coverage is high).
- **Integration Tests**: `ai-scenario-harness.spec.ts` runs 3 deterministic scenarios with golden fixture comparisons.
- **Validation Tests**: `validation.spec.ts` confirms deprecated smoothing config is rejected with helpful message.
- **Type Checking**: `npm run typecheck` confirms all references are valid.

---

## Rollout & Risk

- **Risk:** Minimal. Changes are documentation and memory bank updates only; no code logic changes.
- **Rollout:** Single PR; no feature flags required.
- **Validation:** Run `npm run typecheck` and `npm test` before merge.

---

## Open Questions & Follow-ups

1. Should we create a higher-level guide doc (`memory/GUIDES.md`) that indexes all available guides (test harness patterns, deprecation, etc.)?
2. Should we add a small "AI v2 Onboarding" guide for new contributors?

---

## Related Documents

- TASK251: Remove legacy AI fallback path.
- DESIGN005: AI v2 enforcement and guard behavior.
- `memory/core-aiScenarioHarness.md`
- `memory/core-aiProfiles.md`
- `src/game/aiProfiles.ts`
- `test/support/aiScenarioHarness.ts`
