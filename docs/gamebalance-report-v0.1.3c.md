# Game Balance Report v0.1.3c

SpaceAutoBattler — Balance Snapshot (code-driven)

Generated: 2025-10-04 — version v0.1.3c (code audited)

## Executive summary

This document reviews the live code and configuration (v0.1.3c audit) and provides a concise rating of the current balance, concrete quantitative metrics pulled from the code, and prioritized recommendations.

## High-level findings

- Carrier fighter-swarm remains the single largest imbalance risk: carriers can host up to 6 active fighters (configurable in `src/config/carriers.ts`) with a launch cooldown of 1.5s. When combined with the carrier's own weapon suite this produces a dramatic DPS spike compared to other hulls.
- Speed-tier gap between `fighter` (40) and `corvette` (15) is large (≈2.67×), creating hard-interception issues that limit counterplay.
- AI vertical movement is enabled by default and non-zero (contrary to older snapshots): `AI_CONFIG.verticalEnabled` is true and vertical maneuvers are applied with a configurable clamp (`headingYClamp`, `verticalClamp`). The AI tick rate is effectively 15 Hz by default (experimental path enabled), improving responsiveness relative to older 10 Hz assumptions.
- Spawn/separation settings place fleets at distances tuned from ship ranges (separation = maxRange * SPAWN_CONFIG.initialSeparationFactor), producing initial engagement separations of ~600 units for the default hull set (carrier range = 400).
- Shield regeneration is absolute (numeric shield points per second) and therefore scales differently vs. hull HP; small hulls regain a large fraction of their shield per second.

## Methodology & references

All numbers below are derived directly from the repository files (key locations):

- Ship stats: `src/data/shipStats.ts` (source of HP, shield, damage, fire-rate, turret specs, speed)
- AI profiles: `src/game/aiProfiles.ts` (desired ranges, aggression, patience, patrol styles)
- Carrier config: `src/config/carriers.ts` (maxActive, cooldownSeconds, formation)
- World & spawn config: `src/game/config.ts` and `src/game/state.ts`
- Damage rules & effectiveness: `src/game/progression.ts` (damage effectiveness, armor, the calculateEffectiveDamage() function)
- Carrier spawn logic: `src/game/systems/carriers.ts`

When I report "DPS" I use the in-code interpretation where `damage` is per-shot damage and `fireRate` is the cooldown between shots in seconds. Thus DPS = damage / fireRate. Turret DPS is handled the same way and is summed into a hull's turret contribution.

## Quantitative ship metrics (live code)

Computed per-source data (rounded to 2 decimals):

- Fighter
  - HP: 40, Shield: 24, Shield regen: 4.0/s
  - Primary DPS: 8 / 0.9 = 8.89
  - Turret DPS: 0
  - Total DPS: 8.89
  - Speed: 40 (fast)

- Corvette
  - HP: 75, Shield: 45, Shield regen: 5.0/s
  - Primary DPS: 12 / 1.2 = 10.00
  - Turret DPS: 2 × (6 / 1.0) = 12.00
  - Total DPS: 22.00
  - Speed: 15

- Frigate
  - HP: 120, Shield: 72, Shield regen: 7.0/s
  - Primary DPS: 16 / 1.5 = 10.67
  - Turret DPS: 3 × (8 / 1.2) = 20.00
  - Total DPS: 30.67
  - Speed: 12

- Destroyer
  - HP: 200, Shield: 120, Shield regen: 8.0/s
  - Primary DPS: 22 / 1.8 = 12.22
  - Turret DPS: 2 × (10 / 1.4) + 2 × (10 / 1.6) = 26.79
  - Total DPS: 39.01
  - Speed: 10

- Carrier
  - HP: 320, Shield: 200, Shield regen: 10.0/s
  - Primary DPS: 28 / 2.2 = 12.73
  - Turret DPS: 2 × (9 / 1.3) + 2 × (9 / 1.5) = 25.85
  - Carrier weapon total: 38.58
  - Fighter production: `CARRIER_LAUNCH_CONFIG.maxActive` = 6 fighters
  - Fighter swarm DPS (full cap): 6 × 8.89 = 53.33
  - Combined carrier + fighters (sustained theoretical): 38.58 + 53.33 = 91.91
  - Speed: 7 (very slow)

> Notes on the numbers
>
> - These are raw, instantaneous DPS numbers that ignore: projectile travel time, accuracy/captain modifiers, target shields/armor interactions, turret arcs, and target selection (priority). The in-engine damage application passes projectiles through calculateEffectiveDamage() in `progression.ts`, so actual hull damage vs shield/armor will be lower/higher depending on damage-type effectiveness.
> - Shield regen is an absolute per-second value applied to shields — for small hulls the regen is a larger fraction of their max HP (e.g., fighter regen of 4/s equals 10% of fighter HP per second and ~16.7% of fighter maxShield per second). That skews survivability for small hulls in sustained trading.

## Balance assessment and risk ratings

- Carrier Dominance — Critical (High Risk)
  - Rationale: A full-cap carrier (6 fighters) + carrier weapon suite pushes the carrier platform into a DPS band roughly 2×–3× higher than other single hulls (carrier+fighters ≈ 92 DPS vs. next-highest single-ship ≈ 39 DPS). Production numbers (6 active), fast cooldown (1.5s), and staggered formation make the swarm both persistent and difficult to clear for hulls lacking effective area-denial.

- Speed Tier Gaps — High
  - Rationale: Fighter speed (40) vs corvette speed (15) is a very large gap (≈2.67×). This makes interception and soft counters brittle—fighters can reliably avoid slower hulls absent special anti-speed mechanics.

- Corvette turret overtuning — Medium
  - Rationale: Corvettes gain +12 turret DPS on top of a 10 DPS primary (total 22 DPS) for a relatively small hull. In several cost-to-power analyses this can create corvette-favored compositions. Reducing turret raw damage or adjusting arc/priority tightness is a viable fix.

- AI engagement behavior — Medium
  - Rationale: AI has an explicit opening-salvo boost (30s) and team posture logic (aggressive/hold/retreat) based on rough strength ratios. The default blackboard posture initially is `hold`, but the opening salvo and threat heuristics often produce engagement. If tests show frequent holds, consider tuning aggression/patience or openingSalvo settings.

- Range compression and world scale — Low to Medium
  - Rationale: Max weapon ranges sit in the 220–400 unit band. With WORLD_SIZE = 8000 these ranges represent roughly 2.75%–5% of the world edge length. Practically this makes the active tactical engagement area relatively tight compared to the map, reducing long-range maneuver significance.

- Shield regen scaling — Medium
  - Rationale: Absolute shield regen favors small hulls (high percent of their shield/HP per second). This compresses time-to-kill for light ships vs. big ships in sustained trades and can mask balance gaps.

## Concrete prioritized recommendations (actionable)

1) Immediate (low-risk, quick to test)

- Reduce carrier active fighter cap or raise cooldown
  - Example: `CARRIER_LAUNCH_CONFIG.maxActive: 6 -> 4` and/or `cooldownSeconds: 1.5 -> 2.0` (`src/config/carriers.ts`). Expected effect: reduces sustained swarm DPS by ~33%-50%.

- Tweak carrier fighter spawn behaviour
  - Consider `batchSize: 1 -> 1` (keeps) but add staggered cooldowns or per-spawn longer cooldown after large launch bursts to avoid steady-state saturation.

- Increase AI tick responsiveness vs. aggression parity
  - Confirm `AI_CONFIG.tickRateHz` = 15 (current default). If tests show delayed reactions for fast hulls, raise experimentally to 18–20 and re-evaluate metrics.

1. Short-term (medium-risk)

- Compress top-end speeds
  - Example: `fighter.speed: 40 -> 32` (≈ -20%) (`src/data/shipStats.ts`). Retains fighter role but narrows the catchability gap.

- Re-balance corvette turret damage
  - Example: turret damage 6 -> 4 (per turret) or reduce turret arc/priority strength (`src/data/shipStats.ts`), bringing corvette total DPS closer to progression curve.

- Normalize shield/regeneration
  - Move from absolute shield regen to a hybrid rule or percentage-based regen (e.g., 2.5% of maxShield per second for all hulls) so sustain scales predictably with size.

- Consider one of: increase destroyer/carrier turret ranges slightly to reward their role as area-control/anti-capital platforms (ensures distinct range tiers).

1. Longer-term (higher-risk / design)

- Introduce area-of-effect or anti-swarm mechanics (e.g., arc-wide flak, minefields) to give medium/large hulls tactical tools vs. swarms.

- Add damage-type resistances and tactical counters (ion vs. shield, plasma vs. armor) and weapons that exploit them. Code scaffolding exists in `DAMAGE_EFFECTIVENESS` in `src/game/progression.ts`.

- Revisit world scale to increase engagement-to-map ratio or increase range tiers proportionally.

## Suggested quick test matrix (deterministic)

- Mirror matches for each hull vs same-hull to validate time-to-kill (seeded RNG). Use `spawnInitialFleets` with seeded RNG and run repeated seeds.
- Carrier vs no-carrier comps: measure win-rate over N=100 distinct seeds.
- Speed disparity test: fighter-only vs. corvette-only (measure catch/intercept rates).
- Turret sensitivity sweep: corvette turret damage 6 → 4 → 5 to identify minimal effective change.

## Recommended metrics to collect in automated tests

- Time-to-First-Shot (target < 30s median)
- Engagement frequency (shots fired per minute per match)
- Win-rate per composition (mirror and asymmetric)
- Vertical dispersion metrics (already instrumented: `verticalDispersion` in blackboard)
- DPS contribution breakdown (primary vs turret vs spawned units)

## Short validation notes from the code audit

- Vertical movement is enabled and non-negligible (see `src/game/systems/decision/vertical-maneuvers.ts`). The AI uses a clamp and a per-hull clamp profile, meaning carriers and destroyers remain relatively flatter than fighters/corvettes.
- Opening salvo and engagement boost exist (default enabled) and will increase initial aggression for the first 30s (`AI_CONFIG.openingSalvoDuration`, `openingSalvoAggressionBoost`). Use this toggle when you want longer early-game probing.
- Damage is applied through a layered shield->armor->hull path that already supports per-damage-type modifiers. This is a good place to implement long-term counters to swarms without breaking base numbers.

## Files referenced (key locations)

- src/data/shipStats.ts — definitive ship stats used at spawn
- src/config/carriers.ts — carrier launch configuration (maxActive, cooldownSeconds, formation)
- src/game/aiProfiles.ts — behavior profiles: desiredRange, aggression, patience, vertical preference
- src/game/config.ts — world constants and AI feature flags
- src/game/state.ts — spawn logic (spawnInitialFleets), separation, and anchor calculations
- src/game/progression.ts — damage effectiveness, armor, and calculateEffectiveDamage()
- src/game/systems/carriers.ts — deterministic fighter spawn implementation

## Summary (one-line)

Carrier swarms remain the top balance risk in v0.1.3c; targetted, low-risk tuning (reduce carrier active fighters or increase launch cooldown, compress fighter speed, and soften corvette turret output) will materially improve balance quickly and allow deterministic regression tests to validate outcomes.

## Appendix: computed DPS table (code-derived)

| Hull | Primary DPS | Turret DPS | Total DPS | Max Active Fighters |
|------:|------------:|-----------:|----------:|--------------------:|
| Fighter | 8.89 | 0.00 | 8.89 | N/A |
| Corvette | 10.00 | 12.00 | 22.00 | N/A |
| Frigate | 10.67 | 20.00 | 30.67 | N/A |
| Destroyer | 12.22 | 26.79 | 39.01 | N/A |
| Carrier | 12.73 | 25.85 | 38.58 | 6 (default in config) |


