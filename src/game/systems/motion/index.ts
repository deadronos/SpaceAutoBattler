import type { GameState, ShipEntity } from '../../../types/index.js';
import { updateAngularMotion } from './angular.js';
import { updateLinearMotion } from './linear.js';
import { applyVelocityToPhysics } from './physicsSync.js';
export { shortestAngle, dampingFactor } from './math.js';

export function updateMotionSystem(state: GameState, dt: number): void {
  const ships = state.queries.ships.entities as ShipEntity[];

  for (const ship of ships) {
    if (!ship.ai?.command) continue;

    const command = ship.ai.command;

    updateAngularMotion(ship, command.heading, dt);
    updateLinearMotion(ship, command, dt);
    applyVelocityToPhysics(state, ship, dt);
  }
}
