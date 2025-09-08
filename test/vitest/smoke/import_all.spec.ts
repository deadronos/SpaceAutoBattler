// Auto-generated smoke import test (cleaned).
import { describe, it, expect, vi } from 'vitest';

// Mock heavy external libraries so imports don't attempt to load them.
const heavyMocks = [
  'three',
  'postprocessing',
  'pixi.js',
  'puppeteer',
  'playwright',
  '@dimforge/rapier3d-compat',
  'gsap',
  'idb-keyval',
];
for (const m of heavyMocks) {
  try {
    vi.mock(m, () => ({}));
  } catch (e) {
    // ignore
  }
}

const modules = [
  '../../src/config/behaviorConfig.js',
  '../../src/config/cameraConfig.js',
  '../../src/config/carrierSpawnConfig.js',
  '../../src/config/entitiesConfig.js',
  '../../src/config/fleetConfig.js',
  '../../src/config/gameConfig.js',
  '../../src/config/physicsConfig.js',
  '../../src/config/progression.js',
  '../../src/config/rendererConfig.js',
  '../../src/config/rendererEffectsConfig.js',
  '../../src/config/shipModelMap.js',
  '../../src/config/shipVisualConfig.js',
  '../../src/config/simConfig.js',
  '../../src/config/svgConfig.js',
  '../../src/core/adapters/index.js',
  '../../src/core/adapters/physicsAdapter.js',
  '../../src/core/adapters/rendererAdapter.js',
  '../../src/core/adapters/timeAdapter.js',
  '../../src/core/ai/aggressiveSpatialOptimizer.js',
  '../../src/core/ai/batchedQueries.js',
  '../../src/core/ai/controller.js',
  '../../src/core/ai/decisionEngine.js',
  '../../src/core/ai/defense.js',
  '../../src/core/ai/formation.js',
  '../../src/core/ai/intent.js',
  '../../src/core/ai/intentManager.js',
  '../../src/core/ai/roaming.js',
  '../../src/core/ai/spatial.js',
  '../../src/core/ai/steering.js',
  '../../src/core/ai/targeting.js',
  '../../src/core/ai/teamSystems.js',
  '../../src/core/ai/turretTargeting.js',
  '../../src/core/aiController.js',
  '../../src/core/assetLoader.js',
  '../../src/core/assetPool.js',
  '../../src/core/boundaryUtils.js',
  '../../src/core/gameState.js',
  '../../src/core/math/ballisticIntercept.js',
  '../../src/core/physics.js',
  '../../src/core/reFormFleets.js',
  '../../src/core/searchUtils.js',
  '../../src/core/shipModelLoader.js',
  '../../src/core/spatialIndex.js',
  '../../src/core/startLoops.js',
  '../../src/core/svgLoader.js',
  '../../src/core/svgRasterWorker.impl.js',
  '../../src/core/svgRasterWorker.js',
  '../../src/core/systems/projectileSystem.js',
  '../../src/core/systems/spawnSystem.js',
  '../../src/types/index.js',
  '../../src/utils/env.js',
  '../../src/utils/fileWatcher.js',
  '../../src/utils/logger.js',
  '../../src/utils/perf.js',
  '../../src/utils/perfCollector.js',
  '../../src/utils/perfOverlay.js',
  '../../src/utils/randomShipClass.js',
  '../../src/utils/rng.js',
  '../../src/utils/spatialGrid.js',
  '../../src/utils/vector3.js',
];

describe('smoke imports', () => {
  for (const m of modules) {
    it('imports ' + m, async () => {
      let ok = true;
      try {
        const mod = await import(m);
        expect(mod).toBeTruthy();
      } catch (err) {
        ok = false;
        // eslint-disable-next-line no-console
        console.warn('smoke import failed', m, (err && (err as any).message) || err);
      }
      expect(ok).toBe(true);
    });
  }
});
