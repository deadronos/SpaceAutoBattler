import { describe, it, expect } from 'vitest';

import * as gameConfig from '../../../src/config/gameConfig';

describe('gameConfig', () => {
  it('is importable and has expected keys', () => {
    expect(typeof gameConfig).toBe('object');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(typeof (gameConfig as any).DefaultGameConfig).toBe('object');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((gameConfig as any).DefaultGameConfig.ui).toBeDefined();
  });
});
