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
  return (
    <mesh ref={meshRef} position={localOffset}>
      <circleGeometry args={[size, 64]} />
      {shaderMaterial ? (
        <primitive object={shaderMaterial as unknown as object} attach="material" />
      ) : (
        <meshBasicMaterial
          color={config.color}
          transparent
          opacity={opacity}
          depthWrite={false}
          depthTest={true}
        />
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
    </mesh>
  );
}
