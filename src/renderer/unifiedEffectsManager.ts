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
  // Optional debug for tests
  getDebug?: () => { queuedExplosions: number; queuedHitSparks: number };
}
export interface UnifiedEffectsDeps {
  effects?: EffectsManager;
  animation?: AnimationManager;
  bvh?: BVHManager;
}

export function createUnifiedEffectsManager(
  state: GameState,
  deps?: UnifiedEffectsDeps,
): UnifiedEffectsManager {
  // Create individual managers
  // Note: Effects manager will be created lazily when renderer is available
  let effects: EffectsManager | null = deps?.effects ?? null;

  const animation = deps?.animation ?? createAnimationManager(state);
  const bvh = deps?.bvh ?? createBVHManager(state);
  // Queue for explosion effects when effects manager isn't ready yet
  const queuedExplosions: Array<{
    position: { x: number; y: number; z: number };
    intensity: number;
  }> = [];
  // Queue for hit sparks when effects manager isn't ready
  const queuedHitSparks: Array<{
    position: { x: number; y: number; z: number };
    opts?: { intensity?: number };
  }> = [];

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
        addHitSpark: () => {},
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

    // Flush any queued explosion visual effects once effects are ready
    try {
      if (effects && effects.initDone && queuedExplosions.length > 0) {
        // Drain the queue
        const toFlush = queuedExplosions.splice(0, queuedExplosions.length);
        for (const item of toFlush) {
          try {
            effects.addExplosionEffect(item.position, item.intensity);
            console.info(
              '[UnifiedEffectsManager] flushed queued explosion',
              item.position,
              item.intensity,
            );
          } catch (err) {
            console.warn('[UnifiedEffectsManager] failed to flush queued explosion', err);
          }
        }
      }
      // Flush queued hit sparks as well
      if (effects && effects.initDone && queuedHitSparks.length > 0) {
        const toFlushHits = queuedHitSparks.splice(0, queuedHitSparks.length);
        for (const h of toFlushHits) {
          try {
            effects.addHitSpark(h.position, h.opts);
            console.info('[UnifiedEffectsManager] flushed queued hitSpark', h.position, h.opts);
          } catch (err) {
            console.warn('[UnifiedEffectsManager] failed to flush queued hitSpark', err);
          }
        }
      }
    } catch (_e) {
      void _e;
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
      // Prefer a dedicated hit-spark if the effects manager exposes it.
      // This is cheaper and visually tuned for frequent hits.
      if (effects && effects.initDone && typeof effects.addHitSpark === 'function') {
        try {
          effects.addHitSpark(position, { intensity: clamped * 0.8 });
          console.debug(
            '[UnifiedEffectsManager] handleHitEffect -> effects.addHitSpark',
            position,
            clamped,
          );
        } catch (_e) {
          void _e;
        }
      } else if (effects && effects.initDone && typeof effects.addExplosionEffect === 'function') {
        // Fallback: reuse small explosion effect if hit-spark isn't available
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
      } else {
        // Effects not ready yet: queue hit spark for later flush
        try {
          queuedHitSparks.push({ position, opts: { intensity: clamped * 0.8 } });
          console.debug(
            '[UnifiedEffectsManager] queued hitSpark (effects not ready)',
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

    // Postprocessing effects: if effects manager isn't ready, queue the visual
    if (effects && effects.initDone) {
      effects.addExplosionEffect(position, intensity);
    } else {
      // Queue the effect and continue (animation/camera still run)
      queuedExplosions.push({ position, intensity });
      console.debug(
        '[UnifiedEffectsManager] queued explosion (effects not ready)',
        position,
        intensity,
      );
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
    addHitSpark: () => {},
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
    getDebug: () => ({
      queuedExplosions: queuedExplosions.length,
      queuedHitSparks: queuedHitSparks.length,
    }),
  };
}
