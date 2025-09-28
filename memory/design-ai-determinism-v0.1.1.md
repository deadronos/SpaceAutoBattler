# Design — AI Decision Determinism & Coordination v0.1.1

**Status:** Draft 2025-09-28  
**Version:** v0.1.1 (branch: gamebalancev0.1.1)  
**Related Plan:** memory/design-ai-improvement-v0.1.1-improvements.md

## Problem Statement

AI v2 still exhibits seed-sensitive intent selection, fragile scoring weights, limited target prioritisation, slow responsiveness to critical events, and minimal vertical manoeuvre variance. Scenario harness diagnostics highlight high tie frequency (≥20%), arbitrary intent swaps across seeds, and lack of coordinated focus fire, undermining KPI reliability and gameplay quality.

## Goals

- Reduce reliance on random tiebreaks by increasing score resolution and deterministic ordering.
- Prioritise high-value targets using threat-aware weighting and team coordination signals.
- Deliver sub-tick responsiveness for critical events while respecting scheduler budgets.
- Expand vertical execution amplitude in a deterministic, profile-aware manner.
- Extend diagnostics to expose tie frequency, focus ratios, and decision latency for regression gating.

## Scope & Non-Goals

- **In scope:** scoring pipeline, intent ranking, blackboard targeting, scheduler/LOD adjustments, vertical perturbation clamp tuning, harness metrics.
- **Out of scope:** completely new intents, physics-based pursuit models, UI HUD changes (other than telemetry surfaces).

## Architecture Overview

```mermaid
digraph G {
  rankdir=LR;
  subgraph cluster_scoring {
    label = "Intent Scoring";
    profile["BehaviorProfile"];
    scorer["Score Functions (Attack/Kite/etc.)"];
    precision["ScoreQuantiser (0.1)" ];
    comparator["Deterministic Comparator"];
    profile -> scorer -> precision -> comparator;
  }
  subgraph cluster_targeting {
    label = "Target Prioritisation";
    bb["Blackboard" ];
    priorities["PriorityQueue" ];
    focus["FocusFire Registry" ];
    bb -> priorities -> focus;
  }
  subgraph cluster_scheduler {
    label = "Scheduler";
    lod["LOD & Slices"];
    interrupts["Interrupt Manager"];
    lod -> interrupts;
  }
  subgraph cluster_execution {
    label = "Execution";
    heading["Heading Builder"];
    vertical["Dynamic Vertical Clamp"];
    heading -> vertical;
  }
  metrics["Diagnostics" ];
  comparator -> heading;
  focus -> heading;
  interrupts -> heading;
  vertical -> metrics;
  focus -> metrics;
  comparator -> metrics;
}
```

## Data Flow

1. **Input collection:** `evaluateShip` fetches behavior profile, traits, targets, and escort assignments.
2. **Scoring:** Each `score*Intent` returns a floating-point score (no flooring). Scores pass through `ScoreQuantiser` (round-to-decile) for deterministic comparisons.
3. **Ranking:** `determineWinner` sorts candidates using `(score desc, intentPriority, targetThreat, targetDistance, candidateIndex)`.
4. **Target prioritisation:** `refreshBlackboard` builds `PrioritisedTarget` entries with threat weight = distanceWeight × (`hullThreat + focusPenalty + vipThreat + hpWeight`). Results cached per team and reused by scoring.
5. **Interrupts:** `InterruptManager` watches blackboard deltas (VIP threat, hp drops, target death) and updates `nextThinkAt` to `tickIndex` for affected ships.
6. **Execution:** `writeCommand` composes heading; `applyVerticalPerturbation` now uses profile clamp derived from `AI_CONFIG.verticalClamp[role]` with dynamic scaling by band error.
7. **Diagnostics:** `aggregateKpis` stores tie counts, comparator fallbacks, decision latency histograms, focus-fire ratios, and vertical amplitude distribution.

## Interfaces & Schemas

```ts
// src/game/systems.ts
interface IntentScore {
  intent: AIIntent;
  score: number;        // floating value, quantised to 0.1 increments
  priority: number;     // derived from intent order map
  targetId?: number;
  threatRank?: number;  // lower is more threatening
  distance?: number;
}

interface PrioritisedTarget {
  id: number;
  threat: number; // aggregated weight (higher => higher priority)
  distanceSq: number;
  focusLoad: number; // number of allies already targeting
}

interface IntentInterruptEvent {
  shipId: number;
  reason: 'hp-drop' | 'target-lost' | 'vip-threat' | 'manual';
  tick: number;
}

// src/game/metrics.ts
interface DecisionDiagnostics {
  totalDecisions: number;
  tieDecisions: number;
  intentLatency: number[]; // ticks between event and re-evaluation
  focusFireRatios: Record<AIIntent, number>;
}
```

### Configuration Additions

```ts
export const AI_CONFIG = {
  // ...existing
  scorePrecision: 0.1,
  intentPriority: ['Attack','Intercept','Escort','Kite','Reposition','Regroup','Flee'],
  threatWeights: {
    hull: { carrier: 6, destroyer: 5, frigate: 4, corvette: 3, fighter: 2 },
    hpScalar: 0.0025,
    vipBonus: 3,
    focusPenalty: 1.2,
  },
  verticalClamp: {
    default: 0.45,
    highAgility: 0.6,
    heavy: 0.35,
  },
  interruptHpDrop: 0.1, // 10%
};
```

## Error Handling

- **Invalid scoring data:** fall back to original score + comparator ordering; log warning once per tick.
- **Empty target pool:** maintain previous target if valid, else degrade to `findNearestEnemy` for safety.
- **Interrupt thrash:** rate-limit interrupts per ship (max 1 per tick) and queue remainder for next tick.
- **Diagnostics overflow:** cap histograms to 256 samples; drop oldest entries.

## Testing Strategy

- **Unit:**
  - `ai-determinism.spec.ts` — ensures score quantisation reduces tie frequency and comparator ordering is deterministic.
  - `ai-target-priority.spec.ts` — validates target priority weights under varied hull/hp/focus combos.
  - `ai-responsiveness.spec.ts` — checks interrupt triggers reset `nextThinkAt` immediately.
  - `ai-vertical.spec.ts` — ensures dynamic clamps allow high-agility profiles to exceed 0.3 while respecting global limits.
  - `ai-diagnostics.spec.ts` — verifies metrics capture tie counts, latency, and focus ratios.
- **Integration:**
  - `ai-scenario-harness.spec.ts` — full seeded battles record reduced tie ratios (<5%), improved focus fire (>0.6 on target-of-focus), latency ≤1 tick.
  - `ai-balance-regression.spec.ts` — ensures prior KPI baselines (first-shot, in-band) remain within tolerance.
- **Performance:** instrument slices to confirm added interrupts and priority computations stay within per-tick budget (< maxPerTick 60, no increased budget hits).

## Implementation Plan

1. **Score precision & comparator (P0):**
   - Remove `Math.floor` from `score*Intent` functions and route through `quantiseScore(score, AI_CONFIG.scorePrecision)`.
   - Implement `compareIntents(IntentScore a, IntentScore b)` using priority tables and tie breakers.
   - Update `tieBreak` to use comparator and reserve RNG as last resort.
   - Instrument metrics for tie counts.

2. **Target prioritisation (P0):**
   - Extend blackboard with `teamPriority: Map<Team, PrioritisedTarget[]>` and `focusFire: Map<number, number>`.
   - Adjust `refreshBlackboard` to populate queue using threat weights and focus counts.
   - Update `selectIntent` to fetch primary target from priority list instead of nearest-only.

3. **Interrupt responsiveness (P0):**
   - Introduce `IntentInterruptManager` to track events and force `nextThinkAt` update.
   - Hook into hp updates, target removal, VIP threat changes.
   - Add tests plus instrumentation for latency metrics.

4. **Vertical clamp expansion (P1):**
   - Parameterise clamp by profile role and band error; allow dynamic clamp up to 0.6 for agile hulls.
   - Ensure heading normalisation remains stable.

5. **Diagnostics (P1):**
   - Extend `AIMetrics` with tie/latency/focus arrays.
   - Update harness serialization and debug overlay to show new metrics.

6. **Scoring enrichment (P1/P2):**
   - Incorporate threat weight bonuses, hp gating, and focus fire bias into `scoreAttackIntent`, etc.
   - Rebalance constants; update tests and metrics baselines.

## Risks & Mitigations

- **Performance regression:** priority queues and interrupts add work; mitigate by caching and limiting queue length to active enemies.
- **Over-concentration of fire:** focus weighting may cause instant wipes; cap max focus bonus and run seeded battle comparisons.
- **Oscillation from frequent interrupts:** apply per-ship cooldown and hysteresis for hp triggers (e.g., only fire when cumulative drop exceeds threshold).
- **Tuning fatigue:** Plan A/B toggles for score precision & target weighting to allow incremental rollout.

## Decision Log (initial)

- 2025-09-28: Opted for decile quantisation (0.1) instead of integer flooring to balance determinism with manageable metric diffs.
- 2025-09-28: Chose multi-factor comparator (intent priority → threat rank → distance → candidate index) to avoid random tie fallback except in true symmetry.

## Open Questions

- Should escort VIP protection override focus-fire weighting when VIP under heavy threat? (Pending tuning.)
- Do we need per-role interrupt cooldowns to prevent swarm jitter? (Monitor once instrumentation is live.)
- Is vertical clamp scaling by band error sufficient, or do we need additional context (incoming fire vectors)?
