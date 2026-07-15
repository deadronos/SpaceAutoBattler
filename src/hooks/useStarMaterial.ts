/**
 * Star disk material creation and lifecycle hook
 *
 * Manages the shader material lifecycle, including creation, disposal, and fallback
 * to basic material when shader creation fails.
 */

import { useMemo, useEffect, useRef } from 'react';
import type { ShaderMaterial } from 'three';
import {
  createMainSequenceStarMaterial,
  disposeMainSequenceStarMaterial,
} from '../renderer/starDiskMaterial.js';
import { reportConfigError, reportMaterialError } from '../utils/errorReporting.js';

/**
 * Create and manage the star disk shader material.
 *
 * @param debugEnabled - Whether debug mode is enabled (for debug indicators)
 * @returns ShaderMaterial instance or null if creation failed
 */
export function useStarMaterial(
  debugEnabled: boolean,
  vertexShaderOverride?: string,
): ShaderMaterial | null {
  const shaderMaterialRef = useRef<ShaderMaterial | null>(null);

  const shaderMaterial = useMemo<ShaderMaterial | null>(() => {
    try {
      const mat = createMainSequenceStarMaterial({
        organic: null,
        noise: null,
        vertexShader: vertexShaderOverride,
      });
      shaderMaterialRef.current = mat;

      // Store creation timestamp in localStorage for debugging
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('copilot_star_material_created', String(Date.now()));
        }
      } catch (error) {
        // Expected: localStorage may be unavailable in some environments
        reportConfigError('localStorage', error);
      }

      // Set DOM attribute for debugging
      try {
        if (typeof document !== 'undefined') {
          document.documentElement.setAttribute('data-star-material-created', '1');
        }
      } catch (error) {
        // Expected: DOM may be unavailable in some environments
        reportConfigError('domAttribute', error);
      }

      // DEV: Create a transient DOM indicator when the material object is
      // created so developers can visually confirm that the material was
      // instantiated (useful when console output is noisy). Enabled in
      // development or when the debug query param is present.
      try {
        if (debugEnabled && typeof document !== 'undefined') {
          const id = 'copilot-star-material-created-indicator';
          if (!document.getElementById(id)) {
            const el = document.createElement('div');
            el.id = id;
            el.textContent = 'STAR MATERIAL CREATED';
            el.style.cssText =
              'position:fixed; right:12px; bottom:48px; padding:6px 10px; background:rgba(16,163,127,0.95); color:white; font-size:12px; border-radius:6px; z-index:9999999;';
            document.body.appendChild(el);
            setTimeout(() => {
              try {
                el.remove();
              } catch (error) {
                // Expected: Element may already be removed
                reportMaterialError('debugIndicator.remove', 'DOM', error);
              }
            }, 4000);
          }
        }
      } catch (error) {
        // Expected: Debug indicator creation may fail in some environments
        reportMaterialError('debugIndicator.create', 'DOM', error);
      }

      return mat;
    } catch (error) {
      console.warn(
        '[StarDisk] Failed to create main sequence star material. Falling back to basic material.',
        error,
      );
      shaderMaterialRef.current = null;
      return null;
    }
  }, [debugEnabled, vertexShaderOverride]);

  // Cleanup: dispose material when component unmounts or material changes
  useEffect(() => {
    const mat = shaderMaterial;
    return () => {
      if (shaderMaterialRef.current === mat) {
        shaderMaterialRef.current = null;
      }
      disposeMainSequenceStarMaterial(mat);
    };
  }, [shaderMaterial]);

  return shaderMaterial;
}
