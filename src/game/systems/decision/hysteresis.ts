import type { AIState, BehaviorProfile } from '../../../types/index.js';

type LastRangeDecision = 'inside' | 'above' | 'below' | 'unknown';

interface HysteresisState {
  lastDecision: LastRangeDecision;
  lastDecisionTick: number;
  lockUntilTick: number;
  lastVerticalAmplitude: number;
  lastVerticalTick: number;
}

const HYSTERESIS_MAP = new WeakMap<AIState, HysteresisState>();

function ensureState(ai: AIState): HysteresisState {
  let s = HYSTERESIS_MAP.get(ai);
  if (!s) {
    s = {
      lastDecision: 'unknown',
      lastDecisionTick: 0,
      lockUntilTick: 0,
      lastVerticalAmplitude: 0,
      lastVerticalTick: 0,
    };
    HYSTERESIS_MAP.set(ai, s);
  }
  return s;
}

/**
 * Compute adjusted desired range with small stateful hysteresis to avoid
 * rapid approach/retreat flip-flopping.
 *
 * Behavior:
 * - Keeps a tiny history of the last range decision (inside / above / below)
 *   and expands the threshold for the currently active side. The expansion
 *   scales with profile.patience so more patient behaviours resist flipping.
 * - Applies a short lock window (lockUntilTick) after transitions so multiple
 *   rapid toggles are suppressed.
 *
 * Returns an adjusted [min, max] range that callers should use instead of the
 * nominal profile values for comparisons.
 */
export function computeEffectiveDesiredRange(
  ai: AIState,
  profile: BehaviorProfile,
  distance: number,
  tickIndex: number,
): readonly [number, number] {
  const s = ensureState(ai);
  const [nomMin, nomMax] = profile.desiredRange;

  // Base hysteresis fraction and patience scaling
  const basePct = 0.05; // 5% base
  const patienceScale = Math.max(0, Math.min(0.35, profile.patience * 0.25));
  const hysteresisPct = basePct + patienceScale; // ~0.05 - 0.4

  // Slightly increase hysteresis for low-aggression ships to avoid rapid
  // corrections; aggressive ships are allowed to be snappier.
  const aggressionFactor = 1 - Math.max(0, Math.min(1, profile.aggression)) * 0.25;
  const combinedPct = hysteresisPct * aggressionFactor;

  // Thresholds used to transition between states
  const approachThreshold = nomMax * (1 + combinedPct);
  const retreatThreshold = nomMax * (1 - combinedPct * 0.5);
  const enterLower = nomMin * (1 - combinedPct);
  const exitLower = nomMin * (1 + combinedPct * 0.5);

  // Locking window to avoid quick re-evaluations (in ticks); scales with patience
  const lockWindow = Math.max(4, Math.round(6 + profile.patience * 60));

  // If we're currently locked, keep the previous decision unless the lock
  // expired (tickIndex >= s.lockUntilTick)
  const locked = tickIndex < s.lockUntilTick;

  // Determine next decision
  let nextDecision: LastRangeDecision = s.lastDecision;
  if (!locked) {
    if (s.lastDecision === 'above') {
      // If we were above, require a stricter retreat threshold to return
      // to 'inside' so we don't flip back-and-forth near the edge.
      if (distance <= retreatThreshold) {
        nextDecision = 'inside';
      } else {
        nextDecision = 'above';
      }
    } else if (s.lastDecision === 'below') {
      // If we were below, require moving past exitLower to consider ourselves
      // back 'inside'. This is asymmetrical to reduce chatter on the lower
      // boundary.
      if (distance >= exitLower) {
        nextDecision = 'inside';
      } else {
        nextDecision = 'below';
      }
    } else {
      // No prior strong opinion; use the nominal thresholds to decide.
      if (distance > approachThreshold) {
        nextDecision = 'above';
      } else if (distance < enterLower) {
        nextDecision = 'below';
      } else {
        nextDecision = 'inside';
      }
    }
    if (nextDecision !== s.lastDecision) {
      // transition -> set lock
      s.lastDecision = nextDecision;
      s.lastDecisionTick = tickIndex;
      s.lockUntilTick = tickIndex + lockWindow;
    }
  }

  // Produce adjusted bounds that bias decisions to the current decision
  let effMin = nomMin;
  let effMax = nomMax;
  if (s.lastDecision === 'above') {
    // while considered 'above', expand the max so the ship keeps approaching
    effMax = nomMax * (1 + combinedPct);
  } else if (s.lastDecision === 'below') {
    // while 'below', reduce the min so the ship keeps retreating less often
    effMin = nomMin * (1 - combinedPct);
  } else {
    // inside -> tighten slightly to reduce noisy edge-crossing
    effMin = nomMin * (1 + Math.min(0.02, combinedPct * 0.15));
    effMax = nomMax * (1 - Math.min(0.02, combinedPct * 0.15));
  }

  return [effMin, effMax];
}

/**
 * Damp the raw vertical amplitude to reduce excessive bobbing when repeated
 * high vertical amplitudes are observed. Uses a short cooldown to lower
 * amplitude on recurring large samples.
 */
export function dampVerticalAmplitude(
  ai: AIState,
  profile: BehaviorProfile,
  rawAmplitude: number,
  tickIndex: number,
): number {
  const s = ensureState(ai);
  const now = tickIndex;
  const recentDecayTicks = Math.max(8, Math.round(10 + profile.patience * 60));

  // If the last recorded amplitude was high and recent, reduce the current
  // amplitude by a small factor; otherwise record amplitude and return as-is.
  const amplitudeSpike = rawAmplitude > 0.35; // threshold for 'large' amplitude
  if (amplitudeSpike && now - s.lastVerticalTick < recentDecayTicks) {
    // Progressive damping: stronger damping for repeated spikes and for
    // profiles with low patience (they're more likely to oscillate)
    const patienceFactor = 1 - Math.min(1, profile.patience) * 0.5;
    const damping = 0.6 + (0.3 * patienceFactor); // ~0.6 - 0.9
    const adjusted = rawAmplitude * damping;
    s.lastVerticalAmplitude = adjusted;
    s.lastVerticalTick = now;
    return adjusted;
  }

  // Otherwise just record and return
  s.lastVerticalAmplitude = rawAmplitude;
  s.lastVerticalTick = now;
  return rawAmplitude;
}
