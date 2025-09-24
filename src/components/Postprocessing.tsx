import React, { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import {
  EffectComposer,
  RenderPass,
  EffectPass,
  BloomEffect,
  SelectiveBloomEffect,
  FXAAEffect,
  KernelSize,
  BlendFunction,
} from 'postprocessing';
import { WebGLRenderer, Scene, Camera } from 'three';
import { useBloomContext } from '../renderer/BloomProvider.js';
import { POSTPROCESSING_CONFIG } from '../config/renderer.js';

type Props = {
  enabled?: boolean;
};

export function Postprocessing({ enabled = false }: Props): null {
  const { gl, scene, camera, size } = useThree();
  const composerRef = useRef<EffectComposer | null>(null);
  const fxaaRef = useRef<FXAAEffect | null>(null);
  const bloomCtx = useBloomContext();

  useEffect(() => {
    // Only create the composer when postprocessing is enabled. This avoids
    // interfering with the default R3F renderer when the feature is off.
    if (!enabled) {
      // If the composer exists from a prior enabled state, dispose it.
      if (composerRef.current) {
        try {
          composerRef.current.dispose();
        } catch {}
        composerRef.current = null;
        fxaaRef.current = null;
      }
      return;
    }

    try {
      const renderer = gl as unknown as WebGLRenderer;
      renderer.autoClear = true;

      const composer = new EffectComposer(renderer);

      // Render the main scene first
      const renderPass = new RenderPass(scene as unknown as Scene, camera as unknown as Camera);
      composer.addPass(renderPass);

      // Selective bloom: only affect registered selection
      const bloom = new SelectiveBloomEffect(
        scene as unknown as Scene,
        camera as unknown as Camera,
        (bloomCtx?.selection ?? new Set()) as any,
      );
      // Configure bloom parameters
      try {
        (bloom as any).blendMode.blendFunction = BlendFunction.SCREEN;
        (bloom as any).kernelSize = KernelSize.SMALL;
        (bloom as any).intensity = POSTPROCESSING_CONFIG.bloomIntensity ?? 1.0;
        const lumMat = (bloom as any).luminanceMaterial;
        if (lumMat) {
          lumMat.threshold = POSTPROCESSING_CONFIG.bloomThreshold ?? 1.0;
          lumMat.smoothing = POSTPROCESSING_CONFIG.bloomSmoothing ?? 0.1;
        }
        (bloom as any).mipmapBlur = true;
      } catch {}

      // FXAA
      const fxaa = new FXAAEffect();

      // Compose effects into a single pass (order matters: bloom before fxaa)
  const effectPass = new EffectPass(camera as unknown as Camera, bloom, fxaa);
      effectPass.renderToScreen = true;
      composer.addPass(effectPass);

      composerRef.current = composer;
      fxaaRef.current = fxaa;
    } catch (err) {
      // If instantiation fails, fail gracefully and keep composer disabled
      // so the default R3F renderer can render without interruption.
      // Log for debugging.
      // eslint-disable-next-line no-console
      console.warn('Postprocessing init failed, skipping composer:', err);
      composerRef.current = null;
      fxaaRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, bloomCtx ? bloomCtx.selection : null, gl, scene, camera]);

  useEffect(() => {
    const composer = composerRef.current;
    if (!composer) return;
    composer.setSize(size.width, size.height);
  }, [size]);

  useFrame((_, delta) => {
    const composer = composerRef.current;
    if (!composer) return;
    if (enabled) {
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
