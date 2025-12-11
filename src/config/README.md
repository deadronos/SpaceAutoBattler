# config/ - Game Configuration

Configuration parameters and constants for various game systems and features.

## Configuration Files

| File                  | Purpose                                                              |
| --------------------- | -------------------------------------------------------------------- |
| **carriers.ts**       | Carrier ship configuration (spawn rates, behavior, units)            |
| **effects.ts**        | Visual effects configuration (bloom, particles, thresholds)          |
| **environment.ts**    | Environment configuration (planets, stars, celestial bodies)         |
| **experiments.ts**    | Experimental feature flags and parameters                            |
| **explosions.ts**     | Explosion system configuration (particle counts, durations, colors)  |
| **hudHealth.ts**      | HUD health display configuration and styling                         |
| **motion.ts**         | Ship motion and physics configuration (acceleration, max speed)      |
| **postprocessing.ts** | Post-processing effects configuration (bloom strength, tone mapping) |
| **progression.ts**    | Progression system configuration (XP requirements, leveling)         |
| **projectiles.ts**    | Projectile configuration (bullet types, speeds, damage)              |
| **renderer.ts**       | Renderer configuration (LOD distances, instancing limits)            |
| **shields.ts**        | Shield system configuration (recharge rates, strength, visuals)      |
| **starDiskDebug.ts**  | Star disk debug and tuning configuration                             |

## Configuration Pattern

Each config module exports:

- Constants for system parameters
- Default values for features
- Validation ranges and constraints
- Tuning parameters for balance

## Usage

Configurations are imported by their respective systems:

- Game systems import from `config/` directly
- UI components use config for display formatting
- Asset loaders use config for quality settings
- Physics system references motion config

## Tuning & Balance

These files are primary locations for game balance:

- Weapon damage values
- Ship speeds and acceleration
- Progression thresholds
- Visual effect intensities
- Physics constraints

## Development

Edit these files to tune game parameters without modifying core logic.
