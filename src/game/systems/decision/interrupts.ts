import type {
  AIInterruptReason,
  AIInterruptState,
  AIManagerState,
  GameState,
  IntentInterruptEvent,
  ShipEntity,
  EntityId,
} from '../../../types/index.js';
import { AI_CONFIG } from '../../config.js';

const INTERRUPT_KEY_SEPARATOR = ':';

function interruptKey(shipId: EntityId, reason: AIInterruptReason): string {
  return `${shipId}${INTERRUPT_KEY_SEPARATOR}${reason}`;
}

/**
 * Ensures the interrupt state is initialized in the AI manager.
 *
 * @param {AIManagerState} manager - The AI manager state.
 * @returns {AIInterruptState} The interrupt state.
 */
export function ensureInterruptState(manager: AIManagerState): AIInterruptState {
  if (!manager.interruptState) {
    manager.interruptState = {
      cooldownTick: new Map(),
      damageThisTick: new Map(),
      lastDamageTick: -1,
      vipThreatAssignments: new Map(),
    };
  }
  return manager.interruptState;
}

/**
 * Gets the current queue of pending interrupts.
 *
 * @param {AIManagerState} manager - The AI manager state.
 * @returns {IntentInterruptEvent[]} The queue of interrupts.
 */
export function getInterruptQueue(manager: AIManagerState): IntentInterruptEvent[] {
  if (!manager.interrupts) manager.interrupts = [];
  return manager.interrupts;
}

/**
 * Queues an interrupt event to be processed in the next AI tick.
 * Respects cooldowns for similar interrupts.
 *
 * @param {AIManagerState} manager - The AI manager state.
 * @param {IntentInterruptEvent} event - The interrupt event.
 */
export function queueInterrupt(manager: AIManagerState, event: IntentInterruptEvent): void {
  const state = ensureInterruptState(manager);
  const queue = getInterruptQueue(manager);
  const key = interruptKey(event.shipId, event.reason);
  const cooldown = Math.max(0, AI_CONFIG.interruptCooldownTicks ?? 0);
  const lastTick = state.cooldownTick.get(key);
  if (lastTick != null && event.tick - lastTick <= cooldown) return;
  state.cooldownTick.set(key, event.tick);
  queue.push(event);
}

/**
 * Accumulates damage for a ship to trigger HP-drop interrupts.
 *
 * @param {AIManagerState} manager - The AI manager state.
 * @param {EntityId} shipId - The ship taking damage.
 * @param {number} damage - The amount of damage taken.
 * @param {number} tick - The current tick.
 * @returns {number} The total accumulated damage this tick.
 */
export function accumulateInterruptDamage(
  manager: AIManagerState,
  shipId: EntityId,
  damage: number,
  tick: number,
): number {
  const state = ensureInterruptState(manager);
  if (state.lastDamageTick !== tick) {
    state.damageThisTick.clear();
    state.lastDamageTick = tick;
  }
  const next = (state.damageThisTick.get(shipId) ?? 0) + damage;
  state.damageThisTick.set(shipId, next);
  return next;
}

/**
 * Queues interrupts for all ships that were targeting a specific ship that has been lost (destroyed).
 *
 * @param {GameState} state - The game state.
 * @param {ShipEntity[]} ships - The list of active ships.
 * @param {EntityId} targetId - The ID of the lost target.
 */
export function queueTargetLossInterrupts(
  state: GameState,
  ships: ShipEntity[],
  targetId: EntityId,
): void {
  const manager = state.ai;
  if (!manager) return;
  const queueTick = manager.tickIndex;
  for (const ship of ships) {
    if (ship.id === targetId) continue;
    const ai = ship.ai;
    if (!ai || ai.targetId !== targetId) continue;
    queueInterrupt(manager, {
      shipId: ship.id,
      reason: 'target-lost',
      tick: queueTick,
      sourceId: targetId,
    });
  }
}

/**
 * Processes the interrupt queue, forcing immediate re-evaluation for affected ships.
 *
 * @param {AIManagerState} manager - The AI manager state.
 * @param {Map<number, ShipEntity>} entities - Lookup map for ships.
 */
export function processInterruptQueue(
  manager: AIManagerState,
  entities: Map<number, ShipEntity>,
): void {
  const queue = getInterruptQueue(manager);
  if (queue.length === 0) return;
  const metrics = manager.metrics;
  const currentTick = manager.tickIndex;
  for (const event of queue) {
    const ship = entities.get(event.shipId);
    if (!ship || !ship.ai) continue;
    if (ship.ship.hp <= 0) continue;
    if (ship.ai.nextThinkAt > currentTick) {
      ship.ai.nextThinkAt = currentTick;
    }
    const latency = Math.max(0, currentTick - event.tick);
    const bucket = latency >= 3 ? 3 : latency;
    metrics.decisionLatencyBuckets[bucket] += 1;
  }
  queue.length = 0;
}
