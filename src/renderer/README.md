# renderer/ - Three.js Rendering Infrastructure

Low-level Three.js rendering setup including materials, shaders, texture atlases, and post-processing configuration.

## Core Files

| File | Purpose |
|------|---------|
| **materialRegistry.tsx** | Central material registry for caching and managing Three.js materials |
| **textureAtlas.ts** | Texture atlas management for efficient texture usage |
| **sceneLayerOrder.ts** | Defines rendering order and layer organization for scene objects |
| **hudOverlayStore.ts** | HUD overlay state management |
| **starDiskMaterial.ts** | Star disk material setup and uniforms |
| **starDiskOrientation.ts** | Star disk orientation and rotation calculations |
| **BloomProvider.tsx** | React context provider for bloom effect configuration |
| **webglDebugPrototypePatch.ts** | Early initialization patch for WebGL debug output |
| **webglDebugWrapper.ts** | WebGL debug utility wrapper for shader compilation logging |
| **rippleDebug.ts** | Debug utilities for ripple effects |

## Subdirectories

### [materials/](./materials/) - Material Definitions
Factories and builders for different material types used in rendering.

### [shaders/](./shaders/) - GLSL Shaders
Custom GLSL fragment and vertex shaders for visual effects.

### [shields/](./shields/) - Shield Materials
Specialized materials and shaders for shield visualization.

### [starDisk/](./starDisk/) - Star Disk Effects
Star disk-specific material and effect setup.

### [particles/](./particles/) - Particle System Resources
Resources and utilities for particle effects.

## Architecture

The renderer module provides:
- **Material Registry** - Centralized material management and caching
- **Shader System** - GLSL shader loading and compilation
- **Texture Management** - Texture atlas and optimization
- **Debug Support** - WebGL debug logging for shader issues
- **Post-Processing** - Effect pipeline setup

## Integration

- Used by component layer for material consistency
- Material registry accessed via React hooks
- Shaders compiled at material creation time
- Debug patches applied early in initialization

## Performance Optimization

- Materials cached and reused across components
- Texture atlasing reduces draw calls
- Shader compilation errors logged early
- WebGL debug disabled in production
