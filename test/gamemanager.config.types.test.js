import { test, expect } from 'vitest';
import { getManagerConfig, setManagerConfig } from '../src/gamemanager.js';

test('setManagerConfig ignores invalid types for explosion', () => {
  const def = Object.assign({}, getManagerConfig().explosion);
  // Try to set invalid types
  setManagerConfig({ explosion: {
    particleCount: 'not-a-number',
    particleTTL: null,
    particleColor: 123,
    particleSize: {},
    minSpeed: undefined,
    maxSpeed: []
  }});
  const after = getManagerConfig().explosion;
  // All fields should remain unchanged
  expect(after.particleCount).toBe(def.particleCount);
  expect(after.particleTTL).toBe(def.particleTTL);
  expect(after.particleColor).toBe(def.particleColor);
  expect(after.particleSize).toBe(def.particleSize);
  expect(after.minSpeed).toBe(def.minSpeed);
  expect(after.maxSpeed).toBe(def.maxSpeed);
});

test('setManagerConfig accepts valid types for explosion', () => {
  setManagerConfig({ explosion: {
    particleCount: 99,
    particleTTL: 1.5,
    particleColor: 'rgba(1,2,3,0.5)',
    particleSize: 7,
    minSpeed: 5,
    maxSpeed: 500
  }});
  const after = getManagerConfig().explosion;
  expect(after.particleCount).toBe(99);
  expect(after.particleTTL).toBe(1.5);
  expect(after.particleColor).toBe('rgba(1,2,3,0.5)');
  expect(after.particleSize).toBe(7);
  expect(after.minSpeed).toBe(5);
  expect(after.maxSpeed).toBe(500);
});