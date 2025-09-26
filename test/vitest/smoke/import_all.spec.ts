import { describe, it, expect, vi } from 'vitest';

// Auto-generated smoke test. Tries to import many project modules to increase
// coverage. We mock heavy external libs above so imports don't fail.

// Mock heavy external deps at the top level
vi.mock('three', () => ({}));
vi.mock('postprocessing', () => ({}));
vi.mock('pixi.js', () => ({}));
vi.mock('puppeteer', () => ({}));
vi.mock('playwright', () => ({}));
vi.mock('@dimforge/rapier3d-compat', () => ({}));
vi.mock('gsap', () => ({}));
vi.mock('idb-keyval', () => ({}));

const modules = [
  "../../src/config/carriers.js",
  "../../src/config/environment.js",
  "../../src/config/projectiles.js",
  "../../src/config/renderer.js",
  "../../src/config/starDiskDebug.js",
  "../../src/game/aiProfiles.js",
  "../../src/game/aiScenarioHarness.js",
  "../../src/game/aiTraits.js",
  "../../src/game/config.js",
  "../../src/game/ships.js",
  "../../src/game/state.js",
  "../../src/game/systems/carriers.js",
  "../../src/game/systems/motion.js",
  "../../src/game/systems.js",
  "../../src/game/turretRegistry.js",
  "../../src/game/uiStore.js",
  "../../src/game/validation.js",
  "../../src/hooks/useArchetypeEntities.js",
  "../../src/hooks/usePlanetTexture.js",
  "../../src/types/index.js",
  "../../src/utils/color.js",
  "../../src/utils/patchGltfLoader.js",
  "../../src/utils/rng.js"
];

describe('smoke imports', () => {
  for (const m of modules) {
    it('imports ' + m, async () => {
      // dynamic import so mocking can be applied first
      let ok = true;
      try {
        const mod = await import(m);
        expect(mod).toBeTruthy();
      } catch (err) {
        ok = false;
        console.warn('smoke import failed', m, err && err.message ? err.message : err);
      }
      expect(ok).toBe(true);
    });
  }
});
