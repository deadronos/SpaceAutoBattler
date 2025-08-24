# Object Pooling Strategy for High-Frequency Events

## Purpose
To minimize allocations and garbage collection (GC) pressure, all high-frequency event types (bullets, particles, explosions, shieldHits, healthHits) use object pools. This ensures efficient memory reuse and reduces frame drops due to excessive allocations.

## Implementation
- Pools are implemented as arrays (e.g., `bulletPool`, `explosionPool`, `shieldHitPool`, `healthHitPool`, `particlePool`) in `src/gamemanager.ts`.
- Each event type has `acquire<Event>` and `release<Event>` functions (e.g., `acquireBullet`, `releaseBullet`).
- When an event is needed, use the corresponding `acquire` function. When its lifetime ends or it is pruned, use the `release` function to recycle it.
- Simulation and renderer logic must use these functions for all event creation and recycling.

## Best Practices
- Never create event objects directly; always use the pool's `acquire` function.
- Always call the pool's `release` function when an event's lifetime ends or it is removed from the simulation.
- Pools are automatically grown as needed; released objects are reset and reused.
- Unit tests should verify that no events leak and all are recycled properly.
- If adding a new high-frequency event type, implement a pool and corresponding acquire/release functions.

## Example Usage
```ts
// Acquire a bullet from the pool
const bullet = acquireBullet({ x, y, vx, vy, team, ownerId, damage, ttl });
// Release when bullet expires or is pruned
releaseBullet(bullet);
```

## Maintenance
- If you refactor event shapes, update the pool logic to reset all relevant fields on acquire/release.
- Periodically review pool sizes and test for leaks using unit tests.

## Verification
- After changes, run `npm test` and ensure all pooling-related tests pass.
- If pooling logic changes, add/adjust tests to cover edge cases and recycling behavior.
# AGENTS.md

## Build, Lint, and Test Commands

- Build: `npm run build` or `npm run build-standalone`
- Test all: `npm test`
- Test single file: `npx vitest test/<path-to-spec>.spec.ts`
- Playwright E2E: see `playwright.config.js`
- Validate config: `npm run validate-config`

## Code Style Guidelines

- Edit TypeScript files in `/src`, never JS directly.
- Use ES module imports; import types from `src/types/index.ts` only.
- 2-space indent, semicolons, `const`/`let` (no `var`).
- Use explicit types for public APIs and config.
- Prefer small, test-backed changes; add/adjust unit tests for gameplay changes.
- Use seeded RNG for simulation logic (`src/rng.ts`); simulation must be deterministic.
- Preserve event shapes and public APIs.
- No runtime dependencies; dev deps OK.
- State intent before non-trivial edits.
- For major changes (e.g., type contract changes, config validation logic), create a Decision Record (`/PR_NOTES/`).
- Update `/spec/IMPLEMENTATION_STATUS.md` after each work cycle.

## TypeScript Type & Config Guidelines

- **ShipSpec** must include required fields: `accel` (px/s²), `radius` (number), and `cannons` (non-empty array of `CannonSpec`).
- **CannonSpec** must include required field: `damage` (number).
- **CannonSpec** may include optional fields: `angle`, `rate`, `spread`, `muzzleSpeed`, `bulletRadius`, `bulletTTL`, `ttl`, `reload`, `range`.
- **ShipSpec** may include optional fields: `shieldRegen`, `turnRate`.
- **ShipConfigMap** must be `Record<string, ShipSpec>` (not partials).
- When updating types, ensure all config objects match the stricter requirements.
- Document new required/optional fields in code comments and PR notes.

## Config Validation & Backward Compatibility

- After type or config changes, always run:
  - `npx tsc --noEmit` (type check)
  - `npm test` (unit tests)
- When migrating fields (e.g., from `dmg` to `damage`), maintain legacy fields for compatibility until all callers are updated. Add fallback logic as needed. Remove legacy fields only after full migration.

## Simulation & Config

- Simulation contract: `simulateStep(state, dt, bounds)` mutates `state` (ships, bullets, events).
- Event arrays: `explosions`, `shieldHits`, `healthHits`.
- Bullets must have `ownerId` for XP attribution.
- Edit config files in `/src/config/` for game balance/visuals. Ensure configs match required/optional type fields.
- Edit `src/gamemanager.ts` for spawn/UI logic.

## Error Handling & Naming

- Use clear, descriptive names for functions/types.
- Handle errors with explicit checks; avoid silent failures.

## Test Coverage

- Add or adjust unit tests when changing type contracts or config validation logic.
- Ensure tests cover new required fields and fallback logic for legacy fields.

## Minimal Test Example

```ts
import { srand } from "../src/rng.ts";
test("simulateStep emits shieldHits", () => {
  srand(1);
  const state = {
    ships: [
      {
        accel: 10,
        radius: 20,
        cannons: [{ damage: 5 }],
        // ...other required/optional ShipSpec fields
      },
    ],
    bullets: [],
    explosions: [],
    shieldHits: [],
    healthHits: [],
  };
  simulateStep(state, 0.016, { W: 800, H: 600 });
  expect(state.shieldHits.length).toBeGreaterThanOrEqual(0);
});
```

## Maintainers & Questions

- Main branch: `main`
- Owner: deadronos
- For questions, open an issue titled "clarify: copilot instructions".
