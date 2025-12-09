import { Vector3 } from 'three';
import type { GameState, ShipHull, Team } from '../types/index.js';
import { spawnShip, SHIP_STATS } from './ships.js';
import { WORLD_HALF, SPAWN_CONFIG, clampToWorld } from './config.js';

/**
 * Spawns the initial fleets for both teams at the start of the game.
 * Positions are calculated based on formation, jitter, and world bounds.
 *
 * @param {GameState} state - The game state to spawn entities into.
 */
export function spawnInitialFleets(state: GameState): void {
  const formation: ShipHull[] = ['fighter', 'corvette', 'frigate', 'destroyer', 'carrier'];
  const maxRange = Math.max(...Object.values(SHIP_STATS).map((stats) => stats.range));
  const separation = Math.max(200, maxRange * SPAWN_CONFIG.initialSeparationFactor);
  const halfSeparation = separation * 0.5;
  const baseSpacing = Math.max(120, separation * 0.25);
  const depthJitter = separation * 0.2;
  const verticalSpread = WORLD_HALF * SPAWN_CONFIG.verticalSpreadFactor;
  const radialJitter = separation * 0.15;
  const blueAnchorX = -halfSeparation;
  const redAnchorX = halfSeparation;
  const anchorYOffsetRange = SPAWN_CONFIG.anchorYRandomization ? verticalSpread * 0.5 : 0;
  const blueAnchorY = SPAWN_CONFIG.anchorYRandomization
    ? (state.rng.next() - 0.5) * anchorYOffsetRange
    : 0;
  const redAnchorY = SPAWN_CONFIG.anchorYRandomization
    ? (state.rng.next() - 0.5) * anchorYOffsetRange
    : 0;

  formation.forEach((hull, index) => {
    const offset = index - (formation.length - 1) / 2;
    const zBase = offset * baseSpacing;
    const zJitter = (state.rng.next() - 0.5) * depthJitter;
    const yOffset = (state.rng.next() - 0.5) * verticalSpread;
    const xJitter = (state.rng.next() - 0.5) * radialJitter;

    const bluePosition = new Vector3(blueAnchorX + xJitter, blueAnchorY + yOffset, zBase + zJitter);
    const redPosition = new Vector3(redAnchorX - xJitter, redAnchorY - yOffset, -(zBase + zJitter));

    clampToWorld(bluePosition);
    clampToWorld(redPosition);

    spawnShip(state, {
      hull,
      team: 'blue',
      position: bluePosition,
      heading: 0,
    });

    spawnShip(state, {
      hull,
      team: 'red',
      position: redPosition,
      heading: Math.PI,
    });
  });
}

/**
 * Spawns a single random ship for a specific team at a random position.
 * Used for reinforcing fleets or testing.
 *
 * @param {GameState} state - The game state.
 * @param {Team} team - The team the ship belongs to.
 */
export function spawnRandomShip(state: GameState, team: Team): void {
  const hulls: ShipHull[] = ['fighter', 'corvette', 'frigate', 'destroyer', 'carrier'];
  const hull = hulls[Math.floor(state.rng.next() * hulls.length)];

  const lateralRadius = WORLD_HALF * 0.25;
  const verticalSpread = WORLD_HALF * SPAWN_CONFIG.verticalSpreadFactor;
  const anchorX = (team === 'blue' ? -1 : 1) * WORLD_HALF * 0.3;
  const x = anchorX + (state.rng.next() - 0.5) * lateralRadius;
  const z = (state.rng.next() - 0.5) * lateralRadius;
  const y = (state.rng.next() - 0.5) * verticalSpread;
  const heading = team === 'blue' ? 0 : Math.PI;

  const position = new Vector3(x, y, z);
  clampToWorld(position);

  spawnShip(state, {
    hull,
    team,
    position,
    heading,
  });
}
