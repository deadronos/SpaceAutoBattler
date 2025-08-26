# Memory index — SpaceAutoBattler

This file is an exported snapshot of the agent's internal memory observations for the repository. Generated from docs/memory_snapshot.json.

## Nodes exported

### GameState

- Source: `src/types/index.ts`

- Summary: Canonical GameState interface used across simulation and renderer; includes t, ships, bullets, assetPool (textures/sprites/effects), teamCounts, shipMap.

### config/entitiesConfig.ts

- Source: `src/config/entitiesConfig.ts`

- Summary: Defines ShipTypeCfg and CannonCfg; ShipConfig presets; SIZE_DEFAULTS; getShipConfig() normalizes cannon ranges; BULLET_DEFAULTS and PARTICLE_DEFAULTS.

### config/teamsConfig.ts

- Source: `src/config/teamsConfig.ts`

- Summary: TeamsConfig with teams and defaultFleet counts; generateFleetForTeam, makeInitialFleets, chooseReinforcements and chooseReinforcementsWithManagerSeed.

### config/assets/assetsConfig.ts

- Source: `src/config/assets/assetsConfig.ts`

- Summary: AssetsConfig with shapes2d, animations, svgAssets, turretDefaults and helpers getSpriteAsset/getVisualConfig/getEngineTrailConfig.

### test/vitest/setupTests.ts

- Source: `test/vitest/setupTests.ts`

- Summary: Vitest global setup using happy-dom and providing TextEncoder/TextDecoder and inline svgs via setup-inline-svgs; run before tests.

### test/vitest/assetpool_defaults.spec.ts

- Source: `test/vitest/assetpool_defaults.spec.ts`

- Summary: Ensures acquireSprite creates assetPool and releaseSprite places objects on freeList; uses minimal fake GameState.

### test/vitest/utils/stateFixture.ts

- Source: `test/vitest/utils/stateFixture.ts`

- Summary: makeDeterministicState(seed) fixture for deterministic tests using makeInitialState() and srand().

### test/vitest/ship_movement.spec.ts

- Source: `test/vitest/ship_movement.spec.ts`

- Summary: Integration test verifying simulateStep increases ship velocity when throttle/accel are present.

### test/vitest/utils/glStub.ts

- Source: `test/vitest/utils/glStub.ts`

- Summary: GL and sprite stub helpers: makeGLStub(), makeSpriteFactory() for texture/sprite creation tracking.

### test/vitest/utils/poolAssert.ts

- Source: `test/vitest/utils/poolAssert.ts`

- Summary: Assertion helpers for pool tests: expectPoolMaxFreeList and expectDisposedAtLeast.

### test/vitest/setup-inline-svgs.ts

- Source: `test/vitest/setup-inline-svgs.ts`

- Summary: Inline SVG asset fixture injected into globalThis.__INLINE_SVG_ASSETS for tests.

### test/vitest/ai-range.spec.ts

- Source: `test/vitest/ai-range.spec.ts`

- Summary: AI range and engagement tests (target selection / range enforcement).

### test/vitest/armor-shield.spec.ts

- Source: `test/vitest/armor-shield.spec.ts`

- Summary: Armor and shield interaction tests (damage, mitigation, regen).

### test/vitest/ailogic.spec.ts

- Source: `test/vitest/ailogic.spec.ts`

- Summary: AI decision logic tests (evasive, targeting, thresholds).

### test/vitest/asset_pool_integration.spec.ts

- Source: `test/vitest/asset_pool_integration.spec.ts`

- Summary: Integration tests for asset pooling across renderer and simulation boundaries.

### test/vitest/assets.spec.ts

- Source: `test/vitest/assets.spec.ts`

- Summary: AssetsConfig and asset helper tests (getSpriteAsset/getShipAsset/getBulletAsset).

### test/vitest/assetpool_internal.spec.ts

- Source: `test/vitest/assetpool_internal.spec.ts`

- Summary: Internal asset pool unit tests for helpers and invariants.

### test/vitest/carrier-spawn.spec.ts

- Source: `test/vitest/carrier-spawn.spec.ts`

- Summary: Carrier spawn behavior and fighter spawn tests.

### test/vitest/deterministic-spawn.spec.ts

- Source: `test/vitest/deterministic-spawn.spec.ts`

- Summary: Deterministic spawn/fleet placement tests using seeded RNG.

### test/vitest/bullet_prev_property.spec.ts

- Source: `test/vitest/bullet_prev_property.spec.ts`

- Summary: Bullet prev property maintenance across simulation steps.

### test/vitest/attributes.spec.ts

- Source: `test/vitest/attributes.spec.ts`

- Summary: Entity attribute handling tests (hp, shield, armor).

### test/vitest/shield-outline.spec.ts

- Source: `test/vitest/shield-outline.spec.ts`

- Summary: Shield outline rendering/data tests.

### test/vitest/shipmap_sync.spec.ts

- Source: `test/vitest/shipmap_sync.spec.ts`

- Summary: ShipMap synchronization tests between arrays and Map lookups.

### test/vitest/shipmap_formfleets.spec.ts

- Source: `test/vitest/shipmap_formfleets.spec.ts`

- Summary: Form fleets helper tests and shipMap population verification.

### test/vitest/rng-stream.spec.ts

- Source: `test/vitest/rng-stream.spec.ts`

- Summary: RNG streaming utilities deterministic behavior tests.

### test/vitest/renderer_coalesce.spec.ts

- Source: `test/vitest/renderer_coalesce.spec.ts`

- Summary: Renderer coalescing and draw-batching behavior tests.

### test/vitest/rendererflow.spec.ts

- Source: `test/vitest/rendererflow.spec.ts`

- Summary: Renderer pipeline flow integration tests.

### test/vitest/pool_stress.spec.ts

- Source: `test/vitest/pool_stress.spec.ts`

- Summary: Stress tests for pool allocation/releasing under load.

### test/vitest/pool_overflow.spec.ts

- Source: `test/vitest/pool_overflow.spec.ts`

- Summary: Pool overflow strategy tests (discard-oldest/grow/error).

### test/vitest/pool_class.spec.ts

- Source: `test/vitest/pool_class.spec.ts`

- Summary: Tests for Pool class API and semantics.

### test/vitest/pooling.spec.ts

- Source: `test/vitest/pooling.spec.ts`

- Summary: General pooling integration tests (sprites/textures/effects).

### test/vitest/texture_pool_error_strategy.spec.ts

- Source: `test/vitest/texture_pool_error_strategy.spec.ts`

- Summary: Texture pool overflow and error strategy tests.

### test/vitest/texture_pool_entry_disposer.spec.ts

- Source: `test/vitest/texture_pool_entry_disposer.spec.ts`

- Summary: Verifies disposers for texture pool entries are called during cleanup/trim.

### test/vitest/tintedSharedCanvas.spec.ts

- Source: `test/vitest/tintedSharedCanvas.spec.ts`

- Summary: Shared canvas tinting logic tests for renderer overlays.

### test/vitest/turret.spec.ts

- Source: `test/vitest/turret.spec.ts`

- Summary: Turret aiming, firing and origin offset tests.

### test/vitest/tintedHullPool.spec.ts

- Source: `test/vitest/tintedHullPool.spec.ts`

- Summary: Tinted hull pooling tests for team-colored hulls.

### test/vitest/tintedCache.spec.ts

- Source: `test/vitest/tintedCache.spec.ts`

- Summary: Tinted canvas/sprite cache behavior and eviction tests.

### test/vitest/turret_firing_origin.spec.ts

- Source: `test/vitest/turret_firing_origin.spec.ts`

- Summary: Turret firing origin computations tests.

### test/vitest/texture_pool_disposer.spec.ts

- Source: `test/vitest/texture_pool_disposer.spec.ts`

- Summary: Texture pool disposer invocation tests.

### test/vitest/texture_pool.spec.ts

- Source: `test/vitest/texture_pool.spec.ts`

- Summary: Core texture pool tests for allocation/freeing behavior.

### test/vitest/teamcounts.spec.ts

- Source: `test/vitest/teamcounts.spec.ts`

- Summary: Team counts caching and update tests.

### test/vitest/teamcolor.spec.ts

- Source: `test/vitest/teamcolor.spec.ts`

- Summary: Team color mapping and application tests.

### test/vitest/team-switch.spec.ts

- Source: `test/vitest/team-switch.spec.ts`

- Summary: Tests switching a ship's team and resulting state changes.

### test/vitest/types_barrel.spec.ts

- Source: `test/vitest/types_barrel.spec.ts`

- Summary: Types barrel re-export verification tests.

### test/vitest/svgRenderer_rasterize.spec.ts

- Source: `test/vitest/svgRenderer_rasterize.spec.ts`

- Summary: SVG rasterization correctness tests.

### test/vitest/svgRenderer_mru.spec.ts

- Source: `test/vitest/svgRenderer_mru.spec.ts`

- Summary: MRU cache behavior tests for SVG renderer.

### test/vitest/svgRenderer_cache.spec.ts

- Source: `test/vitest/svgRenderer_cache.spec.ts`

- Summary: SVG renderer cache lookup/eviction tests.

### test/vitest/svgLoader_teamcolors.spec.ts

- Source: `test/vitest/svgLoader_teamcolors.spec.ts`

- Summary: SVG loader team-color application tests.

### test/vitest/svgLoader_hullonly.spec.ts

- Source: `test/vitest/svgLoader_hullonly.spec.ts`

- Summary: SVG loader hull-only case tests.

### test/vitest/svgLoader_applyTeam.spec.ts

- Source: `test/vitest/svgLoader_applyTeam.spec.ts`

- Summary: Applying team color transforms during SVG load tests.

### test/vitest/sprite_effect_pooling.spec.ts

- Source: `test/vitest/sprite_effect_pooling.spec.ts`

- Summary: Pooling tests for small sprite effects and particles.

### test/vitest/spatialGrid.spec.ts

- Source: `test/vitest/spatialGrid.spec.ts`

- Summary: Spatial grid indexing and neighbor query tests.

### test/vitest/smoke_ai_simulation.spec.ts

- Source: `test/vitest/smoke_ai_simulation.spec.ts`

- Summary: Smoke/integration test for AI simulation scenarios.

### test/vitest/simulationflow.spec.ts

- Source: `test/vitest/simulationflow.spec.ts`

- Summary: Simulation step flow, tick ordering, and cleanup tests.

### test/vitest/shiptypes.spec.ts

- Source: `test/vitest/shiptypes.spec.ts`

- Summary: Ship type config validation and default application tests.

### test/vitest/pooled_factory.spec.ts

- Source: `test/vitest/pooled_factory.spec.ts`

- Summary: PooledFactory and makePooled factory tests.

### test/vitest/physics_acceleration.spec.ts

- Source: `test/vitest/physics_acceleration.spec.ts`

- Summary: Physics acceleration and integration math tests.

### test/vitest/maxspeed_fallback.spec.ts

- Source: `test/vitest/maxspeed_fallback.spec.ts`

- Summary: maxSpeed fallback guard tests (createShip).

### test/vitest/svgRenderer_ttl.spec.ts

- Source: `test/vitest/svgRenderer_ttl.spec.ts`

- Summary: TTL eviction tests for SVG renderer cache.

### test/vitest/webgl_pooling.spec.ts

- Source: `test/vitest/webgl_pooling.spec.ts`

- Summary: WebGL pooling tests using glStub helpers.

### test/vitest/webglrenderer-texture.spec.ts

- Source: `test/vitest/webglrenderer-texture.spec.ts`

- Summary: WebGL renderer texture upload/delete semantics tests.

### test/vitest/viewport_scale.spec.ts

- Source: `test/vitest/viewport_scale.spec.ts`

- Summary: Viewport/display scale interaction tests.

### test/vitest/worker_snapshot_render.spec.ts

- Source: `test/vitest/worker_snapshot_render.spec.ts`

- Summary: Worker snapshot -> renderer integration tests.

### test/vitest/main.dispose.spec.ts

- Source: `test/vitest/main.dispose.spec.ts`

- Summary: Main module dispose/cleanup tests for renderer and pools.

### test/vitest/logicalmap.spec.ts

- Source: `test/vitest/logicalmap.spec.ts`

- Summary: Logical map partitioning tests.

### test/vitest/integration_team_color_pixel.spec.ts

- Source: `test/vitest/integration_team_color_pixel.spec.ts`

- Summary: Pixel-level integration test for team color correctness after rendering.

### test/vitest/gamemanager.spec.ts

- Source: `test/vitest/gamemanager.spec.ts`

- Summary: Game manager behavior tests (reinforcements, events, fallback positions).

### test/vitest/gameflow.spec.ts

- Source: `test/vitest/gameflow.spec.ts`

- Summary: High-level game flow integration tests.

### test/vitest/flash_cleanup.spec.ts

- Source: `test/vitest/flash_cleanup.spec.ts`

- Summary: Flash/particle cleanup tests to avoid leaks.

### test/vitest/effect_coordinates.spec.ts

- Source: `test/vitest/effect_coordinates.spec.ts`

- Summary: Effect coordinate transform tests (world <-> local).

### test/vitest/pooling/per_key_overflow.spec.ts

- Source: `test/vitest/pooling/per_key_overflow.spec.ts`

- Summary: Per-key overflow behavior tests for pools.

### test/vitest/integration/turret_render_integration.spec.ts

- Source: `test/vitest/integration/turret_render_integration.spec.ts`

- Summary: Turret renderer integration tests ensuring mountpoints and visuals align.

### test/playwright/ship-movement-debug.spec.js

- Source: `test/playwright/ship-movement-debug.spec.js`

- Summary: Playwright E2E/visual debug test for ship movement and screenshots.

### test

- Source: `test`

- Summary: this is just a test

---

Last updated by generator on 2025-08-26T08:25:13.060Z
