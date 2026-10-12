# Agents Guide: src/app

- Purpose: Owns React/zustand app-layer state (provider, UI store).
- Boundaries: Must not be imported by `src/game`; the game layer stays free of React/zustand.
- Determinism: UI state mirrors onto the canonical `GameState` via `src/hooks/useGameStateMirrors.ts`.
- Collaboration: Update `README.md` here and in `src/` when the layer boundary changes.
