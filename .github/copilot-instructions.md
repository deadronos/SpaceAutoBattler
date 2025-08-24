
# SpaceAutoBattler — Copilot Quick Reference

## Key Rules
- Edit only TypeScript files in `/src`. Never touch JS build artifacts.
- All simulation and rendering state is centralized in the canonical `GameState` type (`src/types/index.ts`).
- All subsystems (simulation, renderer, UI) must accept and mutate the `GameState` object. No scattered state variables.
- Use config helpers for assets and visuals (e.g., `getVisualConfig(type)`).
- Simulation is deterministic and uses seeded RNG (`src/rng.ts`).

## Workflow
- Make minimal, targeted edits. Prefer small, test-backed changes.
- Run `npm test` after every change.
- Update `/spec/IMPLEMENTATION_STATUS.md` at the end of each work cycle with a short summary of completed goals and current project state.

## Recent Changes
- Canonical `GameState` type now required for all simulation, renderer, and UI logic.
- All state must be a property of `GameState`.
- Renderer and simulation refactored to use only `GameState`.

## Maintainers
- Owner: deadronos
- Main branch: `main`

