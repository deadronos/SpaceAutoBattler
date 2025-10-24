import { describe, expect, it } from 'vitest';
import {
  computeAtlasUvTransform,
  normaliseAtlasMetadata,
} from '../../src/renderer/textureAtlas.js';

describe('textureAtlas utilities', () => {
  it('computes UV transform for a region', () => {
    const atlas = {
      width: 512,
      height: 256,
      regions: {
        'foo.png': { x: 128, y: 64, width: 128, height: 64 },
      },
    } as const;

    const transform = computeAtlasUvTransform(atlas, 'foo.png');
    expect(transform.offset).toEqual([0.25, 0.25]);
    expect(transform.scale).toEqual([0.25, 0.25]);
  });

  it('throws for missing region', () => {
    const atlas = { width: 10, height: 10, regions: {} };
    expect(() => computeAtlasUvTransform(atlas, 'missing')).toThrow();
  });

  it('normalises metadata and rejects invalid dimensions', () => {
    const atlas = { width: 10, height: 10, regions: { a: { x: 0, y: 0, width: 5, height: 5 } } };
    const normalised = normaliseAtlasMetadata(atlas);
    expect(normalised.width).toBe(10);
    expect(Object.keys(normalised.regions)).toEqual(['a']);
    expect(() => normaliseAtlasMetadata({ width: NaN, height: 10, regions: {} } as any)).toThrow();
  });
});
