/**
 * Development-only shader compilation hook
 * 
 * Forces the renderer to compile the scene/camera once so the ShaderMaterial's
 * onBeforeCompile hook runs. This helps capture program/link logs when debugging
 * invisible shaders. Only active in development mode with debug flag enabled.
 */

import { useEffect, type RefObject } from 'react';
import type { Mesh, ShaderMaterial, WebGLRenderer, Scene, Camera } from 'three';

/**
 * Force shader compilation in development mode for debugging.
 * 
 * @param enabled - Whether dev compile should be attempted (debug flag + NODE_ENV check)
 * @param meshRef - Reference to the mesh (needs to be parented to scene)
 * @param shaderMaterial - The shader material to compile
 * @param gl - WebGL renderer
 * @param scene - Scene containing the mesh
 * @param camera - Camera for compilation
 */
export function useDevShaderCompile(
  enabled: boolean,
  meshRef: RefObject<Mesh | null>,
  shaderMaterial: ShaderMaterial | null,
  gl: WebGLRenderer,
  scene: Scene,
  camera: Camera
): void {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') {
      return;
    }

    // Enable in development builds only when explicit debug flag is present.
    if (!enabled) {
      return;
    }

    // If no material or no mesh, there's nothing to compile.
    if (!shaderMaterial || !meshRef.current) {
      return;
    }

    // Poll until the mesh is parented into the scene (or until we give up).
    let attempts = 0;
    const pollInterval = 150; // ms
    const maxAttempts = 20; // ~3s of retries
    const intervalId = setInterval(() => {
      attempts += 1;
      const mesh = meshRef.current;
      if (mesh && mesh.parent) {
        try {
          if (scene && camera && typeof gl.compile === 'function') {
            (gl as any).compile(scene, camera);
             
            console.info('[StarDisk][DEV] forced renderer.compile(scene, camera) to trigger shader compilation');
          } else {
             
            console.warn('[StarDisk][DEV] Unable to find scene/camera for forced compile');
          }
        } catch (err) {
           
          console.warn('[StarDisk][DEV] Forced compile failed', err);
        }
        clearInterval(intervalId);
        return;
      }
      if (attempts >= maxAttempts) {
         
        console.warn('[StarDisk][DEV] Giving up waiting for mesh to be parented before compile');
        clearInterval(intervalId);
      }
    }, pollInterval);

    return () => {
      clearInterval(intervalId);
    };
  }, [enabled, shaderMaterial, gl, scene, camera, meshRef]);
}
