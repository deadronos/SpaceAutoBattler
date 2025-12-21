# Game Balance Report v2.0.5g

Date: 2025-12-21

## Summary

- **Balance Rating:** 6.5 / 10 — The combat systems demonstrate coherent design and improved tuning over v2.0.4, with point-defense values adjusted and torpedo configurations refined. However, several hotspots remain that risk brittle encounters: PD still shows high DPS potential, missile damage on corvettes creates burst damage spikes, and destroyer turret clusters produce very high sustained DPS. The systems are tunable and well-structured; I recommend targeted conservative adjustments plus deterministic scenario validation to quantify improvements.

## Scope & Method

- **Inspected**: `src/data/ships/*`, `src/data/ships/turret-factory.ts`, `src/config/*` (projectiles, progression, AI), `src/game/*` (AI profiles, systems).
- **Method**: Analyzed stat values (hp, shield, shieldRegen, damage, fireRate, projectileSpeed, range, turret specs) and calculated approximate DPS (damage / fireRate) as a proxy for raw output. Reviewed AI profile weights for behavioral impact and oscillation risks. Examined damage type effectiveness matrix and progression scaling.
- **Assumptions**: `fireRate` represents cooldown in seconds (confirmed in `src/game/systems/turrets.ts` and ship definitions). DPS approximations ignore accuracy, point-defense interception, projectile travel time, and range falloff.

## Key Findings

### Ship Balance Overview

#### Fighter
- **Stats**: 40 HP, 43 shield, 7.0 regen
- **Primary weapon**: 8 damage @ 0.9s = ~8.9 DPS (bullet:laser)
- **Turrets**:
  - Torpedo: 26 damage @ 4.5s = ~5.8 DPS (torpedo:standard, 12 AOE)
  - Beam: 11 damage @ 1.8s = ~6.1 DPS (beam:laser)
- **Combined DPS**: ~20.8 raw DPS
- **Assessment**: Light and fast, but vulnerable to PD. Torpedo provides anti-capital punch but slow fire rate limits sustained damage.

#### Corvette
- **Stats**: 75 HP, 104 shield, 11.5 regen
- **Primary weapon**: 12 damage @ 1.2s = 10.0 DPS (bullet:plasma)
- **Turrets**:
  - 2x Laser (6 dmg @ 1.0s): 12.0 DPS
  - PD (4 dmg @ 0.35s): ~11.4 DPS
  - Missile (20 dmg @ 2.8s): ~7.1 DPS
  - Beam (16 dmg @ 2.2s): ~7.3 DPS
- **Combined DPS**: ~47.8 raw DPS
- **Assessment**: Strong mid-tier hull with high burst potential from missiles. PD provides good fighter defense but at high DPS cost.

#### Frigate
- **Stats**: 120 HP, 123 shield, 12.0 regen
- **Primary weapon**: 16 damage @ 1.5s = ~10.7 DPS (bullet:plasma)
- **Turrets**:
  - 2x Plasma (8 dmg @ 1.2s): ~13.3 DPS
  - Laser (8 dmg @ 1.2s): ~6.7 DPS
  - PD (5 dmg @ 0.35s): ~14.3 DPS
  - Missile (20 dmg @ 2.8s): ~7.1 DPS
  - Beam (16 dmg @ 2.2s): ~7.3 DPS
- **Combined DPS**: ~59.4 raw DPS
- **Assessment**: High sustained DPS with excellent anti-fighter capability. PD at factory defaults (5 dmg @ 0.35s) is a high-DPS outlier.

#### Destroyer
- **Stats**: 250 HP, 433 shield, 24.0 regen
- **Primary weapon**: 30 damage @ 1.8s = ~16.7 DPS (bullet:heavy)
- **Turrets**:
  - 2x Heavy (10 dmg @ 1.4s): ~14.3 DPS
  - Multiple Laser turrets (varied): ~40-50 DPS estimated
  - Torpedo (42 dmg @ 5.0s): ~8.4 DPS
- **Combined DPS**: ~75-85 raw DPS (conservative estimate)
- **Assessment**: Capital ship with massive shields and high regen. Turret cluster produces very high sustained damage. Shield regen (24.0) allows prolonged engagements.

#### Carrier
- **Stats**: 320 HP, 255 shield, 13.0 regen
- **Primary weapon**: 28 damage @ 2.2s = ~12.7 DPS (bullet:ion)
- **Turrets**:
  - 2x Ion (9 dmg @ 1.3s): ~13.8 DPS
  - Multiple Laser turrets: ~30-35 DPS estimated
  - Missiles: ~7.1 DPS
- **Combined DPS**: ~60-70 raw DPS
- **Assessment**: High HP, moderate shields. Ion turrets excel vs shields (1.4x effectiveness). Fighter launch capability adds tactical depth.

## Quantitative DPS Analysis

### Point-Defense Assessment
- **Corvette PD**: 4 damage @ 0.35s = ~11.4 DPS
- **Frigate PD**: 5 damage @ 0.35s = ~14.3 DPS
- **Factory default PD**: 5 damage @ 0.35s = ~14.3 DPS

**Issue**: PD turrets remain high-DPS outliers. While slightly reduced from v2.0.4 recommendations, PD still delivers comparable DPS to primary weapons while also intercepting projectiles. This makes fighters ineffective unless massed or tactically supported.

### Torpedo & AOE Analysis
- **Fighter torpedo**: 26 damage @ 4.5s, AOE radius: 12
- **Destroyer torpedo**: 42 damage @ 5.0s, AOE radius: 12
- **Torpedo config**: `aoeRadius: 12` (unchanged from v2.0.4)

**Issue**: AOE radius of 12 combined with high damage creates multi-kill potential in clustered formations. A single destroyer torpedo hit (42 damage + 12 radius) can devastate multiple light hulls.

### Missile Burst Damage
- **Corvette/Frigate missiles**: 20 damage @ 2.8s cooldown
- **Carrier missiles**: 22 damage @ ~3.0s cooldown

**Issue**: While DPS is moderate (~7 DPS), missiles with homing capability and 20+ damage create burst damage spikes that can quickly eliminate shields on smaller hulls.

### Damage Type Effectiveness Matrix
From `src/config/progression.ts`:
```
kinetic:   hull 1.0, shield 0.8, armor 1.2
plasma:    hull 1.1, shield 0.9, armor 1.3
ion:       hull 0.7, shield 1.4, armor 0.9
explosive: hull 1.2, shield 0.6, armor 1.1
```

**Analysis**: 
- Ion turrets (carriers) gain 40% effectiveness vs shields - very strong counter
- Explosive weapons lose 40% effectiveness vs shields - situational
- Plasma and kinetic show moderate differentiation
- System creates clear rock-paper-scissors dynamics but can produce balance cliffs

## Balance Issues & Risks

### 1. Point-Defense Dominance (High Priority)
**Impact**: Fighters become non-viable in 1v1 or small engagements against corvette/frigate with PD.

**Evidence**: 
- Frigate PD alone delivers ~14.3 raw DPS, comparable to the frigate's primary weapon
- Combined with PD's projectile interception role, this creates double value
- Fighter combined DPS (~20.8) is only marginally higher than a single PD turret

**Risk**: Reduces tactical depth and limits composition variety. Fighter swarms become mandatory rather than tactical choice.

### 2. Torpedo AOE Multi-Kill Potential (Medium Priority)
**Impact**: Clustered formations suffer catastrophic losses from single torpedo hits.

**Evidence**:
- AOE radius of 12 with 42 damage (destroyer) can eliminate multiple fighters (40 HP each)
- Encourages degenerate formations (excessive spacing) rather than tactical positioning

**Risk**: Reduces engagement variety and creates "one-shot" scenarios that feel unfair.

### 3. Destroyer Sustainability (Medium Priority)
**Impact**: Destroyers with 433 shields + 24.0 regen can sustain indefinitely against equal or smaller forces.

**Evidence**:
- 24.0 shield regen = 24 HP/s regeneration
- Requires sustained 24+ DPS to prevent shield recovery
- Most single ships cannot penetrate this regen rate

**Risk**: Prolonged stalemates and difficulty balancing destroyer encounters.

### 4. AI Profile Oscillation (Low-Medium Priority)
**Impact**: Brawler profile with high aggression (0.9) and low patience (0.3) creates approach/retreat cycling.

**Evidence** (from `src/game/aiProfiles.ts`):
```javascript
brawler: {
  desiredRange: [120, 220],
  aggression: 0.9,
  patience: 0.3,
  // ...
}
```

**Risk**: Visual "bobbing" and heading oscillations reduce combat feel and can cause ships to disengage unintentionally.

### 5. Burst Damage vs Sustained Balance
**Impact**: High-burst weapons (missiles, torpedoes) combined with high-sustained turrets create TTK compression.

**Evidence**:
- Corvette/frigate can deliver 20 damage missile + sustained turret fire simultaneously
- Time-to-kill (TTK) for fighters becomes very short (2-3 seconds under focused fire)

**Risk**: Reduces tactical decision-making window and increases RNG impact (who shoots first wins).

### 6. Progression Scaling Amplification
**Impact**: Level bonuses multiply existing imbalances.

**Evidence** (from `src/config/progression.ts`):
- Damage: +3% per level (cap +30% at level 10)
- FireRate: +2% per level (cap +15% at level 8)
- Combined effect: ~50% DPS increase at max level

**Risk**: Small balance issues at base stats become major issues at max level. PD dominance at level 10 becomes overwhelming.

## Actionable Tuning Suggestions

### Priority 1: Point-Defense Moderation (Safe, High-Impact)

**Option A (Preferred): Reduce fire rate**
- **Change**: Increase PD `fireRate` from `0.35` → `0.45` to `0.50`
- **File**: `src/data/ships/turret-factory.ts` (`createPointDefenseTurret`)
- **Impact**: Reduces DPS from ~14.3 → ~10-11 DPS while maintaining interception capability
- **Reasoning**: PD remains effective against projectiles but no longer out-DPS's primary weapons

**Option B: Reduce damage**
- **Change**: Reduce PD `damage` from `5` → `4` (or `3`)
- **File**: `src/data/ships/turret-factory.ts` (`createPointDefenseTurret`)
- **Impact**: Proportional DPS reduction
- **Note**: May require per-hull adjustments (corvette already uses 4 damage)

### Priority 2: Torpedo AOE Reduction (Safe, High-Impact)

**Change**: Reduce `aoeRadius` from `12` → `8`
- **File**: `src/config/projectiles.ts` (line 91)
- **Impact**: Reduces multi-kill radius by 33%, requires better positioning
- **Alternative**: Reduce torpedo damage from `42` → `36` in `turret-factory.ts` (line 142)

### Priority 3: Missile Burst Smoothing (Medium-Impact)

**Change**: Reduce corvette/frigate missile damage from `20` → `16` or increase `fireRate` from `2.8` → `3.2`
- **Files**: 
  - `src/data/ships/corvette.ts` (if hull-specific override)
  - `src/data/ships/turret-factory.ts` (`createMissileTurret` defaults)
- **Impact**: Smooths burst damage, reduces instant-kill scenarios
- **Trade-off**: Maintains overall DPS but spreads damage over time

### Priority 4: Destroyer Shield Sustainability (Conservative)

**Change**: Reduce destroyer `shieldRegen` from `24.0` → `18.0` or `20.0`
- **File**: `src/data/ships/destroyer.ts` (line 16)
- **Impact**: Makes destroyer vulnerable to sustained fire, reduces indefinite sustain
- **Reasoning**: 18 HP/s regen still strong but allows massed corvettes to overcome it

### Priority 5: AI Brawler Profile Smoothing (Low-Risk)

**Option A**: Reduce aggression
- **Change**: `brawler.aggression` from `0.9` → `0.75` or `0.8`
- **File**: `src/game/aiProfiles.ts` (line 166)

**Option B**: Increase patience
- **Change**: `brawler.patience` from `0.3` → `0.4` or `0.45`
- **File**: `src/game/aiProfiles.ts` (line 167)

**Impact**: Reduces intent churn and approach/retreat oscillations
**Validation**: Test with deterministic harness scenarios

### Priority 6: Progression Fire Rate Cap Audit

**Review**: Verify fire rate bonuses don't trivialize balance
- **Files**: 
  - `src/config/progression.ts` (line 38: `fireRate: { bonus: 0.02, cap: 0.15 }`)
  - `src/game/progression/leveling.ts`
- **Action**: Ensure +15% fire rate cap doesn't cause PD or burst weapons to become dominant at high levels
- **Recommendation**: Consider reducing cap to 0.10 (10%) if testing shows issues

## Testing & Metrics Plan

### Deterministic Scenario Harness

Use `test/support/aiScenarioHarness.ts` to build automated validation suite. Run scenarios with multiple seeds (100-500) for statistical confidence.

**Suggested Scenarios:**

1. **Fighter vs Corvette (1v1)**
   - **Purpose**: Measure PD effectiveness and fighter viability
   - **Metrics**: TTK, timeToFirstKill, shots-to-kill, fighter survival rate
   - **Target**: Fighters should survive >5 seconds and deal meaningful damage

2. **Fighter Squad vs Corvette (3v1)**
   - **Purpose**: Test multi-target PD saturation
   - **Metrics**: Fighter losses, damage dealt, corvette shield depletion
   - **Target**: At least 1 fighter survives, corvette shields <50%

3. **Destroyer vs Corvette Fleet (1v4)**
   - **Purpose**: Test destroyer shield sustainability
   - **Metrics**: Destroyer shield→hull transition time, corvette losses
   - **Target**: Corvettes should overcome destroyer shields within 30-45 seconds

4. **Carrier vs Mixed Fleet**
   - **Purpose**: Test ion damage effectiveness vs shields
   - **Metrics**: Damage by type, shield penetration rate
   - **Target**: Ion bonus observable but not overwhelming

5. **Torpedo Cluster Test**
   - **Purpose**: Measure AOE multi-kill probability
   - **Setup**: 4 fighters in tight formation, 1 destroyer with torpedoes
   - **Metrics**: Multi-kill rate, average casualties per torpedo
   - **Target**: <2 fighters destroyed per torpedo hit

### Metrics to Collect

Via `collectTestMetrics` helper:
- **TTK**: Time-to-kill (median, p90, p99)
- **timeToFirstShot**: Engagement latency
- **timeToFirstKill**: Time to first casualty
- **Damage breakdown**: By source (primary, turrets, torpedoes)
- **Shield metrics**: Shield→hull transition time, shield depletion rate
- **Oscillation metrics**: HeadingAmplitude, VerticalDispersion (from AI blackboard)
- **Projectile metrics**: Interception rate, hit rate, AOE casualties

### Validation Gates

Before/after tuning comparisons:
- Fighter 1v1 survivability improvement >25%
- Torpedo multi-kill rate reduction >30%
- Destroyer engagement time reduction >20%
- AI heading oscillation reduction (amplitude) >15%

## Code Locations Quick Reference

| Area | File | Purpose |
|------|------|---------|
| Ship stats | `src/data/ships/*.ts` | Hull HP, shields, regen, primary weapons |
| Turret factory | `src/data/ships/turret-factory.ts` | Default turret configurations (PD, missiles, etc) |
| Projectile config | `src/config/projectiles.ts` | AOE radius, arming time, homing, colliders |
| Progression | `src/config/progression.ts` | Level bonuses, damage effectiveness, XP scaling |
| AI profiles | `src/game/aiProfiles.ts` | Behavior weights, ranges, oscillation parameters |
| Combat math | `src/game/combat/damage.ts` | Damage distribution, armor absorption |
| Testing harness | `test/support/aiScenarioHarness.ts` | Deterministic scenario testing framework |

## Changes from v2.0.4

Based on inspection of current codebase vs v2.0.4 report findings:

### Observed Changes
1. **Corvette PD**: Now uses `damage: 4` (reduced from default 5)
2. **Torpedo values**: Remain at 42 damage, 12 AOE radius (no change)
3. **AI profiles**: Brawler profile unchanged (aggression: 0.9, patience: 0.3)

### Outstanding v2.0.4 Recommendations
- ❌ PD fire rate increase (0.35 → 0.55): Not implemented
- ❌ Torpedo AOE reduction (12 → 8): Not implemented
- ⚠️ Corvette missile tuning: Missiles remain at 20 damage
- ❌ Destroyer shield regen reduction: Remains at 24.0
- ❌ Brawler AI smoothing: Not implemented

## Recommended Action Plan

### Phase 1: Conservative Safety Changes (Low Risk)
**Goal**: Address highest-impact issues with minimal disruption

1. ✅ Increase PD fire rate to 0.45-0.50
2. ✅ Reduce torpedo AOE radius to 8-9
3. ✅ Document baseline metrics with current values

**Expected Impact**: 
- Fighter viability +20-30%
- Torpedo multi-kill reduction -30-40%
- No risk of over-nerfing capital ships

### Phase 2: Sustained DPS Smoothing (Medium Risk)
**Goal**: Address burst damage and sustainability issues

1. Reduce missile damage to 16-18
2. Reduce destroyer shield regen to 18-20
3. Run validation scenarios

**Expected Impact**:
- Smoother TTK curves
- Destroyer vulnerability to massed fire

### Phase 3: AI Behavioral Tuning (Low Risk)
**Goal**: Improve combat feel and reduce oscillations

1. Adjust brawler aggression to 0.75-0.8
2. Increase brawler patience to 0.4-0.45
3. Validate with harness metrics

**Expected Impact**:
- Reduced heading/thrust oscillations
- Smoother engagement patterns

## Recommended Quick PR (Minimal Changes)

For immediate improvement with low risk:

```
refactor: moderate PD effectiveness and torpedo AOE

- Increase PD fireRate from 0.35 to 0.45 (reduces DPS ~14.3 → ~11.1)
- Reduce torpedo AOE radius from 12 to 8 (limits multi-kill potential)
- Add deterministic harness scenario for fighter vs corvette validation

Files:
- src/data/ships/turret-factory.ts (PD fireRate)
- src/config/projectiles.ts (torpedo aoeRadius)
- test/vitest/balance-scenarios.spec.ts (new validation)
```

## Next Steps

**Choose One:**

**A) Apply Conservative Changes Now**
- Implement Phase 1 changes (PD + torpedo AOE)
- Run baseline and post-change metrics
- Document results in follow-up report
- **Recommended**: Lowest risk, fast iteration

**B) Run Baseline Metrics First**
- Execute deterministic harness scenarios with current values
- Capture comprehensive KPI baseline
- Use data to prioritize changes
- **Recommended**: For data-driven approach

**C) Create Balance Tuning Playbook**
- Document all tuning knobs with expected impacts
- Provide lookup table for rapid designer iteration
- Include harness scenarios and validation gates
- **Recommended**: For long-term maintainability

## Conclusion

Version 2.0.5g shows solid combat system architecture with clear tuning opportunities. The core issues (PD dominance, torpedo AOE, destroyer sustainability) are well-understood and addressable through conservative numeric adjustments. The existing deterministic harness infrastructure provides a strong foundation for validation.

**Recommendation**: Proceed with Phase 1 conservative changes (PD + torpedo AOE) and validate with deterministic scenarios before considering further adjustments. This approach minimizes risk while addressing the highest-impact balance issues.

---

**Report Author**: GitHub Copilot  
**Validation Status**: Analysis based on source inspection, pending harness validation  
**Follow-up**: Run deterministic scenarios and update report with empirical results
