import { Vector3 } from 'three';
import { clampToWorld } from '../config.js';
import { fireProjectile } from '../systems.js';
import { recordShotMetrics } from '../metrics.js';
import type { HarnessGameState, HarnessShip } from './types.js';

const HARNESS_TEMP = new Vector3();

export function applyHarnessIntegration(state: HarnessGameState, delta: number): void {
  const ships = state.queries.ships.entities as HarnessShip[];
  for (const ship of ships) {
    const ai = ship.ai;
    if (!ai) continue;

    const heading = HARNESS_TEMP.copy(ai.command.heading);
    if (heading.lengthSq() < 1e-5) {
      heading.set(0, 0, 1).applyQuaternion(ship.transform.rotation);
    } else {
      heading.normalize();
    }

    const thrust = Math.max(0, Math.min(1, ai.command.thrust));
    const move = ship.ship.speed * thrust * delta;
    ship.transform.position.addScaledVector(heading, move);
    if (ship.__harnessVelocity) {
      ship.transform.position.addScaledVector(ship.__harnessVelocity, delta);
    }
    clampToWorld(ship.transform.position);

    if (ai.command.firePrimary && ship.ship.cooldown <= 0) {
      const targetId = ai.command.targetId ?? ai.targetId;
      const target = targetId
        ? ships.find((candidate) => candidate.id === targetId) ?? null
        : null;

      const distanceToTarget = target
        ? ship.transform.position.distanceTo(target.transform.position)
        : undefined;
      const deltaY = target ? target.transform.position.y - ship.transform.position.y : undefined;

      recordShotMetrics(state.ai.metrics, {
        shipId: ship.id,
        hull: ship.ship.hull,
        time: state.time,
        distance: distanceToTarget,
        deltaY,
      });

      const fireDirection = heading.clone().normalize();
      fireProjectile(state, ship, fireDirection);
      ship.ship.cooldown = ship.ship.fireRate;
    }

    if (ship.ship.cooldown > 0) {
      ship.ship.cooldown -= delta;
    }
  }
}
