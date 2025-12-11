# Game Balance Report v2.0.4

Date: 2025-11-10

## Summary

- **Balance Rating:** 6 / 10 — the combat systems are coherent and expressive but show several hotspots that risk brittle or unsatisfying encounters (PD dominance, torpedo AOE, clustered turret DPS). The systems are tunable; I recommend a few conservative numeric adjustments plus a short battery of deterministic harness scenarios to quantify improvements.

## Scope & Method

- Inspected: `src/data/ships/*`, `src/data/ships/turret-factory.ts`, `src/config/*` (AI, projectiles, progression), `src/game/systems/*` (turrets, projectiles, damage, decision), and `src/game/*` AI profile code.
- Method: read stat values (hp, shield, regen, damage, fireRate, projectileSpeed, range, turret specs) and derive approximated DPS (damage / fireRate) as a quick proxy for raw output. Reviewed AI profile weights for behavioral impact and potential oscillation risks.
- Assumptions: `fireRate` is cooldown seconds (confirmed in `src/game/systems/turrets.ts` and `ships.ts`). DPS approximations ignore accuracy, PD interception, travel time, and range falloff.

## Key Findings

- Point-defense (PD) turrets are high-DPS outliers and can nullify fighter roles quickly.
  - Location: `src/data/ships/turret-factory.ts` (PD defaults) and usages in `src/data/ships/corvette.ts`.
- Medium hulls (corvette, frigate) bundle turrets that yield large combined sustained DPS (often 35–60 raw DPS), which together with PD can produce very short TTKs.
  - Locations: `src/data/ships/corvette.ts`, `src/data/ships/frigate.ts`.
- Destroyers/carriers have significant turret counts and raw output; shields and regen are tuned high to compensate but tuning must consider sustained DPS vs burst.
  - Locations: `src/data/ships/destroyer.ts`, `src/data/ships/carrier.ts`.
- Torpedo/aoe risk: torpedoes use `aoeRadius` (e.g., 12) and high damage values (e.g., 42), producing multi-kill potential for clustered fleets.
  - Location: `src/config/projectiles.ts` (torpedo config), `turret-factory.ts` (torpedo damage values).
- Damage-type system (ion/plasma/kinetic/explosive) is a powerful lever but can create RPS extremes (e.g., carriers with ion dominating shielded fleets).
  - Location: `src/config/progression.ts` (DAMAGE_EFFECTIVENESS, HULL_DAMAGE_TYPES).
- AI profiles: `brawler` is high aggression (0.9) + low patience (0.3) with narrow `desiredRange` which may cause approach/retreat oscillation in some scenarios; smoothing and hysteresis exist but profile extremes still produce chattering risk.
  - Location: `src/game/aiProfiles.ts`, `src/game/systems/decision/intents.ts`.

## Quantitative Examples (approximate raw DPS)

- Fighter (hull): primary ≈ 8 / 0.9 ≈ 8.9 DPS; turret cluster ≈ 26/4.5 + 11/1.8 ≈ 11.9 DPS → combined ≈ 20.8 DPS.
  - File: `src/data/ships/fighter.ts`
- Corvette: primary ≈ 12/1.2 = 10 DPS; turrets ≈ ~37.4 DPS → combined ≈ 47.4 DPS.
  - File: `src/data/ships/corvette.ts`
- Frigate: combined ~59 DPS (primary + turrets).
  - File: `src/data/ships/frigate.ts`
- Destroyer: turret cluster ≈ 80–110 DPS (worst-case), primary ~16.7 DPS; large shields/regen offset this.
  - File: `src/data/ships/destroyer.ts`

> Note: these are raw per-second output estimates before PD, accuracy, projectile travel and AI selection logic.

## Balance Issues & Risks

- PD Overpowering: PD DPS can make fighters ineffective unless massed or supported by tactics (e.g., flanking, torpedoes). This reduces role viability for light craft.
- Burst/TTK Compression: stacked turrets on corvettes/frigates produce short TTKs, reducing tactical depth and increasing RNG impact (who shoots first).
- Torpedo AoE: high AOE radius combined with high damage creates outsized multi-kill potential in clustered fights.
- AI-induced oscillation: aggressive profiles with low patience + narrow desiredRange cause approach/retreat cycles; combined with high steering gains, this can appear as jitter.
- Damage-type cliffs: explicit effectiveness multipliers give powerful counters (ion vs shields, plasma vs armor) — useful for counterplay but may cause balance swings.

## Actionable Tuning Suggestions (safe, high-impact)

1. Point-Defense (PD)
   - Change: reduce PD raw DPS. Two conservative options:
     - Option A (preferred): increase PD `fireRate` from `0.35` → `0.55` (reduces DPS from ~14.3 → ~9.1). File: `src/data/ships/turret-factory.ts` (`createPointDefenseTurret`).
     - Option B: reduce PD `damage` 4 → 3 (reduces DPS proportionally).
   - Expected impact: Fighters survive longer and PD is still effective without being dominant.

2. Torpedo AOE
   - Change: reduce `aoeRadius` from `12` → `8` in `src/config/projectiles.ts` (or reduce torpedo damage from 42→36 in `turret-factory.ts`).
   - Expected impact: Less catastrophic multi-kills for clustered fleets, encourages skillful use of torps.

3. Corvette missile tuning
   - Change: reduce missile `damage` 18 → 14 or increase `fireRate` 2.6 → 3.2. File: `src/data/ships/corvette.ts` or `turret-factory.ts` if overriding.
   - Expected impact: Smoother bursts, fewer insta-wipes.

4. Destroyer shield/regen balance
   - Change: slightly lower `shieldRegen` (e.g., 24 → 18) if destroyers feel unassailable in long fights. File: `src/data/ships/destroyer.ts`.
   - Expected impact: Reduce indefinite sustain against equal forces.

5. AI profile smoothing
   - Change: `brawler.aggression` 0.9 → 0.8 or `brawler.patience` 0.3 → 0.4, test change in harness. File: `src/game/aiProfiles.ts`.
   - Expected impact: Reduce intent-churn and heading/thrust oscillations.

6. Leveling / Fire rate caps
   - Observation: `progression` allows small fireRate bonuses per level. Verify `fireRate` bonuses are normalized and capped to avoid trivializing owner-level DPS.
   - Files: `src/config/progression.ts`, `src/game/progression/leveling.ts`.

## Testing & Metrics Plan (use harness)

Use the existing deterministic harness (`test/support/aiScenarioHarness.ts`) to build an automated validation suite before and after tuning. Suggested scenarios:

- Scenario A: 1 Fighter vs 1 Corvette (measure TTK, timeToFirstShot, shots-to-kill)
- Scenario B: 3 Fighters vs 1 Corvette (measure multi-target dynamics, PD effectiveness)
- Scenario C: 1 Destroyer vs 4 Corvettes (sustained DPS vs shields + regen)
- Scenario D: Carrier + fighters vs mixed (test ion/shield interactions)
- Scenario E: Torpedo salvo on clustered formation (measure multi-kill probability)

Metrics to collect (via harness `collectTestMetrics`):

- TTK median/p90, timeToFirstShot, timeToFirstKill
- Total damage by source (turret vs hull vs torpedo)
- Shield→Hull transition time
- Subsystem-hit frequency (if tracked)
- VerticalDispersion and HeadingAmplitude (to detect oscillation)

Run each scenario across a set of deterministic seeds (e.g., 100–500) and compare before/after tuning. Record KPIs and iterate.

## Where to change code (quick map)

- Ship stats / turrets: `src/data/ships/*.ts` and `src/data/ships/turret-factory.ts`
- Projectile: `src/config/projectiles.ts` (AOE, arming time, homing)
- Progression & damage multipliers: `src/config/progression.ts`, `src/game/progression.ts`
- AI profiles + flags: `src/game/aiProfiles.ts`, `src/game/config.ts` (feature flags, smoothing)
- Combat math: `src/game/combat/damage.ts` (damage distribution & armor absorb)
- Scenario testing: `test/support/aiScenarioHarness.ts`, `test/vitest/ai-scenario-harness.spec.ts`

## Recommended quick PR (small, conservative)

- Make the PD tweak and torpedo AOE tweak only. Example commit message:

```
refactor: moderate PD and torpedo impact

- Increase PD cooldown (or reduce PD damage) to reduce overbearing PD DPS
- Reduce torpedo AOE radius from 12 -> 8 to lower multi-kill risk
- Add harness scenario to verify 1v1 and cluster outcomes
```

## Next Steps (pick one)

- A) I can open a safe PR with the conservative numeric changes above (PD + torpedo AOE + small AI patience change) and include harness tests and metrics. (Low risk; fast to iterate.)
- B) I can run the deterministic harness scenarios now and produce baseline KPIs for the current v2.0.4 values (recommended before PR). This will take a set of harness runs and summary output.
- C) I can produce a compact playbook `docs/gamebalance-playbook.md` listing tuning knobs and expected impacts for rapid tuning by designers.

---

If you want me to proceed, tell me which next step (A/B/C). I can then either open the PR with changes or run harness simulations and produce KPI artifacts. I recommend option B (gather baseline metrics) before applying numeric changes so we can measure impact precisely.
