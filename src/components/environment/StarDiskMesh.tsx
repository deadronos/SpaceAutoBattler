/**
 * Star disk mesh component
 * 
 * Renders the star disk mesh with geometry, material (shader or fallback),
 * and optional debug helper visualizations.
 */

import type { ShaderMaterial } from 'three';
import type { StarLightConfig } from '../../config/environment.js';
import type { RefObject } from 'react';
import type { Mesh } from 'three';
import {
  RENDER_ORDER_OPAQUE_CORE,
  RENDER_ORDER_TRANSLUCENT_ADDITIVE,
} from '../../renderer/sceneLayerOrder.js';
import { isCopilotDebugEnabled } from '../../utils/copilotDebug.js';

interface StarDiskMeshProps {
  /** Reference to the mesh element */
  meshRef: RefObject<Mesh | null>;
  /** Position offset from parent (StarLight group) */
  localOffset: [number, number, number];
  /** Size of the disk in world units */
  size: number;
  /** Shader material (or null to use fallback) */
  shaderMaterial: ShaderMaterial | null;
  /** Star light configuration */
  config: StarLightConfig;
  /** Opacity for fallback material */
  opacity: number;
  /** Whether to show debug helpers (axes, origin marker) */
  showDebugHelpers: boolean;
}

/**
 * Render the star disk mesh with geometry and material.
 */
export function StarDiskMesh({
  meshRef,
  localOffset,
  size,
  shaderMaterial,
  config,
  opacity,
  showDebugHelpers,
}: StarDiskMeshProps): React.ReactElement {
  // Inner core radius relative to the overall disk size. Small, opaque
  // core writes depth so occlusion against planets/rings is deterministic.
  const coreRadius = Math.max(1, size * 0.18);

  // Expose debug helper so we can adjust halo renderOrder from the console
  try {
    if (isCopilotDebugEnabled()) {
      try {
        (window as any).__copilot_setStarHaloRenderOrder = (v: any) => {
          try {
            const n = Number(v);
            const halo = meshRef && (meshRef as any).current;
            if (!halo) return { set: false, reason: 'no-halo' };
            if (!Number.isFinite(n)) return { set: false, reason: 'not-a-number' };
            halo.renderOrder = Math.floor(n);
            return { set: true, value: halo.renderOrder };
          } catch (e) {
            return { set: false, reason: String(e) };
          }
        };
      } catch {
        // ignore attach errors
      }
    }
  } catch {
    // ignore environment errors
  }

  return (
    <group position={localOffset}>
      {shaderMaterial ? (
        <>
          {/* Opaque core that writes depth to create a stable occlusion surface */}
          <mesh renderOrder={RENDER_ORDER_OPAQUE_CORE}>
            <circleGeometry args={[coreRadius, 64]} />
            <meshBasicMaterial color={config.color || '#ffffff'} depthWrite={true} depthTest={true} />
          </mesh>

          {/* Halo / disk rendered with the shader material; preserve meshRef for
              the surrounding code that samples world position and attaches
              debug helpers. This mesh does not write depth so it blends over
              the scene as a glow. */}
          <mesh ref={meshRef} renderOrder={RENDER_ORDER_TRANSLUCENT_ADDITIVE}>
            <circleGeometry args={[size, 64]} />
            <primitive object={shaderMaterial as unknown as object} attach="material" />
          </mesh>
        </>
      ) : (
        <mesh ref={meshRef} position={localOffset}>
          <circleGeometry args={[size, 64]} />
          <meshBasicMaterial
            color={config.color}
            transparent
            opacity={opacity}
            depthWrite={false}
            depthTest={true}
          />
        </mesh>
      )}

      {showDebugHelpers && (
        <>
          {/* Dev helper: small red box at the star local origin to validate placement */}
          <mesh position={[0, 0, 0]} renderOrder={9999}>
            <boxGeometry args={[Math.max(1, size * 0.05), Math.max(1, size * 0.05), Math.max(1, size * 0.05)]} />
            <meshBasicMaterial color="red" depthTest={false} depthWrite={false} />
          </mesh>

          {/* Dev helper: axes for orientation/scale debugging */}
          <axesHelper args={[Math.max(10, size * 0.2)]} />
        </>
      )}
    </group>
  );
}
