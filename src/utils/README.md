# utils/ - Utility Functions

Utility functions and helpers used throughout the application.

## Utility Files

| File                        | Purpose                                                     |
| --------------------------- | ----------------------------------------------------------- |
| **rng.ts**                  | Seeded random number generator for deterministic randomness |
| **color.ts**                | Color utilities (conversion, manipulation, interpolation)   |
| **steering.ts**             | AI steering behaviors (pursuit, evade, seek, flocking)      |
| **motionUtils.ts**          | Motion and kinematics utility functions                     |
| **starDisk.ts**             | Star disk-specific calculations and utilities               |
| **projectileInfo.ts**       | Projectile data and configuration lookup                    |
| **projectileGeometries.ts** | Procedural geometry generation for projectiles              |
| **patchGltfLoader.ts**      | GLTF loader runtime patching for custom behavior            |
| **deterministicLerp.ts**    | Deterministic linear interpolation                          |

## Utility Patterns

Utilities in this directory:

- Are pure functions where possible
- Use seeded RNG for reproducibility
- Provide reusable algorithms
- Have no side effects except logging
- Are consumed by game systems and components

## RNG (seeded Random Number Generator)

The `rng.ts` module provides:

- Seeded random number generation
- Deterministic behavior for replays
- Multiple generator instances
- Fixed seed initialization

All random behavior in the game uses this seeded RNG.

## Performance Notes

- Utilities are allocation-free where practical
- Hot-path functions optimized
- Math utilities pre-compute constants
- Color utilities cache computed values
