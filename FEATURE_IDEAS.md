# Feature Ideas for SpaceAutoBattler

Based on an analysis of the codebase, here are three feature ideas to enhance the gameplay and depth of the simulation.

## 1. Weapon Variety Pack

Currently, the game supports standard projectiles (bullets, missiles, torpedos, beams). Adding more specialized weapon types would increase tactical depth.

**Idea:** Implement new weapon behaviors such as:
- **Flak Cannon:** Area-of-effect anti-fighter weapon with proximity fuse.
- **Railgun:** High-velocity, shield-piercing kinetic weapon with long reload.
- **EMP Missile:** Low hull damage but high shield damage and potential subsystem stun duration.

**Implementation Status:** A "Flak Cannon" with proximity fuse logic has been implemented as a proof-of-concept in this PR. It introduces `proximityFuse` configuration to projectiles and handles proximity detonation in the damage system.

## 2. Ship Modules & Subsystems Expansion

The current subsystem implementation (`src/game/subsystems.ts`) tracks HP and status for engines, weapons, and shields, applying simple multipliers when damaged.

**Idea:** Deepen this system by adding:
- **Targetable Modules:** Allow high-precision weapons to target specific subsystems.
- **Module Variants:** Ships could have different "loadouts" (e.g., "Reinforced Shields" vs "Overclocked Engines").
- **Critical Failure Effects:** Engine destruction could cause drift; Reactor destruction could deal AOE damage to the ship itself.

## 3. Advanced Squadron Behaviors (AI)

The AI uses an intent-based system (`src/game/systems/decision/`). Ships currently act largely independently or with basic escort assignments.

**Idea:** Implement coordinated group tactics:
- **Formations:** Fighters flying in V-formation or protective spheres around carriers.
- **Coordinated Strikes:** Bombers waiting for fighters to strip shields before engaging.
- **Retreat & Regroup:** Damaged squads pulling back to a healer or carrier to repair.
