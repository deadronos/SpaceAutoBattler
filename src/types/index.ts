export type EntityId = number;

export type Team = 'red' | 'blue';

export type ShipClass = 'fighter' | 'corvette' | 'frigate' | 'destroyer' | 'carrier';

export interface Vector2 {
  x: number;
  y: number;
}

export interface RNG {
  seed: string;
  next(): number; // [0,1)
  int(min: number, max: number): number; // inclusive
  pick<T>(arr: readonly T[]): T;
}

export interface TurretConfig {
  id: string;
  cooldown: number; // seconds
  bulletSpeed: number; // units/sec
  damage: number;
  range: number; // units
}

export interface ShipClassConfig {
  class: ShipClass;
  baseHealth: number;
  armor: number;
  shield: number;
  shieldRegen: number; // per second
  speed: number; // units/sec
  turnRate: number; // rad/sec
  turrets: TurretConfig[];
  maxFighters?: number; // carriers only
  fighterSpawnCooldown?: number; // carriers only, seconds
}

export interface SimBounds {
  width: number;
  height: number;
}

export interface Bullet {
  id: EntityId;
  ownerShipId: EntityId;
  ownerTeam: Team;
  pos: Vector2;
  vel: Vector2;
  ttl: number; // seconds
  damage: number;
}

export interface TurretState {
  id: string; // from config
  cooldownLeft: number; // seconds
}

export interface Leveling {
  level: number;
  xp: number;
  nextLevelXp: number;
}

export interface Ship {
  id: EntityId;
  team: Team;
  class: ShipClass;
  pos: Vector2;
  vel: Vector2;
  dir: number; // radians
  targetId: EntityId | null;
  health: number;
  maxHealth: number;
  armor: number;
  shield: number;
  maxShield: number;
  shieldRegen: number;
  speed: number;
  turnRate: number;
  turrets: TurretState[];
  kills: number;
  level: Leveling;
  spawnedFighters?: number; // for carriers
  fighterSpawnCdLeft?: number; // seconds
  parentCarrierId?: EntityId; // for fighters spawned by carriers
}

export interface ScoreBoard {
  red: number;
  blue: number;
}

export interface RendererHandles {
  initDone: boolean;
  resize: () => void;
  render: (dt: number) => void;
  dispose: () => void;
}

export interface Config {
  simBounds: SimBounds;
  classes: Record<ShipClass, ShipClassConfig>;
  tickRate: number; // ticks per second
  maxEntities: number;
}

export interface GameState {
  time: number; // seconds
  tick: number;
  running: boolean;
  speedMultiplier: number; // 0.5x/1x/2x/4x
  rng: RNG;
  nextId: number;
  config: Config;
  ships: Ship[];
  bullets: Bullet[];
  score: ScoreBoard;
  renderer?: RendererHandles;
}

export type UIElements = {
  canvas: HTMLCanvasElement;
  startPause: HTMLButtonElement;
  reset: HTMLButtonElement;
  addRed: HTMLButtonElement;
  addBlue: HTMLButtonElement;
  toggleTrails: HTMLButtonElement;
  speed: HTMLDivElement;
  redScore: HTMLDivElement;
  blueScore: HTMLDivElement;
  stats: HTMLDivElement;
  continuous: HTMLInputElement;
  seedBtn: HTMLButtonElement;
  formationBtn: HTMLButtonElement;
};
