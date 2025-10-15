# Plan: Extend weapon types implementation

## Scope

Implement foundational support for missile, torpedo, and beam projectile categories described in `spec/extend-weapon-types.md`. This iteration focuses on schema updates, projectile configuration, and core simulation mechanics (arming timers, AoE detonations, homing steering, and beam raycasts) required for gameplay correctness. Point-defense AI and bespoke rendering layers remain out of scope for now.

## Goals

1. Extend projectile/turret typing and configuration surfaces to express weapon categories and behaviours (homing, arming, AoE, beam TTL).
2. Update projectile spawning/advancement/resolution systems to honour the new behaviours, including homing steering, arming gates, AoE detonation, and beam raycasts with instant damage.
3. Provide baseline projectile configs for missiles, torpedoes, and beams plus simple material/geometry hooks so they render in the existing instanced layer.
4. Cover new behaviours with targeted unit tests (arming, AoE, homing steering, beam hits).

## Non-goals / Follow-ups

- Dedicated point-defense AI logic and PD stat tuning.
- Custom missile trail or beam mesh layers beyond current instanced projectile rendering.
- Advanced damage falloff or ricochet behaviours.
- Balance tuning of ship loadouts beyond basic config wiring.

## Implementation Steps

1. **Types & Configs**
   - Update `ProjectileComponent` and `TurretSpec` with category and behaviour fields.
   - Expand `ProjectileConfigItem` to include category/homing/arming/AoE/beam TTL definitions and add configs for missile, torpedo, and beam variants.
   - Provide helper utilities for resolving projectile categories and defaults.

2. **Simulation Systems**
   - Enhance `fireProjectile` to read config fields, populate runtime projectile state, and branch on category (including new `fireBeam` helper for instant hits and visual spawn data).
   - Extend `advanceProjectiles` to steer homing projectiles and flag arming progress.
   - Update `resolveProjectiles` to enforce arming, handle AoE detonation, and support beam visuals TTL while avoiding duplicate damage.

3. **Rendering Hooks**
   - Provide simple missile/torpedo geometries (elongated capsules) and register new materials in `materialRegistry` with matching creators.
   - Ensure instanced layer selects correct geometry/material via bulletType keys; include a beam material placeholder rendered via existing instanced path.

4. **Testing**
   - Add Vitest suites covering: arming gate prevents early detonation, AoE damage distribution, homing turn rate steering, and beam raycast applying immediate damage & TTL.
   - Update existing fixtures/mocks for new type requirements.

5. **Validation**
   - Run Prettier formatting, ESLint, TypeScript typecheck, and Vitest unit tests.
