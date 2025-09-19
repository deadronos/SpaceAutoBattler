import * as THREE from 'three';

// Shared texture throttling helper for reducing texSubImage2D spam.
// Enhanced with both frame-based and time-based throttling to reduce GPU driver bursts.

const texLastUpdateFrame = new Map<string, number>();
const texLastUpdateTime = new Map<string, number>();
const defaultMinInterval = 3;
const defaultMinTimeMs = 50; // 50ms cooldown as suggested in optimization plan

export function setTextureNeedsUpdateThrottled(
  texOrMaterial: THREE.Texture | THREE.Material | null | undefined,
  minIntervalFrames = defaultMinInterval,
  minIntervalMs = defaultMinTimeMs,
): boolean {
  try {
    if (!texOrMaterial) return false;
    let tex: THREE.Texture | undefined;
    const isMatWithMap = (o: unknown): o is { map?: THREE.Texture } =>
      !!o && typeof o === 'object' && 'map' in (o as object);
    if (isMatWithMap(texOrMaterial) && texOrMaterial.map) tex = texOrMaterial.map;
    else if ((texOrMaterial as THREE.Texture).uuid) tex = texOrMaterial as THREE.Texture;
    if (!tex) return false;
    
    const id = tex.uuid ?? String(tex);
    const nowFrame = (globalThis as unknown as { __FRAME_COUNT?: number }).__FRAME_COUNT ?? -1;
    const nowTime = performance.now();
    
    // Get last update times
    const lastFrame = texLastUpdateFrame.get(id) ?? -Infinity;
    const lastTime = texLastUpdateTime.get(id) ?? -Infinity;
    
    // Check both frame-based and time-based throttling
    const frameThrottleOk = minIntervalFrames <= 0 || nowFrame < 0 || nowFrame - lastFrame >= minIntervalFrames;
    const timeThrottleOk = minIntervalMs <= 0 || nowTime - lastTime >= minIntervalMs;
    
    // Only update if both throttling conditions are satisfied
    if (frameThrottleOk && timeThrottleOk) {
      try {
        tex.needsUpdate = true;
      } catch (_e) {
        void _e;
      }
      texLastUpdateFrame.set(id, nowFrame);
      texLastUpdateTime.set(id, nowTime);
      return true; // Return true to indicate update was performed
    }
    return false; // Return false to indicate update was throttled
  } catch (_e) {
    void _e;
    return false;
  }
}

/**
 * Clone a material while reusing texture references to avoid unnecessary texture uploads.
 * This prevents each cloned material from requiring separate texture GPU uploads.
 */
export function cloneMaterialReuseTextures(material: THREE.Material): THREE.Material {
  try {
    const cloned = material.clone();
    
    // Reuse texture references from the original material to avoid cloning textures
    const isMatWithMap = (mat: unknown): mat is { map?: THREE.Texture } =>
      !!mat && typeof mat === 'object' && 'map' in (mat as object);
    
    if (isMatWithMap(material) && isMatWithMap(cloned) && material.map) {
      cloned.map = material.map; // Reuse the texture reference
    }
    
    // Handle other common texture properties that might get cloned
    const textureProps = ['normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap'] as const;
    for (const prop of textureProps) {
      const originalTex = (material as unknown as Record<string, THREE.Texture | undefined>)[prop];
      if (originalTex) {
        (cloned as unknown as Record<string, THREE.Texture>)[prop] = originalTex;
      }
    }
    
    return cloned;
  } catch (_e) {
    void _e;
    // Fallback to regular clone if optimization fails
    return material.clone();
  }
}

/**
 * Batch update textures from multiple materials after material creation is complete.
 * This delays texture updates until after cloning operations to reduce redundant uploads.
 * Returns the number of unique textures that were updated.
 */
export function batchUpdateMaterialTextures(
  materials: THREE.Material[],
  minIntervalFrames = defaultMinInterval,
  minIntervalMs = defaultMinTimeMs,
): number {
  const uniqueTextures = new Set<THREE.Texture>();
  
  // Collect all unique textures from materials
  for (const mat of materials) {
    try {
      const isMatWithMap = (m: unknown): m is { map?: THREE.Texture } =>
        !!m && typeof m === 'object' && 'map' in (m as object);
      if (isMatWithMap(mat) && mat.map) {
        uniqueTextures.add(mat.map);
      }
      
      // Check other texture properties
      const textureProps = ['normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap'] as const;
      for (const prop of textureProps) {
        const tex = (mat as unknown as Record<string, THREE.Texture | undefined>)[prop];
        if (tex) {
          uniqueTextures.add(tex);
        }
      }
    } catch (_e) {
      void _e;
    }
  }
  
  let updateCount = 0;
  // Apply throttled updates to each unique texture only once
  for (const tex of uniqueTextures) {
    const result = setTextureNeedsUpdateThrottled(tex, minIntervalFrames, minIntervalMs);
    if (result) updateCount++;
  }
  
  return updateCount;
}
