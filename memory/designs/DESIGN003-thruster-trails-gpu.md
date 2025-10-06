# DESIGN003 — Thruster trail GPU buffer migration

Date: 2025-10-06
Author: Codex (GPT-5 Codex agent)

Confidence: 88% — Instanced buffer authoring and shader wiring are familiar; R3F testing requires careful mocks but follows existing StarDisk patterns.

## Goal

Move thruster trail rendering from a CPU-managed particle pool to GPU-driven instanced buffers so large fleets no longer bottleneck the main thread while keeping deterministic spawn jitter and visual parity with the prior system.

## Context & Problem Statement

- `src/components/ParticleTrails.tsx` preallocates `Particle[]` objects, iterates every slot each frame, and clones vectors during spawn updates, which scales poorly beyond a few hundred ships.
- GLTF-derived thruster anchors are already memoised, but world transforms still allocate `Vector3` instances in fallback paths.
- Trails only need spawn metadata (position, velocity, lifetime, scale); the GPU can evolve positions and fade over time via instanced attributes and a shader uniform clock.
- We must preserve deterministic jitter to keep profiling consistent and supply tests that assert GPU resource shape and per-frame uniform updates.

## Scope

In scope:
- `src/components/ParticleTrails.tsx` (rewrite to GPU buffers, optional test hooks, disposal logic).
- New Vitest coverage under `test/vitest/particle-trails-gpu.spec.tsx`.
- Memory bank updates (requirements, task file, index) and documentation for design/plan.

Out of scope:
- Changing renderer config defaults (color, spawn rate, lifetime).
- Overhauling bloom registration or integrating additional post-processing.
- Compute shader / transform feedback implementation (instanced attributes with custom shader only).

## Proposed Architecture

1. **GPU Resource Factory**
   - Introduce `createParticleTrailResources(maxParticles, config)` returning:
     - `InstancedBufferGeometry` cloned from a low-poly sphere with instanced attributes for spawn position, velocity, spawn time, lifetime, and scale (all marked `DynamicDrawUsage`).
     - `ShaderMaterial` that accepts uniforms `uTime`, `uColor`, `uOpacity` and handles additive blending/depth flags per config.
     - Typed array views (`Float32Array`) backing each instanced attribute for direct writes.
   - Export the factory for unit tests and allow the component to reuse injected resources (via optional `resources` prop) to avoid duplicate allocations in tests.

2. **Ring Buffer State**
   - Replace the CPU particle pool with refs storing:
     - `nextIndex` (0..max-1), `filledCount` (min(total spawned, maxParticles)).
     - `spawnRemainders` map keyed by `shipId:anchorIndex` accumulating fractional spawn counts to simulate continuous emission without randomness spikes.
     - `SeededRng` instance seeded with a stable constant so jitter remains deterministic.
   - Each spawn writes directly into attribute arrays (position, velocity, lifetime, scale, spawn time) and flags the corresponding attribute's `.needsUpdate`.

3. **Shader-Driven Evolution**
   - Vertex shader computes current position as `spawnPos + velocity * age`, scales the sphere by `scale * fade(age)`, and passes the fade factor to the fragment shader.
   - Fragment shader multiplies base color by fade-derived alpha and discards fragments with negligible alpha.
   - The render loop only updates `uTime` uniform; no per-particle CPU updates.

4. **Anchor Computation Cache**
   - Maintain `Map<number, Vector3[]>` storing per-ship world-space anchor buffers that are mutated in-place each frame, reusing `Vector3` instances to avoid allocations.
   - GLTF-based local anchors remain memoised; fallback heuristics populate the cache lazily when GLTF data is unavailable.

5. **Lifecycle Management**
   - Dispose geometry/material in a cleanup `useEffect` to prevent leaks.
   - Clamp `instanceCount` to the filled slot count and keep mesh `visible = filledCount > 0` for free culling.

## Data Flow

```
CPU (ships, throttle)
   │
   │ useFrame (delta, time)
   ├─► spawn loop → typed arrays (position/velocity/lifetime/scale/spawnTime)
   │               └─ updates InstancedBufferAttributes (DynamicDrawUsage)
   │
   └─► shader uniform update (`uTime`)

GPU vertex shader
   ├─ reads instanced attributes
   ├─ computes age = uTime - spawnTime
   ├─ calculates position = spawnPos + velocity * age
   └─ sets scale & fade for fragment shader
```

## Interfaces & Contracts

```ts
export interface ParticleTrailResources {
  geometry: InstancedBufferGeometry;
  material: ShaderMaterial;
  attributes: {
    spawnPosition: InstancedBufferAttribute;
    velocity: InstancedBufferAttribute;
    spawnTime: InstancedBufferAttribute;
    lifetime: InstancedBufferAttribute;
    scale: InstancedBufferAttribute;
  };
  arrays: {
    spawnPosition: Float32Array;
    velocity: Float32Array;
    spawnTime: Float32Array;
    lifetime: Float32Array;
    scale: Float32Array;
  };
}

export function createParticleTrailResources(
  maxParticles: number,
  config: Pick<ParticleTrailsConfig, 'size' | 'color' | 'opacity' | 'additiveBlending' | 'depthTest' | 'depthWrite'>,
): ParticleTrailResources;
```

Component contract adjustments:
- `ParticleTrails` accepts optional `resources?: ParticleTrailResources` (primarily for tests) and still renders nothing when `PARTICLE_TRAILS_CONFIG.enabled` is false.

## Error Handling Matrix

| Scenario | Detection | Response | Notes |
| --- | --- | --- | --- |
| GLTF scene missing or bounds zero | `makeAnchors` receives `null` | Return empty anchors; fallback heuristic populates cache lazily | Matches current behavior, avoids crashes |
| Geometry allocation failure | Factory throws | Propagate error (surface during development); component unmounts cleanly | Low risk, but documented |
| Spawn ring saturation | `filledCount` reaches `maxParticles` | Continue overwriting oldest particles (ring buffer) while keeping `instanceCount = maxParticles` | Matches previous pool semantics |
| Negative throttle or invalid config | Throttle check + clamps | Skip spawning, leave existing particles unaffected | Prevents NaN velocities |

## Testing Strategy

- **Unit/Vitest (`test/vitest/particle-trails-gpu.spec.tsx`):**
  - Assert `createParticleTrailResources` builds instanced attributes sized to config `maxParticles`.
  - Mount `ParticleTrails` with injected resources, mock `useFrame`, and drive a frame where a fighter throttles above `minThrottle`; verify the ring buffer records spawn data and increments `instanceCount` deterministically.
  - Advance successive frames to confirm `uTime` uniform updates monotonically without CPU pool iteration.
- **Regression:** Run `npx tsc --noEmit` and `npm test` locally.
- **Manual (optional):** Inspect large fleet scene to confirm visual continuity (document in reflection if executed).

## Work Plan

1. Publish requirements (done) and this design; register TASK246 with subtasks covering implementation, testing, and documentation updates.
2. Implement GPU resource factory, refactor `ParticleTrails` to consume it, add optional `resources` prop, and wire deterministic spawner + shader.
3. Add Vitest coverage with mocked `useFrame`/`useGLTF` leveraging injected resources.
4. Run validation commands (`npx tsc --noEmit`, `npm test`), capture results.
5. Update task progress log, note reflections/technical debt, and prepare PR summary referencing this design.

## Risks & Mitigations

- **Risk:** Shader mistakes could yield invisible particles. *Mitigation:* Keep shader minimal, verify alpha fade logic in tests, and expose color/opacity uniforms for debugging.*
- **Risk:** Remainder map growth if ships churn rapidly. *Mitigation:* Clean stale map entries when ships array omits prior keys (e.g., prune each frame for absent ships).
- **Risk:** Tests might fail due to actual Three.js constructors executing. *Mitigation:* Use real classes but inject resources, mocking only `useFrame`/`useGLTF` similar to existing component tests.

## Open Questions

- Should trail color/opacity become uniforms configurable per faction? (Out of scope; note as potential enhancement.)
- Would a compute-based approach outperform instanced attributes for >10k particles? (Candidate for future research.)

## References

- `src/components/ParticleTrails.tsx` (current CPU pool implementation).
- `src/config/renderer.ts` (trail configuration constants).
- `docs/reports/v0.1.4b/high-impact-ideas.md` (motivation for GPU migration).
- `memory/tasks/TASK006-instanced-particles-explosions.md` (related instancing work).
