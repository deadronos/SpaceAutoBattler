import type { ShipHull } from '../../types/index.js';

/** List of valid ship hull types. */
export const SHIP_HULLS: readonly ShipHull[] = [
  'fighter',
  'corvette',
  'frigate',
  'destroyer',
  'carrier',
];

/** Bucket boundaries for shot distance histograms. */
export const SHOT_DISTANCE_BUCKETS = [150, 300, 450, 600] as const;
/** Bucket boundaries for vertical delta histograms. */
export const SHOT_DELTA_Y_BUCKETS = [50, 100, 150, 200, 300] as const;
/** Default threshold for considering a maneuver "vertical". */
export const DEFAULT_VERTICAL_THRESHOLD = 100;
/** Maximum number of intent snapshots to keep in history. */
export const MAX_INTENT_TIMELINE_ENTRIES = 512;
