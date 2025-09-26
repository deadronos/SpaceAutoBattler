import {
  ClampToEdgeWrapping,
  DataTexture,
  LinearFilter,
  NearestFilter,
  RepeatWrapping,
  RGBAFormat,
  ShaderMaterial,
  SRGBColorSpace,
  Texture,
  UnsignedByteType,
  Vector3,
} from 'three';
import fragmentShader from './shaders/mainsequencestar.glsl';
import vertexShader from './shaders/starDisk.vertex.glsl';

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
}

const DEFAULT_RESOLUTION = new Vector3(1, 1, 1);

const FALLBACK_ORGANIC = (() => {
  const data = new Uint8Array([
    255, 220, 140, 255,
    240, 180, 80, 255,
    255, 200, 100, 255,
    250, 160, 60, 255,
    200, 120, 40, 255,
    150, 80, 30, 255,
    180, 100, 45, 255,
    220, 140, 70, 255,
    80, 40, 20, 255,
    60, 30, 15, 255,
    100, 50, 25, 255,
    120, 60, 30, 255,
    40, 20, 10, 255,
    160, 80, 20, 255,
    90, 45, 15, 255,
    200, 100, 30, 255,
  ]);
  const texture = new DataTexture(data, 4, 4, RGBAFormat, UnsignedByteType);
  texture.name = 'MainSequenceOrganicFallback';
  texture.wrapS = RepeatWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
})();

const FALLBACK_NOISE = (() => {
  const data = new Uint8Array([
    255, 200, 100, 255,
    80, 40, 20, 255,
    220, 160, 60, 255,
    40, 20, 10, 255,
    200, 120, 40, 255,
    60, 30, 15, 255,
    180, 140, 80, 255,
    100, 50, 25, 255,
    240, 180, 90, 255,
    70, 35, 18, 255,
    160, 100, 50, 255,
    90, 45, 22, 255,
    210, 140, 70, 255,
    50, 25, 12, 255,
    150, 90, 45, 255,
    120, 70, 35, 255,
  ]);
  const texture = new DataTexture(data, 4, 4, RGBAFormat, UnsignedByteType);
  texture.name = 'MainSequenceNoiseFallback';
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.minFilter = NearestFilter;
  texture.magFilter = NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
})();

const resolveTexture = (texture: Texture | null | undefined, fallback: Texture): Texture => texture ?? fallback;

interface MainSequenceUniformMap {
  iTime: { value: number };
  iResolution: { value: Vector3 };
  iChannel0: { value: Texture };
  iChannel1: { value: Texture };
  iCameraRoll: { value: number };
  iStarNorth: { value: number };
}

export function createMainSequenceStarMaterial(options: MainSequenceStarMaterialOptions): ShaderMaterial {
  const organicTexture = resolveTexture(options.organic, FALLBACK_ORGANIC);
  const noiseTexture = resolveTexture(options.noise, FALLBACK_NOISE);

  const material = new ShaderMaterial({
    name: 'MainSequenceStarMaterial',
    transparent: true,
    depthWrite: false,
    vertexShader,
    fragmentShader,
    uniforms: {
      iTime: { value: 0 },
      iResolution: { value: DEFAULT_RESOLUTION.clone() },
      iChannel0: { value: organicTexture },
      iChannel1: { value: noiseTexture },
      iCameraRoll: { value: 0 },
      iStarNorth: { value: 0 },
    },
  });

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
  const height = Number.isFinite(update.resolution.height) ? Math.max(update.resolution.height, 1) : 1;
  resolution.set(width, height, 1);

  if (update.organic !== undefined) {
    uniforms.iChannel0.value = resolveTexture(update.organic, FALLBACK_ORGANIC);
  }
  if (update.noise !== undefined) {
    uniforms.iChannel1.value = resolveTexture(update.noise, FALLBACK_NOISE);
  }
  if (update.cameraRoll !== undefined) {
    const v = Number.isFinite(update.cameraRoll as number) ? (update.cameraRoll as number) : 0;
    uniforms.iCameraRoll.value = v;
  }
  if (update.starNorth !== undefined) {
    const v = Number.isFinite(update.starNorth as number) ? (update.starNorth as number) : 0;
    uniforms.iStarNorth.value = v;
  }
}

export function disposeMainSequenceStarMaterial(material: ShaderMaterial | null): void {
  material?.dispose();
}
