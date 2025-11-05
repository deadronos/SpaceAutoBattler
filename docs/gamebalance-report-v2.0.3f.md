## Game Balance Report v2.0.3f

Generated: 2025-11-01

This report re-reads the authoritative ship and turret definitions in `src/data/ships/*`, the turret defaults in `src/data/ships/turret-factory.ts`, AI feature flags in `src/game/config.ts`, and the damage routing math in `src/game/combat/damage.ts` + `src/config/progression.ts`. Numbers below are computed directly from those source files in the repository (no manual guesswork).

Executive summary

- Overall: the current codebase contains higher shield pools for larger hulls and the turret defaults + per-hull overrides produce similar theoretical turret DPS ordering as prior reports, but some per-ship turret overrides materially change the per-role DPS (for example, the corvette's point-defense turret has been lowered from 5→4 damage in its local override). Destroyer remains the most dangerous gun platform by raw DPS, while carriers are survivable anchors with moderate gun DPS but valuable fighter support in gameplay.
- Biggest balance observations:
  - Point-defense and antiFighter lasers/beam turrets still supply a large fraction of fighter-targeted DPS; however, some ships override PD/laser damage which reduces raw PD DPS compared to earlier audits.
  - Destroyer retains very high raw turret DPS, and its massive shield pool increases its real-world survivability compared to earlier theoretical TTKs computed against lower shield values.
  - Carrier survivability increased (larger shield pool) while direct gun DPS remains in the moderate band — carrier balance likely depends heavily on launched fighters and support systems not covered by this file.

Methodology and assumptions

- Source files read (authoritative):
  - `src/data/ships/*.ts` (fighter, corvette, frigate, destroyer, carrier)
  - `src/data/ships/turret-factory.ts` (turret defaults)
  - `src/game/config.ts` (AI feature flags)
  - `src/game/combat/damage.ts` (damage routing math)
  - `src/config/progression.ts` (damage-effectiveness and armor defaults)

- DPS computation:
  - Main weapon DPS = `damage / fireRate` using the top-level `damage` and `fireRate` on the hull.
  - Turret DPS = sum over turrets of `turret.damage / turret.fireRate` (uses turret-specific overrides or the defaults in `turret-factory.ts`). If a turret factory default supplies a missing field (e.g., `fireRate`) the default is used.
  - We present two figures: "Theoretical max DPS" (sum of main weapon + all turret DPS) and per-role turret splits where turret `priority` is present (antiFighter / antiCapital / any). This highlights that not all turret DPS is equally applicable to every target class.

- Durability and TTK:
  - Raw durability = `maxHp + maxShield` (coarse proxy). TTK (seconds) = raw durability / DPS.
  - This is an optimistic, upper-bound damage application model (no aim constraints, no turret arc limits, perfect uptime). Use these numbers for directional tuning only.

Key AI settings (from `src/game/config.ts`)

- engagementBoostEnabled: true (opening salvo boost; default openingSalvoAggressionBoost = 1.2, duration 30s)
- tickRateHz: repository defaults set experimental tick rate enabled by default (15Hz experimental path is active unless overridden)
- smoothingEnabled, hysteresisEnabled: true
- threatWeights (hull): carrier=6, destroyer=5, frigate=4, corvette=3, fighter=2
- interruptHpDrop: 0.1

Computed hull metrics (theoretical)

Notes: DPS values rounded to one decimal place. Turret DPS is broken down by priority when available. All numbers come directly from the source files listed above.

1) Fighter

- Source: `src/data/ships/fighter.ts`
- maxHp: 40
- maxShield: 43 (shieldRegen: 7.0) — note shields are larger than in earlier report variants
- main weapon: damage 8, fireRate 0.9 → main DPS = 8 / 0.9 ≈ 8.9
- turrets:
  - Torpedo (antiCapital): 26 / 4.5 ≈ 5.8 DPS
  - Beam (antiFighter): 11 / 1.8 ≈ 6.1 DPS
- turret total ≈ 11.9 (antiFighter ≈ 6.1, antiCapital ≈ 5.8)
- theoretical max DPS ≈ 20.8
- raw durability = 83 → theoretical TTK ≈ 83 / 20.8 ≈ 4.0s
- role: fast skirmisher with mixed short/medium weapons; turret roles allow the fighter to contribute both antiCapital torpedo bursts and antiFighter beam damage.

2) Corvette

- Source: `src/data/ships/corvette.ts`
- maxHp: 75
- maxShield: 104 (shieldRegen: 11.5)
- main weapon: damage 12, fireRate 1.2 → main DPS = 12 / 1.2 = 10.0
- turrets (expanded with turret-factory defaults and local per-turret overrides):
  - Laser ×2 (antiFighter): overridden to 6 damage @ 1.0s → 6.0 each → 12.0
  - PointDefense (antiFighter): local override damage 4 (factory default fireRate 0.35) → 4 / 0.35 ≈ 11.4
  - Missile (any): overridden 18 / 2.6 ≈ 6.9
  - Beam (antiFighter): overridden 14 / 2.0 = 7.0
- turret total ≈ 37.4 (antiFighter ≈ 30.4, any ≈ 6.9) — note PD in this ship is 4 damage (lower than the 5 factory default used elsewhere)
- theoretical max DPS ≈ 47.4
- raw durability = 179 → theoretical TTK ≈ 179 / 47.4 ≈ 3.8s
- role: anti-fighter oriented, but local PD damage override reduces the single-shot PD punch vs earlier factory-default assumptions; still an effective fighter-suppressor platform.

3) Frigate

- Source: `src/data/ships/frigate.ts`
- maxHp: 120
- maxShield: 123 (shieldRegen: 12.0)
- main weapon: damage 16, fireRate 1.5 → main DPS ≈ 10.7
- turrets:
  - Plasma ×2 (any): 8 / 1.2 ≈ 6.7 each → 13.3
  - Laser (antiFighter): 8 / 1.2 ≈ 6.7
  - PointDefense (antiFighter): 5 / 0.35 ≈ 14.3
  - Missile (any): 20 / 2.8 ≈ 7.1
  - Beam (antiFighter): 16 / 2.2 ≈ 7.3
- turret total ≈ 48.7 (antiFighter ≈ 28.3, any/antiCapital ≈ 20.5)
- theoretical max DPS ≈ 59.4
- raw durability = 243 → theoretical TTK ≈ 243 / 59.4 ≈ 4.1s
- role: multirole escort with both sustained turret DPS and PD for fighter suppression; its higher shield pool materially increases survivability vs older estimates.

4) Destroyer

- Source: `src/data/ships/destroyer.ts`
- maxHp: 250
- maxShield: 433 (shieldRegen: 24.0) — very large shield pool relative to earlier audits
- main weapon: damage 30, fireRate 1.8 → main DPS ≈ 16.7
- turrets (summary of the many turrets defined in the file):
  - Heavy turrets ×2 (antiCapital): 10 / 1.4 ≈ 7.1 each → 14.3
  - Laser turrets ×6 (antiFighter by default, with local fireRate overrides on several): combined ≈ 32.5
  - Torpedo ×2 (antiCapital): 42 / 5.0 = 8.4 each → 16.8
  - Missile ×2 (any / long range): 22 / 2.8 ≈ 7.9 each → 15.7
  - Beam (antiFighter): 18 / 2.4 = 7.5
- turret total ≈ 86.8 (antiCapital ≈ 46.8, antiFighter ≈ 40.0)
- theoretical max DPS ≈ 103.5
- raw durability = 683 → theoretical TTK ≈ 683 / 103.5 ≈ 6.6s
- role: capital brawler / area denial. Note the combination of very high turret DPS and large shields make the destroyer both dangerous and durable in sustained fights.

5) Carrier

- Source: `src/data/ships/carrier.ts`
- maxHp: 320
- maxShield: 255 (shieldRegen: 13.0)
- main weapon: damage 28, fireRate 2.2 → main DPS ≈ 12.7
- turrets:
  - Ion ×2 (antiCapital): 9 / 1.3 ≈ 6.9 each → 13.8
  - Laser ×4 (antiFighter): overridden to 9 / 1.5 = 6.0 each → 24.0
  - Missile (any): 22 / 2.6 ≈ 8.5
  - Beam (antiFighter): 18 / 2.5 = 7.2
- turret total ≈ 53.5 (antiFighter ≈ 31.2 / antiCapital ≈ 22.3)
- theoretical max DPS ≈ 66.2
- raw durability = 575 → theoretical TTK ≈ 575 / 66.2 ≈ 8.7s
- role: survivable anchor; carriers rely heavily on launched fighters/support to realize their strategic value — in isolation their gun DPS is moderate.

Interpreting the numbers — turret roles matter

- The "theoretical max DPS" above assumes every weapon can focus a single target continuously, which overstates on-target DPS in practice because many turrets use role priorities (e.g., `antiFighter`, `antiCapital`) and have arc limits. Practical engagement DPS is reduced by target distribution, turret arcs, projectile travel time, and AI target selection.
- Still, the relative ordering and the magnitude of PD/laser contributions matter:
  - Fighter-facing DPS (PD + antiFighter lasers/beams) remains a significant share of fleet DPS across corvette/frigate/destroyer — small, high-rate hits combined with large shield pools favor defensive ships with many small hits.
  - Against capital targets, heavy turrets, torpedoes, and ion/heavy missiles deliver the majority of penetrating hull damage.

Damage routing notes (from `src/game/combat/damage.ts` and `src/config/progression.ts`)

- Shields absorb first and damage effectiveness vs shields/hull/armor is governed by `DAMAGE_EFFECTIVENESS` in `src/config/progression.ts` (for example, `ion` is strong vs shields, `plasma` is relatively strong vs armor).
- When shields break, remaining damage is subject to armor absorption limited by 50% of the remaining hit and scaled by `armorEffectiveness` (see `calculateEffectiveDamage`). Armor decays by 10% of absorbed amount per hit.
- Practical implication: many small hits (high rate, low per-shot damage) are often stalled by large shields + regen, while fewer large hits (torpedoes/heavy guns) cut through armor/hull more effectively. DPS composition (many small vs fewer heavy hits) changes real-world TTK materially.

Balance implications and recommendations

1. Point-defense & PD-like lasers remain influential

- Observation: PD and antiFighter turrets are still a dominant source of fighter-facing DPS. In this codebase the corvette's PD was locally reduced to 4 damage (factory default is 5) which lowers single-shot PD punch on that hull, but other hulls still use default PD values.
- Options:
  - Keep testing with deterministic combat sims (seeded RNG) to measure how many small PD hits are actually required to suppress a fighter under current shield/regen values.
  - If fighters are consistently over-suppressed, consider adding PD tracking lock time, reduce PD fire rate slightly, or lower PD damage on selected hulls.

2. Destroyer is both powerful and survivable

- Observation: the destroyer has very high raw turret DPS and a much larger shield pool than earlier audit assumptions, making it a tougher balancing target.
- Options:
  - Reduce counts or rates on some high-rate lasers (e.g., the six-laser battery) or slightly reduce their damage to reduce antiFighter overlap without changing thematic role.
  - Reduce turret ranges on select mounts so destroyer cannot always leverage long-range poke against opponents that cannot respond.

3. Carrier role remains anchored on fighters/support

- Observation: carrier gun DPS is moderate while survivability is high. Carriers' strategic value will likely hinge on fighter sorties and support abilities not modeled in this gun-only audit.
- Options:
  - Increase sortie cadence or add small passive support bonuses for launched fighters, or tune carrier-specific abilities rather than increasing direct gun DPS.

4. Validate damage-type effectiveness and composition

- Action: Run scenario sims with different damage-type mixes (ion-heavy vs plasma-heavy) to see how DPS effectiveness shifts given `DAMAGE_EFFECTIVENESS` values. This will show whether specific fleet compositions over-index on shield- or armor-dominant counters.

Validation and next steps

- Run deterministic combat sims (seeded RNG) using the in-repo harness for focused scenarios: e.g., 5 fighters vs 2 corvettes; 3 frigates vs 1 destroyer; carrier + 3 fighters vs mixed escort. Instrument per-hull damage dealt/received, shield uptime, armor decay, average engagement range, and turret target distribution.
- Add small Vitest unit tests that compute DPS from `src/data/ships/*` and assert values remain in acceptable ranges to detect accidental regression in numeric tuning.

Appendix — raw numbers (theoretical)

- Fighter: main DPS 8.9 | turret DPS 11.9 (antiFighter 6.1 / antiCapital 5.8) | total 20.8 | durability 83 | TTK ≈ 4.0s
- Corvette: main 10.0 | turret 37.4 (antiFighter ≈ 30.4) | total 47.4 | durability 179 | TTK ≈ 3.8s
- Frigate: main 10.7 | turret 48.7 (antiFighter ≈ 28.3) | total 59.4 | durability 243 | TTK ≈ 4.1s
- Destroyer: main 16.7 | turret 86.8 (antiCapital ≈ 46.8 / antiFighter ≈ 40.0) | total 103.5 | durability 683 | TTK ≈ 6.6s
- Carrier: main 12.7 | turret 53.5 (antiFighter ≈ 31.2 / antiCapital ≈ 22.3) | total 66.2 | durability 575 | TTK ≈ 8.7s

Notes on interpretation

- Treat these numbers as a code-audit of current numeric configuration (what the runtime will produce if every weapon can apply DPS uninterrupted). Real engagements reduce available DPS by turret arcs, priority rules, projectile travel times, and AI distribution; nevertheless, the relative ordering and turret-role splits are reliable indicators for tuning.

If you'd like, I can:
- run deterministic simulation scenarios using the repo's in-engine harness (seeded RNG) and produce empirical TTK and per-target distribution charts, or
- add Vitest tests under `test/` that compute DPS from `src/data/ships/*` and assert expected ranges so CI will catch future regressions.

End of report.
