import { describe, it, expect } from 'vitest';
import { loadGLTF } from '../../src/core/assetLoader.js';

describe('assetLoader', () => {
  it('returns cached asset when present in assetPool', async () => {
    const state: any = { assetPool: new Map<string, any>() };
    const url = '/fake/model.gltf';
    const fake = { scene: { name: 'mock' } };
    state.assetPool.set(url, fake);
    const res = await loadGLTF(state, url);
    expect(res.data).toBe(fake);
    expect(res.url).toBe(url);
  });
});
