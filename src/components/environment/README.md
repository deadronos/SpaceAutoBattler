# components/environment/ - Celestial Environment Rendering

Components for rendering the space environment: planets, moons, the central star, and atmospheric elements.

## Star Components

| File               | Purpose                                                                             |
| ------------------ | ----------------------------------------------------------------------------------- |
| **StarSphere.tsx** | Central star billboard (replaces the old star disk); depth + additive shader passes |
| **StarLight.tsx**  | Provides dynamic lighting from star source                                          |

`StarSphere.tsx` renders the central star using `starSphere.vertex.glsl`,
`mainsequencestar.glsl`, `starDiskDepthMaterial`, and `starDiskOrientation`. The
distant background star field is a separate layer (`src/components/layers/StarsField.tsx`).

## Celestial Body Components

| File                         | Purpose                                                             |
| ---------------------------- | ------------------------------------------------------------------- |
| **CelestialEnvironment.tsx** | Main environment orchestrator; sets up all celestial bodies and sky |
| **PlanetBody.tsx**           | Renders a single planet with procedural texture and rotation        |
| **PlanetRings.tsx**          | Renders planetary ring systems around gas giants                    |
| **PlanetRimShell.tsx**       | Creates atmospheric rim/glow effect around planets                  |
| **PlanetAtmosphere.tsx**     | Light-dependent additive atmosphere shell around a planet           |
| **Skysphere.tsx**            | Renders the background skysphere (nebula texture)                   |
| **ParallaxBillboard.tsx**    | Utility component for parallax scrolling billboard effects          |

## Environment Features

- **Procedural Textures**: Planets use procedurally generated textures
- **Star Rendering**: Custom shader-based central star with Gooch-style non-photorealistic rendering
- **Atmospheric Effects**: Planet rim shells and atmosphere shells create depth and atmosphere
- **Parallax Layers**: Billboard-based parallax effects for depth perception
- **Performance**: Uses LOD and billboard techniques to maintain performance

## Integration Notes

- CelestialEnvironment is orchestrated by Battlefield component
- The central star uses custom GLSL shaders (see `src/renderer/shaders/`)
- Materials are managed via material registry
- Textures are cached using Drei's `useTexture` hook
