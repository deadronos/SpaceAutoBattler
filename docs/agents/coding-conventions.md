# Coding conventions

## Architecture & Style

- Use ES modules.
- Prefer clear, self-explanatory names; comment for intent (why), not mechanics (what).
- Code formatting (indentation, semicolons) is managed automatically by `pnpm run format` / `pnpm run lint` (oxfmt/oxlint via vite-plus).

## Types and public APIs

- Add explicit types for exported symbols and configuration objects.
- Import shared types from `src/types/index.ts`.

## Determinism and state

- Use seeded RNG utilities in `src/utils/rng.ts` for any simulation or AI randomness.
- Avoid new module-level state outside `GameState`.

## Error handling

- Throw or return error values; avoid silent failures.

## Visual event state stability

There is no event bus or `state.events` collection. Renderer-visible events are held on `GameState` as plain collections and consumed by the renderer:

- `state.explosions` — pooled `ExplosionEvent[]` managed in `src/game/explosions.ts` (`src/types/simulation.ts`).
- `shieldRipples` — per-ship `ShieldRipple[]` on `ShipComponent` (`src/types/ship.ts`), renderer-only consumption.
- `muzzleFlashes` — per-ship `MuzzleFlash[]` on `ShipComponent` (`src/types/ship.ts`).

Keep these field/type names stable; they are the contract between simulation and rendering.
