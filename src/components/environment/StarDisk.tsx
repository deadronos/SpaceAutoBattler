import { useMemo, useRef, useEffect } from 'react';
import type { Mesh, Texture } from 'three';
import {
  Vector3,
  ShaderMaterial,
  RepeatWrapping,
  ClampToEdgeWrapping,
  LinearFilter,
  LinearMipmapLinearFilter,
  NearestFilter,
  SRGBColorSpace,
} from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import type { StarLightConfig, CelestialEnvironmentConfig, StarDiskShaderConfig } from '../../config/environment.js';
import { applyStarDiskDebugOverrides } from '../../config/starDiskDebug.js';
import { useOptionalGameState } from '../../game/context.js';
import { useBloomRegistration } from '../../renderer/BloomProvider.js';
import {
  buildStarDiskMaterialConfig,
  tryCreateStarDiskMaterial,
  updateStarDiskUniforms,
} from '../../renderer/starDiskMaterial.js';
import { STAR_DISK_TEXTURE_PATHS, type StarDiskTextureKey } from '../../assets/starDiskTextures.js';

interface StarDiskShaderUniforms {
  uTime: { value: number };
  uAspectInv: { value: number };
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
  const baseShaderConfig = shader ?? env?.starDisk?.shader;
  const shaderConfig = useMemo(() => applyStarDiskDebugOverrides(baseShaderConfig), [baseShaderConfig]);
  const meshRef = useRef<Mesh>(null);
  const shaderMaterialRef = useRef<ShaderMaterial | null>(null);
  const aspectWarnedRef = useRef(false);
  const gameState = useOptionalGameState();
  const { gl } = useThree();
  const starTextures = useTexture(STAR_DISK_TEXTURE_PATHS) as Record<StarDiskTextureKey, Texture | undefined>;
  const organicTexture = starTextures.organic ?? null;
  const noiseTexture = starTextures.noiseRgba ?? null;

  useEffect(() => {
    const maxAniso = Math.min(8, gl.capabilities.getMaxAnisotropy());
    if (organicTexture) {
      organicTexture.wrapS = RepeatWrapping;
      organicTexture.wrapT = ClampToEdgeWrapping;
      organicTexture.minFilter = LinearMipmapLinearFilter;
      organicTexture.magFilter = LinearFilter;
      organicTexture.anisotropy = maxAniso;
      organicTexture.colorSpace = SRGBColorSpace;
      organicTexture.needsUpdate = true;
    }
    if (noiseTexture) {
      noiseTexture.wrapS = RepeatWrapping;
      noiseTexture.wrapT = RepeatWrapping;
      noiseTexture.minFilter = NearestFilter;
      noiseTexture.magFilter = NearestFilter;
      noiseTexture.generateMipmaps = false;
      noiseTexture.needsUpdate = true;
    }
  }, [gl, organicTexture, noiseTexture]);

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
        textures: {
          organic: organicTexture,
          noise: noiseTexture,
        },
      }),
    [config, defaultOpacity, shaderConfig, organicTexture, noiseTexture],
  );

  const shaderMaterial = useMemo(() => {
    const mat = tryCreateStarDiskMaterial(materialConfig.uniforms, materialConfig.textures);
    shaderMaterialRef.current = mat;
    return mat;
  }, [materialConfig]);

  useEffect(() => {
    const mat = shaderMaterialRef.current;
    if (!mat) return;
    updateStarDiskUniforms(mat, materialConfig.uniforms, materialConfig.textures);
  }, [materialConfig]);

  useEffect(() => {
    const mat = shaderMaterial;
    return () => {
      if (shaderMaterialRef.current === mat) {
        shaderMaterialRef.current = null;
      }
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
    const rawAspect = viewport.aspect;
    const safeAspect = Number.isFinite(rawAspect) && rawAspect > 0 ? rawAspect : 1;
    if (safeAspect > 8 && !aspectWarnedRef.current) {
      console.warn(`[StarDisk] Unusually high viewport aspect detected: ${safeAspect.toFixed(2)}.`);
      aspectWarnedRef.current = true;
    }
    uniforms.uAspectInv.value = 1 / Math.max(safeAspect, 0.0001);
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