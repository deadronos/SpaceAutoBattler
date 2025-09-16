import type { GameState, Ship } from '../types/index.js';
import { createAnimationManager } from './animationManager.js';
import { createBVHManager } from './bvhManager.js';
import type { EffectsManager } from './effects.js';
import type { AnimationManager } from './animationManager.js';
import type { BVHManager } from './bvhManager.js';

export interface UnifiedEffectsManager {
  initDone: boolean;
  effects: EffectsManager;
  animation: AnimationManager;
  bvh: BVHManager;

  // Unified methods
  update: (dt: number) => void;
  handleShipSpawn: (ship: Ship) => void;
  handleShipDestruction: (ship: Ship) => Promise<void>;
  handleExplosion: (
    position: { x: number; y: number; z: number },
    intensity?: number,
  ) => Promise<void>;
  handleHitEffect: (position: { x: number; y: number; z: number }, intensity?: number) => void;
  setQuality: (quality: 'low' | 'medium' | 'high') => void;
  dispose: () => void;
}

export function createUnifiedEffectsManager(state: GameState): UnifiedEffectsManager {
  // Create individual managers
  // Note: Effects manager will be created lazily when renderer is available
  let effects: EffectsManager | null = null;

  const animation = createAnimationManager(state);
  const bvh = createBVHManager(state);

  // Initialize effects manager when renderer becomes available
  function ensureEffectsManager() {
    if (!effects && state.renderer) {
      // We need to access the internal Three.js objects
      // This requires extending the renderer or accessing through a different method
      // For now, create a basic effects manager that can be enhanced later
      effects = {
        initDone: false,
        render: () => {},
        resize: () => {},
        dispose: () => {},
        setBloomIntensity: () => {},
        enableMotionBlur: () => {},
        enableDepthOfField: () => {},
        addExplosionEffect: () => {},
      };
    }
  }

  function update(dt: number) {
    ensureEffectsManager();

    // Update BVH with current ship positions
    bvh.updateBVH(state.ships);

    // Update effects
    if (effects && effects.initDone) {
      effects.render(dt);
    }
  }

  async function handleShipSpawn(ship: Ship) {
    if (animation.initDone && state.renderer) {
      animation.animateShipSpawn(ship, state.renderer);
    }
  }

  async function handleShipDestruction(ship: Ship): Promise<void> {
    if (animation.initDone && state.renderer) {
      await animation.animateShipDestruction(ship, state.renderer);
    }
  }

  // Lightweight visual effect for non-lethal hits (sparks, brief particle burst).
  // This should be cheap and return quickly so it can be used for frequent hits.
  function handleHitEffect(position: { x: number; y: number; z: number }, intensity = 1): void {
    const clamped = Math.max(0.1, Math.min(2, intensity));
    try {
      // Prefer an effects manager call if available (use small intensity)
      if (effects && typeof effects.addExplosionEffect === 'function') {
        // Reuse postprocessing hook for a cheap visual by dialing intensity down
        try {
          effects.addExplosionEffect(position, clamped * 0.25);
          console.debug(
            '[UnifiedEffectsManager] handleHitEffect -> effects.addExplosionEffect (small)',
            position,
            clamped,
          );
        } catch (_e) {
          void _e;
        }
      }

      // Small camera nudge for hit feedback
      try {
        if (animation && typeof animation.shakeCamera === 'function') {
          animation.shakeCamera(Math.min(0.2, clamped * 0.15), 0.12);
        }
      } catch (_e) {
        void _e;
      }

      // Emit a debug trace so tests or devs can confirm it ran
      console.debug('[UnifiedEffectsManager] handleHitEffect', position, clamped);
    } catch (err) {
      console.warn('[UnifiedEffectsManager] handleHitEffect failed', err);
    }
  }

  async function handleExplosion(
    position: { x: number; y: number; z: number },
    intensity = 1.0,
  ): Promise<void> {
    try {
      // Log entry to help trace whether this function is actually invoked at runtime
      // Avoid importing logger at module top to keep dependency surface unchanged;
      // use console.info as a safe fallback in the renderer context.
      if (typeof console !== 'undefined' && console.info) {
        console.info('[UnifiedEffectsManager] handleExplosion invoked', position, intensity, {
          animationInit: animation.initDone,
          effectsInit: effects ? effects.initDone : false,
        });
      }
    } catch {
      /* ignore logging failures */
    }
    // Combine multiple effects for explosions
    const promises: Promise<void>[] = [];

    // Animation effects
    if (animation.initDone) {
      promises.push(animation.animateExplosion(position, intensity));
    }

    // Postprocessing effects
    if (effects && effects.initDone) {
      effects.addExplosionEffect(position, intensity);
    }

    // Camera shake
    if (animation.initDone) {
      animation.shakeCamera(intensity * 0.3, 0.4);
    }

    await Promise.all(promises);
  }

  function setQuality(quality: 'low' | 'medium' | 'high') {
    ensureEffectsManager();

    if (!effects) return;

    switch (quality) {
      case 'low':
        effects.setBloomIntensity(0.2);
        effects.enableMotionBlur(false);
        effects.enableDepthOfField(false);
        break;
      case 'medium':
        effects.setBloomIntensity(0.4);
        effects.enableMotionBlur(true);
        effects.enableDepthOfField(false);
        break;
      case 'high':
        effects.setBloomIntensity(0.6);
        effects.enableMotionBlur(true);
        effects.enableDepthOfField(true);
        break;
    }
  }

  // Ensure effects manager is initialized
  ensureEffectsManager();

  const finalEffects = effects || {
    initDone: false,
    render: () => {},
    resize: () => {},
    dispose: () => {},
    setBloomIntensity: () => {},
    enableMotionBlur: () => {},
    enableDepthOfField: () => {},
    addExplosionEffect: () => {},
  };

  return {
    initDone: finalEffects.initDone && animation.initDone && bvh.initDone,
    effects: finalEffects,
    animation,
    bvh,
    update,
    handleShipSpawn,
    handleShipDestruction,
    handleExplosion,
    handleHitEffect,
    setQuality,
    dispose: () => {
      finalEffects.dispose();
      animation.dispose();
      bvh.dispose();
    },
  };
}
