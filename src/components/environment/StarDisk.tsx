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
import type { StarLightConfig, CelestialEnvironmentConfig } from '../../config/environment.js';
import { useOptionalGameState } from '../../game/context.js';
import { useBloomRegistration } from '../../renderer/BloomProvider.js';
import {
  createMainSequenceStarMaterial,
  updateMainSequenceStarUniforms,
  disposeMainSequenceStarMaterial,
  type MainSequenceStarUniformUpdate,
} from '../../renderer/starDiskMaterial.js';
import { STAR_DISK_TEXTURE_PATHS, type StarDiskTextureKey } from '../../assets/starDiskTextures.js';

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
}

export function StarDisk({ config, size, opacity, distanceMultiplier, enabled = true }: StarDiskProps): React.ReactElement | null {
  // Allow defaults to be supplied via the environment config when not passed explicitly
  const env = (globalThis as unknown as { __CELESTIAL__?: CelestialEnvironmentConfig }).__CELESTIAL__;
  const defaultSize = size ?? env?.starDisk?.size ?? 800;
  const defaultOpacity = opacity ?? env?.starDisk?.opacity ?? 0.12;
  const defaultDistanceMultiplier = distanceMultiplier ?? env?.starDisk?.distanceMultiplier ?? 0.8;
  const meshRef = useRef<Mesh>(null);
  const shaderMaterialRef = useRef<ShaderMaterial | null>(null);
  const aspectWarnedRef = useRef(false);
  const fallbackTimeRef = useRef(0);
  const gameState = useOptionalGameState();
  const { gl } = useThree();
  const starTextures = useTexture(STAR_DISK_TEXTURE_PATHS) as Record<StarDiskTextureKey, Texture | undefined>;
  const organicTexture = starTextures.organic;
  const noiseTexture = starTextures.noiseRgba;

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

  const shaderMaterial = useMemo<ShaderMaterial | null>(() => {
    try {
      const mat = createMainSequenceStarMaterial({
        organic: null,
        noise: null,
      });
      shaderMaterialRef.current = mat;
      return mat;
    } catch (error) {
      console.warn('[StarDisk] Failed to create main sequence star material. Falling back to basic material.', error);
      shaderMaterialRef.current = null;
      return null;
    }
  }, []);

  useEffect(() => {
    const mat = shaderMaterial;
    return () => {
      if (shaderMaterialRef.current === mat) {
        shaderMaterialRef.current = null;
      }
      disposeMainSequenceStarMaterial(mat);
    };
  }, [shaderMaterial]);

  useBloomRegistration(meshRef, { group: 'star', active: enabled && Boolean(shaderMaterial) });

  // Make the disk always face the camera (billboard behavior)
  useFrame((state, delta) => {
    if (!enabled) {
      return;
    }
    const { camera, viewport } = state;
    if (meshRef.current) {
      meshRef.current.lookAt(camera.position);
    }
    const mat = shaderMaterialRef.current;
    if (!mat) {
      return;
    }
    const sim = gameState?.simulation;
    let elapsed: number;
    if (sim) {
      elapsed = sim.lastTickStart + sim.alpha * sim.step;
      fallbackTimeRef.current = elapsed;
    } else {
      fallbackTimeRef.current += delta;
      elapsed = fallbackTimeRef.current;
    }
    const rawAspect = viewport.aspect;
    const safeAspect = Number.isFinite(rawAspect) && rawAspect > 0 ? rawAspect : 1;
    if (safeAspect > 8 && !aspectWarnedRef.current) {
      console.warn(`[StarDisk] Unusually high viewport aspect detected: ${safeAspect.toFixed(2)}.`);
      aspectWarnedRef.current = true;
    }
    const { width, height } = state.size;
    const uniformUpdate: MainSequenceStarUniformUpdate = {
      time: elapsed,
      resolution: {
        width: Number.isFinite(width) && width > 0 ? width : 1,
        height: Number.isFinite(height) && height > 0 ? height : 1,
      },
    };
    if (organicTexture) {
      uniformUpdate.organic = organicTexture;
    }
    if (noiseTexture) {
      uniformUpdate.noise = noiseTexture;
    }
    updateMainSequenceStarUniforms(mat, uniformUpdate);
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