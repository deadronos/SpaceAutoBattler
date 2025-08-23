Gamemanager authoritative source

The GameManager implementation and API are written in TypeScript (`src/gamemanager.ts`).
To avoid maintaining duplicate logic in the JS runtime, the build process now transpiles `src/gamemanager.ts` into `src/gamemanager.js` prior to bundling. This keeps the JS runtime in sync with the TypeScript source.

Development notes
- Edit `src/gamemanager.ts` for behavior changes.
- Build with `npm run build` or `npm run build-standalone` to regenerate the JS runtime and the bundles.
- The transpile step is implemented in `scripts/build.mjs`.
