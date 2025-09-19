import { describe, it, expect } from 'vitest';

import * as gameConfig from '../../../src/config/gameConfig.js';

describe('gameConfig', () => {
  it('is importable and has expected keys', () => {
    expect(typeof gameConfig).toBe('object');

    expect(typeof (gameConfig as any).DefaultGameConfig).toBe('object');

    expect((gameConfig as any).DefaultGameConfig.ui).toBeDefined();
  });
});
