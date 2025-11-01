## Game Balance Report v2.0.3e

Generated: 2025-11-01

This report recomputes hull DPS/TTK and inspects the live code (in `src/`) for the authoritative ship stats, turret definitions, damage routing, and AI feature flags. The calculations below use the exact values in `src/data/ships/*`, turret defaults from `src/data/ships/turret-factory.ts`, AI flags from `src/game/config.ts`, and the damage routing math from `src/game/combat/damage.ts`.

Executive summary

- Overall: the code shows substantially more turret firepower than the earlier (v01.4d) analysis implied — point-defense and fast turrets contribute large burst DPS numbers which strongly affect engagements, especially vs fighters. When turret roles (antiFighter / antiCapital / any) are considered, the effective DPS a hull can apply to a particular target class is significantly different from the raw "all turrets firing at once" total.
- Biggest balance risks:
  - Corvettes and frigates pack very high turret DPS (especially point-defense and beams) that can shred fighters and suppress swarms.
  - Destroyer has large multi-role turret arrays: its combined theoretical turret DPS is very high and split between antiCapital and antiFighter turrets, meaning it is dangerous in both roles. Against mixed fleets it is a dominant presence.
  - Carrier gun DPS is moderate, but carriers have sizable turret complements and ship-launched fighters (carrier launch behavior is outside this file) — carriers remain survivable but their direct gun DPS is middling compared to turret contributions.

Methodology and assumptions

- Source files read (authoritative):
  - `src/data/ships/*.ts` (fighter, corvette, frigate, destroyer, carrier)
  - `src/data/ships/turret-factory.ts` (turret defaults)
  - `src/game/config.ts` (AI feature flags)
  - `src/game/combat/damage.ts` (damage routing math)
  - `src/config/progression.ts` (damage-effectiveness and armor defaults)

- DPS computation:
  - Main weapon DPS = `damage / fireRate` using the top-level `damage` and `fireRate` on the hull.
  - Turret DPS = sum over turrets of `turret.damage / turret.fireRate` (uses turret-specific overrides or the defaults in `turret-factory.ts`).
  - We produce two DPS figures: "Theoretical max DPS" (sum of main weapon + all turret DPS) and a simple role-split DPS that groups turret DPS by `priority` (antiFighter / antiCapital / any). This highlights that not all turret DPS is equally applicable to every target class.

- Durability and TTK:
  - Raw durability = `maxHp + maxShield` (coarse proxy). TTK (seconds) = raw durability / DPS.
  - This is an optimistic, upper-bound damage application model (no aim constraints, no turret yaw limits, no turret priority conflicts, perfect uptime). Use these numbers for directional tuning only.

Key AI settings (from `src/game/config.ts`)

- engagementBoostEnabled: true (opening salvo boost; default openingSalvoAggressionBoost 1.2, duration 30s)
- tickRateHz: experimental default enabled (15Hz vs base 12Hz) — AI is responsive
- hysteresisEnabled, smoothingEnabled: true
- threatWeights (hull): carrier=6, destroyer=5, frigate=4, corvette=3, fighter=2
- interruptHpDrop: 0.1 (interrupt when ≥10% HP lost in a hit)

Computed hull metrics (theoretical)

Notes: DPS values rounded to one decimal place. Turret DPS is broken down by priority when available. All numbers come directly from the source files listed above.

1) Fighter

- Source: `src/data/ships/fighter.ts`
- maxHp: 40
- maxShield: 24 (shieldRegen: 4.0)
- main weapon: damage 8, fireRate 0.9 → main DPS = 8 / 0.9 ≈ 8.9
- turrets:
  - Torpedo (antiCapital): 26 / 4.5 ≈ 5.8 DPS
  - Beam (antiFighter): 11 / 1.8 ≈ 6.1 DPS
- turret total ≈ 11.9 (antiFighter ≈ 6.1, antiCapital ≈ 5.8)
- theoretical max DPS ≈ 20.8
- raw durability = 64 → theoretical TTK ≈ 64 / 20.8 ≈ 3.1s
- role: fast skirmisher with mixed short/medium weapons; turret roles mean fighter can contribute specialized damage (torpedoes vs big targets, beam/PD vs small fast targets)

2) Corvette

- Source: `src/data/ships/corvette.ts`
- maxHp: 75
- maxShield: 45 (shieldRegen: 5.0)
- main weapon: damage 12, fireRate 1.2 → main DPS = 10.0
- turrets (expanded with turret-factory defaults and per-turret overrides):
  - Laser ×2 (antiFighter): 6.0 each → 12.0
  - PointDefense (antiFighter): 5 / 0.35 ≈ 14.3
  - Missile (any): 18 / 2.6 ≈ 6.9
  - Beam (antiFighter): 14 / 2.0 = 7.0
- turret total ≈ 40.2 (antiFighter ≈ 33.3, any ≈ 6.9)
- theoretical max DPS ≈ 50.2
- raw durability = 120 → theoretical TTK ≈ 120 / 50.2 ≈ 2.4s
- role: strong anti-fighter platform; point-defense and beam DPS dominate the turret contribution — corvettes are highly effective at suppressing fighters in small engagements.

3) Frigate

- Source: `src/data/ships/frigate.ts`
- maxHp: 120
- maxShield: 72 (shieldRegen: 7.0)
- main weapon: damage 16, fireRate 1.5 → main DPS ≈ 10.7
- turrets:
  - Plasma ×2 (any): 8/1.2 ≈ 6.7 each → 13.3
  - Laser (antiFighter): 8/1.2 ≈ 6.7
  - PointDefense (antiFighter): 5/0.35 ≈ 14.3
  - Missile (any): 20/2.8 ≈ 7.1
  - Beam (antiFighter): 16/2.2 ≈ 7.3
- turret total ≈ 48.7 (antiFighter ≈ 28.3, any/antiCapital ≈ 20.5)
- theoretical max DPS ≈ 59.4
- raw durability = 192 → theoretical TTK ≈ 192 / 59.4 ≈ 3.2s
- role: multirole escort with both sustained turret DPS and PD for fighter suppression; turret mix gives flexibility across target classes.

4) Destroyer

- Source: `src/data/ships/destroyer.ts`
- maxHp: 250
- maxShield: 180 (shieldRegen: 10.0)
- main weapon: damage 30, fireRate 1.8 → main DPS ≈ 16.7
- turrets (summary of the many turrets defined in the file):
  - Heavy turrets ×2 (antiCapital): 10/1.4 ≈ 7.14 each → 14.3
  - Laser turrets ×6 (default createLaser priority: antiFighter): 10 / (1.6 or 2.0) → combined ≈ 32.5
  - Torpedo ×2 (antiCapital): 42/5.0 = 8.4 each → 16.8
  - Missile ×2 (any / long range): 22/2.8 ≈ 7.86 each → 15.7
  - Beam (antiFighter): 18/2.4 = 7.5
- turret total ≈ 86.8 (antiCapital ≈ 46.8, antiFighter ≈ 40.0)
- theoretical max DPS ≈ 103.5
- raw durability = 430 → theoretical TTK ≈ 430 / 103.5 ≈ 4.2s
- role: capital brawler / area denial. Note the turret DPS is split: destroyer brings heavy antiCapital punch (torpedoes + heavy turrets) while also possessing a large antiFighter laser/beam battery. Against mixed fleets it is exceptionally dangerous.

5) Carrier

- Source: `src/data/ships/carrier.ts`
- maxHp: 320
- maxShield: 200 (shieldRegen: 10.0)
- main weapon: damage 28, fireRate 2.2 → main DPS ≈ 12.7
- turrets:
  - Ion ×2 (antiCapital): 9/1.3 ≈ 6.9 each → 13.8
  - Laser ×4 (antiFighter): 9/1.5 = 6.0 each → 24.0
  - Missile (any): 22/2.6 ≈ 8.5
  - Beam (antiFighter): 18/2.5 = 7.2
- turret total ≈ 53.5 (antiFighter ≈ 31.2 / antiCapital ≈ 22.3)
- theoretical max DPS ≈ 66.2
- raw durability = 520 → theoretical TTK ≈ 520 / 66.2 ≈ 7.9s
- role: high survivability anchor; gun DPS moderate but turret complement provides utility. Carrier value in game typically depends on launched fighters + support abilities which are not included in this gun-only DPS accounting.

Interpreting the numbers — turret roles matter

- The "theoretical max DPS" above assumes every weapon can focus a single target continuously, which overstates on-target DPS in practice because many turrets have role priorities (e.g., `antiFighter`, `antiCapital`) and limited arcs. A practical takeaway:
  - Fighter-facing DPS (PD + antiFighter lasers/beams) is much larger than the antiCapital share for corvettes/frigates/destroyers — which explains why small fighter swarms struggle without numbers or specialized counters.
  - Against capital targets, a subset of turrets (heavy, torpedo, ion, missiles) contribute the lion's share of damage.

Damage routing notes (from `src/game/combat/damage.ts` and `src/config/progression.ts`)

- Shields absorb first; shield effectiveness depends on damage type (`getDamageEffectiveness`) — e.g., `ion` is strong vs shields, `plasma`/`kinetic` behave differently.
- When shields break, remaining damage is subject to armor absorption limited by 50% of the remaining hit and scaled by `armorEffectiveness` (see code). Armor is decayed by 10% of the absorbed amount per hit.
- Conclusion: large numbers of small hits (high rate) are more easily soaked by large shield pools + regen; large single hits (torpedoes/heavy guns) penetrate armor more effectively. This means DPS composition (many small bullets vs fewer heavy torpedoes) affects real TTK materially.

Balance implications and recommendations

1. Corvettes & Frigates vs Fighters — PD is very strong

- Problem: point-defense and antiFighter turrets generate very high DPS against fighters (PD default 5 damage @ 0.35s → ~14.3 DPS). This makes lone fighters or small swarms underperform relative to their mobility.
- Options:
  - Reduce PD per-shot damage or increase PD minimum tracking restrictions (e.g., require locking time, reduce effective accuracy vs very small fast targets).
  - Reduce PD fire rate slightly (e.g., 0.35 → 0.42s gives ~16% reduction), or lower PD damage by 1–2 to soften one-shot kills from alpha strikes.

2. Destroyer turret density is very high

- Problem: the destroyer’s theoretical max DPS (~103.5) is large relative to its durability; even accounting for turret role-splitting it is a dominant force in mixed fights.
- Options:
  - Reduce the number of high-rate lasers or slightly lower their damage (e.g., -10% damage on the 1.6s lasers) so destroyer loses some raw antiFighter overlap without changing role.
  - Reduce top turret ranges on the longest laser/beam/torpedo mounts so destroyer cannot fully leverage long-range poke against fleets that cannot respond.

3. Carrier perceived underwhelming vs its survivability

- Observation: carrier's direct gun DPS (≈12.7 main + turret mix) is not extreme, but the hull is survivable. The carrier’s in-game value depends heavily on launched fighters and support abilities; verify `CARRIER_LAUNCH_CONFIG` and fighter balancing.
- Options:
  - Increase carrier fighter sortie cadence or give carriers a minor passive buff (fighter buff, turret buff to launched fighters, or modest AoE support) so carriers feel impactful beyond being a big HP pool.

4. Ensure damage-type effectiveness is applied and communicated

- The code uses `DAMAGE_EFFECTIVENESS` in `src/config/progression.ts` to bias damage vs shields/armor. When tuning numbers also test with damage-type mixes (e.g., ion-heavy fleets vs plasma-heavy fleets) to see how balance shifts.

Validation and next steps

- Run deterministic combat sims (seeded RNG) using the actual projectile and AI code for small scenarios:
  - 5 fighters vs 2 corvettes
  - 3 frigates vs 1 destroyer
  - carrier + 3 fighters vs mixed escort
- Instrument telemetry for: per-hull damage dealt/received, shield uptime, armor decay, average engagement range, and turret target distribution. These metrics will validate how much turret DPS actually lands on intended target classes.
- Consider adding small unit tests (Vitest) that assert the computed DPS for each hull remains within an expected range to detect regressions in future changes. The repo already uses Vitest; add tests under `test/` that import `SHIP_STATS` and compute DPS from code values.

Appendix — raw numbers (theoretical)

- Fighter: main DPS 8.9 | turret DPS 11.9 (antiFighter 6.1 / antiCapital 5.8) | total 20.8 | durability 64 | TTK ≈ 3.1s
- Corvette: main 10.0 | turret 40.2 (antiFighter ≈ 33.3) | total 50.2 | durability 120 | TTK ≈ 2.4s
- Frigate: main 10.7 | turret 48.7 (antiFighter ≈ 28.3) | total 59.4 | durability 192 | TTK ≈ 3.2s
- Destroyer: main 16.7 | turret 86.8 (antiCapital ≈ 46.8 / antiFighter ≈ 40.0) | total 103.5 | durability 430 | TTK ≈ 4.2s
- Carrier: main 12.7 | turret 53.5 (antiFighter ≈ 31.2 / antiCapital ≈ 22.3) | total 66.2 | durability 520 | TTK ≈ 7.9s

Notes on interpretation

- Treat these numbers as a code-audit of present numeric configuration (what the runtime will produce if every weapon can apply DPS uninterrupted). Real engagements reduce available DPS by turret arcs, priority rules, projectile travel/arming times, and AI target distribution; still, the relative ordering and the unusually-high PD/laser contributions are meaningful and should inform tuning.

If you'd like, I can:
- run small deterministic simulation scenarios using the repo's in-engine harness (seeded RNG) and produce empirical TTK and distribution charts, or
- add Vitest tests that assert expected DPS ranges and fail CI when turret or hull numbers drift outside targets.

End of report.
