# SpaceAutoBattler — Agent Guide

SpaceAutoBattler is a deterministic, browser-based space auto-battler built in TypeScript.

## Essentials (read this first)

- Commands
  - Build: `npm run build`
  - Typecheck: `npm run typecheck`
  - Unit tests: `npm test`
  - E2E tests: `npm run test:e2e` (or `npm run test:playwright`)
  - Single unit spec: `npx vitest test/<path>.spec.ts`

- Don’t edit generated output: never modify `dist/` unless explicitly asked.

- Keep simulation deterministic
  - Use the seeded RNG utilities in `src/utils/rng.ts` for any simulation or AI randomness.
  - Avoid introducing new module-level state outside the canonical `GameState`.

- Canonical types/state
  - Use `GameState` from `src/types/index.ts` for runtime state.
  - Import shared types from `src/types/index.ts` (not ad-hoc duplicates).

## Where to find the rest (progressive disclosure)

- [Project structure & boundaries](docs/agents/project-structure.md)
- [Coding conventions](docs/agents/coding-conventions.md)
- [Testing (Vitest + Playwright)](docs/agents/testing.md)
- [Git + PR workflow](docs/agents/git-and-pr.md)
- [Engine integration (R3F + Rapier3D)](docs/agents/engine-integration-r3f-rapier.md)
- [Memory bank + spec-driven workflow](docs/agents/memory-bank-and-spec-workflow.md)

## Suggested `docs/` structure

- `docs/agents/` — contributor/agent how-to (this set of files)
- `docs/` — higher-level product/architecture/perf notes (existing)
- `spec/` — specs and structure references (existing)
- `PR_NOTES/` — breaking-change records and migrations (existing)

## Candidate instructions to delete or rewrite

See: [Deletion candidates](docs/agents/deletion-candidates.md)
