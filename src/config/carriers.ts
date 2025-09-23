import type { CarrierLaunchConfig, CarrierLaunchSlot } from '../types/index.js';

/**
 * Default launch formation offsets relative to the carrier hull. Forward distances are tuned
 * so fighters appear in front of the hangar without clipping the hull, while lateral offsets
 * stagger the squad to avoid immediate overlap when several fighters deploy in succession.
 */
const DEFAULT_LAUNCH_FORMATION: readonly CarrierLaunchSlot[] = Object.freeze([
  { forward: 14, lateral: 0, vertical: 0 },
  { forward: 16, lateral: 4, vertical: 0 },
  { forward: 16, lateral: -4, vertical: 0 },
  { forward: 18, lateral: 8, vertical: 1 },
  { forward: 18, lateral: -8, vertical: 1 },
  { forward: 20, lateral: 0, vertical: 2 },
]);

/**
 * Authoring note: cooldown stays in seconds to align with the simulation delta values. The
 * jitter radius is intentionally small – just enough to break up visual uniformity without
 * compromising deterministic behaviour (all randomness flows through the seeded RNG).
 */
export const CARRIER_LAUNCH_CONFIG: CarrierLaunchConfig = Object.freeze({
  maxActive: 6,
  cooldownSeconds: 1.5,
  batchSize: 1,
  formation: DEFAULT_LAUNCH_FORMATION,
  jitterRadius: 1.25,
});

export type { CarrierLaunchConfig };
