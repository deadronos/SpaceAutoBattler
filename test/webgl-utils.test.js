import { splitVertexRanges } from '../src/webglUtils.js';

describe('splitVertexRanges', () => {
  test('below limit', () => {
    const ranges = splitVertexRanges(1000, 65535);
    expect(ranges).toHaveLength(1);
    expect(ranges[0]).toEqual({ start: 0, count: 1000 });
  });

  test('equal to limit', () => {
    const ranges = splitVertexRanges(65535, 65535);
    expect(ranges).toHaveLength(1);
    expect(ranges[0]).toEqual({ start: 0, count: 65535 });
  });

  test('just over limit', () => {
    const ranges = splitVertexRanges(65536, 65535);
    expect(ranges).toHaveLength(2);
    expect(ranges[0]).toEqual({ start: 0, count: 65535 });
    expect(ranges[1]).toEqual({ start: 65535, count: 1 });
  });

  test('multiple chunks', () => {
    const total = 200000;
    const ranges = splitVertexRanges(total, 65535);
    const sum = ranges.reduce((s, r) => s + r.count, 0);
    expect(sum).toBe(total);
    for (const r of ranges) {
      expect(r.count).toBeLessThanOrEqual(65535);
    }
  });
});
