# Particle-based Explosion Spec

## Goal

Design a particle-based explosion effect triggered when a ship dies. The explosion should visually scale with the ship's radius, be deterministic (respect seeded RNG used by the game), use the existing asset pool and renderer pipeline, and be performant at moderate counts (many simultaneous small explosions should be cheap).

## Non-goals

- This spec does not implement the effect. It describes the planned design, data shapes, API, configuration, and tests.
- It does not change existing postprocessing flash-based explosion behavior (the bloom flash). The new particle explosion is additive, and can be enabled/disabled via config.

## Requirements

1. Visual: Particle explosion must approximate a radial burst with configurable color gradients, lifetime, velocity spread, and size, and should scale with the ship radius.
2. Determinism: Given the same RNG seed and inputs (ship id, time), the explosion particle properties should be reproducible for simulation and testing.
3. Integration: Use `GameState.assetPool` for meshes/textures and respect renderer update loop and disposal semantics.
4. Performance: Use instancing or GPU-friendly techniques (single mesh with per-particle attributes when available) and an object/particle pooling system to minimize allocations.
5. Config-driven: Expose settings under `rendererConfig.particles.explosion` including count, lifetime, size, velocity, color stops, and pooling sizes.
6. API: Renderer should expose a clear function `addParticleExplosion(state: GameState, opts: ParticleExplosionOptions)` that can be called when a ship is destroyed.
7. Tests: Unit tests and a short visual smoke test must be defined in this spec to validate behavior and performance.

## Design

High-level:

- When a ship dies, core logic emits an event (or directly calls) renderer API with ship position, radius, and optional seed.
- Renderer translates that into N particle instances sized and positioned around the ship, with randomized velocities drawn from seeded RNG.
- Particles are updated in renderer tick; they use a lifetime, fade color/alpha according to config, and are returned to the pool after expiration.

## Data shapes

- ParticleExplosionOptions
  - pos: {x,y,z}
  - radius: number
  - seed?: number // optional to guarantee deterministic randomness
  - colorOverride?: string[] // optional color stops
  - count?: number
  - lifetime?: number

Renderer/internal types (high-level)

- ParticleInstance
  - id: number
  - pos: Vec3
  - vel: Vec3
  - size: number
  - age: number
  - lifetime: number
  - color: Color
  - active: boolean

## Configuration

Add to `src/config/rendererConfig.ts` (example keys):

rendererConfig.particles.explosion = {
enabled: true,
countPerRadius: 20, // base particles per unit radius
minCount: 8,
maxCount: 200,
lifetime: 1.2, // seconds
size: { min: 0.02, max: 0.2 },
velocity: { radial: { min: 1.0, max: 6.0 }, randomSpread: 0.6 },
colors: ["#fffbda", "#ff8c00", "#440000"],
pooling: { initial: 256, growTo: 2048 }
};

## API contract

- addParticleExplosion(state: GameState, opts: ParticleExplosionOptions): void
  - Input: `state` and `opts` as specified.
  - Side effects: allocates N particle instances from renderer pool, sets per-particle properties using seeded RNG, registers them with the renderer for per-frame updates.
  - Returns: void. Optionally, returns a handle for cancelling early.

## Implementation notes

- RNG: Use `state.rng` or `src/utils/rng.ts` seeded with (base seed XOR ship.id XOR floor(state.time\*1000)) if `opts.seed` is not provided.
- Pooling: Maintain a ring-buffer style pool of ParticleInstance objects. Avoid per-frame allocations by reusing objects and typed arrays for per-instance attributes when using GPU instancing.
- Rendering path: Prefer a single instanced mesh with per-instance attributes (position, size, color, ageNormalized) sent to shader. Fall back to CPU-evaluated point sprites for unsupported targets.
- Shader: A simple additive-blend billboard shader that uses a radial falloff texture (soft circle) and color interpolation across lifetime.
- Lifetimes & sorting: Particles are additive; no depth write and lightweight sorting is fine. For opaque large particles, treat separately.

## Edge cases

- Very large ships: clamp particle count to `maxCount` to avoid explosion storms.
- Many simultaneous explosions: honor `pooling.growTo` and if exhausted, drop lowest-priority (smallest or oldest) particles.
- Disabled config: fallback to existing bloom flash to preserve visual feedback.

## Performance and safety

- Keep per-particle work minimal. Offload where possible to GPU instancing.
- Use coarse LOD: for tiny ships, use a small number of particles or a single scaled sprite.
- Avoid creating new materials each explosion; reuse shared material instances from `assetPool`.
- Provide an opt-out setting to disable particle explosions on low-end devices.

## Acceptance tests

1. Unit: determinism
   - Given a fixed seed and ship radius, two calls to `addParticleExplosion` produce the same particle initial positions and velocities.
2. Unit: scale
   - For radius R1 < R2, average particle spawn distance and particle count scale accordingly (within config limits).
3. Smoke visual test
   - Manually trigger explosions for small/medium/large ship classes and visually confirm burst and fade.
4. Performance test
   - Spawn 50 medium explosions simultaneously; measure frame time and ensure renderer frame time increase within acceptable limit (TBD, e.g., <10ms on desktop dev machine).

## Integration steps (implementation tasks)

1. Add `rendererConfig.particles.explosion` defaults to `src/config/rendererConfig.ts`.
2. Add typed interfaces to `src/types` for ParticleExplosionOptions and internal ParticleInstance.
3. Implement pooling and instanced renderer in `src/renderer/particleSystem.ts`.
4. Wire `src/core`: call `addParticleExplosion(this.state, { pos: ship.pos, radius: ship.radius, seed: someSeed })` when ship dies.
5. Add unit tests for determinism and scaling under `test/vitest/`.
6. Add small visual scene under `spec/` or dev page to test multiple explosions.

## Security and correctness notes

- No user-provided data used for codegen; all assets and config are internal.
- Respect disposal rules in Three.js: when renderer shutdown occurs, release GPU buffers and textures.

## Open decisions

- Exact shader code and texture asset (soft circle) choice.
- Whether to use CPU or GPU simulation for particle movement.

## Timeline estimate

- Spec to PR (this file): 1 hour (already done)
- Implementation (pool + instanced renderer + wiring + tests): ~1-2 days of focused work.

## Changelog

- Initial spec created.
