// Minimal type declarations for the JS runtime module `src/gamemanager.js`.
// These are permissive `any` types to unblock incremental migration to TypeScript.
// Keep in sync with the runtime exports in gamemanager.js. Replace with
// fully-typed declarations as the module is ported to .ts.

import type { GameState, Ship, Bullet } from './types';

export interface GameManagerOptions {
  useWorker?: boolean;
  renderer?: any;
  seed?: number;
  createSimWorker?: Function;
}

export function createGameManager(opts?: GameManagerOptions): any;
export function reset(seed?: number | null): void;
export function setReinforcementInterval(v: number): void;
export function getReinforcementInterval(): number;
export function setShipConfig(name: string, cfg: any): void;
export function getShipConfig(name?: string): any;
export function getStarCanvasVersion(): number;

// Precise event and effect shapes used by the renderer and simulation
export interface ExplosionEvent {
  x: number;
  y: number;
  team?: string;
  life?: number;
  ttl?: number;
  alive?: boolean;
  _pooled?: boolean;
  [key: string]: any;
}

export interface HitEvent {
  id?: number | string;
  x: number;
  y: number;
  team?: string;
  amount?: number;
  hitAngle?: number;
  alive?: boolean;
  _pooled?: boolean;
  [key: string]: any;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ttl: number;
  life: number;
  color: string;
  size: number;
  alive: boolean;
  _pooled?: boolean;
  [key: string]: any;
}

// Runtime-exposed active arrays (views into the current state)
export const ships: Ship[];
export const bullets: Bullet[];
export const particles: Particle[];
export const stars: any[];
export const flashes: ExplosionEvent[];
export const shieldFlashes: HitEvent[];
export const healthFlashes: HitEvent[];

export const config: any;
export const FLASH_TTL_DEFAULT: number;

// Pooled object helpers (state-first signatures)
export function acquireBullet(state: GameState, opts?: Partial<Bullet>): Bullet;
export function releaseBullet(state: GameState, bullet?: Bullet): void;

export function acquireExplosion(state: GameState, opts?: Partial<ExplosionEvent>): ExplosionEvent;
export function releaseExplosion(state: GameState, explosion?: ExplosionEvent): void;

export function acquireShieldHit(state: GameState, opts?: Partial<HitEvent>): HitEvent;
export function releaseShieldHit(state: GameState, sh?: HitEvent): void;

export function acquireHealthHit(state: GameState, opts?: Partial<HitEvent>): HitEvent;
export function releaseHealthHit(state: GameState, hh?: HitEvent): void;

export function acquireParticle(state: GameState, x: number, y: number, opts?: Partial<Particle>): Particle;
export function releaseParticle(state: GameState, p?: Particle): void;

export const Particle: { new(...args: any[]): Particle };

export function setDoubleSimStrict(v: boolean): void;

export default createGameManager;
