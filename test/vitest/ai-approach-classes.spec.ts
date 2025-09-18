/* eslint-env node */
/* global process */
// Enable AI debug logs for visibility during test runs
if (!process.env.DEBUG_AI) process.env.DEBUG_AI = process.env.VITEST_AI_DEBUG === '1' ? '1' : '0';
import { test, expect } from 'vitest';
import { createInitialState, spawnShip, simulateStep } from '../../src/core/gameState.js';
import { getShipClassConfig } from '../../src/config/entitiesConfig.js';

const CLASS_LIST: Array<import('../../src/types/index.js').ShipClass> = [
  'corvette',
  'frigate',
  'destroyer',
  'carrier',
];

for (const cls of CLASS_LIST) {
  test(
    `AI approachToRange behavior — ${cls} approaches then fires`,
    () => {
      const state = createInitialState(`ai-approach-${cls}`);
      state.behaviorConfig!.globalSettings.aiEnabled = true;

      const red = spawnShip(state, 'red', cls);
      const blue = spawnShip(state, 'blue', cls);
      // place red at origin-ish
      red.pos = { x: 100, y: 100, z: 100 };

      // Determine turret max range for this class and place blue just outside
      const shipCfg = getShipClassConfig(cls);
      const maxTurretRange = shipCfg.turrets.reduce(
        (m, t) => (typeof t.range === 'number' && t.range > m ? t.range : m),
        0,
      );
      // Place blue slightly outside turret range but within approach multiplier
      const _approachMult = state.behaviorConfig!.globalSettings.approachRangeMultiplier ?? 1.2;
      const targetDist = Math.ceil(maxTurretRange * 1.05); // 5% outside actual range
      blue.pos = { x: 100, y: 100, z: 100 + targetDist };

      let sawApproach = false;
      let bulletsCreated = 0;
      // Run simulation for enough ticks to allow slower ships to approach
      const maxTicks = 720; // ~12s at 60Hz
      for (let i = 0; i < maxTicks; i++) {
        simulateStep(state, 1 / 60);
        const r = state.ships.find((s) => s.id === red.id)!;
        const intent = r.aiState?.currentIntent ?? 'undefined';
        const dx = blue.pos.x - r.pos.x;
        const dy = blue.pos.y - r.pos.y;
        const dz = blue.pos.z - r.pos.z;
        const _dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (intent === 'approachToRange') sawApproach = true;
        bulletsCreated += state.bullets.length;
        // clear bullets so we count new bullets only
        state.bullets = [];
      }

      expect(sawApproach, `${cls} did not enter approachToRange`).toBe(true);
      expect(
        bulletsCreated,
        `${cls} did not create bullets over ${maxTicks} ticks`,
      ).toBeGreaterThan(0);
    },
    { timeout: 60000 },
  );
}
