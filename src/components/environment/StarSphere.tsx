import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { Mesh, Texture } from 'three';
import { MeshBasicMaterial, ShaderMaterial, Vector3 } from 'three';
import type { StarLightConfig, CelestialEnvironmentConfig, StarDiskHazeConfig, StarDiskBoundaryConfig } from '../../config/environment.js';
import { useStarTextures } from '../../hooks/useStarTextures.js';
import { useStarMaterial } from '../../hooks/useStarMaterial.js';
import { updateMainSequenceStarUniforms } from '../../renderer/starDiskMaterial.js';

interface StarSphereProps {
  config?: StarLightConfig;
  /** Optional override for configured size (world units) */
  size?: number;
  /** Optional override for configured opacity */
  opacity?: number;
  /** Optional multiplier for star distance */
  distanceMultiplier?: number;
  /** Whether the sphere should be rendered */
  enabled?: boolean;
  /** Optional haze configuration override */
  haze?: StarDiskHazeConfig;
  /** Optional boundary configuration override */
  boundary?: StarDiskBoundaryConfig;
  /** Optional texture overrides - when provided these are used instead of the loader */
  organicTexture?: Texture | null;
  noiseTexture?: Texture | null;
  /** Optional pre-built ShaderMaterial to use instead of creating one */
  materialOverride?: ShaderMaterial | null;
}

export function StarSphere({
  config,
  size,
  opacity,
  distanceMultiplier,
  enabled = true,
  haze,
  boundary,
  organicTexture: organicOverride,
  noiseTexture: noiseOverride,
  materialOverride,
}: StarSphereProps): React.ReactElement | null {
  // Reuse global environment defaults where present so this sphere matches
  // the existing StarDisk configuration. Treat `starDisk.size` as a radius
  // (this aligns with the `StarDiskConfig` comment that `size` is a radius),
  // so use the configured value directly as the sphere radius.
  const env = (globalThis as unknown as { __CELESTIAL__?: CelestialEnvironmentConfig }).__CELESTIAL__;
  const defaultSize = size ?? env?.starDisk?.size ?? 800;
  const defaultOpacity = opacity ?? env?.starDisk?.opacity ?? 0.12;
  const defaultDistanceMultiplier = distanceMultiplier ?? env?.starDisk?.distanceMultiplier ?? 0.8;
  const fallbackHaze = env?.starDisk?.haze;
  const fallbackBoundary = env?.starDisk?.boundary;
  const radius = defaultSize;

  const meshRef = useRef<Mesh | null>(null);
  const { gl, camera, size: viewportSize } = useThree();

  // Prefer passed-in textures; otherwise use the global loader hook.
  const { organic: loadedOrganic, noise: loadedNoise } = useStarTextures();
  const organic = organicOverride ?? loadedOrganic ?? null;
  const noise = noiseOverride ?? loadedNoise ?? null;

  const debugEnabled = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return /[?&]copilot_debug=1/.test(window.location.search);
  }, []);

  const createdMaterial = useStarMaterial(debugEnabled);
  // Allow callers to fully override the material if desired (for testing or
  // special-case rendering). Otherwise use the created shader material.
  const appliedMaterial = materialOverride ?? createdMaterial;

  // Compute local offset from parent StarLight group to position the sphere
  // away from the origin along the configured star direction. Mirror the
  // logic from StarDisk so transitions between the two are consistent.
  const localOffset = useMemo(() => {
    if (!config) return [0, 0, 0] as [number, number, number];
    const dir = new Vector3(config.direction.x, config.direction.y, config.direction.z).normalize();
    const distance = Math.max(config.distance * defaultDistanceMultiplier, 8000);
    return dir.multiplyScalar(-distance).toArray() as [number, number, number];
  }, [
    config?.direction.x,
    config?.direction.y,
    config?.direction.z,
    config?.distance,
    defaultDistanceMultiplier,
  ]);

  // Assign material to the mesh when it becomes available / changes.
  useEffect(() => {
    const mesh = meshRef.current;
    const mat = appliedMaterial;
    if (!mesh) return;
    if (mat) {
      try {
        mesh.material = mat as any;
        try { (mat as any).needsUpdate = true; } catch { /* ignore */ }
      } catch {
        /* ignore */
      }
    }
  }, [appliedMaterial]);

  // Update shader uniforms each frame. Includes time, resolution, textures,
  // camera roll and optional haze/boundary settings mirroring StarDisk.
  useFrame((state) => {
    if (!enabled) return;
    const mat = appliedMaterial;
    if (!mat) return;

    const roll = (camera as any).rotation?.z as number | undefined;
    const cameraRoll = typeof roll === 'number' && Number.isFinite(roll) ? roll : 0;

    updateMainSequenceStarUniforms(mat as ShaderMaterial, {
      time: state.clock.getElapsedTime(),
      resolution: { width: Number(viewportSize.width) || Math.max(1, gl.domElement.width), height: Number(viewportSize.height) || Math.max(1, gl.domElement.height) },
      organic: organic ?? null,
      noise: noise ?? null,
      cameraRoll,
      starNorth: 0,
      viewAlignment: { x: 0, y: 0, z: 1 },
      haze: haze ?? fallbackHaze,
      boundary: boundary ?? fallbackBoundary,
    });
  });

  if (!enabled) return null;

  return (
    <mesh ref={meshRef} position={localOffset} visible={enabled}>
      {/* Use a reasonably high-res sphere so shader sampling looks smooth */}
      <sphereGeometry args={[radius, 64, 32]} />
      {appliedMaterial ? (
        <primitive attach="material" object={appliedMaterial as unknown as object} />
      ) : (
        // Fallback material for when shader creation fails or is
        // intentionally omitted. Apply the configured opacity as a
        // reasonable default for the simpler material.
        <meshBasicMaterial color="#fff" transparent={true} opacity={defaultOpacity} />
      )}
    </mesh>
  );
}
