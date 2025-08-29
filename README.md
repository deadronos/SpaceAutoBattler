# SpaceAutoBattler

![Gameplay preview](VideoCapture.gif)

SpaceAutoBattler is a lightweight, research-oriented 3D space combat simulator. The project separates deterministic simulation logic (`src/core`) from rendering (`src/renderer`) so you can run headless tests and fast experiments.

## Quick start

Install dependencies and start the dev server:

```bash
git clone https://github.com/deadronos/SpaceAutoBattler.git
cd SpaceAutoBattler
npm install
npm run serve
```

Open the local server at [http://localhost:8080](http://localhost:8080).

## Codebase updates (#codebase)

- `llms.txt` was added at the repository root to help LLMs and contributors find key docs and entry points.
- `AIController.calculateSeparationForceWithCount` is available as a public helper for testing and tooling.
- New flag: `behaviorConfig.globalSettings.enableSpawnJitter` (default: true) — a tiny deterministic spawn-time velocity jitter to avoid perfect symmetry in clustered spawns.

Proposed quick improvements:

1. Add `docs/_index.md` or expand `llms.txt` with brief file summaries for discoverability.
2. Add a CI link-check job to validate README/llms links.
3. Run an API audit to intentionally expose a minimal set of helpers for testing.

## Testing

Unit tests live under `test/vitest/` (pure logic tests). E2E and UI tests are under `test/playwright/`.

Run tests locally:

```bash
npm test
npm run test:e2e
npm run typecheck
```

## Recent AI behavior changes

- `AIController.calculateSeparationForceWithCount` — helper for separation math.
- `behaviorConfig.globalSettings.enableSpawnJitter` (default: true) — deterministic spawn jitter.
- `globalSettings.evadeOnlyOnDamage` remains configurable for backward compatibility.

## Contributing

Fork the repository, create a feature branch, add tests, and open a pull request. Ensure linting and tests pass.

## License

MIT — see `LICENSE.MD`.
