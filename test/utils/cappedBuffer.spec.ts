import { describe, expect, it } from 'vitest';
import { appendCappedImmutable, appendCappedMutable } from '../../src/utils/cappedBuffer.js';

describe('appendCappedMutable', () => {
  it('appends entries while preserving only the newest items up to the cap', () => {
    const buffer = [1, 2];
    const result = appendCappedMutable(buffer, 3, 3);

    expect(result).toBe(buffer);
    expect(buffer).toEqual([1, 2, 3]);

    appendCappedMutable(buffer, 4, 3);

    expect(buffer).toEqual([2, 3, 4]);
  });

  it('drops all items when cap is zero or negative', () => {
    const buffer = [1, 2, 3];
    const result = appendCappedMutable(buffer, 4, 0);

    expect(result).toBe(buffer);
    expect(buffer).toEqual([]);
  });

  it('normalises non-integer caps before trimming', () => {
    const buffer = [1, 2];
    appendCappedMutable(buffer, 3, 2.2);

    expect(buffer).toEqual([2, 3]);
  });

  it('throws when the buffer is not an array', () => {
    expect(() => appendCappedMutable(null as unknown as number[], 1, 2)).toThrow(TypeError);
  });
});

describe('appendCappedImmutable', () => {
  it('returns a new array reference while applying capped semantics', () => {
    const original = [1, 2];
    const next = appendCappedImmutable(original, 3, 2);

    expect(next).not.toBe(original);
    expect(next).toEqual([2, 3]);
    expect(original).toEqual([1, 2]);
  });

  it('treats undefined buffers as empty arrays', () => {
    const next = appendCappedImmutable<number>(undefined, 5, 2);

    expect(next).toEqual([5]);
  });

  it('returns an empty array when cap is zero', () => {
    const next = appendCappedImmutable([1, 2], 3, 0);

    expect(next).toEqual([]);
  });
});
