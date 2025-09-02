# Tech Context — SpaceAutoBattler

Languages & runtimes
- TypeScript targeting Node and browser (ES Module)
- Bundler: esbuild-based scripts in `scripts/` for standalone builds
- Renderer: three.js (instancing + BVH)

Key deps
- three, three-mesh-bvh, rapier3d-compat, gsap, postprocessing
- Dev tools: vitest, playwright, eslint, prettier

Build & CI notes
- Build scripts: `scripts/build.mjs`, `build-standalone.mjs` produce dist/ artifacts.
- Use `http-server` for quick local serving; `serve:dist` serves built artifacts.

Running tests
- Unit tests: `npm test` (vitest)
- E2E: `npm run test:e2e` (Playwright)

Generated/updated: 2025-09-02 by Serena agent.