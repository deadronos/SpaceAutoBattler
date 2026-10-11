/**
 * PlanetRings debug scaffolding.
 *
 * This module owns the `window.__copilot_*` hooks that `PlanetRings` previously
 * registered inline. The behaviour is unchanged: hooks are registered through
 * `registerDebugHook` under the `rings` owner so `clearDebugHooks('rings')` in
 * the component's unmount cleanup continues to find them.
 */

import type { RefObject } from 'react';
import type { Mesh, MeshBasicMaterial, ShaderMaterial } from 'three';
import { isCopilotDebugEnabled } from '../utils/copilotDebug.js';
import { reportMaterialError } from '../utils/errorReporting.js';
import { registerDebugHook } from './copilotDebugRegistry.js';
import { isShaderMat } from '../hooks/usePlanetRingUniforms.js';

export interface PlanetRingsDebugParams {
  /** The material currently rendered by the ring mesh. */
  materialToUse: ShaderMaterial | MeshBasicMaterial;
  /** Live ref to the ring mesh, used by the render-order hook. */
  meshRef: RefObject<Mesh | null>;
}

/**
 * Attach PlanetRings debug helpers once the material exists so uniforms and
 * render order can be adjusted from the console during interactive debugging.
 *
 * Called unconditionally during render; the internal `isCopilotDebugEnabled`
 * check mirrors the original inline guard.
 */
export function installPlanetRingsDebug({ materialToUse, meshRef }: PlanetRingsDebugParams): void {
  try {
    if (isCopilotDebugEnabled()) {
      try {
        registerDebugHook('__copilot_ringMaterial', materialToUse, 'rings');
        const setRingOpacity = (v: unknown) => {
          try {
            const n = Number(v);
            if (!Number.isFinite(n)) return { set: false, reason: 'not-a-number' };
            if (isShaderMat(materialToUse)) {
              materialToUse.uniforms.uOpacity.value = Math.max(0, Math.min(n, 1));
            } else if ('opacity' in materialToUse) {
              materialToUse.opacity = Math.max(0, Math.min(n, 1));
            }
            try {
              materialToUse.needsUpdate = true;
            } catch (error) {
              // Expected: Material may be disposed
              reportMaterialError('debug.needsUpdate', 'ringMaterial', error);
            }
            const resultValue = isShaderMat(materialToUse)
              ? materialToUse.uniforms.uOpacity.value
              : 'opacity' in materialToUse
                ? materialToUse.opacity
                : undefined;
            return { set: true, value: resultValue };
          } catch (e) {
            return { set: false, reason: String(e) };
          }
        };
        registerDebugHook('__copilot_setRingOpacity', setRingOpacity, 'rings');
        const setRingRenderOrder = (v: unknown) => {
          try {
            const n = Number(v);
            if (!meshRef.current) return { set: false, reason: 'no-mesh' };
            if (!Number.isFinite(n)) return { set: false, reason: 'not-a-number' };
            meshRef.current.renderOrder = Math.floor(n);
            return { set: true, value: meshRef.current.renderOrder };
          } catch (e) {
            return { set: false, reason: String(e) };
          }
        };
        registerDebugHook('__copilot_setRingRenderOrder', setRingRenderOrder, 'rings');
      } catch (error) {
        // Expected: Debug helper attachment may fail in some environments
        reportMaterialError('debug.attach', 'ringMaterial', error);
      }
    }
  } catch (error) {
    // Expected: isCopilotDebugEnabled check may fail in some environments
    reportMaterialError('debug.check', 'ringMaterial', error);
  }
}
