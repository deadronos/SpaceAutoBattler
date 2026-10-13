# renderer/starDisk/ - Star Disk Effects

Star disk-specific materials, textures, and effect setup for the central star rendering.

## Star Disk Files

| File                   | Purpose                                                     |
| ---------------------- | ----------------------------------------------------------- |
| **textures.ts**        | Star disk texture generation and loading                    |
| **materialFactory.ts** | Creates star disk-specific materials with custom properties |
| **uniforms.ts**        | Uniform variable definitions for star disk shaders          |
| **devHelpers.ts**      | Development utilities for debugging star disk effects       |

### [devtools/](./devtools/) - Star Debug Tooling

Browser/devtools helpers that expose star material snapshots, program polling,
and debug-window installation (`debugWindow.ts`, `materialSnapshot.ts`,
`programPoller.ts`, `installDevHelpers.ts`, `shouldEnable.ts`, `domIndicators.ts`).

## Star Disk Rendering

Provides:

- Procedurally generated or loaded star textures
- Custom shader-based rendering with Gooch style
- Dynamic uniform updates for animation effects
- Debug visualization tools

## Integration

- The central star is rendered by `src/components/environment/StarSphere.tsx`, which consumes these materials/textures
- Materials created via this system's factory
- Textures cached and managed here
- Effects tuned through dev helper utilities

## Performance

- Pre-computed textures for better performance
- Minimal shader overhead
- Cached materials reused
- Debug mode can be disabled for production
