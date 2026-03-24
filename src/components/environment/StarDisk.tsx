import { useMemo, useRef, useEffect } from 'react';
import type { Mesh } from 'three';
import { Vector3, ShaderMaterial, Quaternion } from 'three';
import { useThree } from '@react-three/fiber';
import type {
  StarLightConfig,
  CelestialEnvironmentConfig,
  StarDiskHazeConfig,
  StarDiskBoundaryConfig,
} from '../../config/environment.js';
import { useOptionalGameState } from '../../game/context.js';
import { type MainSequenceStarUniformUpdate } from '../../renderer/starDiskMaterial.js';
import {
  computeStarDiskQuaternion,
  createViewAlignmentScratch,
  type ViewAlignment,
} from '../../renderer/starDiskOrientation.js';
import { useStarTextures } from '../../hooks/useStarTextures.js';
import { useStarMaterial } from '../../hooks/useStarMaterial.js';
import { useStarBloom } from '../../hooks/useStarBloom.js';
import { useDevShaderCompile } from '../../hooks/useDevShaderCompile.js';
import { useStarDebug, useDebugOverlayCleanup } from '../../hooks/useStarDebug.js';
import { StarDiskMesh } from './StarDiskMesh.js';
import { useStarDiskFrameLoop } from './starDisk/useStarDiskFrameLoop.js';
import { useStarDiskDebugCleanup } from './starDisk/useStarDiskDebugCleanup.js';
import { isCopilotDebugEnabled } from '../../utils/copilotDebug.js';

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
  /** Optional haze taper configuration overriding environment defaults. */
  haze?: StarDiskHazeConfig;
  /** Optional boundary feather configuration overriding environment defaults. */
  boundary?: StarDiskBoundaryConfig;
}

export function StarDisk({
  config,
  size,
  opacity,
  distanceMultiplier,
  enabled = true,
  haze,
  boundary,
}: StarDiskProps): React.ReactElement | null {
  // Allow defaults to be supplied via the environment config when not passed explicitly
  const env = (globalThis as unknown as { __CELESTIAL__?: CelestialEnvironmentConfig })
    .__CELESTIAL__;
  const defaultSize = size ?? env?.starDisk?.size ?? 800;
  const defaultOpacity = opacity ?? env?.starDisk?.opacity ?? 0.12;
  const defaultDistanceMultiplier = distanceMultiplier ?? env?.starDisk?.distanceMultiplier ?? 0.8;
  const fallbackHaze = env?.starDisk?.haze;
  const fallbackBoundary = env?.starDisk?.boundary;
  const meshRef = useRef<Mesh>(null);
  const aspectWarnedRef = useRef(false);
  const baseQuaternion = useMemo<Quaternion>(
    () => computeStarDiskQuaternion(config.direction),
    [config.direction],
  );
  const meshWorldPosition = useMemo(() => new Vector3(), []);
  const viewScratch = useMemo(() => createViewAlignmentScratch(), []);
  const viewAlignmentRef = useRef<ViewAlignment>({ x: 0, y: 0, z: 1 });
  const hazeConfig = useMemo<MainSequenceStarUniformUpdate['haze']>(() => {
    const source = haze ?? fallbackHaze;
    if (!source) {
      return undefined;
    }
    return {
      taperStrength: source.taperStrength,
      edgeFadeThreshold: source.edgeFadeThreshold,
      edgeExponent: source.edgeExponent,
    };
  }, [haze, fallbackHaze]);

  const boundaryConfig = useMemo<MainSequenceStarUniformUpdate['boundary']>(() => {
    const source = boundary ?? fallbackBoundary;
    if (!source) {
      return undefined;
    }
    return {
      featherStart: source.featherStart,
      featherExponent: source.featherExponent,
      alphaFloor: source.alphaFloor,
    };
  }, [boundary, fallbackBoundary]);

  const gameState = useOptionalGameState();
  const { gl, scene, camera } = useThree();
  const { organic: organicTexture, noise: noiseTexture } = useStarTextures();
  const debugEnabled = useMemo(() => {
    return isCopilotDebugEnabled();
  }, []);
  const shaderMaterial = useStarMaterial(debugEnabled);
  const shaderMaterialRef = useRef<ShaderMaterial | null>(shaderMaterial);

  // Update ref when material changes
  useEffect(() => {
    shaderMaterialRef.current = shaderMaterial;
  }, [shaderMaterial]);

  const removeDebugOverlay = useDebugOverlayCleanup();

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || typeof (mesh.quaternion as unknown as { copy?: unknown })?.copy !== 'function') {
      return;
    }
    mesh.quaternion.copy(baseQuaternion);
  }, [baseQuaternion]);

  // Local offset from the parent (StarLight group's origin). When parented, this is the disk's local position.
  const localOffset = useMemo(() => {
    const direction = new Vector3(
      config.direction.x,
      config.direction.y,
      config.direction.z,
    ).normalize();
    const distance = Math.max(config.distance * defaultDistanceMultiplier, 8000);
    return direction.multiplyScalar(-distance).toArray();
  }, [config, defaultDistanceMultiplier]);

  // Ensure the shader material is explicitly assigned to the mesh when
  // available. This guards against render-order or attach timing issues
  // where the <primitive attach="material" /> might not have executed
  // before the first frame update.
  useEffect(() => {
    const mesh = meshRef.current;
    const mat = shaderMaterial;
    if (mesh && mat) {
      try {
        if (mesh.material !== mat) {
          mesh.material = mat;
          // mark needsUpdate to ensure renderer picks up any shader swap
          try {
            mat.needsUpdate = true;
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* ignore */
      }
    }
  }, [shaderMaterial]);

  useDevShaderCompile(debugEnabled, meshRef, shaderMaterial, gl, scene, camera);

  useStarDebug(debugEnabled, removeDebugOverlay);

  useStarBloom(meshRef, enabled, shaderMaterial);

  useStarDiskFrameLoop({
    enabled,
    debugEnabled,
    meshRef,
    shaderMaterialRef,
    gameState,
    hazeConfig,
    boundaryConfig,
    organicTexture,
    noiseTexture,
    viewAlignmentRef,
    meshWorldPosition,
    viewScratch,
    aspectWarnedRef,
  });

  useStarDiskDebugCleanup({ debugEnabled, meshRef, removeDebugOverlay });

  if (!enabled) return null;

  const showDebugHelpers = debugEnabled;

  return (
    <StarDiskMesh
      meshRef={meshRef}
      localOffset={localOffset as [number, number, number]}
      size={defaultSize}
      shaderMaterial={shaderMaterial}
      config={config}
      opacity={defaultOpacity}
      showDebugHelpers={showDebugHelpers}
    />
  );
}
