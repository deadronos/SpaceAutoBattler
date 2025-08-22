// entities.ts - catalog of ships, bullets, cannon configs and simple factories
import { getShipConfig } from './config/entitiesConfig';

let nextId = 1;
export function genId(): number { return nextId++; }

export type Cannon = {
  damage: number;
  rate: number;
  spread?: number;
  muzzleSpeed?: number;
  bulletRadius?: number;
  bulletTTL?: number;
};

export type Ship = {
  id: number;
  type: string;
  x: number; y: number;
  vx: number; vy: number;
  hp: number; maxHp: number;
  shield?: number; maxShield?: number;
  team?: string;
  xp?: number; level?: number;
  cannons?: Cannon[];
  accel?: number; turnRate?: number; radius?: number;
};

export function createShip(type = 'fighter', x = 0, y = 0, team = 'red'): Ship {
  const cfg = (getShipConfig() as any)[type] || (getShipConfig() as any).fighter;
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
  } as Ship;
}

export type Bullet = {
  id: number; x: number; y: number; vx: number; vy: number; team: string; ownerId?: number | null; damage: number; ttl: number;
};

export function createBullet(x: number, y: number, vx: number, vy: number, team = 'red', ownerId: number | null = null, damage = 1, ttl = 2.0): Bullet {
  return {
    id: genId(),
    x, y, vx, vy, team, ownerId, damage, ttl
  } as Bullet;
}

export type GameState = {
  t: number;
  ships: Ship[];
  bullets: Bullet[];
  explosions: any[];
  shieldHits: any[];
  healthHits: any[];
};

export function makeInitialState(): GameState {
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
