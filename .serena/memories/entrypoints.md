## Entrypoints

Last-Reviewed: 2025-09-07

Lists the application's entrypoints and how they are used.
- `src/main.ts` - main app bootstrap (UI wiring, renderer creation, worker handshake)
- `src/simWorker.ts` - physics worker entry script
- `scripts/build.mjs` and `scripts/build-standalone.mjs` - build helpers for dist and standalone HTML

Notes: Use `npm run serve` or `npm run serve:dist` after building for manual testing.