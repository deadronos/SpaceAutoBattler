import { test, expect } from 'vitest';
import { getManagerConfig, setManagerConfig } from '../src/gamemanager.js';

test('setManagerConfig merges explosion keys without overwriting others', () => {
  // capture defaults
  const before = getManagerConfig();
  // copy defaults to avoid referencing the live config object which will be mutated
  const def = Object.assign({}, before.explosion);
  expect(def).toBeTruthy();
  // apply a partial update: only change particleCount and minSpeed
  setManagerConfig({ explosion: { particleCount: def.particleCount + 5, minSpeed: def.minSpeed + 10 } });
  const after = getManagerConfig();
  expect(after.explosion).toBeTruthy();
  // changed keys updated
  expect(after.explosion.particleCount).toBe(def.particleCount + 5);
  expect(after.explosion.minSpeed).toBe(def.minSpeed + 10);
  // unchanged keys remain as before
  expect(after.explosion.particleTTL).toBe(def.particleTTL);
  expect(after.explosion.particleColor).toBe(def.particleColor);
  expect(after.explosion.maxSpeed).toBe(def.maxSpeed);
});
