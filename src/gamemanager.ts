// Minimal TypeScript shim that re-exports the existing JavaScript runtime implementation.
// Import the runtime as a namespace and re-export value bindings to avoid
// circular alias issues. Types are defined in `gamemanager.d.ts`.

import * as gmjs from './gamemanager.js';

export const createGameManager = (gmjs as any).createGameManager;
export const reset = (gmjs as any).reset;
export const simulate = (gmjs as any).simulate;
export const setReinforcementInterval = (gmjs as any).setReinforcementInterval;
export const getReinforcementInterval = (gmjs as any).getReinforcementInterval;
export const setShipConfig = (gmjs as any).setShipConfig;
export const getShipConfig = (gmjs as any).getShipConfig;
export const getStarCanvasVersion = (gmjs as any).getStarCanvasVersion;

export const ships = (gmjs as any).ships;
export const bullets = (gmjs as any).bullets;
export const particles = (gmjs as any).particles;
export const stars = (gmjs as any).stars;
export const flashes = (gmjs as any).flashes;
export const shieldFlashes = (gmjs as any).shieldFlashes;
export const healthFlashes = (gmjs as any).healthFlashes;
export const particlePool = (gmjs as any).particlePool;

export const config = (gmjs as any).config;

export const shieldFlashIndex = (gmjs as any).shieldFlashIndex;
export const healthFlashIndex = (gmjs as any).healthFlashIndex;
export const FLASH_TTL_DEFAULT = (gmjs as any).FLASH_TTL_DEFAULT;

export const acquireParticle = (gmjs as any).acquireParticle;
export const releaseParticle = (gmjs as any).releaseParticle;

export const Particle = (gmjs as any).Particle;

export const setDoubleSimStrict = (gmjs as any).setDoubleSimStrict;

export default createGameManager;
