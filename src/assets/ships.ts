// The original art assets live under `src_old/config/assets/gltf/` and are reused by
// the rebuilt renderer at build time without duplicating the large binary blobs.
const GLTF_ROOT = '../../src_old/config/assets/gltf/';

export const SHIP_MODEL_PATHS = {
  fighter: new URL(`${GLTF_ROOT}fighter.glb`, import.meta.url).href,
  corvette: new URL(`${GLTF_ROOT}corvette.glb`, import.meta.url).href,
  frigate: new URL(`${GLTF_ROOT}frigate.glb`, import.meta.url).href,
  destroyer: new URL(`${GLTF_ROOT}destroyer.glb`, import.meta.url).href,
  carrier: new URL(`${GLTF_ROOT}carrier.glb`, import.meta.url).href
} as const;

export type ShipModelKey = keyof typeof SHIP_MODEL_PATHS;
