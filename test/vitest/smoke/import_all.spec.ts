/// <reference types="vite/client" />

import { describe, it, expect, vi } from 'vitest';

// Auto-generated smoke test. Tries to import many project modules to increase
// coverage. We mock heavy external libs above so imports don't fail.

// Mock heavy external deps at the top level
vi.mock('postprocessing', () => ({}));
vi.mock('pixi.js', () => ({}));
vi.mock('puppeteer', () => ({}));
vi.mock('playwright', () => ({}));
vi.mock('@dimforge/rapier3d-compat', () => ({}));
vi.mock('gsap', () => ({}));
vi.mock('idb-keyval', () => ({}));

const moduleLoaders = import.meta.glob<unknown>(
  '../../../src/**/*.{ts,tsx}',
  { eager: false }
);

const moduleKeys = [
  '../../../src/config/carriers.ts',
  '../../../src/config/environment.ts',
  '../../../src/config/projectiles.ts',
  '../../../src/config/renderer.ts',
  '../../../src/game/aiProfiles.ts',
  '../../../src/game/aiScenarioHarness.ts',
  '../../../src/game/aiTraits.ts',
  '../../../src/game/config.ts',
  '../../../src/game/ships.ts',
  '../../../src/game/state.ts',
  '../../../src/game/systems/carriers.ts',
  '../../../src/game/systems/motion.ts',
  '../../../src/game/systems.ts',
  '../../../src/game/turretRegistry.ts',
  '../../../src/game/uiStore.ts',
  '../../../src/game/validation.ts',
  '../../../src/hooks/useArchetypeEntities.ts',
  '../../../src/hooks/usePlanetTexture.ts',
  '../../../src/types/index.ts',
  '../../../src/utils/color.ts',
  '../../../src/utils/patchGltfLoader.ts',
  '../../../src/utils/rng.ts',
] as const;

describe('smoke imports', () => {
  for (const path of moduleKeys) {
    it('imports ' + path, async () => {
      // dynamic import so mocking can be applied first
      let ok = true;
      try {
        const loader = moduleLoaders[path];
        expect(loader).toBeTruthy();
        const mod = loader ? await loader() : null;
        expect(mod).toBeTruthy();
      } catch (err) {
        ok = false;
        console.warn('smoke import failed', path, formatError(err));
      }
      expect(ok).toBe(true);
    });
  }
});

function formatError(err: unknown): string {
  if (err instanceof Error && typeof err.message === 'string') {
    return err.message;
  }
  if (typeof err === 'string') {
    return err;
  }
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}
