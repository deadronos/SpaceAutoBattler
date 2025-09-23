# Agents Guide: src/game

- Purpose: Owns simulation state, ECS systems, and game-specific business rules.
- Boundaries: Keep this layer free of React/Three bindings; expose data via typed selectors and context.
- Determinism: Drive randomness through `src/utils/rng.ts` and keep mutations scoped to the canonical `GameState`.
- Collaboration: Update `README.md` here when workflows change and add notes in `PR_NOTES/` for breaking balance shifts.
- Testing: Cover new systems with Vitest unit specs; seed inputs so behaviour remains reproducible.
