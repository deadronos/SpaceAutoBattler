# Agents Guide: src/components/ship

- Purpose: Ship view models, shields, and visual helpers that map simulation `ShipComponent` -> Three.js objects.
- Contracts: Components should be render-only and read from `GameState`/selectors; do not perform authority-affecting side effects.
- Reuse: Centralise visual math in `rippleUtils.ts` and `shieldUtils.ts` to keep components small and testable.
- Tests: Prefer Playwright snapshots for visual fidelity and small unit tests for math helpers.
