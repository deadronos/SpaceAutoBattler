import { Quaternion, Vector3 } from 'three';
import type {
  CarrierComponent,
  CarrierLaunchConfig,
  CarrierLaunchSlot,
  GameState,
  ShipBlueprint,
  ShipEntity,
} from '../../types/index.js';
import { spawnShip } from '../ships.js';
import { enqueueDeferredMutation } from '../simulationQueue.js';

const TEMP_FORWARD = new Vector3();
const TEMP_RIGHT = new Vector3();
const TEMP_UP = new Vector3();
const TEMP_OFFSET = new Vector3();
const TEMP_POS = new Vector3();
const GLOBAL_FORWARD = new Vector3(0, 0, 1);
const GLOBAL_UP = new Vector3(0, 1, 0);
const FALLBACK_SLOT: CarrierLaunchSlot = { forward: 14, lateral: 0, vertical: 0 };

/**
 * Spawn fighters from carrier hulls while respecting cooldowns and active caps. The system is
 * deterministic: all positional jitter draws from the seeded RNG carried on the GameState.
 */
export function updateCarrierLaunchSystem(state: GameState, dt: number): void {
  const ships = state.queries.ships.entities as ShipEntity[] | undefined;
  if (!ships || ships.length === 0) return;

  const aliveById = new Map<number, ShipEntity>();
  for (const ship of ships) aliveById.set(ship.id, ship);

  for (const ship of ships) {
    const carrier = ship.carrier;
    if (!carrier) continue;
    if (ship.ship.hp <= 0) {
      carrier.activeFighterIds.length = 0;
      continue;
    }

    pruneTrackedFighters(carrier, aliveById, ship.id);
    carrier.launchCooldownRemaining = Math.max(0, carrier.launchCooldownRemaining - dt);

    const availableSlots = carrier.config.maxActive - carrier.activeFighterIds.length;
    if (availableSlots <= 0) continue;
    if (carrier.launchCooldownRemaining > 0) continue;

    const launches = Math.min(carrier.config.batchSize, availableSlots);
    if (launches <= 0) continue;

    let spawned = 0;
    for (; spawned < launches; spawned += 1) {
      const slotIndex = (carrier.launchIndex + spawned) % Math.max(1, carrier.config.formation.length);
      const slot = carrier.config.formation[slotIndex] ?? FALLBACK_SLOT;
      const spawnPosition = computeLaunchPosition(ship, carrier.config, slot, state).clone();
      const heading = computeHeadingYaw(ship.transform.rotation);
      const blueprint: ShipBlueprint = {
        hull: 'fighter',
        team: ship.ship.team,
        position: spawnPosition,
        heading,
        parentCarrierId: ship.id,
      };

      enqueueDeferredMutation(state, () => {
        const fighter = spawnShip(state, blueprint);
        carrier.activeFighterIds.push(fighter.id);
        aliveById.set(fighter.id, fighter);
      });
    }

    carrier.launchIndex += spawned;
    carrier.launchCooldownRemaining = carrier.config.cooldownSeconds;
  }

}

function pruneTrackedFighters(
  carrier: CarrierComponent,
  aliveById: Map<number, ShipEntity>,
  carrierId: number,
): void {
  if (carrier.activeFighterIds.length === 0) return;
  let write = 0;
  for (let i = 0; i < carrier.activeFighterIds.length; i += 1) {
    const fighterId = carrier.activeFighterIds[i];
    const fighter = aliveById.get(fighterId);
    if (!fighter) continue;
    const component = fighter.ship;
    if (!component) continue;
    if (component.parentCarrierId !== carrierId) continue;
    if (component.hp <= 0) continue;
    carrier.activeFighterIds[write] = fighterId;
    write += 1;
  }
  carrier.activeFighterIds.length = write;
}

function computeHeadingYaw(rotation: Quaternion): number {
  const forward = TEMP_FORWARD.copy(GLOBAL_FORWARD).applyQuaternion(rotation);
  forward.y = 0;
  if (forward.lengthSq() < 1e-6) return 0;
  forward.normalize();
  return Math.atan2(forward.x, forward.z);
}

function computeLaunchPosition(
  carrier: ShipEntity,
  config: CarrierLaunchConfig,
  slot: CarrierLaunchSlot,
  state: GameState,
): Vector3 {
  const forward = TEMP_FORWARD.copy(GLOBAL_FORWARD).applyQuaternion(carrier.transform.rotation);
  if (forward.lengthSq() < 1e-6) forward.copy(GLOBAL_FORWARD);
  forward.normalize();

  const up = TEMP_UP.copy(GLOBAL_UP).applyQuaternion(carrier.transform.rotation);
  if (up.lengthSq() < 1e-6) up.copy(GLOBAL_UP);
  up.normalize();

  const right = TEMP_RIGHT.copy(forward).cross(up);
  if (right.lengthSq() < 1e-6) {
    right.copy(GLOBAL_FORWARD).cross(GLOBAL_UP).normalize();
  } else {
    right.normalize();
  }

  const offset = TEMP_OFFSET.copy(forward).multiplyScalar(slot.forward);
  offset.addScaledVector(right, slot.lateral);
  if (slot.vertical != null && slot.vertical !== 0) offset.addScaledVector(up, slot.vertical);

  const jitterRadius = config.jitterRadius ?? 0;
  if (jitterRadius > 0) {
    const jitter = (state.rng.next() * 2 - 1) * jitterRadius;
    offset.addScaledVector(right, jitter);
  }

  return TEMP_POS.copy(carrier.transform.position).add(offset);
}
