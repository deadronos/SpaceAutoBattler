# Plan: AI Improvement v0.1.1 — 3D Combat, Range, Engagement

Version: v0.1.1 (branch: gamebalancev0.1.1)
Date: 2025-09-27
Status: Planning
Confidence: High (85%) — 3D is already supported; this plan focuses on better utilization and pacing.

## Goals

- Enable visible, intentional 3D combat behavior by role (fighters/escorts climb/dive; artillery seeks elevation).
- Reduce passiveness and increase engagement frequency without causing early wipes.
- Address range compression by improving band separation/usage and initial geometry (spawn/separation).

## Requirements (EARS)

1. WHEN an AI intent is selected, THE SYSTEM SHALL adjust the execution heading with a vertical component according to the ship role (fighters/escorts frequent, corvette/frigate light, artillery minimal) (Acceptance: ≥ 60% of commands for fighters/escorts have |heading.y| > 0.05; deterministic under seed).
2. WHEN artillery attacks from beyond its preferred band, THE SYSTEM SHALL bias the heading to maintain outer-edge distance and pursue an elevation offset relative to the target ("high ground") (Acceptance: artillery shot-distance histogram peaks near upper third of band; ≥ 30% of shots with |Δy| ≥ 100u).
3. WHEN escorts are assigned, THE SYSTEM SHALL distribute them around VIPs on a weakly spherical shell and bias intercepts against the closest attackers (Acceptance: median escort-to-VIP distance within spherical shell thickness; ≥ 50% of escort shots target nearest threats).
4. WHEN the simulation starts, THE SYSTEM SHALL initialize fleets with increased vertical spread and randomized team anchor Y such that initial separation ≈ 1.5× max range (configurable) (Acceptance: p50 time-to-first-shot ≤ 20s; p90 ≤ 30s).
5. WHEN evaluating intents, THE SYSTEM SHALL prefer aggressive intents (Attack/Intercept) during a configurable opening-salvo window unless heavily outnumbered (Acceptance: ≥ 60% Attack/Intercept in first 30s when strength ratio ≤ 1.6).
6. WHEN retreating/regrouping, THE SYSTEM SHALL allow 3D retreat vectors and bias regrouping toward team spawn centroid (Acceptance: regroup vector has non-zero y in ≥ 50% of cases; regroup radius shrinks over time).
7. WHEN range policy v0.1.1-exp is active, THE SYSTEM SHALL apply small role-based band adjustments to improve separation and band usage (without changing world scale) (Acceptance: in-band time per hull ≥ 65% over 120s; peaks within ±15% of role mid).
8. WHEN 3D improvements are active, THE SYSTEM SHALL preserve determinism via seeded RNG and expose toggles for all behavior changes (Acceptance: identical replays under same seed; toggles flip behavior predictably).

## Design

### Architecture & Interfaces

- Behavior profiles: add vertical and band preferences.
  - `BehaviorProfile.verticalManeuver: number` (0.0–0.6) — role-specific y-perturb amplitude.
  - `BehaviorProfile.elevationPreference?: "above" | "below" | "follow"` — artillery defaults to "above" to achieve high ground vs current target.
  - `BehaviorProfile.bandPreference?: "outer" | "mid" | "inner"` — artillery defaults to "outer"; brawler/escort to "mid".
- AI configuration toggles (on by default):
  - `AI_CONFIG.verticalEnabled = true`
  - `AI_CONFIG.engagementBoostEnabled = true`
  - `AI_CONFIG.rangePolicy = "v0.1.1-exp"`
  - `AI_CONFIG.tickRateHz = 15`
- Spawn configuration (configurable):
  - `spawn.verticalSpreadFactor = 0.2` (WORLD_HALF \* factor)
  - `spawn.anchorYRandomization = true`
  - `spawn.initialSeparationFactor = 1.5` (× max range)
- Metrics/telemetry (toggleable HUD later):
  - Vertical dispersion per team, intent distribution over time, in-band time per hull, shot distance histogram per hull, time-to-first-shot.

### Data Flow

```mermaid
flowchart TD
  Start[Spawn] --> Geo[3D starting geometry (±Y spread, 1.5x separation)]
  Geo --> Tick[AI Tick (15Hz)]
  Tick --> Intent[Select Intent]
  Intent --> Exec[Post-intent execution heading with role-based y-perturb]
  Exec --> Score[Band stickiness + engagement boost]
  Score --> Motion[3D Kinematic Motion]
  Motion --> Fire[Projectile & turret systems]
  Fire --> Metrics[Record KPIs: vertical, in-band, posture]
```

### Role Tuning (defaults)

- Fighters/Escorts: `verticalManeuver ≈ 0.35–0.4`; frequent climbs/dives; escort shell weakly spherical; strong bias to nearest threats on VIP.
- Corvettes/Frigates: `verticalManeuver ≈ 0.2–0.25`; occasional altitude changes; brawler band preference "mid".
- Artillery (Destroyer/Carrier): `verticalManeuver ≈ 0.15–0.2`; elevationPreference "above"; bandPreference "outer"; pursue elevation relative to current target.

### Execution Model

- Vertical thinking injection occurs after intent selection (how to execute), not in scoring, to preserve intent semantics.
- Opening salvo posture: force posture = aggressive for N seconds unless strength ratio > 1.6; then fall back to normal rules.
- Retreat/regroup: allow 3D retreat vectors; regroup around spawn centroid; apply hysteresis to avoid oscillation.
- Determinism: all perturbations use seeded RNG derived from tickIndex and traitSeed; clamp |heading.y| additions (default ±0.3; configurable).

### Range Policy (v0.1.1-exp)

- Small, role-consistent band nudges to improve separation and identity without changing WORLD_SIZE.
- Projectile speed micro-variance per role to emphasize band usage (artillery slightly faster, close-range lasers slightly slower).
- Spawn separation aligned to 1.5× max range for early-but-not-instant engagement.

## Implementation Plan (staged, on-by-default)

1. Geometry & Cadence (low risk)

- Increase vertical spread (WORLD_HALF \* 0.2), randomize team anchor Y, target initial separation ~1.5× max range (configurable).
- Raise AI tick to 15 Hz behind `AI_CONFIG.tickRateHz` (on by default).

1. 3D Execution Injection (medium risk)

- Add role-based y-perturb post-heading with clamps (default ±0.3), gated by `verticalEnabled`.
- Implement artillery elevationPreference and bandPreference adherence during Attack/Reposition.
- Implement escort spherical shell distribution and nearest-threat bias.

1. Engagement Boost & Band Stickiness (medium risk)

- Opening salvo posture (config): time-limited aggressive posture unless heavily outnumbered.
- Add band stickiness (2–4s inertia) to maintain stable firing positions.
- Nudge scoring: small Attack/Intercept bonuses beyond desiredMax; slight Reposition penalty under hold posture.

1. Range Policy v0.1.1-exp (optional medium risk)

- Apply subtle role band adjustments (maintain minimum 40u separation between adjacent roles) and micro projectile speed tweaks.
- Parameterize via `rangePolicy` toggle.

1. Optional Mechanics (high ground/flanking) — follow-up

- Prototype mechanical modifiers (accuracy/damage) for high ground/flanking behind a separate experimental flag; off by default.

## Validation Strategy

Automated (seeded):

- Time-to-first-shot: p50 ≤ 20s; p90 ≤ 30s.
- Aggressive intent share: ≥ 60% Attack/Intercept in first 30s when strength ratio ≤ 1.6.
- In-band time: ≥ 65% per hull over 120s (range policy on).
- Vertical usage: median vertical dispersion ≥ 300u by 45s; ≥ 25% of shots with |Δy| ≥ 100u.
- Determinism: identical metrics across runs with same seed.
- Performance: ≤ configured budget hits at 15v15 per side.

Manual/E2E:

- Visual confirmation of climbs/dives and artillery elevation positions.
- Escort shell around VIPs observable; escorts peel to nearest threats.
- Range histograms peak near role mids/edges per preference.

## Risks & Rollback

- Over-aggression: early wipes at close range. Mitigation: lower opening-salvo duration; reduce Attack bonus; revert via `engagementBoostEnabled`.
- Oscillation/bobbing: excessive y-perturb. Mitigation: reduce verticalManeuver; add hysteresis; clamp heading.y.
- Performance at 15 Hz: raise `maxPerTick` slices or revert tick rate; profile 15v15.
- Player readability: too much vertical spread. Mitigation: reduce spread factor; adjust camera/fog presets.

All features are guarded by flags and defaults as listed; rollback is immediate by toggling config.

## Configuration Summary (defaults)

- verticalEnabled: true
- engagementBoostEnabled: true
- rangePolicy: "v0.1.1-exp"
- ai.tickRateHz: 15
- spawn.verticalSpreadFactor: 0.2
- spawn.anchorYRandomization: true
- spawn.initialSeparationFactor: 1.5
- headingYClamp: ±0.3 (configurable)

## Follow-ups (tracked)

- Physics: per-hull vertical acceleration/steering caps; turn-rate review for vertical maneuvers.
- Anti-oscillation smoothing and intent hysteresis tuning.
- Performance pass at 15v15, adjust budgets.
- Visuals: camera/fog presets for highlighting verticality.
- Debug panels/HUD: toggleable metrics overlay (off by default).
- Ship stats pass (weapon ranges aligned with range policy) after initial rollout.

## Handoff Notes

- Feature set ships ON by default; interplay can be tuned in subsequent passes using toggles.
- Provide before/after KPI tables and seed references in the PR description.
- Document any deviations from plan in a Decision Record.
