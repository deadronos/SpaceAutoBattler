# hooks/ - Custom React Hooks

Custom React hooks for game logic integration with React Three Fiber components.

## Hook Files

| File | Purpose |
|------|---------|
| **useArchetypeEntities.ts** | Hook for querying ECS entities by archetype pattern |
| **useShipInterpolation.ts** | Hook for smooth interpolation between physics frames |
| **useShipThrusters.ts** | Hook for managing thruster attachment points and animations |
| **useStarMaterial.ts** | Hook for creating and managing star material instances |
| **useStarTextures.ts** | Hook for loading and caching star textures |
| **usePlanetTexture.ts** | Hook for loading and caching planet textures |
| **useStarDebug.ts** | Hook for star debug visualization |
| **useStarBloom.ts** | Hook for managing bloom effects on stars |
| **usePrefersReducedMotion.ts** | Hook for respecting reduced motion user preferences |
| **useDevShaderCompile.ts** | Hook for development shader compilation with debug output |

## Hook Patterns

Hooks in this directory follow React conventions:
- Setup/cleanup via useEffect
- Memoized values via useMemo
- Refs for Three.js object management
- Context consumption where needed

## Usage

Hooks are consumed by components:
- Components use hooks to integrate with game systems
- Hooks manage Three.js resource lifecycle
- Hooks provide optimized re-render patterns
- Hooks abstract complex logic from components

## Performance Optimization

- Hooks use React.memo and useMemo for optimization
- Three.js resources cached and reused
- Texture loading deferred with Drei's hooks
- Debug hooks disabled in production
