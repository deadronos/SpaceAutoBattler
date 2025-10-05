import { describe, it, expect } from 'vitest';
import { TextureAtlasBuilder } from '../../src/renderer/textureAtlas.js';

describe('TextureAtlasBuilder', () => {
  it('packs regions using shelf packing and exposes UV transforms', () => {
    const builder = new TextureAtlasBuilder(64, 64, 2);
    const regionA = builder.add('a', 16, 16);
    const regionB = builder.add('b', 24, 12);
    const regionC = builder.add('c', 32, 20);

    expect(regionA.x).toBe(0);
    expect(regionB.x).toBeGreaterThan(regionA.x);
    expect(regionC.y).toBeGreaterThanOrEqual(regionA.y);

    const atlas = builder.build();
    expect(atlas.width).toBe(64);
    expect(atlas.height).toBe(64);

    const transform = atlas.getUVTransform('b');
    expect(transform.scale[0]).toBeCloseTo(regionB.width / 64, 5);
    expect(transform.offset[0]).toBeCloseTo(regionB.x / 64, 5);
  });

  it('throws when adding duplicate keys or overflowing space', () => {
    const builder = new TextureAtlasBuilder(16, 16, 0);
    builder.add('tile', 8, 8);
    expect(() => builder.add('tile', 4, 4)).toThrow(/already contains key/);
    expect(() => builder.add('big', 32, 8)).toThrow(/Region size exceeds atlas dimensions/);
  });

  it('throws when atlas runs out of vertical space', () => {
    const builder = new TextureAtlasBuilder(16, 16, 0);
    builder.add('a', 16, 8);
    builder.add('b', 16, 8);
    expect(() => builder.add('c', 16, 2)).toThrow(/ran out of vertical space/);
  });
});
