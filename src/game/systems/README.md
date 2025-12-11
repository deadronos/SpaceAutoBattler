# game/systems/ - Game Systems

Core gameplay systems that execute each frame to update game state. Each system handles a specific aspect of gameplay.

## Core Systems

| File               | Purpose                                                     |
| ------------------ | ----------------------------------------------------------- |
| **combat.ts**      | Resolves weapon hits, damage application, and combat events |
| **turrets.ts**     | Manages turret targeting, weapon firing, and cooldown       |
| **projectiles.ts** | Updates projectile positions, trajectories, and lifespans   |
| **motion.ts**      | Applies movement, velocity, and acceleration to ships       |
| **shipControl.ts** | Manages ship control input and AI command execution         |
| **carriers.ts**    | Manages carrier ship behavior and spawning                  |
| **damage.ts**      | Core damage calculation and application logic               |
| **sensors.ts**     | Ship sensor and targeting system                            |
| **sync.ts**        | Synchronizes game state with physics engine                 |

## Decision & AI Systems

### [decision/](./decision/)

AI decision-making system including:

- **manager.ts** - Coordinates AI decision-making
- **blackboard.ts** - Shared decision data
- **evaluator.ts** - Evaluates tactical situations
- **intents.ts** - High-level AI intentions
- **command-generators.ts** - Generates movement/attack commands

### [motion/](./motion/)

Movement and steering system:

- **linear.ts** - Linear motion calculations
- **angular.ts** - Rotational motion calculations
- **math.ts** - Movement-related math utilities

### [projectiles/](./projectiles/)

Projectile behavior system:

- **spawn.ts** - Creates new projectiles
- **advance.ts** - Updates projectile positions
- **beam.ts** - Beam weapon projectiles
- **homing.ts** - Homing projectile behavior

### [shipControl/](./shipControl/)

Ship command execution:

- **aiExecutor.ts** - Executes AI commands
- **movementApply.ts** - Applies movement commands
- **weapons.ts** - Weapon firing execution

## System Execution Order

Systems typically run in this order each frame:

1. **decision** - AI makes decisions
2. **shipControl** - Commands executed
3. **turrets** - Weapons fire
4. **projectiles** - Projectiles advance
5. **motion** - Motion applied
6. **combat** - Damage resolved
7. **sync** - State synced to physics

## Architecture Notes

- All systems are pure functions that take and return GameState
- Systems use seeded RNG for deterministic behavior
- Each system focuses on a single responsibility
- Subsystems module orchestrates which systems run each frame
