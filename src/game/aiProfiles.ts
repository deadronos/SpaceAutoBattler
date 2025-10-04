import type { BehaviorProfile, ShipHull } from '../types/index.js';

/**
 * Behavior profile configuration reference
 *
 * Each BehaviorProfile controls high-level decision preferences used by the
 * decision and command generators. Below are field-level notes describing the
 * intended effect of each value, how it drives steering/thrust commands, and
 * where it can interact with motion/steering oscillation ("bobbing") or
 * generate undesired chattering. These notes are written to help tune
 * profiles and to suggest mitigations when oscillatory behavior appears.
 *
 * Fields
 * - desiredRange: [min, max]
 *   - Purpose: canonical standoff range the AI attempts to keep from its target.
 *     Decision logic uses this as the primary setpoint for approach / retreat.
 *   - Steering effect: drives forward/backward thrust and braking and therefore
 *     the magnitude of longitudinal (forward) acceleration and deceleration.
 *   - Oscillation risk: If a ship repeatedly crosses the min/max threshold it
 *     will alternate between accelerating and braking; this causes throttle and
 *     heading oscillation (approach/retreat cycles). Also, tight ranges that
 *     are close to stopping distances amplify overshoot.
 *   - Mitigation: add hysteresis or a deadband around the edges, smooth the
 *     commanded thrust, or increase the 'patience' value so the AI resists
 *     immediate flips.
 *
 * - orbit: number
 *   - Purpose: bias that causes the ship to offset its heading around the
 *     target (circling / side-approach). The exact units are the internal
 *     steering implementation's expected units (angle offset or radial offset).
 *   - Steering effect: produces a persistent lateral turning command rather
 *     than a pure head-on intercept; increases continuous yaw/turning rate.
 *   - Oscillation risk: High orbit values create sustained turning which, if
 *     combined with aggressive steering gains or no steering-rate limits, can
 *     lead to large-amplitude oscillatory yaw or repetitive course corrections.
 *   - Mitigation: clamp steering rate, low-pass the orbit-driven heading set
 *     point, and randomize orbit phase across ships if synchronized behavior
 *     looks artificial.
 *
 * - aggression: [0..1]
 *   - Purpose: weight in decision scoring that favors closing and attacking
 *     versus conservative actions (flee/regroup). Higher values cause faster
 *     approach, earlier throttle application, and more permissive target choices.
 *   - Steering effect: increases setpoint speed and reduces braking tolerance;
 *     high aggression commonly increases steering amplitude (bigger corrections).
 *   - Oscillation risk: High aggression + low damping → overshoot and
 *     corrective oscillations when approaching the desiredRange.
 *   - Mitigation: soften acceleration commands when aggression is high or tune
 *     steering damping based on aggression.
 *
 * - patience: [0..1]
 *   - Purpose: temporal tolerance for sticking with a chosen strategy/target
 *     before re-evaluating or switching. Higher patience means fewer rapid
 *     target switches and fewer mid-course maneuver reversals.
 *   - Oscillation risk: Low patience increases decision churn and therefore
 *     frequent heading changes, producing steering instability and oscillation.
 *   - Mitigation: increase stickiness windows (see `AIState.stickinessUntil`),
 *     or use a minimum time between intent switches.
 *
 * - dodgeFreq: [0..1]
 *   - Purpose: frequency/probability scalar for issuing short dodge maneuvers
 *     (lateral or vertical impulse moves) when threatened.
 *   - Steering effect: injects short, high-rate lateral/vertical steering and
 *     thrust impulses that override normal motion commands.
 *   - Oscillation risk: High dodge rates produce a lot of high-frequency motion
 *     that can look like bobbing or cause the controller to hunt; combining
 *     high dodgeFreq with high verticalManeuver produces complex 3D oscillation.
 *   - Mitigation: bound dodge magnitudes, add cooldowns between dodge actions,
 *     and blend dodge impulses with the current heading rather than replacing
 *     it instantly.
 *
 * - classBias: Record<ShipHull, number>
 *   - Purpose: additive scoring bias used by target selection logic so certain
 *     hull classes are preferred as targets.
 *   - Steering effect: indirect — influences which targets are selected, which
 *     in turn changes commanded headings and manoeuvres.
 *   - Oscillation risk: Frequent target switching due to similar bias scores
 *     can cause repeated heading changes; ensure target selection includes a
 *     stickiness penalty or threshold.
 *
 * - style: 'brawler' | 'kiter' | 'artillery' | 'escort'
 *   - Purpose: semantic label used by decision/command generators to pick
 *     behavior templates (e.g. firing patterns, band preference, or opening
 *     aggression). Not directly used for steering math but drives overall
 *     motion patterns.
 *
 * - verticalManeuver: [0..1]
 *   - Purpose: scalar that sets the amplitude of preferred vertical motion
 *     (how much the ship actively moves in Y / elevation when positioning).
 *   - Steering effect: produces vertical heading offsets and additional pitch
 *     or vertical thrust demand; higher values increase vertical movement.
 *   - Oscillation risk: If vertical motion is commanded aggressively without
 *     smoothing, the pitch/vertical axis can oscillate (bobbing). When combined
 *     with high dodgeFreq the vertical channel may see competing impulses that
 *     cause visible jitter.
 *   - Mitigation: low-pass filters on vertical setpoints, rate limits on
 *     vertical thrust, and phase/randomization to avoid synchronized bobbing
 *     across multiple ships.
 *
 * - elevationPreference: 'above' | 'below' | 'follow'
 *   - Purpose: preference for whether to position above/below the target or to
 *     stay at target's elevation. Works in concert with verticalManeuver.
 *   - Oscillation risk: Rapid toggles between elevation bands (or aggressive
 *     follow behavior) can create vertical hunting; add hysteresis around
 *     elevation thresholds.
 *
 * - bandPreference: 'outer' | 'mid' | 'inner'
 *   - Purpose: semantic preference that helps the decision system choose a
 *     sub-band inside the desiredRange (e.g., outer band → near max range).
 *   - Steering effect: modifies the target radial setpoint and therefore the
 *     steady-state turning/thrust needed.
 *
 * - engagementBias: number
 *   - Purpose: additive bonus to the score for engaging a target; increases
 *     likelihood the AI will commit to a target or move in to engage.
 *   - Oscillation risk: Large engagementBias combined with low patience can
 *     force repeated commitment and abandonment cycles; keep engagementBias
 *     proportional to expected engagement duration.
 *
 * - gates.hpRetreatPct: number
 *   - Purpose: health gate that triggers retreat behavior when the ship's HP
 *     falls below this percentage.
 *   - Steering effect: causes an immediate change in intent (often to Flee or
 *     Regroup) and will command a large, abrupt heading/thrust reversal.
 *   - Oscillation risk: without cooldowns or smoothing, repeated hp events or
 *     noisy HP reads can flip the retreat gate and trigger oscillatory
 *     behavior. Use a cooldown or hysteresis on gate evaluation.
 *
 * Additional notes (cross-field interactions)
 * - desiredRange + aggression + patience: Together these determine approach
 *   dynamics. High aggression with low patience and a narrow desiredRange is
 *   a common recipe for oscillatory throttle/heading as ships overshoot and
 *   rapidly attempt to correct.
 * - dodgeFreq + verticalManeuver: Combining frequent dodges with large
 *   vertical maneuvers produces pronounced 'bobbing' (rapid vertical
 *   oscillations) unless the vertical controller provides damping.
 * - orbit + steering gains: Orbit induces persistent turning. If steering
 *   gains are high it can resonate with angular rate limits and create
 *   oscillatory yaw. Add steering rate limits and a small steering integrator
 *   damping term to reduce this.
 * - engagementBias + classBias: These alter target stickiness and can cause
 *   target churn (switching) if two targets have similar scores — use a
 *   stickiness penalty and a minimum engagement time to avoid frequent target
 *   hand-offs and the consequent steering oscillations.
 *
 * Monitoring & metrics
 * - The codebase already exposes metrics such as `AIHeadingAmplitudeSummary`
 *   and optional `verticalDispersion` on the blackboard. Use these to
 *   quantify oscillation and correlate it back to specific profile fields.
 *
 * Recommended tuning patterns
 * - Start conservative: moderate aggression (0.4–0.6), higher patience
 *   (0.5+), and small verticalManeuver values. Increase individual fields
 *   incrementally while observing heading amplitude and vertical dispersion.
 * - Use hysteresis: add +/- deadband to desiredRange checks and to elevation
 *   band decisions. This is the simplest way to cure chattering.
 * - Smooth commands: apply low-pass filters to commanded heading and thrust
 *   (and to orbit/elevation setpoints) so the physical controller sees a
 *   continuous, damped setpoint rather than a sequence of sharp impulses.
 */

export const AI_PROFILES: Record<string, BehaviorProfile> = {
  brawler: {
    desiredRange: [120, 220] as const,
    orbit: 0,
    aggression: 0.9,
    patience: 0.3,
    dodgeFreq: 0.2,
    classBias: {
      fighter: 20,
      corvette: 10,
      frigate: 5,
    },
    style: 'brawler',
    verticalManeuver: 0.25,
    elevationPreference: 'follow',
    bandPreference: 'mid',
    engagementBias: 25,
    gates: {
      hpRetreatPct: 0.25,
    },
  },
  kiter: {
    desiredRange: [240, 360] as const,
    orbit: 160,
    aggression: 0.5,
    patience: 0.7,
    dodgeFreq: 0.6,
    classBias: {
      destroyer: 8,
      carrier: 12,
    },
    style: 'kiter',
    verticalManeuver: 0.15, // cruiser: 0.15 per issue spec (assuming kiter = cruiser-like)
    elevationPreference: 'follow',
    bandPreference: 'outer',
    engagementBias: 15,
    gates: {
      hpRetreatPct: 0.35,
    },
  },
  escort: {
    desiredRange: [70, 180] as const,
    orbit: 60,
    aggression: 0.8,
    patience: 0.5,
    dodgeFreq: 0.3,
    classBias: {
      fighter: 15,
      corvette: 10,
    },
    style: 'escort',
    verticalManeuver: 0.5, // fighters: 0.5 per issue spec
    elevationPreference: 'follow',
    bandPreference: 'mid',
    engagementBias: 30,
    gates: {
      hpRetreatPct: 0.3,
    },
  },
  artillery: {
    desiredRange: [260, 400] as const,
    orbit: 0,
    aggression: 0.6,
    patience: 0.7,
    dodgeFreq: 0.1,
    classBias: {
      carrier: 25,
      destroyer: 15,
    },
    style: 'artillery',
    verticalManeuver: 0.05, // artillery: 0.05 per issue spec
    elevationPreference: 'above',
    bandPreference: 'outer',
    engagementBias: 10,
    gates: {
      hpRetreatPct: 0.4,
    },
  },
};

/**
 * PROFILE_BY_HULL
 * - Maps a ship hull to a sensible default profile id.
 * - Effect: indirectly selects the movement/engagement style for ships of the
 *   given hull. Changing this mapping will alter global traffic patterns and
 *   should be done carefully: switching hulls to higher-aggression profiles
 *   will increase the chance of oscillatory behavior if not accompanied by
 *   steering/command smoothing.
 */
const PROFILE_BY_HULL: Record<ShipHull, string> = {
  fighter: 'escort',
  corvette: 'brawler',
  frigate: 'brawler',
  destroyer: 'artillery',
  carrier: 'artillery',
};

/**
 * Helper functions
 * - getDefaultProfileId: returns a default profile for a given hull. Useful
 *   when spawning ships or for fallback logic — callers should cache the
 *   resolved profile and avoid frequently re-resolving in hot loops.
 * - resolveBehaviorProfile: safe resolver that returns the canonical
 *   BehaviorProfile for a given id. Returns the 'brawler' profile as a
 *   fallback when the id is unknown.
 *
 * Notes about mutation and safety:
 * - The returned profile objects are references into the shared `AI_PROFILES`
 *   map. Callers MUST NOT mutate profiles in-place because changes will affect
 *   other ships that reuse the same profile object and can create surprising
 *   synchronized behavior or emergent oscillation across multiple ships.
 */
export function getDefaultProfileId(hull: ShipHull): string {
  return PROFILE_BY_HULL[hull] ?? 'brawler';
}

export function resolveBehaviorProfile(profileId: string): BehaviorProfile {
  const profile = AI_PROFILES[profileId];
  if (!profile) {
    return AI_PROFILES.brawler;
  }
  return profile;
}
