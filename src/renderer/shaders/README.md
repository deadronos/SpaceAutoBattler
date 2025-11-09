# renderer/shaders/ - GLSL Shaders

Custom GLSL shaders for specialized visual effects and rendering.

## Shader Files

| File | Purpose |
|------|---------|
| **index.ts** | Main shader export and registry |
| **common.glsl** | Common utility functions shared across shaders (noise, color, etc.) |
| **starDisk.vertex.glsl** | Vertex shader for star disk rendering |
| **starDisk.fragment.glsl** | Fragment shader for star disk with Gooch-style rendering |
| **mainsequencestar.glsl** | Main sequence star appearance and coloring |

## Shader Types

### Star Disk Shaders
- Vertex shader handles star geometry and positioning
- Fragment shader implements non-photorealistic Gooch rendering
- Creates distinctive stylized star appearance

### Common Utilities
- Noise functions for procedural effects
- Color space conversions
- Math utilities (smoothstep, etc.)
- Lighting calculations

## Compilation & Error Handling

- Shaders compiled when materials are created
- Compilation errors logged to WebGL debug wrapper
- Fallback materials used if compilation fails
- All shaders validated at startup

## Integration

- Loaded and compiled by material creation system
- Uniforms managed by material instances
- Registered with shader compiler for hot-reloading in dev
