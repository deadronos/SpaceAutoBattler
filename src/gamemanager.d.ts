// Minimal type declarations for the JS runtime module `src/gamemanager.js`.
// These are permissive `any` types to unblock incremental migration to TypeScript.
// Keep in sync with the runtime exports in gamemanager.js. Replace with
// fully-typed declarations as the module is ported to .ts.

export interface GameManagerOptions {
  renderer?: any;
  canvas?: HTMLCanvasElement | null;
  useWorker?: boolean;
  [key: string]: any;
}

export function createGameManager(opts?: GameManagerOptions): any;
export function reset(seed?: number): void;
export function simulate(...args: any[]): any;
export function setReinforcementInterval(v: number): void;
export function getReinforcementInterval(): number;
export function setShipConfig(name: string, cfg: any): void;
export function getShipConfig(name: string): any;
export function getStarCanvasVersion(): number;

export const ships: any[];
export const bullets: any[];
export const particles: any[];
export const stars: any[];
export const flashes: any[];
export const shieldFlashes: any[];
export const healthFlashes: any[];
export const particlePool: any[];

export const config: any;

export const shieldFlashIndex: any;
export const healthFlashIndex: any;
export const FLASH_TTL_DEFAULT: number;

export function acquireParticle(...args: any[]): any;
export function releaseParticle(...args: any[]): any;

export const Particle: any;

export function setDoubleSimStrict(v: boolean): void;

export default createGameManager;
