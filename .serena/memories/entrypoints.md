# Entrypoints

Primary entrypoints and their purposes:
- `src/main.ts` — App entry: boots renderer and simulation in a dev environment (used by `npm run serve`).
- `src/simWorker.ts` — Worker-based simulation entrypoint used for offloading simulation in the browser.
- `scripts/build.mjs` and `scripts/build-standalone.mjs` — build pipelines for bundling the app and producing a standalone build.
- `test/vitest/setupTests.ts` — test environment setup for Vitest (registers globals, DOM shims via `happy-dom`).

Helpful quick references
- Dev server: `npm run serve` → serves local files from the repo root on port 8080.
- Running a single unit test file with Vitest: `npx vitest path/to/test.spec.ts` or `npm test -- path/to/test.spec.ts`.
