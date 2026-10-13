# hooks/ - Custom React Hooks

Custom React hooks for game logic integration with React Three Fiber components.

## Hook Files

| File                                | Purpose                                                           |
| ----------------------------------- | ----------------------------------------------------------------- |
| **useArchetypeEntities.ts**         | Hook for querying ECS entities by archetype pattern               |
| **useDevShaderCompile.ts**          | Hook for development shader compilation with debug output         |
| **useGameStateMirrors.ts**          | Mirrors UI store state (pause/time-scale, flags) onto `GameState` |
| **useInterval.ts**                  | Runs a callback every `delayMs` (pause with `null`)               |
| **useParticleTrailSimulation.ts**   | Per-frame thruster trail particle simulation and buffers          |
| **usePlanetRingUniforms.ts**        | Keeps `PlanetRings` shader uniforms in sync                       |
| **usePlanetTexture.ts**             | Hook for loading and caching planet textures                      |
| **usePrefersReducedMotion.ts**      | Hook for respecting reduced motion user preferences               |
| **useProgressiveTexture.ts**        | Loads a low-res texture, then upgrades to high-res in background  |
| **useProjectileInstancedGroups.ts** | Per-frame instanced projectile grouping and matrix updates        |
| **useShipInterpolation.ts**         | Hook for smooth interpolation between physics frames              |
| **useShipThrusters.ts**             | Hook for managing thruster attachment points and animations       |
| **useSimulationBridge.ts**          | Owns the worker `SimulationBridge` lifecycle                      |
| **useStarBloom.ts**                 | Hook for managing bloom effects on stars                          |
| **useStarDebug.ts**                 | Hook for star debug visualization                                 |
| **useStarMaterial.ts**              | Hook for creating and managing star material instances            |
| **useStarSphereUniforms.ts**        | `StarSphere` per-frame uniform updates (time, camera, textures)   |
| **useStarTextures.ts**              | Hook for loading and caching star textures                        |
| **useTimeout.ts**                   | Runs a callback once after `delayMs` (disable with `null`)        |

### [interpolation/](./interpolation/) - Ship Interpolation Helpers

Owns the math/state for render-time interpolation between physics ticks:
`banking.ts`, `bob.ts`, `config.ts`, `detailPolicy.ts`, `math.ts`,
`smoothing.ts`, `state.ts`, `updateInterpolation.ts`.

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
