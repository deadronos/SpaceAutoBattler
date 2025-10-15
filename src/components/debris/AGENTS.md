# Agents Guide: src/components/debris

- Purpose: Debris rendering and pooling; typically uses instanced managers for performance.
- Integration: Renderers should consume small deterministic data shapes from `GameState` and not perform simulation-level spawns.
- Performance: Use instancing and pools; avoid per-frame allocations in the instanced manager hot path.
- Tests: Render smoke tests via Playwright or snapshot the instanced manager behaviour in unit tests.
