# Game Balance Report (current)

Date: 2026-10-13

This is the canonical, code-grounded balance snapshot for SpaceAutoBattler. It
supersedes the versioned reports in `docs/gamebalance-report-*.md`, which were
written against earlier code and contain stale or estimated figures. Nothing in
this document is a gameplay change: it is a read-only analysis of the current
source.

## Scope, method & model

- **Scope**: Raw offensive and defensive stats for the five player hulls
  (`fighter`, `corvette`, `frigate`, `destroyer`, `carrier`), their turret
  loadouts, damage-type effectiveness, progression scaling, and the AI profiles
  that shape engagement.
- **Method**: Read the ship definitions and the turret factory, summed
  `damage / fireRate` per weapon, and cross-checked the derived DPS against the
  systems that actually fire. Every figure below cites the source symbol it
  comes from so a reader can re-derive it.
- **Sources inspected** (branch `docs/game-balance-report-183`, commit
  `32fe973080b2f026f75e2a365c740c8774c1194e`):
  - `src/data/ships/fighter.ts`, `corvette.ts`, `frigate.ts`, `destroyer.ts`,
    `carrier.ts`
  - `src/data/ships/turret-factory.ts`
  - `src/config/progression.ts` (`DAMAGE_EFFECTIVENESS`, `LEVEL_BONUSES`,
    `XP_CONFIG`)
  - `src/config/projectiles.ts` (`PROJECTILE_CONFIG`)
  - `src/game/aiProfiles.ts` (`AI_PROFILES.brawler`)
  - `src/game/config/aiConfig.ts` (`AI_CONFIG`)
  - `src/game/systems/turrets.ts`, `src/game/systems/shipControl/weapons.ts`,
    `src/game/progression/leveling.ts` (fire-rate semantics and progression)
  - `test/support/aiScenarioHarness.ts` (validation plan)

### Model and assumptions (upper-bound proxy)

- **DPS = `damage / fireRate`, where `fireRate` is a cooldown in seconds.**
  Confirmed in code, not assumed: the primary weapon sets
  `ship.ship.cooldown = ship.ship.fireRate` after firing
  (`src/game/systems/shipControl/weapons.ts:41`), and each turret sets
  `t.turret.cooldown = t.turret.fireRate` (`src/game/systems/turrets.ts:132`).
- These DPS values are **upper-bound raw values** assuming perfect uptime. They
  deliberately **ignore** firing arcs (`minYaw`/`maxYaw`/`minPitch`/`maxPitch`),
  accuracy, projectile travel time, homing misses, point-defense interception,
  range falloff, target acquisition latency, and cooldown randomization at spawn
  (`spec.fireRate * rng.next()`).
- **TTK proxy = durability / total raw DPS** is directional only. It assumes one
  attacker at perfect uptime, no shield regen during the engagement, no damage
  type modifiers, and no repair. It is a comparison aid, not a predicted
  time-to-kill.
- Damage-type effectiveness and progression bonuses are **not** folded into the
  roster table (they are treated separately in their own sections).

## Fleet roster snapshot

One row per hull. Primary DPS is the hull's main weapon; turret DPS is split by
`priority` (the targeting role the turret uses in
`src/game/systems/turrets.ts:54-93`). Values are rounded to two decimals; totals
are computed from unrounded components.

| Hull      | maxHp | maxShield | Regen | Speed | Primary DPS | antiFighter | antiCapital | antiProjectile | any   | Total raw DPS | Durability | TTK proxy |
| --------- | ----- | --------- | ----- | ----- | ----------- | ----------- | ----------- | -------------- | ----- | ------------- | ---------- | --------- |
| Fighter   | 40    | 43        | 7.0   | 90    | 8.89        | 6.11        | 5.78        | 0.00           | 0.00  | 20.78         | 83         | 4.00      |
| Corvette  | 75    | 104       | 11.5  | 15    | 10.00       | 19.00       | 0.00        | 11.43          | 6.92  | 47.35         | 179        | 3.78      |
| Frigate   | 120   | 123       | 12.0  | 12    | 10.67       | 13.94       | 0.00        | 14.29          | 20.48 | 59.37         | 243        | 4.09      |
| Destroyer | 250   | 433       | 24.0  | 10    | 16.67       | 40.00       | 31.09       | 0.00           | 15.71 | 103.47        | 683        | 6.60      |
| Carrier   | 320   | 255       | 13.0  | 7     | 12.73       | 31.20       | 13.85       | 0.00           | 8.46  | 66.23         | 575        | 8.68      |

Derivation notes (all `damage / fireRate`):

- **Fighter** (`src/data/ships/fighter.ts`): primary `8 / 0.9 = 8.89`;
  torpedo `26 / 4.5 = 5.78` (antiCapital); beam `11 / 1.8 = 6.11`
  (antiFighter). Durability `40 + 43 = 83`.
- **Corvette** (`src/data/ships/corvette.ts`): primary `12 / 1.2 = 10.00`;
  2× laser `2 × 6 / 1.0 = 12.00` plus beam `14 / 2.0 = 7.00` = `19.00`
  antiFighter; PD `4 / 0.35 = 11.43` antiProjectile; missile
  `18 / 2.6 = 6.92` any. Durability `75 + 104 = 179`.
- **Frigate** (`src/data/ships/frigate.ts`): primary `16 / 1.5 = 10.67`;
  laser `8 / 1.2 = 6.67` plus beam `16 / 2.2 = 7.27` = `13.94` antiFighter;
  PD `5 / 0.35 = 14.29` antiProjectile; 2× plasma `2 × 8 / 1.2 = 13.33` plus
  missile `20 / 2.8 = 7.14` = `20.48` any. Durability `120 + 123 = 243`.
- **Destroyer** (`src/data/ships/destroyer.ts`): primary `30 / 1.8 = 16.67`;
  6× laser (`2 × 10 / 1.6` + `4 × 10 / 2.0` = `32.50`) plus beam
  `18 / 2.4 = 7.50` = `40.00` antiFighter; 2× heavy `2 × 10 / 1.4 = 14.29`
  plus 2× torpedo `2 × 42 / 5.0 = 16.80` = `31.09` antiCapital; 2× missile
  `2 × 22 / 2.8 = 15.71` any. Durability `250 + 433 = 683`.
- **Carrier** (`src/data/ships/carrier.ts`): primary `28 / 2.2 = 12.73`;
  4× laser `4 × 9 / 1.5 = 24.00` plus beam `18 / 2.5 = 7.20` = `31.20`
  antiFighter; 2× ion `2 × 9 / 1.3 = 13.85` antiCapital; missile
  `22 / 2.6 = 8.46` any. Durability `320 + 255 = 575`.

## Weapon / turret inventory

Defaults come from `src/data/ships/turret-factory.ts`; the last column flags
where a hull overrides those defaults (an override can change `damage`,
`fireRate`, or `range`). `projectileCategory` is either set explicitly by the
factory or derived from `PROJECTILE_CONFIG[bulletType].category` in
`src/config/projectiles.ts`.

| Factory function           | damage | fireRate | DPS   | range | bulletType         | category | priority       | Per-hull overrides                                                                             |
| -------------------------- | ------ | -------- | ----- | ----- | ------------------ | -------- | -------------- | ---------------------------------------------------------------------------------------------- |
| `createPlasmaTurret`       | 8      | 1.2      | 6.67  | 260   | `bullet:plasma`    | bullet   | any            | none (frigate uses defaults)                                                                   |
| `createLaserTurret`        | 8      | 1.2      | 6.67  | 260   | `bullet:laser`     | bullet   | antiFighter    | corvette `6/1.0`; destroyer `10/1.6` (×2) and `10/2.0` (×4); carrier `9/1.5`                   |
| `createPointDefenseTurret` | 5      | 0.35     | 14.29 | 280   | `bullet:laser`     | bullet   | antiProjectile | corvette `damage: 4` (fireRate stays at factory `0.35`)                                        |
| `createMissileTurret`      | 20     | 2.8      | 7.14  | 560   | `missile:light`    | missile  | any            | corvette `18/2.6`; destroyer `22` (fireRate stays `2.8`); carrier `22/2.6`                     |
| `createBeamTurret`         | 16     | 2.2      | 7.27  | 320   | `beam:laser`       | beam     | antiFighter    | fighter `11/1.8`; corvette `14/2.0`; destroyer `18/2.4`; carrier `18/2.5`                      |
| `createIonTurret`          | 9      | 1.3      | 6.92  | 460   | `bullet:ion`       | bullet   | antiCapital    | none (carrier uses defaults)                                                                   |
| `createHeavyTurret`        | 10     | 1.4      | 7.14  | 580   | `bullet:plasma`    | bullet   | antiCapital    | none (destroyer uses defaults)                                                                 |
| `createTorpedoTurret`      | 42     | 5.0      | 8.40  | 680   | `torpedo:standard` | torpedo  | antiCapital    | fighter torpedo is defined inline in `fighter.ts`, not via this factory: `26/4.5`, range `380` |

Two structural notes:

- Only `createPointDefenseTurret` sets `priority: 'antiProjectile'`; all other
  factories use `any`, `antiFighter`, or `antiCapital`. This is what makes PD
  the only weapon that fires at projectiles (`src/game/systems/turrets.ts:54-61`).
- The fighter torpedo bypasses the factory (`src/data/ships/fighter.ts:20-34`),
  so the factory default of `42/5.0` does **not** apply to the fighter.

## Damage-type effectiveness & progression scaling

### Damage-type effectiveness matrix

From `DAMAGE_EFFECTIVENESS` in `src/config/progression.ts:44-49` (multiplier
applied to hull / shield / armor):

| Damage type | hull | shield | armor |
| ----------- | ---- | ------ | ----- |
| kinetic     | 1.0  | 0.8    | 1.2   |
| plasma      | 1.1  | 0.9    | 1.3   |
| ion         | 0.7  | 1.4    | 0.9   |
| explosive   | 1.2  | 0.6    | 1.1   |

Hull default damage types come from `HULL_DAMAGE_TYPES`
(`src/config/progression.ts:147-153`): fighter/corvette kinetic, frigate/
destroyer plasma, carrier ion. Explosive is defined but not assigned to any
player hull's primary; it is used by torpedo/explosive effects.

### Level bonuses

From `LEVEL_BONUSES` in `src/config/progression.ts:31-38`:

- `damage`: `+3%` per level, cap `+30%` (`maxLevel: 10`).
- `fireRate`: `+2%` per level, cap `+15%` (`maxLevel: 8`).
- `hull`: `+5%`/level, cap `+50%`; `shield`: `+5%`/level, cap `+50%`;
  `shieldRegen`: `+4%`/level, cap `+40%`.

XP curve from `XP_CONFIG` (`src/config/progression.ts:16-25`):
`damageXpMultiplier 0.5`, `killXpMultiplier 0.5`, `baseXp 100`,
`xpExponent 1.8`; XP for a level is `floor(100 * (level - 1)^1.8)`.

### Combined max-level DPS amplification (measured, with a caveat)

This is the one place where the **intent in the config comments** and the
**behaviour in code** diverge, so both are stated explicitly:

- **Nominal (config-comment reading)**: damage `×1.30` and fire rate `×1.15` →
  primary DPS `×1.495` (**~+50%**). This is the figure the older reports quoted.
- **Code-observed**: `applyLevelUpBonuses` applies the fire-rate bonus
  multiplicatively to `ship.fireRate` via `applyStatBonus`
  (`src/game/progression/leveling.ts:93`). Because `ship.fireRate` is a
  **cooldown** (`src/game/systems/shipControl/weapons.ts:41`), multiplying it by
  `1.15` **lengthens** the primary cooldown. So the primary-weapon DPS multiplier
  is `1.30 / 1.15 ≈ ×1.130` (**+13.0%**), not `×1.495`.
- **Turrets do not scale with level at all.** `applyLevelUpBonuses` only mutates
  the ship's own `damage`, `fireRate`, `maxHp`, `maxShield`, `shieldRegen`, and
  subsystem `repairRate`; turret specs are copied once at spawn
  (`src/game/turretFactory.ts:41-58`) and never re-scaled.

Because turret DPS dominates each hull's raw output, the whole-hull raw-DPS
multiplier at max level is far below the nominal ~+50%:

| Hull      | Primary ×1.130 | Turrets (unchanged) | Total raw DPS multiplier |
| --------- | -------------- | ------------------- | ------------------------ |
| Fighter   | 8.89 → 10.05   | 11.89               | ×1.056                   |
| Corvette  | 10.00 → 11.30  | 37.35               | ×1.028                   |
| Frigate   | 10.67 → 12.06  | 48.70               | ×1.023                   |
| Destroyer | 16.67 → 18.84  | 86.80               | ×1.021                   |
| Carrier   | 12.73 → 14.39  | 53.51               | ×1.025                   |

Durability does scale as advertised at max level: `maxHp ×1.50`,
`maxShield ×1.50`, `shieldRegen ×1.40`.

## Findings & levers (ranked)

Each finding gives the source symbol/line, the observed value, the risk, and the
lever to turn. **No lever below is applied in this task** — they are proposals
for a separate, human-approved balance pass.

### 1. Point-defense dominance (high)

- **Source**: `createPointDefenseTurret` (`src/data/ships/turret-factory.ts:43-61`);
  frigate loadout `src/data/ships/frigate.ts:63`; corvette override
  `src/data/ships/corvette.ts:77-82`.
- **Observed**: factory PD `5 / 0.35 ≈ 14.29` raw DPS at `range 280`, which is
  **higher than the frigate's own primary** (10.67) and its plasma turret DPS
  (6.67). The corvette's PD override (`damage: 4`) still yields `11.43`, close
  to its `12.00` twin-laser output. PD is the only `antiProjectile` turret
  (`src/game/systems/turrets.ts:54`), so it both out-DPSes primaries and
  intercepts incoming fire.
- **Risk**: Fighters (total 20.78) face a single PD turret worth ~14.29 DPS that
  also shoots down their torpedoes. PD double-dips offense and defense, which
  narrows composition variety toward massed fighter swarms.
- **Lever**: raise `createPointDefenseTurret.fireRate` (e.g. `0.35 → 0.45`) or
  lower its `damage`; keep the `antiProjectile` role intact.

### 2. Torpedo AOE multi-kill (medium)

- **Source**: `'torpedo:standard'` `aoeRadius: 12`
  (`src/config/projectiles.ts:84-93`, radius on line 92); destroyer torpedo
  `damage: 42` (`src/data/ships/turret-factory.ts:142`); fighter torpedo
  `damage: 26` (`src/data/ships/fighter.ts:23`).
- **Observed**: a `12`-unit AOE radius combined with 42 damage (destroyer) or 26
  damage (fighter) hits every hull inside the blast. A fighter has 40 HP, so a
  single destroyer torpedo can destroy clustered light hulls outright.
- **Risk**: Clustered formations suffer disproportionate losses, incentivising
  degenerate over-spacing rather than tactical positioning, and producing
  "one-shot" outcomes that read as unfair.
- **Lever**: reduce `aoeRadius` (e.g. `12 → 8`) and/or torpedo `damage`; both
  are single constants in the cited files.

### 3. Destroyer raw DPS + shield sustain (medium)

- **Source**: `src/data/ships/destroyer.ts:15-16` (`maxShield: 433`,
  `shieldRegen: 24.0`); turret cluster `src/data/ships/destroyer.ts:59-139`.
- **Observed**: destroyer total raw DPS is **103.47** — more than double any
  other hull — with `683` durability. Its `24.0` shield regen equals 24 HP/s,
  so an attacker must sustain >24 DPS just to keep shields from recovering, and
  the destroyer's own output is 4× that.
- **Risk**: Destroyers can out-sustain and out-damage equal or smaller forces,
  producing stalemates or one-sided fights. The large raw-DPS lead also makes
  destroyer-heavy compositions dominant.
- **Lever**: lower `shieldRegen` (e.g. `24.0 → 18.0`) to let massed smaller hulls
  break through; revisit the 6-laser cluster if raw output is the target.

### 4. Missile burst (medium)

- **Source**: `createMissileTurret` default `20 / 2.8`
  (`src/data/ships/turret-factory.ts:69-70`); corvette override `18 / 2.6`
  (`src/data/ships/corvette.ts:84-85`); carrier override `22 / 2.6`
  (`src/data/ships/carrier.ts:100-101`).
- **Observed**: missile DPS is modest (6.92–8.46), but each shot is a single
  18–22 damage packet with homing (`missile:light`, `src/config/projectiles.ts:75-83`)
  and `armingTime: 1.2`. Corvette and carrier missiles fire on a 2.6s cooldown.
- **Risk**: A 22-damage homing packet is a large fraction of a fighter's 83
  durability, so missile volleys create burst spikes that can strip shields or
  kill light hulls before counter-play, compressing the decision window.
- **Lever**: lower missile `damage` (e.g. 20 → 16) or lengthen `fireRate`
  (2.8 → 3.2); the corvette/carrier overrides are the highest-value targets.

### 5. AI brawler oscillation (low-medium)

- **Source**: `AI_PROFILES.brawler` (`src/game/aiProfiles.ts:165-184`):
  `desiredRange: [120, 220]`, `aggression: 0.9`, `patience: 0.3`.
  Opening-salvo boost: `openingSalvoDuration: 30`,
  `openingSalvoAggressionBoost: 1.2` (`src/game/config/aiConfig.ts:95-96`).
- **Observed**: the highest aggression (0.9) paired with the lowest patience
  (0.3) of any profile, applied to a narrow 100-unit standoff band, and further
  amplified by the 1.2× opening-salvo aggression boost for the first 30 seconds.
  `brawler` is the default profile for corvette and frigate
  (`src/game/aiProfiles.ts:263-269`). The module's own header documents this
  exact combination as an oscillation recipe (`src/game/aiProfiles.ts:131-135`).
- **Risk**: approach/retreat cycling ("bobbing") and heading oscillation reduce
  combat feel and can make ships disengage unintentionally.
- **Lever**: reduce `aggression` (0.9 → 0.75–0.8) or raise `patience`
  (0.3 → 0.4–0.45); validate with the harness before shipping.

### 6. Progression amplification (low, but see caveat)

- **Source**: `LEVEL_BONUSES` (`src/config/progression.ts:31-38`);
  `applyLevelUpBonuses` (`src/game/progression/leveling.ts:59-106`).
- **Observed**: max-level bonuses are `damage +30%`, `fireRate +15%`,
  `hull/shield +50%`, `shieldRegen +40%`. In code the `fireRate` bonus lengthens
  the primary cooldown, so primary DPS rises only `×1.130`; turrets do not scale
  at all, so whole-hull raw DPS rises only `×1.02–1.06` (see the table above).
- **Risk**: because the advertised ~+50% DPS amplification does **not** actually
  occur, the balance risk is lower than older reports claimed. The real risk is
  the opposite: a level-10 ship gains ~+50% durability but almost no offensive
  scaling, which can make high-level fights slower and grindier.
- **Lever**: this is a design decision, not a simple number. If offensive
  scaling is intended, either fix the `fireRate` bonus to divide the cooldown
  (rather than multiply it) or move the scaling onto turret specs.

## Drift vs `docs/gamebalance-report-v2.0.5g.md`

The v2.0.5g report is dated 2025-12-21 and used estimates for several hulls. Key
differences from the current source:

| Item                          | v2.0.5g (stale)                  | Current source                                                              |
| ----------------------------- | -------------------------------- | --------------------------------------------------------------------------- |
| Corvette missile              | `20 / 2.8 ≈ 7.1`                 | `18 / 2.6 = 6.92` (`src/data/ships/corvette.ts:84-85`)                      |
| Corvette beam                 | `16 / 2.2 ≈ 7.3`                 | `14 / 2.0 = 7.00` (`src/data/ships/corvette.ts:91-95`)                      |
| Corvette combined DPS         | ~47.8                            | 47.35 (exact, all turrets counted)                                          |
| Destroyer combined DPS        | "~75-85 (conservative estimate)" | 103.47 (exact; 6 lasers + 2 torpedoes + 2 missiles + beam + primary)        |
| Destroyer torpedo DPS         | ~8.4 (single turret)             | 16.80 (two torpedo turrets, `src/data/ships/destroyer.ts:118-119`)          |
| Carrier combined DPS          | "~60-70"                         | 66.23 (exact)                                                               |
| Carrier missile               | "22 dmg @ ~3.0s cooldown"        | `22 / 2.6 = 8.46` (`src/data/ships/carrier.ts:100-101`)                     |
| Progression DPS amplification | "~50% at max level"              | Primary `×1.130`; whole-hull `×1.02-1.06` (turrets unscaled, `leveling.ts`) |
| Report date / basis           | 2025-12-21, partly estimated     | 2026-10-13, fully code-derived                                              |

Unchanged from v2.0.5g: torpedo `aoeRadius: 12`, PD `fireRate: 0.35`, destroyer
`shieldRegen: 24.0`, and `brawler` `aggression: 0.9` / `patience: 0.3`.

## Deterministic validation plan (proposed — not implemented here)

These are **proposed validation runs, not implemented in this task**. The harness
exists at `test/support/aiScenarioHarness.ts` and is deterministic: identical
`seed` + config produce identical decision logs
(`runAIScenario`, lines 101-373; `collectTestMetrics`, exported line 375). Per
the harness docs, use `SeededRng` seeds and reset module-level temp RNGs (the
harness already does this at lines 156-170).

Proposed scenarios (each run across many seeds, e.g. 100-500, and compared
before/after any tuning):

1. **Fighter 1v1 vs corvette** — purpose: quantify PD dominance and fighter
   viability. Metrics: time-to-first-shot, time-to-first-kill, fighter survival
   time, damage dealt before death.
2. **Fighter squad (3v1) vs corvette** — purpose: PD saturation under multiple
   targets. Metrics: fighter losses, corvette shield-depletion time.
3. **Destroyer vs corvette fleet (1v4)** — purpose: destroyer sustain. Metrics:
   shield→hull transition time, corvette losses, engagement duration.
4. **Carrier vs mixed fleet** — purpose: ion vs shield effectiveness. Metrics:
   damage by type, shield-penetration rate.
5. **Torpedo cluster** — purpose: AOE multi-kill. Setup: fighters in tight
   formation against a destroyer. Metrics: casualties per torpedo hit, multi-kill
   rate.
6. **Brawler oscillation probe** — purpose: measure approach/retreat cycling.
   Metrics: heading amplitude and vertical dispersion from the AI blackboard,
   intent-switch frequency for corvette/frigate under `brawler`.

Suggested gates for a future tuning pass (to be confirmed against a captured
baseline, not asserted here): fighter survival improvement >25%, torpedo
multi-kill reduction >30%, destroyer engagement-time reduction >20%, heading
oscillation reduction >15%.

## Related reports & reproduction

Historical reports in `docs/` (superseded by this document; values were derived
from earlier code and should not be quoted as current):

- `docs/gamebalance-report-v0.1.1.md`
- `docs/gamebalance-report-v0.1.3c.md`
- `docs/gamebalance-report-v0.1.4.md`
- `docs/gamebalance-report-v01.4d.md`
- `docs/gamebalance-report-v2.0.3e.md`
- `docs/gamebalance-report-v2.0.3f.md`
- `docs/gamebalance-report-v2.0.4.md`
- `docs/gamebalance-report-v2.0.5g.md`

Also related: `docs/gamebalance-review-v0.1.1.md` (review format, not a
versioned balance report).

### How to reproduce these numbers

1. Read the hull definition, e.g. `src/data/ships/destroyer.ts`. The hull's
   primary weapon is `damage` / `fireRate` on the exported `*_STATS` object.
2. Read the `turrets` array on the same object. For turrets created by
   `src/data/ships/turret-factory.ts`, resolve the factory defaults, then apply
   the inline options passed at the call site (options spread over defaults, so
   inline values win).
3. Sum `turret.damage / turret.fireRate` per turret, grouped by `priority`.
4. Add the primary DPS to the turret sum for total raw DPS.
5. Durability is `maxHp + maxShield`; the TTK proxy is
   `durability / total raw DPS`.

All divisions above treat `fireRate` as a cooldown in seconds, which matches
`src/game/systems/shipControl/weapons.ts:41` (primary) and
`src/game/systems/turrets.ts:132` (turrets).
