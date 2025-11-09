import type { ShipHull } from '../../types/index.js';

export const SHIP_HULLS: readonly ShipHull[] = [
  'fighter',
  'corvette',
  'frigate',
  'destroyer',
  'carrier',
];

export const SHOT_DISTANCE_BUCKETS = [150, 300, 450, 600] as const;
export const SHOT_DELTA_Y_BUCKETS = [50, 100, 150, 200, 300] as const;
export const DEFAULT_VERTICAL_THRESHOLD = 100;
export const MAX_INTENT_TIMELINE_ENTRIES = 512;
