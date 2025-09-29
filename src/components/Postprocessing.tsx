import React, { useCallback, useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { type EffectComposer, type FXAAEffect, type SelectiveBloomEffect } from 'postprocessing';
import { type WebGLRenderer, type Scene, type Camera, type WebGLRenderTarget } from 'three';
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
  const { gl, scene, camera, size } = useThree();
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

    if (!enabled) {
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
    if (enabled) {
      if (bloomEffectsRef.current.length > 0) {
        for (const effect of bloomEffectsRef.current) {
          effect.blendMode.opacity.value = effect.selection.size > 0 ? 1 : 0;
        }
      }
      try {
        composer.render(delta);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('Postprocessing render failed:', err);
      }
    }
  }, 1);

  return null;
}

export default Postprocessing;
