
# Background / Starfield tuning notes

This document summarizes an evaluation of the "Star Nest" Shadertoy shader (Pablo Roman Andrioli, MIT) and concrete integration options for SpaceAutoBattler. It maps required uniforms and defines, performance tradeoffs, determinism constraints imposed by the repo, recommended file locations, fallback strategies, and a small implementation plan.

## Contract (inputs / outputs / success)

- Inputs: canvas resolution, deterministic time/seed from the canonical `GameState`, optional camera rotation or user input, and a quality preset (high/medium/low).

- Output: fullscreen starfield background that is visually similar to Shadertoy "Star Nest" on high settings and gracefully degrades on low-end GPUs.

- Error / fallback: when the shader is unsupported or disabled, fall back to an instanced point-sprite star layer or a pre-baked texture.

- Success criteria: visual fidelity on high, solid 60FPS on common desktop hardware at medium settings (or acceptable target), deterministic output given same `GameState` inputs.

## Summary of the Star Nest shader

- The original is a volumetric raymarching shader (iterative formula + tiling fold) that is visually rich but GPU-intensive. Typical Shadertoy parameters use `iterations=17` and `volsteps=20` making it expensive for low-end devices.

- The shader's look depends heavily on loop counts and volumetric steps; reducing these values yields large performance wins with visible quality tradeoffs.

## Integration options (concrete)

1. Three.js ShaderMaterial + fullscreen plane

   - Directly port the GLSL into a `ShaderMaterial` and draw a fullscreen orthographic quad behind the scene. Simple to implement and debug.

2. Post-processing pass (EffectComposer ShaderPass)

   - Add it as a shader pass so it composes with existing post effects and can be toggled or re-ordered easily.

3. Render-to-texture (RT) at reduced resolution

   - Render the shader to a low-resolution `WebGLRenderTarget` (0.5x or 0.33x) and upscale. Big performance win with minor blur.

4. Hybrid presets + fallback

   - High: full parameters (iterations/volsteps as in original).

   - Medium: reduced iterations/volsteps and half-resolution RT.

   - Low: disable raymarch, use GPU-instanced points or a baked texture.

5. Pre-baked/static texture

   - For lowest cost, supply a built asset (looping texture or cube map) used on very constrained devices.

## Performance mitigations

- Use `defines` on the `ShaderMaterial` for `iterations` and `volsteps` so variants can be compiled for presets. Note: changing defines recompiles material.

- Render at lower resolution via an RT and upscale.

- Update shader less frequently (every N frames) when static background is acceptable.

- Provide quality presets and auto-detect low-end GPUs to switch to fallback.

- Dispose of materials and render targets on unmount to avoid leaks.

## Determinism & repo constraints

- The repository mandates that runtime state (simulation & renderer) lives on the canonical `GameState`. To preserve determinism:

  - Feed shader time from `GameState` (e.g., `GameState.simTime` or `GameState.tick`) rather than Date.now or real wall clock.

  - Any randomness the shader relies on should be seeded from `GameState`'s deterministic RNG (`src/utils/rng.ts`) and passed as a uniform.

  - Avoid reading direct mouse/time device inputs for simulation-critical rendering. If mouse-driven rotation is a purely visual feature, make it optional and non-deterministic only when enabled by the user.

## Minimum uniforms / defines to expose

- Uniforms (recommended):

  - `uResolution` (vec2): canvas width/height

  - `uTime` (float): deterministic time (from `GameState`)

  - `uSeed` (float): seeded value from `GameState` RNG (optional)

  - `uCameraRot` or `uCameraMatrix` (mat3/vec3): optional camera rotation

  - tuning floats: `uSpeed`, `uZoom`, `uTile`, `uBrightness`, `uDarkMatter`, `uDistFading`, `uSaturation`

  - `uQuality` (int) or use compile-time `defines` for loops

- Defines (compile-time):

  - `iterations`, `formuparam`, `volsteps`, `stepsize` — these enable efficient static loops in GLSL

## Files to add / edit (where changes should live)

- `src/renderer/shaders/starNest.glsl` (or `src/renderer/shaders/starNest.ts`) — shader source with author header and MIT attribution.

- `src/components/Starfield.tsx` — React component that wraps the ShaderMaterial, manages uniforms, RTs and presets, and disposes resources.

- `src/components/Battlefield.tsx` — mount `<Starfield />` behind the 3D scene or register as a postprocessing pass.

- `src/config/renderer.ts` — add configuration keys for `starfield.enabled`, `starfield.quality`, `starfield.lowResScale`.

- `src/renderer/materialRegistry.tsx` (optional) — register and manage shader materials, ensure disposal patterns.

## Fallback strategies

- Instanced point sprites: inexpensive, uses GPU instancing, deterministic positions from `GameState` RNG.

- Baked texture or static cube map: simplest and lowest cost.

- Toggle in HUD/Controls to disable shader for users on battery or poor performance.

## Edge cases and gotchas

- WebGL1 / low-precision float artifacts — set `precision: 'highp'` and test on target hardware.

- Shader compile fail when defines are dynamically inconsistent — use a small set of stable presets.

- DPR and resizing: when rendering to RT, consider devicePixelRatio and apply RT scaling consistently.

- Resource leaks: ensure `.dispose()` is called for `ShaderMaterial`, `RenderTarget`, and geometries on unmount.

## Licensing / attribution

- Keep the original Shadertoy header inside the shader file with the author's name and the `MIT` note.

- Add a line in repository docs or `README.md` attributing: "Star Nest by Pablo Roman Andrioli — MIT License" and include short license text or a link if desired.

## Recommended next steps (practical)

1. Implement `src/components/Starfield.tsx` that:

   - Creates a Three.js `ShaderMaterial` using the Star Nest GLSL.

   - Exposes three presets via `material.defines` (high/medium/low) and a `uTime` uniform sourced from `GameState`.

   - Renders either as a fullscreen plane or to a reduced-resolution `WebGLRenderTarget` and draws that as a textured quad.

   - Provides a fallback mode (instanced points or a baked texture).

2. Add `starfield` config to `src/config/renderer.ts` and wire a toggle into the HUD or `Controls.tsx`.

3. Add the MIT attribution comment and a short note in the docs (this file) pointing to the original author.

4. Run smoke tests / typecheck and perform simple profiling on medium preset to verify frame time impact.

If you'd like, I can implement the minimal `Starfield` component and integrate it into `Battlefield.tsx` next. I will follow the repository rules for determinism (use `GameState` for time and RNG) and implement three quality presets plus a low-cost fallback.


