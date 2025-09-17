import * as THREE from 'three';

// Shared texture throttling helper for reducing texSubImage2D spam.
// Minimal, dependency-free helper exposing a single function.

const texLastUpdateFrame = new Map<string, number>();
const defaultMinInterval = 3;

export function setTextureNeedsUpdateThrottled(
  texOrMaterial: THREE.Texture | THREE.Material | null | undefined,
  minIntervalFrames = defaultMinInterval,
) {
  try {
    if (!texOrMaterial) return;
    let tex: THREE.Texture | undefined;
    const isMatWithMap = (o: unknown): o is { map?: THREE.Texture } =>
      !!o && typeof o === 'object' && 'map' in (o as object);
    if (isMatWithMap(texOrMaterial) && texOrMaterial.map) tex = texOrMaterial.map;
    else if ((texOrMaterial as THREE.Texture).uuid) tex = texOrMaterial as THREE.Texture;
    if (!tex) return;
    const id = tex.uuid ?? String(tex);
    const nowFrame = (globalThis as unknown as { __FRAME_COUNT?: number }).__FRAME_COUNT ?? -1;
    const last = texLastUpdateFrame.get(id) ?? -Infinity;
    if (minIntervalFrames <= 0 || nowFrame < 0 || nowFrame - last >= minIntervalFrames) {
      try {
        tex.needsUpdate = true;
      } catch (_e) {
        void _e;
      }
      texLastUpdateFrame.set(id, nowFrame);
    }
  } catch (_e) {
    void _e;
  }
}
