# components/environment/ - Celestial Environment Rendering

Components for rendering the space environment: planets, moons, stars, star disks, and atmospheric elements.

## Star Components

| File                 | Purpose                                                                  |
| -------------------- | ------------------------------------------------------------------------ |
| **StarDisk.tsx**     | Main star disk component; manages star disk rendering and material setup |
| **StarDiskMesh.tsx** | Low-level star disk mesh rendering with custom shader material           |
| **StarSphere.tsx**   | Renders background star sphere (distant stars)                           |
| **StarLight.tsx**    | Provides dynamic lighting from star source                               |

## Celestial Body Components

| File                         | Purpose                                                             |
| ---------------------------- | ------------------------------------------------------------------- |
| **CelestialEnvironment.tsx** | Main environment orchestrator; sets up all celestial bodies and sky |
| **PlanetBody.tsx**           | Renders a single planet with procedural texture and rotation        |
| **PlanetRings.tsx**          | Renders planetary ring systems around gas giants                    |
| **PlanetRimShell.tsx**       | Creates atmospheric rim/glow effect around planets                  |
| **Skysphere.tsx**            | Renders the background skysphere (nebula texture)                   |
| **ParallaxBillboard.tsx**    | Utility component for parallax scrolling billboard effects          |

## Environment Features

- **Procedural Textures**: Planets use procedurally generated textures
- **Star Disk Rendering**: Custom shader-based star disk with Gooch-style non-photorealistic rendering
- **Atmospheric Effects**: Planet rim shells create depth and atmosphere
- **Parallax Layers**: Billboard-based parallax effects for depth perception
- **Performance**: Uses LOD and billboard techniques to maintain performance

## Integration Notes

- CelestialEnvironment is orchestrated by Battlefield component
- Star disk uses custom GLSL shaders (see `src/renderer/shaders/`)
- Materials are managed via material registry
- Textures are cached using Drei's `useTexture` hook
