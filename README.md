# SpaceAutoBattler

![Gameplay preview](VideoCapture.gif)

SpaceAutoBattler is a lightweight, research-oriented 3D space combat simulator. The project separates deterministic simulation logic (`src/core`) from rendering (`src/renderer`) so you can run headless tests and fast experiments.

## Quick start

Install dependencies and run the dev server or build artifacts:

```powershell
git clone https://github.com/deadronos/SpaceAutoBattler.git
Set-Location SpaceAutoBattler
npm install
# serve (uses a simple static server for the project root)
npm run serve
```

Open the local server at [http://localhost:8080](http://localhost:8080) (or the URL printed by the serve script).

## Project layout

Edit TypeScript sources in `src/` only. Key folders:

- `src/main.ts` — application entry and main loop
- `src/simWorker.ts` — deterministic physics worker (Rapier3D)
- `src/core/` — pure game logic, AI, entity management (simulation)
- `src/renderer/` — Three.js renderer, scene and effects
- `src/config/` — balance and behaviour configuration (entities, AI, sim, renderer)
- `src/types/` — canonical types including `GameState`
- `src/utils/` — seeded RNG and shared helpers
- `src/styles/` and `src/ui.html` — minimal UI/front-end glue

Build artifacts and generated files live in `dist/` (do not edit).

## Scripts & common commands

Use the repository scripts for typechecks, builds and tests. Typical commands:

```powershell
# install deps
npm install

# TypeScript typecheck
npm run typecheck

# Build (produces `dist/`)
npm run build

# Build standalone HTML bundle
npm run build-standalone

# Run unit tests (Vitest)
npm test

# Serve the built files
npm run serve:dist
```

Note: `npm run test:e2e` is not provided by default and will fail in this repository.

## Testing

Unit tests are under `test/vitest/` (pure logic). Playwright UI tests are under `test/playwright/` and test artifacts are present in `test-output/` and `playwright-report/`.

Before committing, run the recommended pre-commit checks:

```powershell
npm run typecheck; npm test
```

## Codebase notes (#codebase)

- `llms.txt` and a `docs/` folder were added to help contributors and automated tools discover entry points and developer notes.
- Public helpers and stable APIs live under `src/core` and `src/types` — prefer configuration-driven interfaces (`src/config/*`) when adding or changing behavior.
- The project preserves determinism: runtime randomness uses the seeded RNG in `src/utils/rng.ts` and `GameState` is the canonical runtime state (see `src/types/index.ts`).

Proposed small improvements (low-risk):

1. Add `docs/_index.md` or expand `llms.txt` with brief file summaries for discoverability.
2. Add a CI link-check job to validate README and docs links.
3. Add a lightweight API audit that exposes minimal test helpers for external tooling.

## Contributing

Fork the repository, create a feature branch, add tests, and open a pull request. Follow these rules:

- Edit TypeScript only under `src/` (do not modify build artifacts in `dist/`).
- Keep deterministic behavior: use seeded RNG and `GameState` for runtime state.
- Add unit tests in `test/vitest/` for logic changes and update `test/playwright/` for UI flows when relevant.
- Run `npm run typecheck` and `npm test` before opening a PR.

## License

MIT — see `LICENSE.MD`.
