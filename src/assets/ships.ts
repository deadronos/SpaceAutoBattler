// Import GLB assets directly; Vite treats these as build assets and returns the final URL string.
// Output placement/hashing is configured in vite.config.ts (dist/models/*).
import fighterUrl from '../assets/gltf/fighter.glb';
import corvetteUrl from '../assets/gltf/corvette.glb';
import frigateUrl from '../assets/gltf/frigate.glb';
import destroyerUrl from '../assets/gltf/destroyer.glb';
import carrierUrl from '../assets/gltf/carrier.glb';

export const SHIP_MODEL_PATHS = {
  fighter: fighterUrl,
  corvette: corvetteUrl,
  frigate: frigateUrl,
  destroyer: destroyerUrl,
  carrier: carrierUrl,
} as const;

export type ShipModelKey = keyof typeof SHIP_MODEL_PATHS;
