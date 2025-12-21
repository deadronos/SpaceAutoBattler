import gasGiant12Url from '../assets/textures/gasgiant/Gas Giant-EQUIRECTANGULAR-12-2048x1024.png';
import gasGiant12LoResUrl from '../assets/textures/gasgiant/Gas Giant-EQUIRECTANGULAR-12-512x256.png';
import icePlanet1Url from '../assets/textures/planet/Ice-EQUIRECTANGULAR-1-2048x1024.png';
import icePlanet1LoResUrl from '../assets/textures/planet/Ice-EQUIRECTANGULAR-1-512x256.png';

export const PLANET_TEXTURE_PATHS = {
  gasGiant12: gasGiant12Url,
  icePlanet1: icePlanet1Url,
} as const;

export const PLANET_LOWRES_TEXTURE_PATHS = {
  gasGiant12: gasGiant12LoResUrl,
  icePlanet1: icePlanet1LoResUrl,
} as const;

export type PlanetTextureKey = keyof typeof PLANET_TEXTURE_PATHS;
