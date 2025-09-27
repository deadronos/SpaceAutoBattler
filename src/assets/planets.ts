import gasGiant12Url from '../assets/textures/gasgiant/Gas Giant-EQUIRECTANGULAR-12-2048x1024.png';
import icePlanet1Url from '../assets/textures/planet/Ice-EQUIRECTANGULAR-1-2048x1024.png';

export const PLANET_TEXTURE_PATHS = {
  gasGiant12: gasGiant12Url,
  icePlanet1: icePlanet1Url,
} as const;

export type PlanetTextureKey = keyof typeof PLANET_TEXTURE_PATHS;
