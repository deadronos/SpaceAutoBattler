# components/layers/ - Rendering Layers

Specialized instanced rendering layers for efficient batch rendering of game objects and effects.

## Core Layer Components

| File | Purpose |
|------|---------|
| **ShipsLayer.tsx** | Renders all ships in scene using instanced geometry; optimized for multiple ship rendering |
| **ProjectilesLayer.tsx** | Legacy projectile rendering layer (non-instanced) |
| **ProjectilesInstancedLayer.tsx** | Instanced projectile rendering layer; efficient for thousands of projectiles |
| **TurretsLayer.tsx** | Renders turret objects across all ships |
| **MuzzleFlashInstancedLayer.tsx** | Instanced rendering of muzzle flash effects when weapons fire |
| **StarsField.tsx** | Renders background star field |

## Supporting Files

| File | Purpose |
|------|---------|
| **instancedLayer.ts** | Base utilities and helpers for instanced layer implementations |
| **instanceAllocator.ts** | Manages instance allocation and pooling for instanced layers |
| **muzzleFlashMath.ts** | Math utilities for calculating muzzle flash positions and effects |
| **types.ts** | TypeScript types and interfaces for layer components |
| **saturationWarning.ts** | Warnings and diagnostics for instance capacity saturation |

## Layer Architecture

Each layer follows the pattern:
1. **Setup** - Create geometry, materials, and instanced mesh
2. **Update** - Each frame, update instance matrices and colors
3. **Cleanup** - Dispose resources when unmounted

## Performance Considerations

- **Instancing**: Uses Three.js InstancedMesh for efficient rendering
- **Capacity Limits**: Pre-allocated fixed capacity per layer type
- **Dirty Marking**: Only updates GPU when data changes
- **Saturation Warnings**: Alerts when approaching instance limits
- **Culling**: Frustum and distance-based culling where appropriate

## Integration

- Layers are children of Battlefield scene component
- Updated each frame via React Three Fiber's `useFrame`
- Share materials from material registry
- Coordinated by layer ordering system (see `src/renderer/sceneLayerOrder.ts`)
