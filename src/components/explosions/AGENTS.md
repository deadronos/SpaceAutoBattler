# Agents Guide: src/components/explosions

- Purpose: Explosion rendering pipeline: instanced managers, per-effect updaters, dynamic lights and materials.
- Separation: Render-only code consumes pooled `ExplosionEvent` objects from `GameState.explosions` and must not mutate authoritative simulation state.
- Extensibility: Add new effect updaters in `effectUpdaters/` and wire them into the instanced lifecycle; keep update logic allocation-light.
- Testing: Use focused unit tests for effect math and Playwright snapshots for visual regressions.
