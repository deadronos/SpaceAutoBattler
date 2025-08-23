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
- For major changes, create a Decision Record (`/PR_NOTES/`).
- Update `/spec/IMPLEMENTATION_STATUS.md` after each work cycle.

## Simulation & Config

- Simulation contract: `simulateStep(state, dt, bounds)` mutates `state` (ships, bullets, events).
- Event arrays: `explosions`, `shieldHits`, `healthHits`.
- Bullets must have `ownerId` for XP attribution.
- Edit config files in `/src/config/` for game balance/visuals.
- Edit `src/gamemanager.ts` for spawn/UI logic.

## Error Handling & Naming

- Use clear, descriptive names for functions/types.
- Handle errors with explicit checks; avoid silent failures.

## Minimal Test Example

```ts
import { srand } from '../src/rng.ts';
test('simulateStep emits shieldHits', () => {
  srand(1);
  const state = { ships: /* ... */, bullets: [], explosions: [], shieldHits: [], healthHits: [] };
  simulateStep(state, 0.016, { W: 800, H: 600 });
  expect(state.shieldHits.length).toBeGreaterThanOrEqual(0);
});
```

## Maintainers & Questions

- Main branch: `main`
- Owner: deadronos
- For questions, open an issue titled "clarify: copilot instructions".
