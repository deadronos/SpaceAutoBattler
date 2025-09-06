import type { GameState } from '../types/index.js';
import SHIP_MODEL_MAP, { ShipClass } from '../config/shipModelMap.js';
import { loadGLTF } from './assetLoader.js';

/**
 * Minimal loader adapter for ship glTF models.
 * - loads .glb via existing loadGLTF
 * - applies optional normalization metadata (scale/pivot) to the stored prototype
 * - registers prototypes in GameState.assetPool under keys like `ship-${class}-${team}`
 */
export async function preloadShipModels(state: GameState, teams: string[] = ['red', 'blue']) {
  if (!state) throw new Error('preloadShipModels requires GameState');
  if (!state.assetPool) state.assetPool = new Map<string, unknown>();

  for (const cls of Object.keys(SHIP_MODEL_MAP) as ShipClass[]) {
    const entry = SHIP_MODEL_MAP[cls];
    try {
      const res = await loadGLTF(state, entry.file);
      // We'll store an object with metadata so renderer/instancer can consume it.
      const proto: {
        className: string;
        url: string;
        gltf: unknown;
        scale: number;
        pivotOffset: [number, number, number];
        boundsRadius: number;
        attribution: string;
        threePrototypes?: { geometries: unknown[]; materials: unknown[] };
      } = {
          className: cls,
          url: entry.file,
          gltf: res.data,
          scale: entry.scale ?? 1,
          pivotOffset: entry.pivotOffset ?? [0, 0, 0],
          boundsRadius: entry.boundsRadius ?? 1,
          attribution: entry.attribution ?? ''
        };

        // Try to extract Three.js prototype geometries/materials lazily.
        try {
          // Dynamic import to avoid bundling three in non-render paths (we don't need the THREE namespace directly)
          await import('three');
          // glTF loader returns an object where .scene contains Object3D hierarchy
          const gltfData = res.data as unknown as { scene?: unknown; scenes?: unknown[] };
          const scene = gltfData?.scene ?? gltfData?.scenes?.[0] ?? null;
          if (scene) {
            const geoms: unknown[] = [];
            const mats: unknown[] = [];
            const sceneObj = scene as unknown as { traverse?: (callback: (node: unknown) => void) => void };
            if (sceneObj.traverse) {
              sceneObj.traverse((node: unknown) => {
                const meshNode = node as unknown as { isMesh?: boolean; geometry?: unknown; material?: unknown };
                if (meshNode && meshNode.isMesh) {
                  try {
                    // Clone geometry and material to avoid sharing mutable state
                    const geom = meshNode.geometry as unknown as { clone?: () => unknown };
                    const mat = meshNode.material as unknown as { clone?: () => unknown };
                    const g = geom?.clone ? geom.clone() : meshNode.geometry;
                    const m = mat?.clone ? mat.clone() : meshNode.material;
                    geoms.push(g);
                    mats.push(m);
                  } catch (_e) { void _e; }
                }
              });
            }
            if (geoms.length > 0) proto.threePrototypes = { geometries: geoms, materials: mats };
          }
        } catch (e) { void e; /* non-fatal: keep gltf only */ }

      // Register for each team so existing code that looks up `ship-${cls}-${team}` finds it.
      for (const team of teams) {
        try {
          state.assetPool.set(`ship-${cls}-${team}`, proto);
        } catch { /* ignore individual set failures */ }
      }
      // Also register a class-only prototype
      try { state.assetPool.set(`ship-${cls}`, proto); } catch { /* ignore */ }
    } catch (err) {
  // Fail gracefully: log to console and continue
  console.warn(`Failed to load ship model ${entry.file} for class ${cls}:`, err);
    }
  }
}

export async function preloadSingleShip(state: GameState, cls: ShipClass, team: string = 'red') {
  const entry = SHIP_MODEL_MAP[cls];
  if (!entry) throw new Error(`Unknown ship class ${cls}`);
  if (!state.assetPool) state.assetPool = new Map<string, unknown>();
  const res = await loadGLTF(state, entry.file);
  const proto = {
    className: cls,
    url: entry.file,
    gltf: res.data,
    scale: entry.scale ?? 1,
    pivotOffset: entry.pivotOffset ?? [0, 0, 0],
    boundsRadius: entry.boundsRadius ?? 1,
    attribution: entry.attribution ?? ''
  };
  state.assetPool.set(`ship-${cls}-${team}`, proto);
  state.assetPool.set(`ship-${cls}`, proto);
  return proto;
}
