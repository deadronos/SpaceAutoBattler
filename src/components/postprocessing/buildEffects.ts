import {
  BlendFunction,
  EffectPass,
  FXAAEffect,
  KernelSize,
  SelectiveBloomEffect,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
  type Selection,
} from 'postprocessing';
import type { Camera, Scene } from 'three';
import type { ColorPipelineConfig, PostprocessingConfig } from '../../config/renderer.js';
import { reportWebGLError } from '../../utils/errorReporting.js';

export interface BloomContextLike {
  defaultGroup: string;
  selections: Map<string, Selection>;
}

export interface BuildEffectsOptions {
  scene: Scene;
  camera: Camera;
  bloomContext: BloomContextLike | null;
  config: PostprocessingConfig;
  /** Linear-HDR + tone-mapping pipeline config. */
  colorPipeline: ColorPipelineConfig;
}

export interface BuildEffectsResult {
  effectPass: EffectPass;
  bloomEffects: SelectiveBloomEffect[];
  fxaa: FXAAEffect;
  /** Tone-mapping effect when the pipeline is on; `null` on the legacy path. */
  toneMapping: ToneMappingEffect | null;
  /** Vignette effect when the pipeline and vignette are both on; else `null`. */
  vignette: VignetteEffect | null;
  effects: (SelectiveBloomEffect | FXAAEffect | ToneMappingEffect | VignetteEffect)[];
}

const TONE_MAPPING_MODES: Record<ColorPipelineConfig['toneMapping'], ToneMappingMode> = {
  agx: ToneMappingMode.AGX,
  aces: ToneMappingMode.ACES_FILMIC,
  neutral: ToneMappingMode.NEUTRAL,
};

type SelectiveBloomWithInternals = SelectiveBloomEffect & {
  depthMaskMaterial?: { keepFar: boolean };
  luminanceMaterial?: { threshold: number; smoothing: number };
  mipmapBlur?: boolean;
};

export function buildEffects({
  scene,
  camera,
  bloomContext,
  config,
  colorPipeline,
}: BuildEffectsOptions): BuildEffectsResult {
  const groupConfigs = config.bloomGroups ?? {};
  const defaultGroup = bloomContext?.defaultGroup ?? config.bloomDefaultGroup ?? 'default';
  const groupNames = new Set<string>([...Object.keys(groupConfigs), defaultGroup]);
  const bloomEffects: SelectiveBloomEffect[] = [];

  groupNames.forEach((groupName) => {
    const selection = bloomContext?.selections.get(groupName);
    if (!selection) return;

    const overrides = groupConfigs[groupName] ?? {};
    // `bloomScale` rebalances the linear-HDR path only: the target preserves
    // emissive values > 1, so bloom needs a lower multiplier than the legacy
    // sRGB path. Pipeline off ⇒ raw legacy intensity.
    const intensityScale = colorPipeline.enabled ? colorPipeline.bloomScale : 1;
    const bloom = new SelectiveBloomEffect(scene, camera, {
      blendFunction: BlendFunction.SCREEN,
      kernelSize: KernelSize.SMALL,
      intensity: (overrides.intensity ?? config.bloomIntensity ?? 1) * intensityScale,
    }) as SelectiveBloomWithInternals;

    bloom.selection = selection;
    bloom.ignoreBackground = config.bloomIgnoreBackground ?? true;
    bloom.blendMode.opacity.value = selection.size > 0 ? 1 : 0;

    if (bloom.depthMaskMaterial) {
      bloom.depthMaskMaterial.keepFar = false;
    }

    if (bloom.luminanceMaterial) {
      bloom.luminanceMaterial.threshold = overrides.threshold ?? config.bloomThreshold ?? 1;
      bloom.luminanceMaterial.smoothing = overrides.smoothing ?? config.bloomSmoothing ?? 0.1;
    }

    if (typeof bloom.mipmapBlur !== 'undefined') {
      bloom.mipmapBlur = true;
    }

    bloomEffects.push(bloom);
  });

  const fxaa = new FXAAEffect();
  let toneMapping: ToneMappingEffect | null = null;
  let vignette: VignetteEffect | null = null;

  if (colorPipeline.enabled) {
    // Headless-safe: under jsdom/happy-dom (no WebGL) effect construction may
    // throw. Degrade to the legacy effect list rather than breaking the
    // composer, mirroring `buildAmbientOcclusion`.
    try {
      // Exposure is applied by `createComposer` via `renderer.toneMappingExposure`
      // (the effect's operator reads three's built-in uniform).
      toneMapping = new ToneMappingEffect({
        mode: TONE_MAPPING_MODES[colorPipeline.toneMapping],
      });

      if (colorPipeline.vignette.enabled) {
        vignette = new VignetteEffect({
          offset: colorPipeline.vignette.offset,
          darkness: colorPipeline.vignette.darkness,
        });
      }
    } catch (error) {
      reportWebGLError('buildEffects.toneMapping', error);
      toneMapping = null;
      vignette = null;
    }
  }

  const effects =
    toneMapping === null
      ? [...bloomEffects, fxaa]
      : [...bloomEffects, toneMapping, ...(vignette === null ? [] : [vignette]), fxaa];
  const effectPass = new EffectPass(camera, ...effects);
  effectPass.renderToScreen = true;

  return {
    effectPass,
    bloomEffects,
    fxaa,
    toneMapping,
    vignette,
    effects,
  };
}
