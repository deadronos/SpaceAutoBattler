import { describe, expect, it } from 'vite-plus/test';
import { parseBooleanFlag } from '../../src/utils/booleanFlag.js';

describe('parseBooleanFlag', () => {
  it('accepts truthy flag values case-insensitively', () => {
    for (const raw of ['1', 'true', 'TRUE', 'True', 'on', 'ON', 'On']) {
      expect(parseBooleanFlag(raw)).toBe(true);
    }
  });

  it('rejects falsy or unrecognized flag values', () => {
    for (const raw of ['', '0', 'false', 'off', 'no', 'yes', ' true ', '2']) {
      expect(parseBooleanFlag(raw)).toBe(false);
    }
  });
});
