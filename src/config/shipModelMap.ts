export type ShipClass = 'fighter' | 'corvette' | 'frigate' | 'destroyer' | 'carrier';

export interface ShipModelEntry {
  file: string; // path to .glb (public or dist relative)
  scale?: number; // multiplier to normalize model size to game units
  pivotOffset?: [number, number, number];
  boundsRadius?: number; // approx visual radius for LOD/physics
  attribution?: string; // short license/author text
}

const SHIP_MODEL_MAP: Record<ShipClass, ShipModelEntry> = {
  fighter: {
    file: '/src/config/assets/gltf/fighter.glb',
    scale: 1.0,
    boundsRadius: 1.0,
    attribution: 'https://opengameart.org/users/majadroid',
  },
  corvette: {
    file: '/src/config/assets/gltf/corvette.glb',
    scale: 1.0,
    boundsRadius: 1.0,
    attribution: 'https://opengameart.org/users/majadroid',
  },
  frigate: {
    file: '/src/config/assets/gltf/frigate.glb',
    scale: 1.0,
    boundsRadius: 1.0,
    attribution: 'https://opengameart.org/users/majadroid',
  },
  destroyer: {
    file: '/src/config/assets/gltf/destroyer.glb',
    scale: 1.0,
    boundsRadius: 1.0,
    attribution: 'https://opengameart.org/users/majadroid',
  },
  carrier: {
    file: '/src/config/assets/gltf/carrier.glb',
    scale: 1.0,
    boundsRadius: 1.0,
    attribution: 'https://opengameart.org/users/majadroid',
  },
};

export default SHIP_MODEL_MAP;
