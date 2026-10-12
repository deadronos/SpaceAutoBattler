import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import {
  type EffectComposer,
  type FXAAEffect,
  type Pass,
  type SelectiveBloomEffect,
} from 'postprocessing';
import { type WebGLRenderer, type Scene, type Camera, type WebGLRenderTarget } from 'three';
import { useBloomContext } from '../renderer/bloom/index.js';
import {
  POSTPROCESSING_CONFIG,
  type AmbientOcclusionConfig,
  type ColorPipelineConfig,
} from '../config/renderer.js';
import { useUiStore } from '../app/uiStore.js';
import { resolveQualitySettings } from '../config/quality.js';
import { createComposer, type ComposerSetupResult } from './postprocessing/createComposer.js';
import { buildEffects, type BloomContextLike } from './postprocessing/buildEffects.js';
import { buildAmbientOcclusion } from './postprocessing/buildAmbientOcclusion.js';
import { reportMaterialError, reportWebGLError } from '../utils/errorReporting.js';

type Props = {
  enabled?: boolean;
};

type DebugWindow = Window & {
  __copilot_forceAmbientOcclusion?: boolean;
  __copilot_forceHdrPipeline?: boolean;
};

/**
 * Manages the post-processing effect composer and passes.
 * Handles Bloom, FXAA, and other screen-space effects.
 *
 * @param {object} props - Component props.
 * @param {boolean} [props.enabled=false] - Whether post-processing is enabled.
 * @returns {null} This component does not render DOM elements, but attaches to the R3F canvas.
 */
export function Postprocessing({ enabled = false }: Props): null {
  const { gl, scene, camera, size } = useThree();
  const effectiveEnabled = enabled;
  const composerRef = useRef<EffectComposer | null>(null);
  const composerSetupRef = useRef<ComposerSetupResult | null>(null);
  const fxaaRef = useRef<FXAAEffect | null>(null);
  const bloomEffectsRef = useRef<SelectiveBloomEffect[]>([]);
  const renderTargetRef = useRef<WebGLRenderTarget | null>(null);
  const aoPassRef = useRef<Pass | null>(null);
  // Tracks the latest canvas size so the AO pass can be built at the current
  // resolution without recreating the composer on every resize (the composer's
  // `setSize` path resizes passes afterwards).
  const sizeRef = useRef(size);
  const bloomCtx = useBloomContext();
  const activeBloomCtx = bloomCtx ?? null;
  const enableCameraLayers = activeBloomCtx?.enableCameraLayers;

  // Resolved quality knobs (render-only). `high` reproduces the shipped
  // POSTPROCESSING_CONFIG.ao values exactly, so this is a no-op by default.
  const qualityPreset = useUiStore((s) => s.qualityPreset);
  const detectedQualityTier = useUiStore((s) => s.detectedQualityTier);
  const quality = useMemo(
    () => resolveQualitySettings(qualityPreset, detectedQualityTier),
    [qualityPreset, detectedQualityTier],
  );
  const aoConfig = useMemo<AmbientOcclusionConfig>(
    () => ({
      ...POSTPROCESSING_CONFIG.ao,
      enabled: quality.ao.enabled,
      halfRes: quality.ao.halfRes,
      quality: quality.ao.quality,
    }),
    [quality.ao.enabled, quality.ao.halfRes, quality.ao.quality],
  );

  // Linear-HDR + tone-mapping pipeline (#645). The debug override is resolved
  // once (at mount), mirroring `__copilot_forceAmbientOcclusion`:
  // `undefined` → config; `true`/`false` → forced.
  const colorPipeline = useMemo<ColorPipelineConfig>(() => {
    const forced =
      typeof window !== 'undefined'
        ? (window as DebugWindow).__copilot_forceHdrPipeline
        : undefined;
    return {
      ...POSTPROCESSING_CONFIG.colorPipeline,
      enabled: forced === undefined ? POSTPROCESSING_CONFIG.colorPipeline.enabled : forced,
    };
  }, []);

  const cleanupComposer = useCallback(() => {
    const setup = composerSetupRef.current;
    composerSetupRef.current = null;

    const aoPass = aoPassRef.current;
    aoPassRef.current = null;

    if (setup) {
      try {
        setup.dispose();
      } catch (error) {
        // Expected: Composer may already be disposed
        reportWebGLError('composer.dispose', error);
      }
      try {
        setup.restoreRendererState();
      } catch (error) {
        // Expected: Renderer state may already be restored
        reportWebGLError('composer.restoreRendererState', error);
      }
    }

    if (aoPass) {
      try {
        aoPass.dispose();
      } catch (error) {
        // Expected: AO pass may already be disposed by the composer
        reportWebGLError('aoPass.dispose', error);
      }
    }

    composerRef.current = null;
    fxaaRef.current = null;
    bloomEffectsRef.current = [];
    renderTargetRef.current = null;
  }, []);

  useEffect(() => {
    const renderer = gl as unknown as WebGLRenderer;

    if (!effectiveEnabled) {
      cleanupComposer();
      return cleanupComposer;
    }

    const bloomContext: BloomContextLike | null = activeBloomCtx
      ? {
          defaultGroup: activeBloomCtx.defaultGroup,
          selections: activeBloomCtx.selections,
        }
      : null;

    let aoPass: Pass | null = null;

    try {
      const { effectPass, bloomEffects, fxaa } = buildEffects({
        scene: scene as unknown as Scene,
        camera: camera as unknown as Camera,
        bloomContext,
        config: POSTPROCESSING_CONFIG,
        colorPipeline,
      });

      // Debug override: tests/automation can force AO on or off regardless of
      // the shipped config, mirroring `__copilot_forcePostprocessingMount`.
      const forcedAo =
        typeof window !== 'undefined'
          ? (window as DebugWindow).__copilot_forceAmbientOcclusion
          : undefined;
      const aoEnabled = forcedAo === undefined ? aoConfig.enabled : forcedAo;

      aoPass = aoEnabled
        ? buildAmbientOcclusion({
            scene: scene as unknown as Scene,
            camera: camera as unknown as Camera,
            width: sizeRef.current.width,
            height: sizeRef.current.height,
            config: aoConfig,
          })
        : null;

      const composerSetup = createComposer({
        renderer,
        scene: scene as unknown as Scene,
        camera: camera as unknown as Camera,
        effectPass,
        colorPipeline,
        aoPass,
      });

      composerSetupRef.current = composerSetup;
      composerRef.current = composerSetup.composer;
      renderTargetRef.current = composerSetup.renderTarget;
      bloomEffectsRef.current = bloomEffects;
      fxaaRef.current = fxaa;
      aoPassRef.current = aoPass;
    } catch (err) {
      // If `createComposer` threw after the AO pass was built, the pass was
      // never handed to the composer, so release it here before cleanup.
      if (aoPass) {
        try {
          aoPass.dispose();
        } catch (error) {
          reportWebGLError('aoPass.dispose', error);
        }
      }
      cleanupComposer();
      // If instantiation fails, fail gracefully and keep composer disabled
      // so the default R3F renderer can render without interruption.
      // Log for debugging.
      // oxlint-disable-next-line no-console
      console.warn('Postprocessing init failed, skipping composer:', err);
    }

    return () => {
      cleanupComposer();
    };
  }, [
    effectiveEnabled,
    activeBloomCtx,
    gl,
    scene,
    camera,
    cleanupComposer,
    aoConfig,
    colorPipeline,
    quality.tier,
  ]);

  useEffect(() => {
    sizeRef.current = size;
    const composer = composerRef.current;
    if (!composer) return;
    composer.setSize(size.width, size.height);
    renderTargetRef.current?.setSize(size.width, size.height);
  }, [size]);

  useFrame((_, delta) => {
    const composer = composerRef.current;
    if (!composer) return;
    if (effectiveEnabled) {
      if (bloomEffectsRef.current.length > 0) {
        for (const effect of bloomEffectsRef.current) {
          effect.blendMode.opacity.value = effect.selection.size > 0 ? 1 : 0;
        }
      }
      try {
        // Use BloomProvider helper to enable all bloom selection layers on the camera
        // and restore the previous mask afterwards. This centralizes the logic
        // inside BloomProvider so tests can assert it deterministically.
        let prevCameraLayersMask: number | undefined;

        if (camera.layers) {
          prevCameraLayersMask = camera.layers.mask;
        }

        try {
          if (typeof enableCameraLayers === 'function') {
            prevCameraLayersMask = enableCameraLayers(camera as Camera);
          }
        } catch (error) {
          // Expected: BloomContext may not expose enableCameraLayers
          reportMaterialError('enableCameraLayers', 'BloomContext', error);
        }

        composer.render(delta);

        // Restore camera layers to previous mask so other systems are unaffected
        if (prevCameraLayersMask !== undefined && camera.layers) {
          try {
            camera.layers.mask = prevCameraLayersMask;
          } catch (error) {
            // Expected: Camera layers may be read-only in some contexts
            reportMaterialError('restoreCameraLayers', 'camera', error);
          }
        }
      } catch (err) {
        // oxlint-disable-next-line no-console
        console.warn('Postprocessing render failed:', err);
      }
    }
    // Return true to skip R3F's default render (composer handles rendering)
    return true;
  }, 1);

  return null;
}

export default Postprocessing;
