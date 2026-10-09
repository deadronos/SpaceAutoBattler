import type { Vector3 } from 'three';
import type { EntityId } from '../core.js';
import type { Team } from '../gameplay.js';
import type { SensorVisibility } from './sensors.js';

/**
 * Strategic posture of a team.
 */
export type TeamPosture = 'aggressive' | 'hold' | 'retreat';

/**
 * Evaluation of a potential target's priority.
 */
export interface PrioritisedTarget {
  /** ID of the target entity. */
  id: EntityId;
  /** Calculated threat score. */
  threat: number;
  /** Squared distance to the target. */
  distanceSq: number;
  /** Number of allies currently focusing this target. */
  focusLoad: number;
}

/**
 * Shared data structure for AI team coordination and situational awareness.
 */
export interface AIBlackboard {
  /** Current game tick index. */
  tickIndex: number;
  /** Current posture for each team. */
  teamPosture: Record<Team, TeamPosture>;
  /** Centroid position of each team's fleet. */
  allyCentroid: Record<Team, Vector3>;
  /** Map of ship ID to its nearest enemy ID. */
  nearestEnemy: Map<EntityId, EntityId>;
  /** Map of VIP ship ID to its primary threat ID. */
  threatToVip: Map<EntityId, EntityId>;
  /** Pool of temporary vectors for calculation. */
  tmpVectors: Vector3[];
  /** Ratio of team strength relative to the opponent. */
  strengthRatio: Record<Team, number>;
  /** List of prioritized targets for each team. */
  teamPriority: Record<Team, PrioritisedTarget[]>;
  /** Map of target ID to its priority index. */
  priorityIndex: Record<Team, Map<EntityId, number>>;
  /** Map tracking how many allies are focusing each enemy. */
  focusFire: Record<Team, Map<EntityId, number>>;
  /** Visibility status of enemies for each team. */
  visibleEnemies?: Record<Team, Map<EntityId, SensorVisibility>>;
  /** Ship counts per team. */
  teamCounts?: Record<Team, number>;
  /** Vertical dispersion tracking for validation (optional for backward compatibility). */
  verticalDispersion?: {
    headingYSamples: number[];
    positionYSamples: number[];
    lastUpdateTick: number;
  };
}

/**
 * Assignments for team-level coordination.
 */
export interface AITeamAssignments {
  /** Map of escort ship ID to assignment details. */
  escorts: Map<EntityId, EscortAssignment>;
}

/**
 * Details of an escort mission.
 */
export interface EscortAssignment {
  /** ID of the ship to protect. */
  vipId: EntityId;
  /** Formation offset from the VIP. */
  offset: Vector3;
  /** ID of the threat currently engaging the VIP. */
  threatId?: EntityId;
}
