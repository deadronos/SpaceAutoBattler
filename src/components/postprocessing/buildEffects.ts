import {
  BlendFunction,
  EffectPass,
  FXAAEffect,
  KernelSize,
  SelectiveBloomEffect,
  type Selection,
} from 'postprocessing';
import type { Camera, Scene } from 'three';
import type { PostprocessingConfig } from '../../config/renderer.js';

export interface BloomContextLike {
  defaultGroup: string;
  selections: Map<string, Selection>;
}

export interface BuildEffectsOptions {
  scene: Scene;
  camera: Camera;
  bloomContext: BloomContextLike | null;
  config: PostprocessingConfig;
}

export interface BuildEffectsResult {
  effectPass: EffectPass;
  bloomEffects: SelectiveBloomEffect[];
  fxaa: FXAAEffect;
  effects: (SelectiveBloomEffect | FXAAEffect)[];
}

type SelectiveBloomWithInternals = SelectiveBloomEffect & {
  depthMaskMaterial?: { keepFar: boolean };
  luminanceMaterial?: { threshold: number; smoothing: number };
  mipmapBlur?: boolean;
};

export function buildEffects({ scene, camera, bloomContext, config }: BuildEffectsOptions): BuildEffectsResult {
  const groupConfigs = config.bloomGroups ?? {};
  const defaultGroup = bloomContext?.defaultGroup ?? config.bloomDefaultGroup ?? 'default';
  const groupNames = new Set<string>([...Object.keys(groupConfigs), defaultGroup]);
  const bloomEffects: SelectiveBloomEffect[] = [];

  groupNames.forEach((groupName) => {
    const selection = bloomContext?.selections.get(groupName);
    if (!selection) return;

    const overrides = groupConfigs[groupName] ?? {};
    const bloom = new SelectiveBloomEffect(scene, camera, {
      blendFunction: BlendFunction.SCREEN,
      kernelSize: KernelSize.SMALL,
      intensity: overrides.intensity ?? config.bloomIntensity ?? 1,
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
  const effects = [...bloomEffects, fxaa];
  const effectPass = new EffectPass(camera, ...effects);
  effectPass.renderToScreen = true;

  return {
    effectPass,
    bloomEffects,
    fxaa,
    effects,
  };
}
