import React, { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import {
  EffectComposer,
  RenderPass,
  EffectPass,
  BloomEffect,
  FXAAEffect,
  KernelSize,
  ToneMappingEffect,
  BlendFunction,
} from 'postprocessing';
import { WebGLRenderer, Scene, Camera } from 'three';

type Props = {
  enabled?: boolean;
};

export function Postprocessing({ enabled = false }: Props): null {
  const { gl, scene, camera, size } = useThree();
  const composerRef = useRef<EffectComposer | null>(null);
  const fxaaRef = useRef<FXAAEffect | null>(null);

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

      // Bloom effect
      const bloom = new BloomEffect({
        blendFunction: BlendFunction.SCREEN,
        kernelSize: KernelSize.SMALL,
        luminanceThreshold: 0.85,
        luminanceSmoothing: 0.1,
        intensity: 1.0,
      });

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
  }, [enabled]);

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
