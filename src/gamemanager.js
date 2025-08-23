import * as gmjs from "./gamemanager.js";
const createGameManager = gmjs.createGameManager;
const reset = gmjs.reset;
const simulate = gmjs.simulate;
const setReinforcementInterval = gmjs.setReinforcementInterval;
const getReinforcementInterval = gmjs.getReinforcementInterval;
const setShipConfig = gmjs.setShipConfig;
const getShipConfig = gmjs.getShipConfig;
const getStarCanvasVersion = gmjs.getStarCanvasVersion;
const ships = gmjs.ships;
const bullets = gmjs.bullets;
const particles = gmjs.particles;
const stars = gmjs.stars;
const flashes = gmjs.flashes;
const shieldFlashes = gmjs.shieldFlashes;
const healthFlashes = gmjs.healthFlashes;
const particlePool = gmjs.particlePool;
const config = gmjs.config;
const shieldFlashIndex = gmjs.shieldFlashIndex;
const healthFlashIndex = gmjs.healthFlashIndex;
const FLASH_TTL_DEFAULT = gmjs.FLASH_TTL_DEFAULT;
const acquireParticle = gmjs.acquireParticle;
const releaseParticle = gmjs.releaseParticle;
const Particle = gmjs.Particle;
const setDoubleSimStrict = gmjs.setDoubleSimStrict;
var gamemanager_default = createGameManager;
export {
  FLASH_TTL_DEFAULT,
  Particle,
  acquireParticle,
  bullets,
  config,
  createGameManager,
  gamemanager_default as default,
  flashes,
  getReinforcementInterval,
  getShipConfig,
  getStarCanvasVersion,
  healthFlashIndex,
  healthFlashes,
  particlePool,
  particles,
  releaseParticle,
  reset,
  setDoubleSimStrict,
  setReinforcementInterval,
  setShipConfig,
  shieldFlashIndex,
  shieldFlashes,
  ships,
  simulate,
  stars
};
