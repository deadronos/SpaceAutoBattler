// entities.js - catalog of ships, bullets, cannon configs and simple factories
import { getShipConfig, getDefaultShipType } from './config/entitiesConfig';
import { validateConfigOrThrow } from './config/validateConfig';

// Validate ship configuration on module load. In CI / production this will throw.
try {
  validateConfigOrThrow(getShipConfig());
} catch (err) {
  // eslint-disable-next-line no-console
  console.error('Fatal ship config validation error:', err && err.message ? err.message : err);
  // Re-throw so importing modules fail fast in strict environments
  throw err;
}

let nextId = 1;
export function genId() { return nextId++; }

export function createShip(type, x = 0, y = 0, team = 'red') {
  const shipCfg = getShipConfig();
  const resolvedType = (type && shipCfg[type]) ? type : getDefaultShipType();
  const cfg = shipCfg[resolvedType] || shipCfg[getDefaultShipType()];
  return {
    id: genId(),
    type: resolvedType,
    x, y,
    vx: 0, vy: 0,
    hp: cfg.maxHp,
    maxHp: cfg.maxHp,
    shield: cfg.maxShield || 0,
    maxShield: cfg.maxShield || 0,
    team,
    xp: 0,
    level: 1,
    cannons: JSON.parse(JSON.stringify(cfg.cannons || [])),
    accel: cfg.accel || 0,
    turnRate: cfg.turnRate || 0,
    radius: cfg.radius || 6,
  };
}

export function createBullet(x, y, vx, vy, team = 'red', ownerId = null, damage = 1, ttl = 2.0) {
  return {
    id: genId(),
    x, y, vx, vy, team, ownerId, damage, ttl
  };
}

export function makeInitialState() {
  return {
    t: 0,
    ships: [],
    bullets: [],
    explosions: [],
    shieldHits: [],
    healthHits: [],
  };
}

export default { createShip, createBullet, makeInitialState };
