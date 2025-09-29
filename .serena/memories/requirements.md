# Requirements — Star Disk Shader Integration

## 2025-09-29 — Ship Level Bonus Caps (TASK153)

1. **WHEN** a ship crosses any level threshold above 1, **THE SYSTEM SHALL** recompute `maxHp` and `hp` using the base hull value scaled by the capped hull bonus so the resulting multiplier never exceeds +50%. *(Acceptance: `test/vitest/progression-system.spec.ts` levels a ship to level 11 and asserts `maxHp` equals `baseHp × 1.5` while current `hp` increases by the delta.)*
2. **WHEN** the level-up handler applies shield, damage, shield regen, or fire rate bonuses, **THE SYSTEM SHALL** clamp each stat to the configured `LEVEL_BONUSES` cap by recomputing from the base stat rather than compounding off prior increases. *(Acceptance: `test/vitest/progression-system.spec.ts` validates that level 11 stats match the capped multiplier and that a control ship without bonuses remains unchanged.)*
3. **WHEN** subsystem repair rates are recalculated after leveling, **THE SYSTEM SHALL** respect the progression cap so each subsystem’s `repairRate` stays within +50% of its baseline. *(Acceptance: the same Vitest suite inspects subsystem entries post level-up and ensures `repairRate` equals `base × 1.5`.)*
4. **WHEN** a ship gains levels beyond a stat’s `maxLevel`, **THE SYSTEM SHALL** keep the tracked level bonus total constant so repeated leveling produces no further change to the capped stat. *(Acceptance: the Vitest progression spec advances to level 20 and asserts fire rate and shield regen plateau once their caps are reached.)*

## 2025-09-29 — Ship Progression Test Hardening

1. **WHEN** unit tests instantiate ship entities without calling the production ship factory, **THE SYSTEM SHALL** apply a shared helper that hydrates progression defaults (XP, level, xpToNext, damageType, armor, and subsystem status records) so subsystem lookups never throw. *(Acceptance: `test/vitest/motion.system.spec.ts`, `test/vitest/ai-metrics.spec.ts`, and `test/vitest/projectile-resolve.spec.ts` all run without `subsystems.engine` access errors.)*
2. **WHEN** tests need to mutate subsystem health or statuses for specific scenarios, **THE SYSTEM SHALL** start from a fully populated subsystem record returned by the helper and allow per-test overrides without removing required keys. *(Acceptance: `test/vitest/turrets.spec.ts` and `test/vitest/shield-regen.spec.ts` adjust subsystem data while keeping `engine`, `weapons`, and `shields` entries defined.)*
3. **WHEN** future progression fields are introduced on `ShipComponent`, **THE SYSTEM SHALL** centralise test schema updates inside the helper so affected suites only require helper consumption instead of manual property updates. *(Acceptance: helper module exports typed surface reviewed by `test/vitest/projectile-bullettype.spec.ts` and `test/vitest/ai-regression.spec.ts` with no ad-hoc property additions.)*

## 2025-09-28 — AI Determinism & Coordination Overhaul (Task145)

... (file continues)
