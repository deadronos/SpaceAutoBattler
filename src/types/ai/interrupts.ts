import type { EntityId } from '../core.js';

/**
 * Reasons why an AI might interrupt its current intent.
 */
export type AIInterruptReason = 'hp-drop' | 'target-lost' | 'vip-threat' | 'manual';

/**
 * Record of an interrupt event.
 */
export interface IntentInterruptEvent {
  /** ID of the ship being interrupted. */
  shipId: EntityId;
  /** Reason for the interrupt. */
  reason: AIInterruptReason;
  /** Game tick when the interrupt occurred. */
  tick: number;
  /** Source ID associated with the interrupt (e.g., attacker). */
  sourceId?: EntityId;
}

/**
 * State tracking for the interrupt system.
 */
export interface AIInterruptState {
  /** Map of cooldown keys to expiration ticks. */
  cooldownTick: Map<string, number>;
  /** Map of accumulated damage per ship this tick. */
  damageThisTick: Map<EntityId, number>;
  /** Last tick where damage was processed. */
  lastDamageTick: number;
  /** Map of VIPs to their current threats. */
  vipThreatAssignments: Map<EntityId, EntityId>;
}
