## Contributor Notes

Last-Reviewed: 2025-09-07

Quick onboarding tips:
- Use `npm install` then `npm run typecheck` and `npm test`.
- All changes affecting runtime state should update `GameState` types in `src/types/index.ts`.
- Asset additions: place SVGs in `assets/` and register prototypes via `meshFactory`.
- For rendering changes, prefer instancing via `shipInstancer` rather than per-mesh allocations.

Contact maintainers listed in AGENTS.md for PR reviews and architecture questions.