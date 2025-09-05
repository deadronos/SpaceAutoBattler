## PRD: Particle Explosion

### 1. Product overview

#### 1.1 Document title and version
- PRD: Particle Explosion
- Version: 0.1

#### 1.2 Product summary
The project is to design, specify, and deliver a production-ready particle-based explosion effect that is triggered when a ship dies. The explosion must visually scale to each ship's radius, be deterministic using the game's seeded RNG, integrate cleanly with the existing renderer and `GameState.assetPool`, and meet a desktop performance target (see acceptance criteria).

This PRD covers the full end-to-end scope: engineering integration points, renderer implementation approach (including instanced rendering and pooling), asset and shader authoring guidance, tests (unit + smoke + perf), and rollout plan.

### 2. Goals

#### 2.1 Business goals
- Improve visual fidelity and feedback for ship destruction to increase player satisfaction and perceived polish.
- Provide a configurable, performant system that can be enabled gradually across platforms.
- Keep implementation maintainable and deterministic for repeatable tests and replayability.

#### 2.2 User goals
- Players see satisfying explosion visuals that scale to ship size and match team/coloring.
- Explosions are unobtrusive on performance and do not drop below 60 FPS on supported desktop targets.

#### 2.3 Non-goals
- This effort will not replace the existing bloom flash effect; it augments it. The existing bloom flash remains the fallback/opt-out.
- This PRD does not mandate a specific visual art style — the engineering API must support art-driven iteration.

### 3. User personas

#### 3.1 Key user types
- Renderer engineers: implement instanced renderer, pooling, shader, and render loop updates.
- Gameplay/core engineers: trigger explosion on ship death, pass deterministic seed + metadata.
- Technical artists: supply soft-circle texture(s), color palettes, and iterate on shader parameters.
- QA/perf engineers: validate determinism, visual correctness, and performance targets.
- Automated agents (AI): consume PRD to create tasks and tests.

#### 3.2 Basic persona details
- **Renderer engineer**: needs clear API, typed interfaces, and performance targets. Responsible for GPU-friendly implementation and disposal.
- **Gameplay engineer**: needs a synchronous/async hook that fires on ship death and provides pos/radius/seed.
- **Technical artist**: needs shader preview guidance and recommended texture formats and naming.

#### 3.3 Role-based access
- **renderer**: implement, own tests, and ship renderer config defaults. Can toggle particle explosion via config.
- **core/gameplay**: call the API when ship dies, provide optional seed and colorOverride.
- **art**: provide assets and iterate on shader parameters in a dev scene.

### 4. Functional requirements

- **Explosion rendering** (Priority: High)
  - GH-001: Renderer must provide `addParticleExplosion(state: GameState, opts: ParticleExplosionOptions)`.
  - GH-002: Explosion visuals must scale with the ship radius and be tunable by config.
- **Deterministic RNG** (Priority: High)
  - GH-003: Explosion initial particle positions & velocities must be reproducible given a seed.
- **Pooling & reuse** (Priority: High)
  - GH-004: Renderer must use pooling to avoid per-frame allocations and support configurable pool sizes.
- **Config-driven** (Priority: Medium)
  - GH-005: All parameters (counts, lifetimes, sizes, colors, pooling) must be configurable under `rendererConfig.particles.explosion`.
- **Fallback behavior** (Priority: Medium)
  - GH-006: When particle explosions are disabled or out-of-pool, the existing bloom flash must still surface to preserve feedback.
- **Authoring & assets** (Priority: Medium)
  - GH-007: Technical artists must be able to provide textures (soft-circle, noise) and color palettes; the API should accept colorOverride.

### 5. User experience

#### 5.1 Entry points & first-time user flow
- When the game starts, `renderer` initializes the explosion particle pool and registers update hooks.
- On ship destruction, `core` calls `addParticleExplosion` with `pos`, `radius`, optional `seed`, and optional color overrides.
- Particles spawn and animate over a TTL controlled by config, fade out, and are returned to the pool.

#### 5.2 Core experience
- **Spawn**: Particles spawn in a radial distribution around the ship center. Particle count = clamp(countPerRadius * radius, minCount, maxCount).
- **Animate**: Each particle has velocity (radial + random spread), size, color ramp over lifetime, and alpha fade.
- **Cleanup**: After lifetime ends, particle instances are recycled.

#### 5.3 Advanced features & edge cases
- LOD: for very small ships use a single billboard sprite; for very large ships cap count and add layered shock/gore decals as future work.
- Pool exhaustion: drop lowest-priority particles and/or fall back to bloom flash.

#### 5.4 UI/UX highlights
- Color interpolation across particle lifetime (bright center -> orange -> dark) controlled by artist-provided stops.
- Add small camera-facing lens-glow/tint for large explosions if toggled in config.

### 6. Narrative
When an enemy ship is destroyed, the core system triggers an explosion event with a deterministic seed and the ship's radius. The renderer consumes the event, instantiates a burst of particles sized by radius, animates them on the GPU (or efficient CPU path), and recycles the particle instances. The result is a satisfying, scalable explosion that is deterministic and performs to a desktop target of 60 FPS with acceptable headroom.

### 7. Success metrics

#### 7.1 User-centric metrics
- Increase subjective polish score in playtests (qualitative) for ship destruction feedback.

#### 7.2 Business metrics
- No increase in crash rate or memory regressions after rollout.

#### 7.3 Technical metrics (numeric acceptance)
- PER-001: Rendering cost for 50 medium explosions spawned simultaneously on a desktop dev machine must add <10ms frame time overhead (so 60+ FPS stays feasible).
- PER-002: Determinism: two runs with identical seed and inputs must produce identical initial particle states (pos & vel within floating point tolerance).
- PER-003: Pool memory growth should not exceed configured `pooling.growTo` under stress tests.

### 8. Technical considerations

#### 8.1 Integration points
- `src/core` (gameplay): fire the explosion via `addParticleExplosion` on ship death (pass `pos`, `radius`, `teamColor`, `seed`).
- `src/config/rendererConfig.ts`: add `particles.explosion` defaults and toggles.
- `src/types`: add `ParticleExplosionOptions` and `ParticleInstance` types.
- `src/renderer`: implement `particleSystem` (e.g., `src/renderer/particleSystem.ts`) exposing `addParticleExplosion` and lifecycle methods.
- `GameState.assetPool`: store/reuse textures and materials.

#### 8.2 Data storage & privacy
- No player data required. All data are internal runtime objects.

#### 8.3 Scalability & performance
- Use GPU instancing when available. Use typed arrays and upload per-instance attributes in batches.
- Provide a CPU fallback that uses pre-baked billboard sprites when instancing unavailable.

#### 8.4 Potential challenges
- Ensuring determinism across CPU/GPU differences and shader randomness.
- Managing GPU buffer updates efficiently when many explosions occur in the same frame.

#### 8.5 Think/explore: instanced rendering group and pooling strategies
- Proposal: implement a single instanced mesh group per particle material/type (e.g., "explosion-soft"), and maintain per-instance attribute buffers for position, size, color, ageNormalized.
- Buffer strategy:
  - Use dynamic ring buffers (typed arrays) sized to `pooling.initial`. When buffer head reaches capacity, wrap and overwrite oldest inactive instances.
  - Avoid per-explosion GL buffer re-allocations: upload only the range of instances updated each frame.
- Pooling strategy:
  - Maintain an array of `ParticleInstance` objects with metadata (active, lifetime, indices).
  - Keep a free-list and an active-list. On spawn, allocate from free-list; on expiration, return to free-list.
  - When free-list empty and pool < `pooling.growTo`, grow buffers and allocate more instances.
  - If pool at `growTo` and exhausted, implement graceful degradation: drop smallest/oldest particles or substitute bloom flash.
- Caching/use reuse:
  - Reuse shared `Material` and `Texture` objects from `assetPool`.
  - Group particles by material and shader to reduce draw calls.
  - Provide a debug UI to visualize pool usage and create alarms for excessive growth.
- Synchronization & determinism:
  - Generate per-particle initial data (pos, vel) deterministically on CPU using `state.rng` seeded by (global seed XOR ship.id XOR floor(time*1000)) and then upload those values to GPU buffers. Avoid GPU-side randomness that would be nondeterministic across runs.

### 9. Milestones & sequencing

#### 9.1 Project estimate
- Size: Medium; Estimate: 1-2 developer-days for renderer + integration + tests (split across 2-3 focused commits).

#### 9.2 Team size & composition
- Team size: 2 (1 renderer/TAA, 1 gameplay + QA support). Optionally add a technical artist for 1 day to produce textures and parameter passes.

#### 9.3 Suggested phases
- **Phase 1: Design & config (0.25d)**: Add config entries and type definitions; finalize API contract.
- **Phase 2: Renderer pool + instanced path (0.75d)**: Implement particle pool, instanced buffer strategy, shader, and shared material handling.
- **Phase 3: Integration & wiring (0.25d)**: Hook `core` death event to call `addParticleExplosion`; add fallback handling.
- **Phase 4: Tests & perf validation (0.25–0.5d)**: Add deterministic unit tests, scaling tests, and perf smoke tests.

### 10. User stories

#### 10.1 Add particle explosion API
- **ID**: GH-001
- **Description**: As a gameplay engineer, I want to call a simple `addParticleExplosion(state, opts)` API so I can trigger explosions when ships die.
- **Acceptance criteria**:
  - The function is typed and exported by renderer.
  - It accepts `pos`, `radius`, optional `seed`, optional `colorOverride`, and optional `count`.
  - On call, particles appear and recycle after TTL.

#### 10.2 Deterministic particle initial state
- **ID**: GH-002
- **Description**: As a QA engineer, I need explosion particle initial positions and velocities to be reproducible given the same seed so we can write tests and replays.
- **Acceptance criteria**:
  - Unit test that checks two runs with the same seed produce matching particle pos/vel arrays within float tolerance.

#### 10.3 Configurable parameters and defaults
- **ID**: GH-003
- **Description**: As a renderer engineer, I need all tunable parameters exposed in `rendererConfig.particles.explosion`.
- **Acceptance criteria**:
  - Defaults added to `src/config/rendererConfig.ts` and verified by unit tests.

#### 10.4 Pooling and fallback behavior
- **ID**: GH-004
- **Description**: As a performance engineer, I want pooling to limit allocations and gracefully degrade when saturated.
- **Acceptance criteria**:
  - Pool grows to `pooling.growTo` and no more.
  - Under exhaustion, oldest or lowest-priority particles are dropped and bloom flash fallback triggers.

#### 10.5 Shader and asset authoring
- **ID**: GH-005
- **Description**: As a technical artist, I need shader guidance and expected input textures so I can produce assets.
- **Acceptance criteria**:
  - Provide a reference soft-circle texture (recommended size/prefix) and shader parameter documentation.

#### 10.6 Performance validation
- **ID**: GH-006
- **Description**: As QA/perf, validate that 50 medium explosions add <10ms frame overhead on desktop hardware.
- **Acceptance criteria**:
  - Perf test script or manual measurement shows <10ms extra frame time for 50 simultaneous medium explosions.

### Final checklist
- [x] Product overview and scope defined
- [x] Audience: all (engineers, art, QA) + AI agents
- [x] Numeric acceptance criteria: <10ms for 50 medium explosions (desktop) and seeded RNG determinism
- [x] Include shader/asset authoring and integration scope
- [x] Think/explore criteria for instanced rendering and pooling included

Notes and next steps
- If approved, I will: 1) split PRD user stories into issues, 2) add config defaults in `src/config/rendererConfig.ts`, and 3) implement a minimal instanced particleSystem in `src/renderer/particleSystem.ts` with unit tests for determinism. Please confirm if you want me to create issues now and begin implementation.
