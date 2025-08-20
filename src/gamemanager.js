import { srand } from './rng.js';
import { createShip } from './entities.js';
import { simulateStep } from './simulate.js';

export const ships = [];
export const bullets = [];
export const particles = [];
export const stars = [];
export const flashes = [];
export const shieldFlashes = [];
export const healthFlashes = [];

let _seed = null;
let _reinforcementInterval = 5.0;
let _reinforcementAccumulator = 0;

export function reset(seedValue = null) {
  ships.length = 0; bullets.length = 0; particles.length = 0; stars.length = 0;
  flashes.length = 0; shieldFlashes.length = 0; healthFlashes.length = 0;
  _reinforcementAccumulator = 0;
  if (typeof seedValue === 'number') { _seed = seedValue >>> 0; srand(_seed); }
}

export function simulate(dt, W = 800, H = 600) {
  const state = { ships, bullets, particles, stars, explosions: [], shieldHits: [], healthHits: [] };
  evaluateReinforcement(dt);
  simulateStep(state, dt, { W, H });
  // merge emitted events into exported arrays for renderer
  flashes.push(...state.explosions);
  shieldFlashes.push(...state.shieldHits);
  healthFlashes.push(...state.healthHits);
  return { ships, bullets, particles, flashes: flashes, shieldFlashes, healthFlashes, stars };
}

export function processStateEvents(state, dt = 0) {
  // placeholder for manager-level logic (XP, scoring)
  return state;
}

export function evaluateReinforcement(dt) {
  _reinforcementAccumulator += dt;
  if (_reinforcementAccumulator >= _reinforcementInterval) {
    _reinforcementAccumulator = 0;
    // spawn a pair of ships for each team
    ships.push(createShip({ x: 100, y: 100, team: 'red' }));
    ships.push(createShip({ x: 700, y: 500, team: 'blue' }));
  }
}

export function setReinforcementInterval(seconds) { _reinforcementInterval = seconds; }
export function getReinforcementInterval() { return _reinforcementInterval; }

export default { reset, simulate, processStateEvents, evaluateReinforcement, ships, bullets };
