# Game Balance Report v0.1.4

SpaceAutoBattler — Balance Snapshot (code-driven)

Generated: 2025-10-04 — version v0.1.4 (code audited)

## Executive summary

This report updates the v0.1.3c audit using the current source configuration in `src/data/shipStats.ts`, `src/config/carriers.ts`, and the AI surfaces (`src/game/aiProfiles.ts`, `src/game/config.ts`). Key findings:

- Carrier fighter-swarm remains the highest single-platform balance risk. With the current `CARRIER_LAUNCH_CONFIG.maxActive = 6` and `cooldownSeconds = 1.5`, a fully-tooled carrier plus its fighters produces a sustained theoretical DPS far above other single hulls.
- Several ship stats were changed since the prior snapshot (v0.1.3c): the `destroyer` primary damage and HP have been increased (damage 30, HP 250), and ranges for capital platforms were increased (destroyer range = 700, carrier range = 600). These changes materially raise capital-class lethality and reach.
- AI defaults continue to enable vertical maneuvers and run the tick-rate experiment by default (`verticalEnabled = true`, effective AI tick-rate = 15 Hz), which favors more responsive behavior and makes speed-tier gaps more consequential.
- Shield regeneration remains absolute (numeric per-second values), which continues to favor small hull sustain in prolonged trades.

## High-level findings

- Carrier Dominance — Critical (High Risk)
  - Rationale: Carrier + maximum fighter complement (6) now yields a combined theoretical sustained DPS ≈ 91.91 (carrier weapons ≈ 38.57 + fighters ≈ 53.33). This keeps carriers as the largest single imbalance vector.

- Destroyer buff — High
  - Rationale: Destroyer primary damage and HP have increased (damage 30, HP 250) and the hull carries a large turret battery (six turrets). Destroyer total DPS now sits far higher than previous snapshots, shifting composition balance toward capital-heavy lists.

- Speed Tier Gaps — High
  - Rationale: Fighter speed (40) vs corvette (15) remains a large gap (~2.67×). With AI tick-rate at 15 Hz and vertical maneuvers enabled, intercept windows tighten for slower hulls.

- AI engagement & experiments — Medium
  - Rationale: AI vertical motion, opening salvo, and engagement-boost experiments are enabled by default (openingSalvoDuration = 30s, engagement boost multiplier = 1.2). This increases early aggression and rewards responsive hulls.

- Shield regen scaling — Medium
  - Rationale: Absolute shield regen (e.g., fighter 4/s, carrier 10/s) still scales non-linearly vs HP and favors smaller hulls in sustained trades.

- Spawn/Separation & Range Compression — Medium
  - Rationale: `SPAWN_CONFIG.initialSeparationFactor = 1.5`. Using the current largest platform range (destroyer 700 or carrier 600) produces initial separations of ~1050 (if based on destroyer) or ~900 (if based on carrier) units—noticeably larger than prior snapshots and affecting opening engagement tempo.

## Methodology & references

Numbers below are derived directly from repository files (primary locations):

- Ship stats: `src/data/shipStats.ts` (HP, shields, damage, fire-rates, turret specs, speed, range)
- Carrier config: `src/config/carriers.ts` (maxActive, cooldownSeconds, formation)
- AI profiles & config: `src/game/aiProfiles.ts`, `src/game/config.ts` (desired ranges, vertical motion, tick-rate, opening salvo)
- Spawn rules: `src/game/config.ts` (SPAWN_CONFIG)
- Damage application & progression scaffolding: `src/game/progression.ts`

DPS calculation method: DPS = damage / fireRate for primaries and turrets; turret DPS summed per hull. Values are instantaneous theoretical DPS and ignore projectile travel, accuracy, target selection, damage type effectiveness, and turret arcs.

## Quantitative ship metrics (live code)

Computed per-source data (rounded to 2 decimals):

- Fighter
  - HP: 40, Shield: 24, Shield regen: 4.0/s
  - Primary DPS: 8 / 0.9 = 8.89
  - Turret DPS: 0
  - Total DPS: 8.89
  - Speed: 40, Range: 220

- Corvette
  - HP: 75, Shield: 45, Shield regen: 5.0/s
  - Primary DPS: 12 / 1.2 = 10.00
  - Turret DPS: 2 × (6 / 1.0) = 12.00
  - Total DPS: 22.00
  - Speed: 15, Range: 220

- Frigate
  - HP: 120, Shield: 72, Shield regen: 7.0/s
  - Primary DPS: 16 / 1.5 = 10.67
  - Turret DPS: 3 × (8 / 1.2) = 20.00
  - Total DPS: 30.67
  - Speed: 12, Range: 260

- Destroyer
  - HP: 250, Shield: 180, Shield regen: 10.0/s
  - Primary DPS: 30 / 1.8 = 16.67
  - Turret DPS: 2 × (10 / 1.4) + 4 × (10 / 1.6) = 39.29
  - Total DPS: 55.95
  - Speed: 10, Range: 700

- Carrier
  - HP: 320, Shield: 200, Shield regen: 10.0/s
  - Primary DPS: 28 / 2.2 = 12.73
  - Turret DPS: 2 × (9 / 1.3) + 2 × (9 / 1.5) = 25.85
  - Carrier weapon total (primary + turrets): 38.57
  - Fighter production: `CARRIER_LAUNCH_CONFIG.maxActive` = 6 fighters
  - Fighter swarm DPS (full cap): 6 × 8.89 = 53.33
  - Combined carrier + fighters (sustained theoretical): 38.57 + 53.33 = 91.91
  - Speed: 7, Range: 600

Notes on the numbers:

- These represent instantaneous theoretical DPS and ignore accuracy/aiming, projectile travel/lead time, turret firing arcs/overlap, damage-type effectiveness, and target selection heuristics. Actual in-simulation DPS will vary by scenario and target characteristics (shields vs armor).
- Shield regen is absolute per-second and therefore represents a larger proportion of small-hull survivability (example: fighter regen 4/s = 10% of fighter HP per second and ~16.7% of fighter maxShield per second).

## Balance assessment and risk ratings

- Carrier Dominance — Critical (High Risk)
  - Rationale: With current defaults a carrier at full fighter capacity produces sustained output (~91.9 DPS) that exceeds other single-hull platforms by a large margin. The combination of long carrier weapon ranges (460–600) and fighter swarm persistence makes carriers difficult to neutralize without explicit area-control or anti-swarm tools.
  - Quick mitigations: reduce `CARRIER_LAUNCH_CONFIG.maxActive` or increase `cooldownSeconds` to reduce swarm saturation.

- Destroyer Lethality Increase — High
  - Rationale: Destroyer total DPS (~55.95) and long range (700) put it into a dominant capital/anti-capital role. In many cost-composition analyses this change will favor ships that can endure or avoid destroyer volleys (range, armor, or area-denial).
  - Quick mitigations: consider reducing turret count/DPS or shortening turret ranges to preserve destroyer role without allowing it to unilaterally control engagements at long stand-off.

- Speed Tier Gaps — High
  - Rationale: Fighter vs corvette speed disparity (≈2.67×) remains large and is made more impactful by the AI's more-responsive tick rate (15 Hz) and active vertical maneuvers.
  - Mitigations: compress fighter top speed modestly (e.g., 40 → 32) or boost interception tools on corvettes (trackers, turret arcs, or dodge penalties for fighters).

- AI Engagement Dynamics — Medium
  - Rationale: AI runs with vertical movement enabled and an opening salvo/engagement boost; these defaults make early aggression common and put emphasis on platform response times. The `bandStickinessDuration` (3s) and `patience` values in profiles are important knobs to control oscillation and target churn.

- Shield regen scaling — Medium
  - Rationale: Absolute shield regen favors small hulls in sustained trades; moving to a percentage-based or hybrid regen model will scale sustain predictably by hull size and avoid compressing time-to-kill for light ships.

- Spawn separation & range compression — Medium
  - Rationale: With `initialSeparationFactor = 1.5` and top platform ranges at 600–700, initial engagement distances increase (900–1050 units), changing opening anchor behaviors and making long-range hulls more effective at dictating first contact.

## Concrete prioritized recommendations (actionable)

Immediate (low-risk, quick to test)

- Reduce carrier active fighter cap or raise cooldown
  - Example: `CARRIER_LAUNCH_CONFIG.maxActive: 6 -> 4` and/or `cooldownSeconds: 1.5 -> 2.0` (`src/config/carriers.ts`). Expected effect: reduces sustained swarm DPS by ~33%–50%.

- Add a "post-burst" cooldown or ramp for carrier launches
  - Keep `batchSize = 1` but add a small additional cooldown after multiple successive launches to prevent steady-state saturation.

- Validate AI tick-rate vs fast-hull reaction
  - Confirm whether 15 Hz (AI_CONFIG.tickRateHz) produces desirable reaction windows for interceptors. If over-responsive, consider lowering or sampling additional smoothing/hysteresis.

Short-term (medium-risk)

- Compress fighter top speed
  - Example: `fighter.speed: 40 -> 32` (`src/data/shipStats.ts`). This retains the fighter’s role while narrowing interception gaps.

- Re-balance destroyer turret battery
  - Example: reduce either turret damage (10 -> 8) or reduce turret counts from 6 → 4, or shorten turret ranges (e.g., 700 → 620). This reduces destroyer raw burst and brings composition balance back toward mixed fleets.

- Normalize shield/regeneration
  - Move shield regen to a hybrid or percentage model (e.g., 2.5% of maxShield per second) so sustain scales more predictably across hull sizes.

- Slightly reduce carrier fighter damage or fighter HP
  - Example: fighter.damage: 8 -> 7 or fighter.maxHp: 40 -> 36 to soften swarm edge.

Longer-term (higher-risk / design)

- Introduce area-denial / anti-swarm counters
  - Add weapons or subsystems (flak, short-range arc weapons, EMP pulses) that specifically threaten many small targets at once without overpowering single-target DPS.

- Add damage-type counterplay and resistances
  - Expand the `DAMAGE_EFFECTIVENESS` matrices in `src/game/progression.ts` and create dedicated anti-fighter weapons that scale better against swarms.

- Revisit world/range scaling
  - Consider increasing world scale or adjusting range tiers to give long-range platforms distinct roles without letting them dominate mobility-advantaged fleets.

## Suggested quick test matrix (deterministic)

- Mirror matches for each hull (same-hull vs same-hull) to validate time-to-kill (seeded RNG). Use `spawnInitialFleets` with seeded RNG and run repeated seeds.
- Carrier vs no-carrier comps: measure win-rate across N=100 seeds with `CARRIER_LAUNCH_CONFIG.maxActive` variations {6,5,4} and `cooldownSeconds` variations {1.2,1.5,2.0}.
- Destroyer sensitivity sweep: turret count {6,5,4} and turret damage {10,9,8} to identify the minimal effective change that restores parity with other capital choices.
- Speed disparity test: fighter-only vs corvette-only (measure interception rate, catch fraction) and fighter.speed {40,36,32} sweeps.
- Shield model test: absolute regen vs percentage-based regen across all hulls; measure time-to-kill and sustainability across mirror matches.

## Recommended metrics to collect in automated tests

- Time-to-First-Shot (target < 30s median)
- Win-rate per composition (mirror and asymmetric)
- Average sustained DPS contributions (primary vs turret vs spawned units)
- Fighter survival fraction in carrier+fighter compositions (how many fighters survive 30s windows)
- Vertical dispersion metrics (already exposed as `verticalDispersion`)
- AI heading amplitude and command-churn metrics (to catch oscillation)

## Short validation notes from the code audit

- AI: `AI_CONFIG.verticalEnabled` is true by default and `AI_CONFIG.tickRateHz` resolves to 15 Hz in the default build unless runtime UI or query overrides change it. `openingSalvoDuration` and `openingSalvoAggressionBoost` are enabled and set to 30s and 1.2 respectively.

- Spawn: `SPAWN_CONFIG.initialSeparationFactor = 1.5` and `verticalSpreadFactor = 0.2`. Using platform ranges in the current tree leads to larger initial separation distances than prior snapshots (e.g., carrier 600 → separation ≈ 900 units; destroyer 700 → ≈ 1050 units).

- Carriers: `CARRIER_LAUNCH_CONFIG` remains at `maxActive: 6`, `cooldownSeconds: 1.5`, `batchSize: 1` and a 6-slot formation. This is the single largest lever for quick reduction of swarm pressure.

- Shields: Absolute shield regen values persist in `src/data/shipStats.ts` (per-second numbers), continuing to favor small hull sustained trades.

## Files referenced (key locations)

- `src/data/shipStats.ts` — definitive ship stats used at spawn
- `src/config/carriers.ts` — carrier launch configuration (maxActive, cooldownSeconds, formation)
- `src/game/aiProfiles.ts` — behavior profiles: desiredRange, aggression, patience, vertical preference
- `src/game/config.ts` — world constants, SPAWN_CONFIG, AI experiment flags
- `src/game/progression.ts` — damage effectiveness and calculation scaffolding
- `src/game/systems/carriers.ts` — deterministic fighter spawn implementation

## Summary (one-line)

Carrier swarm saturation and the recent destroyer power increases are the two highest balance risks in v0.1.4; immediate mitigations (reduce carrier active fighters or increase launch cooldown, rebalance destroyer turret output, and compress fighter speed) will quickly reduce extreme composition outcomes and are straightforward to validate with deterministic tests.

## Appendix: computed DPS table (code-derived)

|      Hull | Primary DPS | Turret DPS | Total DPS |  HP | Shield | Shield Regen/s | Speed | Range |   Max Active Fighters |
| --------: | ----------: | ---------: | --------: | --: | -----: | -------------: | ----: | ----: | --------------------: |
|   Fighter |        8.89 |       0.00 |      8.89 |  40 |     24 |           4.00 |    40 |   220 |                   N/A |
|  Corvette |       10.00 |      12.00 |     22.00 |  75 |     45 |           5.00 |    15 |   220 |                   N/A |
|   Frigate |       10.67 |      20.00 |     30.67 | 120 |     72 |           7.00 |    12 |   260 |                   N/A |
| Destroyer |       16.67 |      39.29 |     55.95 | 250 |    180 |          10.00 |    10 |   700 |                   N/A |
|   Carrier |       12.73 |      25.85 |     38.57 | 320 |    200 |          10.00 |     7 |   600 | 6 (default in config) |

---

If you'd like, I can:

- Generate the deterministic test cases and Vitest specs for the recommended sweeps (carrier cap sweep, destroyer sensitivity sweep, and fighter speed sweep).
- Produce a short patch (PR) that implements a low-risk change (e.g., `maxActive: 6 -> 4` and `fighter.speed: 40 -> 36`) alongside unit tests that assert expected DPS changes.
