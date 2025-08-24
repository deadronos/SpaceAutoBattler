import { getShipConfig, getDefaultShipType, BULLET_DEFAULTS } from "./config/entitiesConfig";
import { TEAM_DEFAULT } from "./config/teamsConfig";
import type { ShipConfigMap, ShipSpec } from "./types/index";

let nextId = 1;
export function genId(): number {
  return nextId++;
}

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
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  shield?: number;
  maxShield?: number;
  team?: string;
  xp?: number;
  level?: number;
  cannons?: Cannon[];
  accel?: number; // max acceleration from config
  currentAccel?: number; // dynamic, set by AI/gamemanager, 0..accel
  throttle?: number; // 0..1, set by AI/gamemanager
  steering?: number; // -1..1, set by AI/gamemanager
  turnRate?: number;
  radius?: number;
  angle?: number; // heading in radians
  friction?: number; // velocity damping factor (default 0.98)
  maxSpeed?: number; // max speed override for tests/simulation
  // optional AI runtime slot used by tests and behavior logic
  __ai?: any;
  // Renderer/simulation convenience fields
  hpPercent?: number;
  shieldPercent?: number;
  shieldRegen?: number;
  trail?: { x: number; y: number }[];
  turrets?: Array<{
    position: [number, number];
    kind: string;
    targeting?: string;
    cooldown?: number;
    lastFired?: number;
  }>;
};

export function createShip(
  type: string | undefined = undefined,
  x = 0,
  y = 0,
  team = TEAM_DEFAULT,
): Ship {
  const shipCfg = getShipConfig() as ShipConfigMap;
  const availableTypes = Object.keys(shipCfg || {});
  const resolvedType =
    type && shipCfg[type]
      ? type
      : availableTypes.length
        ? availableTypes[0]
        : getDefaultShipType();
  const cfg = (shipCfg[resolvedType] ||
    shipCfg[getDefaultShipType()]) as Partial<ShipSpec>;
  return {
    id: genId(),
    type: resolvedType,
    x,
    y,
    vx: 0,
    vy: 0,
    hp: cfg.maxHp,
    maxHp: cfg.maxHp,
    shield: cfg.maxShield || 0,
    maxShield: cfg.maxShield || 0,
    team,
    xp: 0,
    level: 1,
    cannons: JSON.parse(JSON.stringify(cfg.cannons || [])),
    accel: cfg.accel || 0,
    currentAccel: 0, // start at rest, AI/gamemanager sets this
    throttle: 0, // start at rest, AI/gamemanager sets this
    steering: 0, // start straight, AI/gamemanager sets this
    turnRate: cfg.turnRate || 0,
    radius: cfg.radius || 6,
    maxSpeed: cfg.maxSpeed || undefined,
    angle: 0,
  } as Ship;
}

export type Bullet = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  team: string;
  ownerId?: number | null;
  damage: number;
  ttl: number;
  radius?: number;
  bulletRadius?: number;
  bulletTTL?: number;
  kind?: string;
};

export function createBullet(
  x: number,
  y: number,
  vx: number,
  vy: number,
  team = TEAM_DEFAULT,
  ownerId: number | null = null,
  damage = 1,
  ttl = 2.0,
): Bullet {
  return {
    id: genId(),
    x,
    y,
    vx,
    vy,
    team,
    ownerId,
    damage,
    ttl,
  } as Bullet;
}

export type GameState = {
  t: number;
  ships: Ship[];
  bullets: Bullet[];
  explosions: any[];
  shieldHits: any[];
  healthHits: any[];
  engineTrailsEnabled?: boolean;
  starCanvas?: HTMLCanvasElement;
};

export function makeInitialState(): GameState {
  return {
    t: 0,
    ships: [],
    bullets: [],
    explosions: [],
    shieldHits: [],
    healthHits: [],
    engineTrailsEnabled: true,
  };
}

export default { createShip, createBullet, makeInitialState };
