

# Gamemanager authoritative source

The GameManager implementation and API are written in TypeScript (`src/gamemanager.ts`).
All runtime and build logic now uses only TypeScript sources in `/src/*.ts`. No JS shims or transpilation steps are required.


Development notes

- Edit `src/gamemanager.ts` for behavior changes.

- Build with `npm run build` or `npm run build-standalone` to generate the bundles.

- The build process is implemented in `scripts/build.mjs` and `scripts/build-standalone.mjs` and uses only TypeScript sources.
