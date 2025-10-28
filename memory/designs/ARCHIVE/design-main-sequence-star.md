# Design — Main Sequence Star Shader

**Summary:** Replace the configurable star disk material pipeline with a direct port of the Shadertoy `mainsequencestar` fragment, binding the organic and noise textures to the shader inputs while keeping billboard and bloom integration intact.

## Architecture Overview

- Retire `StarDiskShaderConfig`, `buildStarDiskMaterialConfig`, and related debug override plumbing in favour of a single-purpose material factory.
- Introduce `createMainSequenceStarMaterial` that wraps the imported GLSL, exposes deterministic uniforms (`iTime`, `iResolution`, `iChannel0`, `iChannel1`), and handles texture fallbacks.
- Keep `StarDisk` as the integration point: it loads textures via `useTexture`, instantiates the material once, and updates uniforms every frame.
- Preserve bloom routing by registering the mesh under the fixed `"star"` group via `useBloomRegistration`.

## Data Flow

1. `StarDisk` resolves organic/noise textures from `STAR_DISK_TEXTURE_PATHS` (SRGB + anisotropy setup preserved).
2. `StarDisk` calls `createMainSequenceStarMaterial({ organicTexture, noiseTexture })` to obtain a `ShaderMaterial` with uniforms seeded from renderer size and simulation time.
3. `useFrame` updates `iTime` deterministically (simulation clock → uniform) and refreshes `iResolution` when viewport size changes.
4. The fragment shader uses `gl_FragCoord.xy` alongside `iResolution` to reproduce the original Shadertoy coordinate system, sampling `iChannel0/1` exactly as in the reference shader.
5. If the factory throws (e.g., GLSL compile failure), `StarDisk` swaps to a `MeshBasicMaterial` fallback so the scene keeps rendering.

### Viewport & Uniform Mapping

- `iResolution` := `(renderer.domElement.width, renderer.domElement.height, 1.0)`
- `iTime` := simulation time (`sim.lastTickStart + sim.alpha * sim.step`) or accumulated real time when simulation unavailable.
- `iChannel0` := organic texture; `iChannel1` := noise texture; both default to deterministic generated textures when null.

## Interfaces

```ts
export interface MainSequenceStarMaterialOptions {
  organic: Texture | null;
  noise: Texture | null;
}

export interface MainSequenceStarMaterialUniforms {
  iTime: number;
  iResolution: THREE.Vector3;
  iChannel0: Texture;
  iChannel1: Texture;
}

export function createMainSequenceStarMaterial(
  options: MainSequenceStarMaterialOptions,
): ShaderMaterial;
export function updateMainSequenceStarUniforms(
  material: ShaderMaterial,
  uniforms: MainSequenceStarMaterialUniforms,
): void;
```

## Error Handling Matrix

| Scenario                         | Detection                                   | Response                                                                       | Test Coverage                                               |
| -------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| Organic or noise texture missing | `options.organic` / `options.noise` nullish | Substitute generated SRGB/nearest fallback textures                            | Vitest material spec asserts fallbacks are used and named   |
| Shader compilation fails         | `createMainSequenceStarMaterial` throws     | Log warning, return `null`, trigger `MeshBasicMaterial` fallback in `StarDisk` | Vitest spec stubs factory to throw and checks fallback      |
| Renderer size undefined          | `state.size.width` or `height` non-finite   | Default `iResolution` to `(1,1,1)` and warn once                               | Component spec simulates NaN size and asserts safe defaults |
| Simulation context absent        | `useOptionalGameState` returns undefined    | Accumulate delta time on uniform but keep deterministic path when available    | Component spec toggles simulation presence                  |

## Testing Strategy

- Unit spec for `createMainSequenceStarMaterial` verifying uniforms, fallback textures, and fragment shader identity.
- Unit spec for `updateMainSequenceStarUniforms` ensuring `iTime`/`iResolution` refresh without reallocating materials.
- Component-level spec (React Testing Library + Vitest) stubbing `useFrame` to confirm simulation time and viewport updates propagate.
- Snapshot/visual follow-up (manual) after shader swap to validate parity with Shadertoy reference.
