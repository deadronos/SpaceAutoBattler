Starting (1/2) Draft particle renderer plan

Completed (1/2) Draft particle renderer plan

I'll lay out a concise, actionable plan you can follow (or I can implement) to convert the existing particle-system skeleton into a renderer-backed particle explosion effect with instancing, shader, asset-pool usage, and a smoke visual test.

High-level contract
Input: GameState and ParticleExplosionOptions (pos, radius, optional seed, colorOverride, count, lifetime, entityId)
Output: Visual explosion effect rendered via Three.js (instanced mesh) that fades and moves over lifetime; no return value required.
Error modes: If renderer is unavailable or resources missing, fail gracefully (no crash) and optionally fall back to post-processing bloom flash.
Success criteria:
Visual matches spec (radial burst, color gradient, fade).
Deterministic particle generation remains unchanged.
Pooling and lifecycle use existing skeleton pool.
Smoke test can trigger 1 small, 1 medium, 1 large explosion visually.
Implementation plan (steps)
Add renderer-side module and exports

Create src/renderer/particleRenderer.ts (or extend particleSystem.ts carefully) to own Three.js resources: instanced mesh, shader material, per-instance buffers, and lifecycle hooks.
Export initParticleRenderer(rendererHandles, assetPool) and disposeParticleRenderer() and a bridge function renderParticleSystem(delta) to be called by renderer tick.
Shader & asset

Add a soft-circle texture in assets/textures/explosion-soft.png (or use an existing texture). If not available, create a data-URL fallback or small placeholder.
Create a minimal vertex+fragment shader (in assets/shaders/particleBillboard.glsl or as inline strings) implementing:
Per-instance attributes: position (vec3), size (float), ageNorm (float), lifetime (float), color (vec3 or vec4).
Billboarding: compute screen-facing quad or use Three.js plane geometry with InstancedBufferAttribute.
Fragment: sample soft-circle texture and multiply by color and alpha; use additive blending.
Instanced mesh & buffer attributes

In particleRenderer.ts, create an InstancedMesh (e.g., plane geometry) sized for max pool size.
Create per-instance InstancedBufferAttributes for position, size, color (vec3), age (float), lifetime (float) — update attributes each frame or on spawn.
Set material to additive blending, depthWrite=false, transparent=true.
Hook up the existing data-only ParticleSystem

Keep the deterministic data generation in particleSystem.ts.
Expose a way for renderer to fetch active instances via ParticleSystem.getActiveInstances() (already present).
In renderer tick: call ensureParticleSystem(state) to get the system, call sys.update(dt), then pull sys.getActiveInstances() and copy values into instanced attributes (or maintain a mapping from instance.id -> instanceIndex to reuse slots).
Implement slot mapping & reuse:
On spawn: allocate rendering slot index (reuse freed indices).
On despawn: mark slot free, optionally hide instance (set scale 0).
Option: keep rendering slots identical to pool order to simplify copying (but mapping is better for stable instance indices).
Asset Pool & Material reuse

Load/obtain explosion texture from GameState.assetPool (via state.assetPool.getTexture('explosion-soft') or similar).
Create a shared ShaderMaterial once and reuse across explosions (store on particleRenderer).
Dispose and return assets only on renderer shutdown if necessary.
LOD and performance

Respect RendererConfig.particles.explosion.lod settings — downscale count or size with distance threshold.
Use pooling.initial and pooling.growTo as InstancedMesh capacity; if renderer cannot grow instanced mesh, allocate a new one when needed (or cap spawn).
Wiring & lifecycle

Init: when renderer starts, call initParticleRenderer(rendererHandles, state.assetPool).
Tick: particleRenderer.renderParticleSystem(dt) called by renderer's per-frame loop.
Dispose: on renderer shutdown, dispose InstancedMesh, material, and attributes.
Tests & smoke visual test

Add a small dev UI page or a debug function window.testExplosionPreset('small'|'medium'|'large') in explosionTester.ts (already exists and calls addParticleExplosion) — wire this to call animation + renderer so explosion shows.
Add tests:
Unit: ensure getActiveInstances() shape and deterministic output (existing tests already cover many items).
Integration (smoke): a visual smoke test that runs in the dev page — spawn three explosions and show a screenshot / manual check.
Files to add / modify
Add: src/renderer/particleRenderer.ts — main renderer integration (instanced mesh + shader + lifecycle)
Add: assets/shaders/particleBillboard.glsl (or inline shader in TS)
Add/ensure texture: assets/textures/explosion-soft.png (or use assets/textures/circle.png if present)
Modify: particleSystem.ts — keep as data-only generator; no heavy changes required. Optionally add small hooks:
optional event/callback on spawn: onSpawn(instance, renderSlot?) (not required; renderer just reads getActiveInstances()).
Modify: renderer main loop (likely threeRenderer.ts or equivalent) to call particle renderer renderParticleSystem(dt) each frame. If a unified effects manager exists, wire into it (e.g., unifiedEffectsManager.handleExplosion already triggers animation).
Add tests: test/vitest/renderer-particle-rendering.spec.ts — small unit tests that validate attribute update logic (mock renderer context).
Minimal MVP implementation details (low-risk)
First pass: simple CPU->GPU copy each frame:
For every frame, read sys.getActiveInstances() and loop over them to set InstancedBufferAttribute arrays (position, size, color, age/lifetime).
Mark attributes needsUpdate = true.
This is simple, easy to verify; if perf issues arise, optimize by writing into typed arrays directly and using partial updates.
Use small initial pool (e.g., 256) and growable instancing as needed.
Provide fallback: if Three.js renderer unavailable, just rely on data-only particleSystem (so tests still pass).
Edge cases & robustness
If state.renderer or state.assetPool missing: skip rendering but keep data generator running.
If InstancedMesh capacity exhausted and cannot grow: stop spawning extra particles gracefully.
If texture missing: use solid white circle shader fallback.
Development & verification commands
Typecheck and tests:
npm run typecheck (or npx tsc --noEmit)
npm test (runs Vitest)
Manual smoke run (dev server / build):
npm run build
npm run serve (or serve:dist) and open dev page with explosionTester UI; call presets.
Example commands (PowerShell):

Next steps I can take for you
Implement the MVP renderer in src/renderer/particleRenderer.ts, wire it into the render loop, and add a minimal shader + texture fallback.
Run the tests and a local smoke test to confirm visuals and no regressions.
Or produce the actual shader code and InstancedMesh wiring as a patch for review.
Which next step would you like me to do: implement the MVP and run tests, or produce just the PR-ready patch files (shader + TS)?
