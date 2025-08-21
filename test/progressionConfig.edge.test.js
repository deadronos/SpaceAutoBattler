import { test, expect } from 'vitest';
import * as cfg from '../src/progressionConfig.js';

test('progressionConfig constants are reasonable numbers', () => {
  expect(typeof cfg.XP_BASE).toBe('number');
  expect(cfg.XP_BASE).toBeGreaterThan(0);
  expect(cfg.XP_GROWTH).toBeGreaterThanOrEqual(1);
  expect(cfg.HP_PERCENT_PER_LEVEL).toBeGreaterThanOrEqual(0);
  expect(cfg.DMG_PERCENT_PER_LEVEL).toBeGreaterThanOrEqual(0);
  expect(cfg.SHIELD_PERCENT_PER_LEVEL).toBeGreaterThanOrEqual(0);
});
