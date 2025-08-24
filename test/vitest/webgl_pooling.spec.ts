import { describe, it, expect } from 'vitest';
import { makeInitialState } from '../../src/entities';
import { acquireTexture, releaseTexture } from '../../src/entities';

// Minimal GL stub that counts create/delete calls
class GLMock {
  created: number = 0;
  deleted: number = 0;
  createTexture() {
    this.created++;
    return { id: this.created } as unknown as WebGLTexture;
  }
  deleteTexture(_t: WebGLTexture) {
    this.deleted++;
  }
}

describe('Texture pooling - per-key metadata and disposer', () => {
  it('discard-oldest should call disposer when trimming', () => {
    const state = makeInitialState();
    const gl = new GLMock();
    const key = 'test:key';
    // Acquire and release textures more than pool size to trigger trimming
    const createFn = () => gl.createTexture();
    // configure small pool
    state.assetPool.config.texturePoolSize = 2;

    const t1 = acquireTexture(state as any, key, createFn);
    const t2 = acquireTexture(state as any, key, createFn);
    const t3 = acquireTexture(state as any, key, createFn);
    // release all three with disposer passed to releaseTexture
    releaseTexture(state as any, key, t1, (t) => gl.deleteTexture(t));
    releaseTexture(state as any, key, t2, (t) => gl.deleteTexture(t));
    releaseTexture(state as any, key, t3, (t) => gl.deleteTexture(t));

    // Since pool size is 2 and strategy is discard-oldest (default), one delete should have occurred
    expect(gl.deleted).toBeGreaterThanOrEqual(1);
  });

  it('error strategy should throw on acquire when exhausted', () => {
    const state = makeInitialState();
    const gl = new GLMock();
    const key = 'err:key';
    state.assetPool.config.texturePoolSize = 1;
    state.assetPool.config.textureOverflowStrategy = 'error';
    const createFn = () => gl.createTexture();

    const t1 = acquireTexture(state as any, key, createFn);
    // second acquire should throw if strategy is 'error' and max=1
    let threw = false;
    try {
      const t2 = acquireTexture(state as any, key, createFn);
    } catch (e) { threw = true; }
    expect(threw).toBe(true);
  });

  it('grow strategy should allow growth beyond max', () => {
    const state = makeInitialState();
    const gl = new GLMock();
    const key = 'grow:key';
    state.assetPool.config.texturePoolSize = 1;
    state.assetPool.config.textureOverflowStrategy = 'grow';
    const createFn = () => gl.createTexture();

    const t1 = acquireTexture(state as any, key, createFn);
    const t2 = acquireTexture(state as any, key, createFn);
    // both should be created without throwing
    expect(t1).toBeTruthy();
    expect(t2).toBeTruthy();
  });
});
