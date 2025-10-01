import React, { useCallback, useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { type EffectComposer, type FXAAEffect, type SelectiveBloomEffect } from 'postprocessing';
import { type WebGLRenderer, type Scene, type Camera, type WebGLRenderTarget, Color } from 'three';
import { useBloomContext } from '../renderer/BloomProvider.js';
import { POSTPROCESSING_CONFIG } from '../config/renderer.js';
import {
  createComposer,
  type ComposerSetupResult,
} from './postprocessing/createComposer.js';
import {
  buildEffects,
  type BloomContextLike,
} from './postprocessing/buildEffects.js';

type Props = {
  enabled?: boolean;
};

export function Postprocessing({ enabled = false }: Props): null {
  const { gl, scene, camera, size, invalidate } = useThree();
  const effectiveEnabled = enabled;
  const composerRef = useRef<EffectComposer | null>(null);
  const composerSetupRef = useRef<ComposerSetupResult | null>(null);
  const fxaaRef = useRef<FXAAEffect | null>(null);
  const bloomEffectsRef = useRef<SelectiveBloomEffect[]>([]);
  const renderTargetRef = useRef<WebGLRenderTarget | null>(null);
  const bloomCtx = useBloomContext();

  const cleanupComposer = useCallback(() => {
    const setup = composerSetupRef.current;
    composerSetupRef.current = null;

    if (setup) {
      try {
        setup.dispose();
      } catch {}
      try {
        setup.restoreRendererState();
      } catch {}
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

    const bloomContext: BloomContextLike | null = bloomCtx
      ? { defaultGroup: bloomCtx.defaultGroup, selections: bloomCtx.selections }
      : null;

    try {
      const { effectPass, bloomEffects, fxaa } = buildEffects({
        scene: scene as unknown as Scene,
        camera: camera as unknown as Camera,
        bloomContext,
        config: POSTPROCESSING_CONFIG,
      });

      const composerSetup = createComposer({
        renderer,
        scene: scene as unknown as Scene,
        camera: camera as unknown as Camera,
        effectPass,
      });

      composerSetupRef.current = composerSetup;
      composerRef.current = composerSetup.composer;
      renderTargetRef.current = composerSetup.renderTarget;
      bloomEffectsRef.current = bloomEffects;
      fxaaRef.current = fxaa;
    } catch (err) {
      cleanupComposer();
      // If instantiation fails, fail gracefully and keep composer disabled
      // so the default R3F renderer can render without interruption.
      // Log for debugging.
      // eslint-disable-next-line no-console
      console.warn('Postprocessing init failed, skipping composer:', err);
    }

    return () => {
      cleanupComposer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    enabled,
    bloomCtx ? bloomCtx.selections : null,
    bloomCtx ? bloomCtx.defaultGroup : null,
    gl,
    scene,
    camera,
    cleanupComposer,
  ]);

  useEffect(() => {
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
        let prevCameraLayersMask = camera.layers.mask;
        try {
          if (bloomCtx && typeof (bloomCtx as any).enableCameraLayers === 'function') {
            prevCameraLayersMask = (bloomCtx as any).enableCameraLayers(camera as any);
          }
        } catch { /* ignore */ }

        composer.render(delta);

        // Restore camera layers to previous mask so other systems are unaffected
        try {
          camera.layers.mask = prevCameraLayersMask;
        } catch { /* ignore */ }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('Postprocessing render failed:', err);
      }
    }
    // Return true to skip R3F's default render (composer handles rendering)
    return true;
  }, 1);

  return null;
}

export default Postprocessing;
