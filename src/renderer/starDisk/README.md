# renderer/starDisk/ - Star Disk Effects

Star disk-specific materials, textures, and effect setup for the central star rendering.

## Star Disk Files

| File                   | Purpose                                                     |
| ---------------------- | ----------------------------------------------------------- |
| **textures.ts**        | Star disk texture generation and loading                    |
| **materialFactory.ts** | Creates star disk-specific materials with custom properties |
| **uniforms.ts**        | Uniform variable definitions for star disk shaders          |
| **devHelpers.ts**      | Development utilities for debugging star disk effects       |

## Star Disk Rendering

Provides:

- Procedurally generated or loaded star textures
- Custom shader-based rendering with Gooch style
- Dynamic uniform updates for animation effects
- Debug visualization tools

## Integration

- Star disk rendered by StarDisk component
- Materials created via this system's factory
- Textures cached and managed here
- Effects tuned through dev helper utilities

## Performance

- Pre-computed textures for better performance
- Minimal shader overhead
- Cached materials reused
- Debug mode can be disabled for production
