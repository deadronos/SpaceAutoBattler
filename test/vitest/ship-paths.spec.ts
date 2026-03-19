import { describe, it, expect } from 'vite-plus/test';
import { resolveModelPath } from '../../src/components/Ship.js';
import { SHIP_MODEL_PATHS } from '../../src/assets/ships.js';
import React from 'react';
import { ShipObject } from '../../src/components/Ship.js';

describe('Ship model path resolution', () => {
  it('falls back to fighter when model is undefined', () => {
    const path = resolveModelPath(undefined as unknown as string);
    expect(path).toBe(SHIP_MODEL_PATHS.fighter);
  });

  it('returns the explicit path when model key exists', () => {
    const path = resolveModelPath('corvette');
    expect(path).toBe(SHIP_MODEL_PATHS.corvette);
  });

  it('does not throw when creating element with undefined model', () => {
    const entity = { id: 1, model: undefined } as any;
    expect(() => React.createElement(ShipObject, { entity })).not.toThrow();
  });
});
