# Coding conventions

## Style

- Use two-space indentation and semicolons.
- Use ES modules.
- Prefer clear, self-explanatory names; comment for intent (why), not mechanics (what).

## Types and public APIs

- Add explicit types for exported symbols and configuration objects.
- Import shared types from `src/types/index.ts`.

## Determinism and state

- Use seeded RNG utilities in `src/utils/rng.ts` for any simulation or AI randomness.
- Avoid new module-level state outside `GameState`.

## Error handling

- Throw or return error values; avoid silent failures.

## Event name stability

These event names are expected to remain stable:

- `bullets`
- `explosions`
- `shieldHits`
- `healthHits`
