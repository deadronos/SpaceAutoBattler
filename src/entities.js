// entities.js - catalog of ships, bullets, cannon configs and simple factories
import { getShipConfig } from './config/entitiesConfig.js';

let nextId = 1;
export function genId() { return nextId++; }

export function createShip(type = 'fighter', x = 0, y = 0, team = 'red') {
  const cfg = getShipConfig()[type] || getShipConfig().fighter;
  return {
    id: genId(),
    type,
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
