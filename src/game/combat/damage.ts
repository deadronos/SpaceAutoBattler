/**
 * Barrel re-export for damage calculations and application.
 *
 * Split into:
 *   - `damageMath.ts`       — pure damage calculation (`calculateEffectiveDamage`)
 *   - `damageApplication.ts` — state mutation + callbacks (`applyDamageResultToShip`)
 */
export type { DamageBreakdown } from './damageMath.js';
export { calculateEffectiveDamage } from './damageMath.js';
export type {
  DamageSourceMeta,
  DamageApplicationContext,
  ShieldRippleCallbackContext,
  DamageApplicationCallbacks,
  ApplyDamageResultOptions,
  DamageApplicationSummary,
} from './damageApplication.js';
export { applyDamageResultToShip } from './damageApplication.js';
