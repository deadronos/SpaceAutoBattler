import type { AIPersonality, AIIntent } from '../../config/behaviorConfig.js';
import type { Ship, RNG } from '../../types/index.js';

export type ComputeOptions = {
  // If true, adjust the base duration using the provided evade duration
  // before adding the random range (parity with current controller logic).
  damageEvade?: boolean;
  damageEvadeDuration?: number; // required when damageEvade is true
};

/**
 * IntentManager — small helper to compute and apply intent lifetimes.
 * Keeps exact parity with the legacy logic in AIController:
 *   base = minIntentDuration
 *   if (damageEvade) base = min(base, damageEvadeDuration)
 *   final = base + rng.next() * (max - min)
 */
export class IntentManager {
  computeDuration(personality: AIPersonality, rng: RNG, opts?: ComputeOptions): number {
    const baseMin = personality.minIntentDuration;
    const range = personality.maxIntentDuration - personality.minIntentDuration;
    let base = baseMin;
    if (opts?.damageEvade && typeof opts.damageEvadeDuration === 'number') {
      base = Math.min(base, opts.damageEvadeDuration);
    }
    return base + rng.next() * range;
  }

  /**
   * Applies the intent to the ship and sets intentEndTime using computeDuration.
   * Returns the assigned duration for convenience.
   */
  applyIntent(
    ship: Ship,
    now: number,
    intent: AIIntent,
    personality: AIPersonality,
    rng: RNG,
    opts?: ComputeOptions,
  ): number {
    const duration = this.computeDuration(personality, rng, opts);
  // Ensure aiState exists; use a local variable and assign back to ship to help
  // the TypeScript control-flow analysis narrow the value safely.
  // Ensure aiState exists and set the two fields in a single assignment.
  // Use Object.assign to avoid narrow-control-flow issues with optional properties.
  const baseState = (ship.aiState ?? ({} as unknown)) as Record<string, unknown>;
  const merged = Object.assign(baseState, {
    currentIntent: intent,
    intentEndTime: now + duration,
  });
  ship.aiState = merged as typeof ship.aiState;
    return duration;
  }
}
