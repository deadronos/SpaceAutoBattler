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
  // Debug override: allow tests to disable postprocessing at runtime
  // by setting `window.__copilot_disablePostprocessing = true`.
  const debugDisable = typeof window !== 'undefined' && (window as any).__copilot_disablePostprocessing === true;
  const effectiveEnabled = enabled && !debugDisable;
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
        // DEV: optional per-frame composer snapshot for automation/debugging.
        // Enable by setting `window.__copilot_enableComposerSnapshot = true` in the page.
        try {
          const win = typeof window !== 'undefined' ? (window as any) : undefined;
          if (win && win.__copilot_enableComposerSnapshot) {
            try {
              const renderer = gl as unknown as WebGLRenderer;
              const pre = {
                timestamp: Date.now(),
                autoClear: !!renderer.autoClear,
                toneMapping: String(renderer.toneMapping),
                toneMappingExposure: typeof (renderer as any).toneMappingExposure === 'number' ? (renderer as any).toneMappingExposure : null,
                outputColorSpace: (renderer.outputColorSpace && (renderer.outputColorSpace as any).name) ? (renderer.outputColorSpace as any).name : String(renderer.outputColorSpace),
                renderTargetSize: renderTargetRef.current ? { width: renderTargetRef.current.width, height: renderTargetRef.current.height } : null,
                bloomSelectionCounts: bloomEffectsRef.current.map((e) => (e.selection ? e.selection.size : 0)),
                bloomBlendOpacities: bloomEffectsRef.current.map((e) => (e.blendMode ? Number(e.blendMode.opacity.value) : null)),
                fxaaPresent: !!fxaaRef.current,
              } as const;
              try { win.__copilot_composerSnapshot = { pre, post: null }; } catch { /* ignore */ }
            } catch { /* ignore */ }
          }
        } catch { /* ignore */ }

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

        // Deterministic marker: indicate that the composer completed a render
        try { if (typeof window !== 'undefined') (window as any).__copilot_composerRendered = Date.now(); } catch { /* ignore */ }

        // Restore camera layers to previous mask so other systems are unaffected
        try {
          camera.layers.mask = prevCameraLayersMask;
        } catch { /* ignore */ }

        // DEV: optional post-composer write test for automation/debugging.
        // Inject a tiny 3×3 white quad to verify framebuffer writability.
        // Enable by setting `window.__copilot_injectPostWrite = true` in the page.
        try {
          const win = typeof window !== 'undefined' ? (window as any) : undefined;
          if (win && win.__copilot_injectPostWrite) {
            try {
              const renderer = gl as unknown as WebGLRenderer;
              const canvas = renderer.domElement;
              const w = canvas.width;
              const h = canvas.height;
              // Get star projection from window.__copilot_star_screenPos (set by StarDisk)
              const screenPos = win.__copilot_star_screenPos;
              if (screenPos && typeof screenPos.pxX === 'number' && typeof screenPos.pxY === 'number') {
                const pxX = screenPos.pxX;
                const pxY = screenPos.pxY;
                const cssWidth = screenPos.width || 1;
                const cssHeight = screenPos.height || 1;
                // Convert CSS pixel coords to device pixel coords
                const dpr = renderer.getPixelRatio();
                const deviceX = Math.floor(pxX * dpr);
                const deviceY = Math.floor((cssHeight - 1 - pxY) * dpr);
                // Enable scissor to constrain write to 50×50 region (increased for visibility)
                const writeSize = 50;
                renderer.setScissorTest(true);
                renderer.setScissor(deviceX - writeSize / 2, deviceY - writeSize / 2, writeSize, writeSize);
                renderer.clearColor();
                // Write opaque magenta for high visibility
                const prevClearColor = renderer.getClearColor(new Color());
                const prevClearAlpha = renderer.getClearAlpha();
                renderer.setClearColor(0xff00ff, 1.0);
                renderer.clear(true, false, false);
                renderer.setClearColor(prevClearColor, prevClearAlpha);
                renderer.setScissorTest(false);
                // Signal that the post-composer write completed so tests can await this deterministically
                try { (win as any).__copilot_postWritePerformed = Date.now(); } catch { /* ignore */ }
                // Log that we executed the write
                try { console.log('[copilot] post-composer write executed at device', deviceX, deviceY, 'from CSS', pxX, pxY); } catch {}
              }
            } catch { /* ignore */ }
          }
        } catch { /* ignore */ }

        try {
          const win = typeof window !== 'undefined' ? (window as any) : undefined;
          if (win && win.__copilot_enableComposerSnapshot) {
            try {
              const post = { timestamp: Date.now(), renderSucceeded: true };
              try { win.__copilot_composerSnapshot = { ...(win.__copilot_composerSnapshot || {}), post }; } catch { /* ignore */ }
            } catch { /* ignore */ }
          }
        } catch { /* ignore */ }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('Postprocessing render failed:', err);
        try {
          const win = typeof window !== 'undefined' ? (window as any) : undefined;
          if (win && win.__copilot_enableComposerSnapshot) {
            try {
              const post = { timestamp: Date.now(), renderSucceeded: false, error: String(err) };
              try { win.__copilot_composerSnapshot = { ...(win.__copilot_composerSnapshot || {}), post }; } catch { /* ignore */ }
            } catch { /* ignore */ }
          }
        } catch { /* ignore */ }
      }
    }
    // Return true to skip R3F's default render (composer handles rendering)
    return true;
  }, 1);

  return null;
}

export default Postprocessing;
