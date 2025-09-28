# Design — AI Improvement v0.1.1 — 3D Combat, Range, Engagement

**Status:** Draft 2025-09-27  
**Version:** v0.1.1 (branch: gamebalancev0.1.1)  
**Related Plan:** plan-ai-improvement-v0.1.1.md

## Problem Statement

The AI behavior in the current system is predominantly planar, leading to passive engagements, compressed engagement ranges, and underutilization of the 3D battle space. Fleets often fail to leverage verticality for tactical advantage, resulting in infrequent and unvaried combat interactions. Initial spawn geometry contributes to delayed or overly distant engagements, while range band adherence is inconsistent across ship roles. This design introduces role-specific 3D maneuvers, refined spawn configurations, engagement pacing boosts, and adjusted range policies to create more dynamic, intentional, and balanced 3D combat without altering the world scale or introducing nondeterminism.

## Goals

- Enable visible, intentional 3D combat behavior by role (fighters/escorts climb/dive; artillery seeks elevation).
- Reduce passiveness and increase engagement frequency without causing early wipes.
- Address range compression by improving band separation/usage and initial geometry (spawn/separation).
- Preserve determinism via seeded RNG and provide toggles for all new behaviors.
- Ensure performance remains within budgets at scale (e.g., 15v15 per side).

## Non-Goals

- Altering the world scale or core physics parameters.
- Introducing mechanical bonuses for elevation or flanking (deferred to optional follow-up).
- Overhauling the entire AI intent selection logic (focus on execution and scoring tweaks).
- Adding new UI/HUD elements for metrics (toggleable debug panels as follow-up).

## Architecture Overview

The enhancements build on the existing AI tick loop, intent selection, and motion systems, injecting verticality post-intent and adjusting scoring/spawn configs. Key extensions include behavior profile updates for role preferences, new config toggles, and seeded perturbation utilities.

```mermaid
flowchart TD
  Start[Spawn] --> Geo[3D starting geometry (±Y spread, 1.5x separation)]
  Geo --> Tick[AI Tick (15Hz)]
  Tick --> Intent[Select Intent with engagement boost scoring]
  Intent --> Exec[Post-intent execution heading with role-based y-perturb]
  Exec --> Score[Band stickiness + range policy nudges]
  Score --> Motion[3D Kinematic Motion with vertical steering]
  Motion --> Fire[Projectile & turret systems respecting bands]
  Fire --> Metrics[Record KPIs: vertical, in-band, engagement]
```

## Data Flow

1. At simulation start, `initializeFleets` applies increased vertical spread (`WORLD_HALF * verticalSpreadFactor`), randomizes team anchor Y, and sets initial separation to ~1.5× max range using configurable factors, ensuring deterministic placement via seed.
2. During each AI tick (elevated to 15 Hz via `AI_CONFIG.tickRateHz`), the system evaluates intents for each ship, applying engagement boost scoring (prefer Attack/Intercept in opening window unless outnumbered) and band stickiness inertia.
3. Post-intent selection, `computeExecutionHeading` injects role-based vertical perturbation (clamped y-component) using seeded RNG, respecting `verticalEnabled` toggle and behavior profile preferences (e.g., artillery elevation bias).
4. For escorts, `assignEscortTargets` distributes positions on a spherical shell around VIPs and biases intercepts toward nearest threats.
5. Motion system (`updateKinematics`) executes the 3D heading, incorporating range policy nudges (v0.1.1-exp) for band adherence during Reposition/Attack.
6. Firing and projectile resolution proceed as before, with metrics logged for vertical dispersion, in-band time, and engagement frequency.
7. Expired or retreating ships regroup toward team spawn centroid with 3D vectors, applying hysteresis to prevent oscillation.

## Vertical Maneuvering

Verticality is injected after intent selection to preserve semantic intent choices while enabling 3D execution.

- **Perturbation Mechanism:** Add a y-component to the base heading vector: `heading.y += SeededRng.normal(verticalManeuver * 0.3, 0.05)`, clamped to ±0.3 (configurable). Frequency scales with role: fighters/escorts (high), artillery (low but biased).
- **Artillery High Ground:** During Attack, bias toward target's y + offset (e.g., +100u), maintaining outer band distance.
- **Escort Shell:** Positions computed as spherical offsets from VIP centroid, with weak radial bias; intercepts prioritize closest incoming threats via distance metric.
- **Regroup/Retreat:** Vectors include y toward spawn centroid; radius shrinks over time with hysteresis (e.g., only regroup if >1.2× radius).

All perturbations use `src/utils/rng.ts` seeded by tickIndex and ship traitSeed for determinism.

## Engagement Boost & Range Policy

- **Opening Salvo:** For first N seconds (configurable, default 30s), inflate Attack/Intercept scores by +20% unless strength ratio >1.6; adds band stickiness (2-4s heading inertia) to stabilize firing positions.
- **Scoring Nudges:** Slight penalties for Reposition under hold posture; bonuses for intents aligning with bandPreference.
- **Range Policy v0.1.1-exp:** Role-based band shifts (e.g., artillery outer nudge +50u, brawlers mid -20u) ensuring min 40u separation; micro projectile speed variance (artillery +5%, lasers -3%) to emphasize bands without scale changes.

## Interfaces & Configuration

```ts
// src/types/ai.ts (extensions)
export interface BehaviorProfile {
  // ... existing
  verticalManeuver: number; // 0.0–0.6, role-specific y-perturb amplitude
  elevationPreference?: 'above' | 'below' | 'follow'; // default 'follow'; artillery 'above'
  bandPreference?: 'outer' | 'mid' | 'inner'; // default 'mid'; artillery 'outer'
}

// src/config/ai.ts (new toggles, defaults on)
export const AI_CONFIG = {
  // ... existing
  verticalEnabled: true,
  engagementBoostEnabled: true,
  rangePolicy: 'v0.1.1-exp' as const,
  tickRateHz: 15,
  openingSalvoDuration: 30, // seconds
  headingYClamp: 0.3,
  strengthRatioThreshold: 1.6,
  bandStickinessDuration: 3, // seconds
} as const;

// Spawn config extensions
export const SPAWN_CONFIG = {
  // ... existing
  verticalSpreadFactor: 0.2,
  anchorYRandomization: true,
  initialSeparationFactor: 1.5,
} as const;
```

- Behavior profiles updated per role in config (e.g., fighters: {verticalManeuver: 0.4, bandPreference: 'mid'}).
- All new params exposed for tuning; determinism ensured via seeded RNG calls.

## Role Tuning (Defaults)

- **Fighters/Escorts:** verticalManeuver: 0.35–0.4; frequent y-perturbs; spherical shell for escorts; nearest-threat bias.
- **Corvettes/Frigates:** verticalManeuver: 0.2–0.25; occasional changes; bandPreference: 'mid'.
- **Artillery (Destroyer/Carrier):** verticalManeuver: 0.15–0.2; elevationPreference: 'above'; bandPreference: 'outer'; high-ground pursuit.

## Execution Model

- Vertical injection post-intent: preserves intent (e.g., Attack still targets, but climbs during approach).
- Opening boost: temporary scoring override; reverts to normal after window or if outnumbered.
- Retreat/Regroup: 3D vectors to centroid; hysteresis (e.g., min distance delta 50u) avoids ping-pong.
- Band adherence: during Reposition, nudge toward preferred band mid/edge; inertia prevents jitter.
- Determinism: RNG calls keyed by tick/ship; clamps prevent extreme y (e.g., |y| <= 0.3).

## Testing Strategy

- **Unit (Vitest):**
  - `ai-vertical.spec.ts`: Post-intent headings have expected y-components per role/seed; artillery biases verified.
  - `ai-engagement.spec.ts`: Intent scores boost Attack in opening window; band stickiness holds heading.
  - `spawn-geometry.spec.ts`: Initial positions match separation/spread factors; deterministic under seed.
  - `escort-assignment.spec.ts`: Shell distribution and threat prioritization correct.
- **Integration (Playwright):**
  - `ai-3d-combat.spec.ts`: Seeded battles show vertical dispersion, in-band time, and engagement KPIs within thresholds (e.g., p50 first-shot <=20s).
  - Visual diffs confirm climbs/dives, escort shells, and artillery elevation.
- **Automated Validation (seeded runs):**
  - Metrics: vertical usage (>=25% shots |Δy|>=100u), aggressive intents (>=60% first 30s), in-band (>=65%).
  - Determinism: Identical replays/seeds; performance <= budget at 15Hz/15v15.
- **Manual:**
  - Smoke tests toggling configs; observe no oscillation/early wipes; tune if needed.

## Implementation Steps

1. **Geometry & Cadence (low risk):**
   - Update `initializeFleets` with vertical spread, Y randomization, 1.5x separation (use SPAWN_CONFIG).
   - Set AI tick to 15 Hz in main loop, gated by AI_CONFIG.tickRateHz.

2. **3D Execution Injection (medium risk):**
   - Extend BehaviorProfile with new fields; update role configs.
   - Add `computeVerticalPerturb` in execution phase, using SeededRng and clamps.
   - Implement artillery elevation/band bias in Attack/Reposition.
   - Add escort shell distribution and threat bias in assignment logic.

3. **Engagement Boost & Band Stickiness (medium risk):**
   - Introduce opening salvo scoring override (time-based, ratio check).
   - Add heading inertia for stickiness (per-ship timer).
   - Implement scoring nudges for intents/bands.

4. **Range Policy v0.1.1-exp (optional medium risk):**
   - Apply role band adjustments and projectile speed variance in configs/motion.
   - Gate behind rangePolicy toggle.

5. **Metrics & Toggles:**
   - Add logging for KPIs (vertical, in-band, etc.); expose all toggles.
   - Update tests and validate determinism/performance.

## Risks & Rollback

- **Over-aggression:** Early wipes; mitigate with shorter salvo duration, lower bonuses; rollback via engagementBoostEnabled=false.
- **Oscillation:** Excessive y-bobbing; reduce verticalManeuver, add hysteresis; clamp heading.y.
- **Performance:** 15Hz overhead; profile and adjust maxPerTick or revert tickRateHz.
- **Readability:** Too much vertical chaos; reduce spread, adjust camera/fog.
- All features toggled; immediate rollback by config flips.

## Follow-ups

- Physics: Vertical acceleration caps, turn-rate review for 3D.
- Anti-oscillation tuning and intent hysteresis.
- Performance optimization at scale.
- Visuals: Camera/fog for vertical emphasis.
- Debug HUD for metrics.
- Ship stats alignment with ranges.
- Optional: High ground/flanking mechanics.

