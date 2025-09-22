# TASK109 — Expand AI Scenario Harness Fixtures

## Goal
Add additional deterministic harness coverage for heavy bomber intercept patterns and artillery retreats to broaden regression protection for AI intents.

## Context
- Plan `plan/plan-ai-system.md` lists "Broaden scenario coverage" as a near-term action.
- Existing harness only covers an escort/intercept/regroup mix via `ai-escort-scenario.json`.
- Need fixtures + tests validating bomber intercept pursuit and artillery retreat posture shifts.

## Approach Sketch
- Define two new scenario configs in `ai-scenario-harness.spec.ts` for bomber intercept and artillery retreat cases.
- Capture golden logs via `runAIScenario` and persist as JSON fixtures under `test/vitest/fixtures/`.
- Ensure harness config exercises intercept lead math and regroup/retreat posture triggers.
- Update docs/memory to record expanded coverage and note any future follow-ups discovered.

## Deliverables
- Additional fixture JSON files and updated Vitest spec assertions.
- Memory updates summarizing coverage addition.
- Test suite (`npm test`, `npx tsc --noEmit`) remains green.

## Open Questions
- Do we need to parameterize harness exports for easier fixture generation later?
- Should bomber scenario include slow projectiles to cover noted edge case?

## Status
- 2025-09-25: Added bomber intercept + artillery retreat configs to `ai-scenario-harness.spec.ts`, generated normalized JSON fixtures, updated memory/plan entries, and ran `npx tsc --noEmit` + `npm test` to lock behavior.
