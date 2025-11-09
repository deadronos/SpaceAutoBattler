import type { GameState, ProjectileEntity, ShipEntity } from '../../../types/index.js';
import type { ProjectileHomingConfig } from '../../../types/combat.js';
import {
  FORWARD,
  computeLeadDirection,
  orientQuaternionFromDirection,
  steerDirection,
} from '../../../utils/steering.js';
import { TEMP_TARGET } from './sharedTemps.js';

export function findShipById(
  state: GameState,
  id: number | undefined | null,
): ShipEntity | undefined {
  if (id == null) return undefined;
  const ships = state.queries.ships.entities as ShipEntity[];
  return ships.find((s) => s.id === id);
}

export function steerProjectileTowardTarget(
  projectile: ProjectileEntity,
  target: ShipEntity,
  homing: ProjectileHomingConfig,
  delta: number,
): void {
  const currentDir = projectile.direction;
  const separationSq = TEMP_TARGET.copy(target.transform.position)
    .sub(projectile.transform.position)
    .lengthSq();
  if (separationSq <= 1e-6) {
    return;
  }

  const desired = computeLeadDirection(
    target.transform.position,
    projectile.transform.position,
    target.ship.velocity,
    homing.lead ? 0.5 : 0,
    TEMP_TARGET,
  );

  const { newDir, angle } = steerDirection(currentDir, desired, homing.turnRate, delta, currentDir);
  if (angle < 1e-5) {
    return;
  }

  projectile.direction = newDir;
  orientQuaternionFromDirection(newDir, FORWARD, projectile.transform.rotation);
}
