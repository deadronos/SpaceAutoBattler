import { useMemo, useRef, useEffect } from 'react';
import type { Mesh } from 'three';
import { Vector3, ShaderMaterial } from 'three';
import { useFrame } from '@react-three/fiber';
import type { StarLightConfig, CelestialEnvironmentConfig, StarDiskShaderConfig } from '../../config/environment.js';
import { useOptionalGameState } from '../../game/context.js';
import { useBloomRegistration } from '../../renderer/BloomProvider.js';
import {
  buildStarDiskMaterialConfig,
  tryCreateStarDiskMaterial,
  updateStarDiskUniforms,
} from '../../renderer/starDiskMaterial.js';

interface StarDiskShaderUniforms {
  uTime: { value: number };
  uAspect: { value: number };
}

interface StarDiskProps {
  config: StarLightConfig;
  /** Size of the star disk billboard in world units */
  size?: number;
  /** Opacity of the star disk */
  opacity?: number;
  /** Multiplier applied to starLight.distance to compute disk offset */
  distanceMultiplier?: number;
  /** Enable/disable the star disk */
  enabled?: boolean;
  /** Optional shader overrides (defaults come from environment config). */
  shader?: StarDiskShaderConfig;
}

export function StarDisk({ config, size, opacity, distanceMultiplier, enabled = true, shader }: StarDiskProps): React.ReactElement | null {
  // Allow defaults to be supplied via the environment config when not passed explicitly
  const env = (globalThis as unknown as { __CELESTIAL__?: CelestialEnvironmentConfig }).__CELESTIAL__;
  const defaultSize = size ?? env?.starDisk?.size ?? 800;
  const defaultOpacity = opacity ?? env?.starDisk?.opacity ?? 0.12;
  const defaultDistanceMultiplier = distanceMultiplier ?? env?.starDisk?.distanceMultiplier ?? 0.8;
  const shaderConfig = shader ?? env?.starDisk?.shader;
  const meshRef = useRef<Mesh>(null);
  const shaderMaterialRef = useRef<ShaderMaterial | null>(null);
  const gameState = useOptionalGameState();

  // Local offset from the parent (StarLight group's origin). When parented, this is the disk's local position.
  const localOffset = useMemo(() => {
    const direction = new Vector3(config.direction.x, config.direction.y, config.direction.z).normalize();
    const distance = Math.max(config.distance * defaultDistanceMultiplier, 8000);
    return direction.multiplyScalar(-distance).toArray();
  }, [config.direction.x, config.direction.y, config.direction.z, config.distance, defaultDistanceMultiplier]);

  const materialConfig = useMemo(
    () =>
      buildStarDiskMaterialConfig({
        light: config,
        opacity: defaultOpacity,
        shader: shaderConfig,
      }),
    [config, defaultOpacity, shaderConfig],
  );

  const shaderMaterial = useMemo(() => {
    const mat = tryCreateStarDiskMaterial(materialConfig.uniforms);
    shaderMaterialRef.current = mat;
    return mat;
  }, [materialConfig]);

  useEffect(() => {
    const mat = shaderMaterialRef.current;
    if (!mat) return;
    updateStarDiskUniforms(mat, materialConfig.uniforms);
  }, [materialConfig]);

  useEffect(() => {
    const mat = shaderMaterial;
    return () => {
      mat?.dispose();
    };
  }, [shaderMaterial]);

  useBloomRegistration(meshRef, { group: materialConfig.bloomGroup, active: Boolean(shaderMaterial) });

  // Make the disk always face the camera (billboard behavior)
  useFrame((state, delta) => {
    const { camera, viewport } = state;
    if (meshRef.current) {
      meshRef.current.lookAt(camera.position);
    }
    const mat = shaderMaterialRef.current;
    if (!mat) {
      return;
    }
  const uniforms = mat.uniforms as unknown as StarDiskShaderUniforms;
    const sim = gameState?.simulation;
    if (sim) {
      const elapsed = sim.lastTickStart + sim.alpha * sim.step;
      uniforms.uTime.value = elapsed;
    } else {
      uniforms.uTime.value += delta;
    }
    uniforms.uAspect.value = viewport.aspect || 1;
  });

  if (!enabled) {
    return null;
  }

  return (
    <mesh ref={meshRef} position={localOffset as [number, number, number]}>
      <circleGeometry args={[defaultSize, 64]} />
      {shaderMaterial ? (
        <primitive object={shaderMaterial} attach="material" />
      ) : (
        <meshBasicMaterial
          color={config.color}
          transparent
          opacity={defaultOpacity}
          depthWrite={false}
          depthTest={true}
        />
      )}
    </mesh>
  );
}