import type { EntityId } from '../core.js';
import type { Team } from '../gameplay.js';

/**
 * State of a sensor contact.
 */
export interface SensorVisibility {
  /** Signal strength (0..1). */
  strength: number;
  /** Tick index when the contact was last seen. */
  lastSeenTick: number;
  /** ID of the ship detecting this contact. */
  sourceId: EntityId;
  /** Whether the contact is currently occluded. */
  occluded: boolean;
  /** Distance to the contact. */
  distance: number;
}

/**
 * State of the sensor system.
 */
export interface SensorState {
  /** Last tick the sensors were updated. */
  lastUpdateTick: number;
  /** Visibility map per team. */
  visibilityByTeam: Record<Team, Map<EntityId, SensorVisibility>>;
  /** Rate at which signal strength decays. */
  decayRate: number;
  /** Minimum signal strength for detection. */
  threshold: number;
  /** Tick duration before a stale contact is removed. */
  staleDecay: number;
}
