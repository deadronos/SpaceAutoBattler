# Design — Planet Shadowing Enhancement

**Status:** Final 2025-09-26  
**Related Requirements:** 2025-09-26 — Planet Shadowing (memory/requirements.md)

## Problem Statement

Planets currently appear uniformly lit because the custom rim material bypasses Three.js lighting and shadows. We need the daylight hemisphere to respond to the directional star light while keeping rim accents and enabling cast/receive shadows for celestial bodies.

## Goals

- Maintain physically based shading for every planet, including those with rim glow enabled.
- Apply rim lighting as an additive accent rather than a full replacement for lighting.
- Allow planets to cast and receive shadows from the existing star light.
- Keep the solution deterministic and compatible with current configuration/state patterns.

## Non-Goals

- Introducing fully dynamic soft-body occlusion or volumetric shadows beyond standard shadow maps.
- Replacing the existing planet texture or rim shader art direction.
- Altering camera defaults or bloom configuration.

## Architecture Overview

```text
CelestialEnvironment
  ├─ StarLight (DirectionalLight + ambient)
  └─ PlanetBody (mesh + material selection)
        ├─ MeshStandardMaterial (base shading + shadows)
        └─ PlanetRimShell (additive fresnel overlay)
```

- `StarLight` already positions a directional light; we will refine its shadow camera and bias for clearer planet shadows.
- `PlanetBody` will mark meshes with `castShadow` / `receiveShadow` to participate in shadow mapping.
- Rim glow moves to a thin additive shell (`PlanetRimShell`) rendered slightly above the surface so the base material can remain a stock `MeshStandardMaterial` that benefits from built-in lighting and shadows.

## Data Flow

1. `CELESTIAL_ENVIRONMENT` config feeds `CelestialEnvironment` -> `PlanetBody` components.
2. Each `PlanetBody` fetches textures and instantiates a stock `MeshStandardMaterial` for the primary surface, ensuring compatibility with Three.js lighting and shadows.
3. When rim glow is requested, `PlanetBody` spawns a secondary shell mesh using `PlanetRimShell` to add fresnel glow without affecting the base shading.
4. The renderer (Drei Canvas) already has `shadows` enabled; directional light shadow settings determine the darkness on the night side and occlusion on neighbouring bodies.

## Interfaces

### Planet Rim Shell Material

`PlanetRimShell` continues to use a lightweight `ShaderMaterial` with fresnel-based intensity. Key props:

```ts
interface PlanetRimShellProps {
  radius: number;
  rimStrength?: number;
  rimColor?: string;
}
```

### StarLight Shadow Tweaks

- Map size: `2048x2048` for sharper penumbra.
- Camera bounds derived from `config.distance` (e.g., `shadow.camera.near = 1`, `far = distance * 2`, `left/right/top/bottom = WORLD_SIZE`).
- Bias: `-0.0002` to minimise shadow acne.

## Error Handling

- Fallback to base `MeshStandardMaterial` if shader injection fails (log warning once).
- Ensure rim parameters clamp to non-negative values to avoid NaN propagation.

## Testing Strategy

- Extend `planet-material` Vitest suite to assert that rim material Shader chunks include `#include <lights_fragment_begin>` indicator and custom rim snippet.
- Snapshot compiled shader string or uniform presence to ensure rim uniforms exist.
- Add regression test verifying `PlanetBody` sets `castShadow` / `receiveShadow` flags.

## Implementation Steps

1. Apply stock `MeshStandardMaterial` (with texture + emissive support) to all planets and enable shadow casting/receiving.
2. Render an additive `PlanetRimShell` slightly above the surface when rim glow is configured.
3. Tune `StarLight` directional light shadow map (size, camera bounds, bias).
4. Extend Vitest coverage for rim shell parameters or component shadow props as feasible.
5. Validate via `npm run typecheck`, `npm test`, and Playwright capture (optional spot check).
6. Document changes within memory and design artefacts.
