import type { GameState } from '../types/index.js';
import { createEffectsManager } from './effects.js';
import { createAnimationManager } from './animationManager.js';
import { createBVHManager } from './bvhManager.js';

export interface UnifiedEffectsManager {
  initDone: boolean;
  effects: import('./effects.js').EffectsManager;
  animation: import('./animationManager.js').AnimationManager;
  bvh: import('./bvhManager.js').BVHManager;

  // Unified methods
  update: (dt: number) => void;
  handleShipSpawn: (ship: any) => void;
  handleShipDestruction: (ship: any) => Promise<void>;
  handleExplosion: (position: { x: number; y: number; z: number }, intensity?: number) => Promise<void>;
  setQuality: (quality: 'low' | 'medium' | 'high') => void;
  dispose: () => void;
}

export function createUnifiedEffectsManager(state: GameState): UnifiedEffectsManager {
  // Create individual managers
  // Note: Effects manager will be created lazily when renderer is available
  let effects: import('./effects.js').EffectsManager | null = null;

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
        addExplosionEffect: () => {}
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

  async function handleShipSpawn(ship: any) {
    if (animation.initDone && state.renderer) {
      animation.animateShipSpawn(ship, state.renderer);
    }
  }

  async function handleShipDestruction(ship: any): Promise<void> {
    if (animation.initDone && state.renderer) {
      await animation.animateShipDestruction(ship, state.renderer);
    }
  }

  async function handleExplosion(position: { x: number; y: number; z: number }, intensity = 1.0): Promise<void> {
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
    addExplosionEffect: () => {}
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
    setQuality,
    dispose: () => {
      finalEffects.dispose();
      animation.dispose();
      bvh.dispose();
    }
  };
}