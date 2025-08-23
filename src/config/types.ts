// Shared configuration types for SpaceAutoBattler
export interface CannonSpec {
  // common cannon fields used by simulation and progression
  // damage is required for simulation damage calculations
  damage: number;
  ttl?: number;
  reload?: number;
  range?: number;
  angle?: number;
  // fields commonly found in cannon config objects
  rate?: number;
  spread?: number;
  muzzleSpeed?: number;
  bulletRadius?: number;
  bulletTTL?: number;
  [k: string]: any;
}

export interface ShipSpec {
  maxHp: number;
  accel: number;
  cannons: CannonSpec[];
  maxShield?: number;
  shieldRegen?: number;
  turnRate?: number;
  // radius is now required for rendering and collision calculations
  radius: number;
  [k: string]: any;
}

export interface ProgressionConfig {
  xpPerDamage: number;
  xpPerKill: number;
  xpToLevel: number | ((level: number) => number);
  hpPercentPerLevel: number | ((level: number) => number);
  dmgPercentPerLevel: number | ((level: number) => number);
  shieldPercentPerLevel: number | ((level: number) => number);
  speedPercentPerLevel?: number | ((level: number) => number);
  regenPercentPerLevel?: number | ((level: number) => number);
  [k: string]: any;
}

export type Shape2D_Polygon = { type: 'polygon'; points: any[]; [k: string]: any };
export type Shape2D_Compound = { type: 'compound'; parts: any[]; [k: string]: any };
export type Shape2D_Generic = { type: string; [k: string]: any };
export type Shape2D = Shape2D_Polygon | Shape2D_Compound | Shape2D_Generic;

export interface AssetsConfig {
  palette: Record<string, any>;
  shapes2d: Record<string, Shape2D>;
  [k: string]: any;
}

export interface TeamsConfig {
  teams: Record<string, { id: string; color: string; [k: string]: any }>;
  defaultFleet?: { counts: Record<string, number>; spacing?: number; [k: string]: any };
  continuousReinforcement?: {
    enabled: boolean;
    scoreMargin: number;
    perTick: number;
    reinforceType?: string;
    shipTypes?: string[];
    [k: string]: any;
  };
  [k: string]: any;
}

export interface DisplayConfig {
  getDefaultBounds?: () => { W: number; H: number } | any;
  [k: string]: any;
}

export interface RendererConfig {
  preferred: string;
  rendererScale?: number;
  [k: string]: any;
}

export type ShipConfigMap = Record<string, ShipSpec>;

export default {};
