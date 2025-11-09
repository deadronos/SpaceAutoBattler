import { AdditiveBlending, ShaderMaterial, Texture, Vector3, Vector4 } from 'three';
import fragmentShaderRaw from '../shaders/mainsequencestar.glsl';
import vertexShader from '../shaders/starDisk.vertex.glsl';
import { COMMON_GLSL } from '../shaders/index.js';
import {
  StarDiskBoundaryUniformInput,
  StarDiskHazeUniformInput,
  deriveBoundaryUniform,
  deriveHazeUniform,
} from './uniforms.js';
import { FALLBACK_NOISE, FALLBACK_ORGANIC, resolveTexture } from './textures.js';
import { installDevHelpers, shouldEnableStarDiskDevHelpers } from './devHelpers.js';

interface MainSequenceUniformMap {
  iTime: { value: number };
  iResolution: { value: Vector3 };
  iChannel0: { value: Texture };
  iChannel1: { value: Texture };
  iCameraRoll: { value: number };
  iStarNorth: { value: number };
  iViewAlignment: { value: Vector3 };
  iHazeParams: { value: Vector3 };
  iBoundaryFeather: { value: Vector4 };
  iDepthCoreRadius: { value: number };
}

export interface MainSequenceStarMaterialOptions {
  organic: Texture | null;
  noise: Texture | null;
}

export interface MainSequenceStarUniformUpdate {
  time: number;
  resolution: { width: number; height: number };
  organic?: Texture | null;
  noise?: Texture | null;
  /** Camera roll angle around the view direction in radians. Optional; defaults to 0. */
  cameraRoll?: number;
  /** Star-fixed north angle in radians for inner-UV orientation (0 aligns to +U axis). */
  starNorth?: number;
  /** Camera-to-disk alignment encoded as (planeX, planeY, facingCos). */
  viewAlignment?: { x: number; y: number; z: number };
  /** Optional haze taper configuration controlling rim attenuation. */
  haze?: StarDiskHazeUniformInput;
  /** Optional boundary feather settings for alpha fade near the rim. */
  boundary?: StarDiskBoundaryUniformInput;
  /** Optional normalized radius (0..1) to force an opaque depth core inside the star. */
  depthCoreRadius?: number;
}

const DEFAULT_RESOLUTION = new Vector3(1, 1, 1);

const DEFAULT_BOUNDARY_RESULT = deriveBoundaryUniform();
const DEFAULT_BOUNDARY_VECTOR = new Vector4(
  DEFAULT_BOUNDARY_RESULT.start,
  DEFAULT_BOUNDARY_RESULT.exponent,
  DEFAULT_BOUNDARY_RESULT.alphaFloor,
  DEFAULT_BOUNDARY_RESULT.reserved,
);

const DEFAULT_HAZE_RESULT = deriveHazeUniform(1);
const DEFAULT_HAZE_VECTOR = new Vector3(
  DEFAULT_HAZE_RESULT.fade,
  DEFAULT_HAZE_RESULT.edgeThreshold,
  DEFAULT_HAZE_RESULT.edgeExponent,
);

const STAR_DEV_CLEANUP_KEY = '__starDiskDevCleanup';

export function createMainSequenceStarMaterial(
  options: MainSequenceStarMaterialOptions,
): ShaderMaterial {
  const organicTexture = resolveTexture(options.organic, FALLBACK_ORGANIC);
  organicTexture.anisotropy = 16;
  const noiseTexture = resolveTexture(options.noise, FALLBACK_NOISE);
  noiseTexture.anisotropy = 16;

  const fragmentShader = COMMON_GLSL + '\n' + fragmentShaderRaw;

  const material = new ShaderMaterial({
    name: 'MainSequenceStarMaterial',
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: false,
    blending: AdditiveBlending,
    vertexShader,
    fragmentShader,
    uniforms: {
      iTime: { value: 0 },
      iResolution: { value: DEFAULT_RESOLUTION.clone() },
      iChannel0: { value: organicTexture },
      iChannel1: { value: noiseTexture },
      iCameraRoll: { value: 0 },
      iStarNorth: { value: 0 },
      iViewAlignment: { value: new Vector3(0, 0, 1) },
      iHazeParams: { value: DEFAULT_HAZE_VECTOR.clone() },
      iBoundaryFeather: { value: DEFAULT_BOUNDARY_VECTOR.clone() },
      iDepthCoreRadius: { value: 0 },
    },
  });

  if (shouldEnableStarDiskDevHelpers()) {
    const disposeDev = installDevHelpers(material);
    const userData = material.userData as Record<string, unknown>;
    userData[STAR_DEV_CLEANUP_KEY] = disposeDev;
  }

  return material;
}

export function updateMainSequenceStarUniforms(
  material: ShaderMaterial,
  update: MainSequenceStarUniformUpdate,
): void {
  const uniforms = material.uniforms as unknown as MainSequenceUniformMap;
  uniforms.iTime.value = update.time;
  const resolution = uniforms.iResolution.value;
  const width = Number.isFinite(update.resolution.width) ? Math.max(update.resolution.width, 1) : 1;
  const height = Number.isFinite(update.resolution.height)
    ? Math.max(update.resolution.height, 1)
    : 1;
  resolution.set(width, height, 1);

  if (update.organic !== undefined) {
    uniforms.iChannel0.value = resolveTexture(update.organic, FALLBACK_ORGANIC);
  }
  if (update.noise !== undefined) {
    uniforms.iChannel1.value = resolveTexture(update.noise, FALLBACK_NOISE);
  }
  if (update.cameraRoll !== undefined) {
    const value = Number.isFinite(update.cameraRoll as number) ? (update.cameraRoll as number) : 0;
    uniforms.iCameraRoll.value = value;
  }
  if (update.starNorth !== undefined) {
    const value = Number.isFinite(update.starNorth as number) ? (update.starNorth as number) : 0;
    uniforms.iStarNorth.value = value;
  }
  if (update.viewAlignment !== undefined) {
    const safeX = Number.isFinite(update.viewAlignment.x) ? update.viewAlignment.x : 0;
    const safeY = Number.isFinite(update.viewAlignment.y) ? update.viewAlignment.y : 0;
    const safeZRaw = Number.isFinite(update.viewAlignment.z) ? update.viewAlignment.z : 1;
    const safeZ = Math.min(Math.max(safeZRaw, 0), 1);
    uniforms.iViewAlignment.value.set(safeX, safeY, safeZ);
  }
  const facingCosine = uniforms.iViewAlignment.value.z;
  const hazeParams = deriveHazeUniform(facingCosine, update.haze);
  uniforms.iHazeParams.value.set(
    hazeParams.fade,
    hazeParams.edgeThreshold,
    hazeParams.edgeExponent,
  );
  const boundaryParams = deriveBoundaryUniform(update.boundary);
  uniforms.iBoundaryFeather.value.set(
    boundaryParams.start,
    boundaryParams.exponent,
    boundaryParams.alphaFloor,
    boundaryParams.reserved,
  );
  if (update.depthCoreRadius !== undefined) {
    const core = Number.isFinite(update.depthCoreRadius as number)
      ? Math.min(Math.max(Number(update.depthCoreRadius), 0), 1)
      : 0;
    uniforms.iDepthCoreRadius.value = core;
  }
}

export function disposeMainSequenceStarMaterial(material: ShaderMaterial | null): void {
  if (!material) return;
  const userData = material.userData as Record<string, unknown> | undefined;
  const disposeDev = userData?.[STAR_DEV_CLEANUP_KEY] as (() => void) | undefined;
  if (disposeDev) {
    disposeDev();
    if (userData) {
      delete userData[STAR_DEV_CLEANUP_KEY];
    }
  }
  material.dispose();
}
