## Game Balance Report v01.4d

Generated: 2025-10-13

This report inspects the current `SHIP_STATS` and relevant AI configuration in `src/` to provide an overall game-balance assessment and per-hull ratings. All numbers are taken from `src/data/shipStats.ts`, AI settings from `src/game/config.ts`, and progression hints from `src/config/progression.ts`.

Summary (top-level)

- Overall balance: Moderately well structured around clear roles (fighter skirmisher, corvette anti-fighter, frigate multirole, destroyer capital brawler, carrier support/anchor). Most values are consistent and scale reasonably by hull tier.
- Largest balance risks:
  - Carrier feels underwhelming in raw DPS vs its high survivability (but has utility via fighter launches not accounted for in raw DPS).
  - Destroyer has a high turret count and very high combined DPS — it can dominate mixed fights if not countered by prioritization or armor/damage modifiers.
  - Corvettes have very strong anti-fighter turret DPS which can make fighter swarms less effective in small numbers.
  - AI feature flags (engagement boost, hystereses, elevated tick rate, threat weights) make AI more aggressive and favor focusing high-threat hulls (carrier/destroyer) early — this amplifies the perceived power of capital ships.

Methodology / assumptions

- `fireRate` in `SHIP_STATS` is treated as seconds per shot (cooldown base). DPS = damage / fireRate.
- Ship "main" weapon DPS is computed from `damage` and `fireRate`. Turret DPS is computed per turret (damage/fireRate) and summed.
- Raw durability = maxHp + maxShield (simple combined buffer). This ignores armor/damage type multipliers and subsystem/repair mechanics; durability is a coarse proxy.
- Time-to-kill (TTK) = raw durability / total DPS (seconds) — approximate and optimistic (no evasion, no armor reduction, no allied repair/regen effects). Shield regen will extend real TTK; note shield regen values in each hull.

Key AI settings affecting balance

- AI_CONFIG (selected):
  - engagementBoostEnabled: true (opening salvo aggression multiplier 1.2 for early time window)
  - rangePolicy: 'v0.1.1-exp' (±5% variance applied to weapon ranges)
  - tickRateHz: default experimental value (15Hz) — increases AI responsiveness
  - threatWeights: carrier=6, destroyer=5, frigate=4, corvette=3, fighter=2 (AI prioritizes larger hulls strongly)
  - hysteresisEnabled, smoothingEnabled: true (AI keeps intent bands, reduces flip-flopping)
  - interruptHpDrop: 0.1 (AI will interrupt actions when losing ≥10% HP in one hit)

Computed hull metrics (raw values taken directly from `src/data/shipStats.ts`)

Notes: DPS values rounded to one decimal place. TTK calculated as (maxHp+maxShield)/TotalDPS and also shown approximately.

1. Fighter

- maxHp: 40
- maxShield: 24 (regen 4.0 /s)
- armor: 5
- main weapon: damage 8, fireRate 0.9s → main DPS = 8 / 0.9 ≈ 8.9
- turrets: none
- total DPS ≈ 8.9
- raw durability = 64 → TTK ≈ 64 / 8.9 ≈ 7.2s
- mobility: maxSpeed 40 (very high)
- role: skirmisher / hit-and-run
- Ratings (1–10): DPS 5, Survivability 3, Mobility 9, Overall 6
- Notes: Fighter is light but fast; good as intended. Shield regen is decent relative to HP which helps short survivability.

2. Corvette

- maxHp: 75
- maxShield: 45 (regen 5.0 /s)
- armor: 8
- main weapon: damage 12, fireRate 1.2s → main DPS = 10.0
- turrets: 2 × (damage 6, fireRate 1.0s) → 2 × 6 = 12.0 DPS
- total DPS ≈ 22.0
- raw durability = 120 → TTK ≈ 120 / 22 ≈ 5.5s
- mobility: maxSpeed 15 (medium-low)
- role: anti-fighter / skirmish platform with turrets
- Ratings: DPS 7, Survivability 5, Mobility 4, Overall 7
- Notes: High combined DPS for its durability — particularly dangerous vs fighters because turrets are flagged 'antiFighter'. Consider reducing turret per-turret DPS or range if corvettes are dominating swarms.

3. Frigate

- maxHp: 120
- maxShield: 72 (regen 7.0 /s)
- armor: 12
- main weapon: damage 16, fireRate 1.5s → main DPS ≈ 10.7
- turrets: 3 × (damage 8, fireRate 1.2s) → each ≈ 6.7 DPS → turrets total ≈ 20.0
- total DPS ≈ 30.7
- raw durability = 192 → TTK ≈ 192 / 30.7 ≈ 6.3s
- mobility: maxSpeed 12 (low-medium)
- role: multirole/escorting
- Ratings: DPS 8, Survivability 6, Mobility 3, Overall 7.5
- Notes: Good mid-tier ship balancing DPS and durability. Turret composition gives flexibility: mix of plasma and laser. Watch for stacking of frigates vs destroyers.

4. Destroyer

- maxHp: 250
- maxShield: 180 (regen 10.0 /s)
- armor: 18
- main weapon: damage 30, fireRate 1.8s → main DPS ≈ 16.7
- turrets: 2 × (10 / 1.4) ≈ 14.3; 4 × (10 / 1.6) = 25.0 → turret total ≈ 39.3
- total DPS ≈ 56.0
- raw durability = 430 → TTK ≈ 430 / 56 ≈ 7.7s
- mobility: maxSpeed 10 (slow)
- role: capital ship / brawler / area denial
- Ratings: DPS 9, Survivability 8, Mobility 2, Overall 8.5
- Notes: Extremely high combined DPS. Because threatWeights favor destroyers and they have long range (700) for main guns, they can control engagements. Consider soft-capping turret damage, reducing turret count, or lowering long-range main weapon damage to avoid destroyer-dominant metas.

5. Carrier

- maxHp: 320
- maxShield: 200 (regen 10.0 /s)
- armor: 15
- main weapon: damage 28, fireRate 2.2s → main DPS ≈ 12.7
- turrets: 2 × (9 / 1.3) ≈ 13.85; 2 × (9 / 1.5) = 12.0 → turret total ≈ 25.85
- total DPS ≈ 38.6 (not counting launched fighters or support abilities)
- raw durability = 520 → TTK ≈ 520 / 38.6 ≈ 13.5s
- mobility: maxSpeed 7 (very slow)
- role: anchor/support; launches fighters (launch behavior & fighter DPS not included here)
- Ratings: DPS 6, Survivability 9, Mobility 1, Overall 7.5
- Notes: Carrier's raw gun DPS is modest for its durability — that's acceptable if carriers are intended to be platforms that project power via fighters. If carriers do not reliably project fighter power (or if fighter squadrons are weak against corvettes), carriers will feel underpowered. AI threat weight (6) ensures AI tries to protect/target carriers.

Analysis and balance observations

- DPS scaling vs durability: Destroyer and Frigate sit high on DPS for their tiers, but destroyer's total DPS is very front-loaded (many turrets) making it a potential outlier in mixed fights.
- Fighter vulnerability: In small engagements corvettes and turret-heavy hulls can suppress fighters; fighters require swarm numbers and/or positioning to trade favorably. Consider giving fighters a small damage bonus vs armor or a short burst-fire option.
- Carrier vs fighter interplay: Carrier survivability is high but DPS low — the net value comes from fighters. Verify `CARRIER_LAUNCH_CONFIG` (not inspected here) to ensure carriers can deploy meaningful fighter pressure; if not, carrier will feel like a slow HP sponge.
- AI behavior amplifies perceived capital-ship strength: threat weights and engagement boosts push AI to protect/attack large hulls; combined with increased tick rate and hysteresis this yields more consistent focus fire, which increases TTK consistency for capital ships and reduces randomness.

Short, actionable tuning recommendations

1. Reduce destroyer turret DPS slightly (e.g., -10% per turret damage or drop one anti-fighter turret). Rationale: reduce overbearing area DPS while preserving role.
2. Slightly reduce corvette turret damage or range (e.g., -1 damage per turret or -10% range) to reduce the dominance vs fighters. Rationale: preserve anti-fighter role but allow lone fighters to skirmish.
3. Re-evaluate carrier fighter sortie contribution: if carrier launches are frequent and strong, keep as-is; otherwise increase fighter-launch cadence or give carrier a modest passive bonus (e.g., small turret buff to fighters it launches). Rationale: make carrier feel impactful outside raw gun DPS.
4. Consider reducing destroyer main range from 700 to a slightly lower value (e.g., 620–660) to reduce early-kiting advantage and make positioning more meaningful.
5. Add (or tune) damage type interactions: `DAMAGE_EFFECTIVENESS` already favors ion vs shields and plasma vs armor — ensure these multipliers are respected in runtime damage calculations and communicate them to players.
6. If AI is too aggressive for testing stability, expose a runtime flag or UI toggle to lower `tickRateHz` and/or `engagementBoostEnabled` so designers can iterate on numbers without strong AI amplification.

Suggested follow-ups (tech debt / further validation)

- Run targeted simulation fights (stateless, deterministic: seeded RNG) for 1v1 and fleet compositions (e.g., 5 fighters vs 2 corvettes, 3 frigates vs 1 destroyer, carrier+fighters vs mixed fleet) to collect empirical TTK, kill distribution, and role effectiveness.
- Instrument in-game telemetry for per-hull damage dealt/received, time-to-first-kill, and average engagement range to validate assumptions about turret effectiveness and range-policy impacts.
- Add simple unit tests that calculate and assert expected DPS ranges for each hull so balance changes trigger CI checks (this repo uses Vitest; tests can live under `test/vitest/`).

Appendix: raw numbers

- Fighter: DPS 8.9 | Durability 64 | shieldRegen 4.0 | TTK ≈ 7.2s
- Corvette: DPS 22.0 | Durability 120 | shieldRegen 5.0 | TTK ≈ 5.5s
- Frigate: DPS 30.7 | Durability 192 | shieldRegen 7.0 | TTK ≈ 6.3s
- Destroyer: DPS 56.0 | Durability 430 | shieldRegen 10.0 | TTK ≈ 7.7s
- Carrier: DPS 38.6 | Durability 520 | shieldRegen 10.0 | TTK ≈ 13.5s

End of report.

## Tankiness model — how shield / shieldRegen / armor / HP interact

To make the balance implications more concrete I computed two illustrative engagement profiles and estimated Time-To-Kill (TTK) per hull using the exact damage routing rules in `src/game/progression.ts`:

- Damage routing summary (relevant bits):
  - Shields absorb damage first; incoming damage is scaled by shield effectiveness (damage-type dependent).
  - If shields break, remaining damage is reduced by an absolute armor absorption: armorAbs = min(remainingDamage _ 0.5, armor _ armorEffectiveness).
  - Hull takes the leftover damage; armor is reduced by 10% of the armorAbs amount after the hit.

Assumptions for the quick model below

- Baseline damage-type used: kinetic (armorEffectiveness = 1.2) — this gives a conservative, understandable baseline.
- Two incoming profiles chosen to represent common combat patterns:
  1. Small-fast (swarm): hit = 6 damage, hits/sec = 3 → incoming DPS = 18 (many small shots, typical of fighters/turrets).
  2. Large-slow (salvo): hit = 30 damage, hits/sec = 1 → incoming DPS = 30 (big single shots, typical of capital main batteries).
- For each hull we estimate:
  1. Time to deplete shields using net shield DPS = incoming DPS - shieldRegen (if net positive).
  2. Per-hit armor absorption using armorAbs = min(hit _ 0.5, armor _ 1.2).
  3. Hull DPS after shields = (hit - armorAbs) \* hits/sec. TTK = maxHp / hullDPS_after.
  4. Total TTK ≈ time_to_deplete_shields + time_to_kill_hull.

These are approximate but use the exact math-path used by the game (shield first, then armor cap at 50% of the hit, armor scaled by armorEffectiveness).

Illustrative results (TTK in seconds)

Profile A — Small-fast (hit 6 @ 3/s, incoming DPS 18)

- Fighter: shields 24, regen 4 → shields last ≈ 1.71s; hull takes 3 dmg/hit → hull DPS 9 → TTK ≈ 6.16s
- Corvette: shields 45, regen 5 → shields last ≈ 3.46s; hull DPS 9 → TTK ≈ 11.79s
- Frigate: shields 72, regen 7 → shields last ≈ 6.55s; hull DPS 9 → TTK ≈ 19.88s
- Destroyer: shields 180, regen 10 → shields last ≈ 22.5s; hull DPS 9 → TTK ≈ 50.28s
- Carrier: shields 200, regen 10 → shields last ≈ 25s; hull DPS 9 → TTK ≈ 60.56s

Profile B — Large-slow (hit 30 @ 1/s, incoming DPS 30)

- Fighter: shields 24, regen 4 → shields last ≈ 0.92s; armorAbs ≈ 6 → hullDamage 24 → TTK ≈ 2.59s
- Corvette: shields 45, regen 5 → shields last ≈ 1.80s; armorAbs ≈ 9.6 → hullDamage 20.4 → TTK ≈ 5.48s
- Frigate: shields 72, regen 7 → shields last ≈ 3.13s; armorAbs ≈ 14.4 → hullDamage 15.6 → TTK ≈ 10.82s
- Destroyer: shields 180, regen 10 → shields last ≈ 9.00s; armorAbs ≈ 15 (cap) → hullDamage 15 → TTK ≈ 25.67s
- Carrier: shields 200, regen 10 → shields last ≈ 10.00s; armorAbs ≈ 15 (cap) → hullDamage 15 → TTK ≈ 31.33s

What these numbers tell us (takeaways)

- Shield & regen dominate against sustained small-fire profiles. Destroyers and carriers (very large shield pools + high regen) become very tanky against many small hits because net shield drain is low; shields buy a lot of time.
- Armor shines more vs larger hits. Because armor absorption is capped at 50% of an incoming hit, very large hits still penetrate heavily but armor (if sufficiently large) can soak a significant absolute chunk — lowering hull DPS after shields collapse.
- Armor is consumable: heavy sustained hits degrade armor over time (10% of armorAbs per hit). In protracted fights a ship's armor pool will fall and its effective tankiness will drop — the current model supports sustained-power counters.
- Example implication: corvettes/frigates will be much more durable against small, high-rate fire than naive raw-DPS/HP numbers suggest; destroyers/carriers can often shrug off fighter spam for long durations due to shield pools & regen.

Practical tuning levers

- To reduce destroyer/carrier dominance vs swarm: lower shieldRegen or total shield pool; alternatively increase DPS of anti-capital weapons or increase turret focus penalty so that many small weapons can chew shields faster.
- To make armor more (or less) meaningful: change armorEffectiveness multipliers per damage type, or change armor depletion factor (currently 10% of absorbed damage per hit).
- To make fighters more viable vs turreted corvettes: increase fighter alpha (burst) damage, increase projectile speed/accuracy, or add abilities that bypass some turret soak (e.g., short EMP vs shields).

Model caveats and suggested next steps

- This is a compact, analytical model. It ignores hit variance, accuracy, projectile travel time, subsystem interactions, captain modifiers, and damage-type diversity in actual fights.
- Next steps to validate and lock tuning:
  - Run deterministic sims with the real projectile and AI code (seeded RNG) for the profiles above and measure empirical TTK and damage distribution.
  - Instrument live telemetry of shield uptime, armor depletion, and per-hit damage to verify the approximate model.
