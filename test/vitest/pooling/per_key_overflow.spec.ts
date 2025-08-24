import { acquireSprite, releaseSprite, acquireEffect, releaseEffect } from '../../../src/entities';

describe('pooling per-key overflow strategies (sprites)', () => {
  let state: any;
  beforeEach(() => { state = makeInitialState(); });

  it('discard-oldest trims oldest entries and calls disposer (sprites)', () => {
    const key = 'sprite-small';
    state.assetPool.config.spritePoolSize = 2;
    state.assetPool.config.spriteOverflowStrategy = 'discard-oldest';
    const s1 = acquireSprite(state, key, () => ({ id: 's1', alive: true }));
    const s2 = acquireSprite(state, key, () => ({ id: 's2', alive: true }));
    const s3 = acquireSprite(state, key, () => ({ id: 's3', alive: true }));
    releaseSprite(state, key, s1, (s: any) => { s.alive = false; });
    releaseSprite(state, key, s2, (s: any) => { s.alive = false; });
    releaseSprite(state, key, s3, (s: any) => { s.alive = false; });
    const entry = state.assetPool.sprites.get(key);
    expect(entry).toBeTruthy();
    expect(entry.freeList.length).toBe(2);
  });

  it('grow strategy allows exceeding max (sprites)', () => {
    const key = 'sprite-grow';
    state.assetPool.config.spritePoolSize = 1;
    state.assetPool.config.spriteOverflowStrategy = 'grow';
    const a = acquireSprite(state, key, () => ({ id: 'g1', alive: true }));
    const b = acquireSprite(state, key, () => ({ id: 'g2', alive: true }));
    releaseSprite(state, key, a, (s: any) => { s.alive = false; });
    releaseSprite(state, key, b, (s: any) => { s.alive = false; });
    const entry = state.assetPool.sprites.get(key);
    expect(entry).toBeTruthy();
    expect(entry.freeList.length).toBe(2);
  });

  it('error strategy throws when exceeding max (sprites)', () => {
    const key = 'sprite-error';
    state.assetPool.config.spritePoolSize = 1;
    state.assetPool.config.spriteOverflowStrategy = 'error';
    const s1 = acquireSprite(state, key, () => ({ id: 'e1', alive: true }));
    expect(() => acquireSprite(state, key, () => ({ id: 'e2', alive: true }))).toThrow();
    releaseSprite(state, key, s1, (s: any) => { s.alive = false; });
  });
});

describe('pooling per-key overflow strategies (effects)', () => {
  let state: any;
  beforeEach(() => { state = makeInitialState(); });

  it('discard-oldest trims oldest entries and calls disposer (effects)', () => {
    const key = 'effect-small';
    state.assetPool.config.effectPoolSize = 2;
    state.assetPool.config.effectOverflowStrategy = 'discard-oldest';
    const e1 = acquireEffect(state, key, () => ({ id: 'e1', alive: true }));
    const e2 = acquireEffect(state, key, () => ({ id: 'e2', alive: true }));
    const e3 = acquireEffect(state, key, () => ({ id: 'e3', alive: true }));
    releaseEffect(state, key, e1, (e: any) => { e.alive = false; });
    releaseEffect(state, key, e2, (e: any) => { e.alive = false; });
    releaseEffect(state, key, e3, (e: any) => { e.alive = false; });
    const entry = state.assetPool.effects.get(key);
    expect(entry).toBeTruthy();
    expect(entry.freeList.length).toBe(2);
  });

  it('grow strategy allows exceeding max (effects)', () => {
    const key = 'effect-grow';
    state.assetPool.config.effectPoolSize = 1;
    state.assetPool.config.effectOverflowStrategy = 'grow';
    const a = acquireEffect(state, key, () => ({ id: 'g1', alive: true }));
    const b = acquireEffect(state, key, () => ({ id: 'g2', alive: true }));
    releaseEffect(state, key, a, (e: any) => { e.alive = false; });
    releaseEffect(state, key, b, (e: any) => { e.alive = false; });
    const entry = state.assetPool.effects.get(key);
    expect(entry).toBeTruthy();
    expect(entry.freeList.length).toBe(2);
  });

  it('error strategy throws when exceeding max (effects)', () => {
    const key = 'effect-error';
    state.assetPool.config.effectPoolSize = 1;
    state.assetPool.config.effectOverflowStrategy = 'error';
    const e1 = acquireEffect(state, key, () => ({ id: 'e1', alive: true }));
    expect(() => acquireEffect(state, key, () => ({ id: 'e2', alive: true }))).toThrow();
    releaseEffect(state, key, e1, (e: any) => { e.alive = false; });
  });
});
import { describe, it, expect, beforeEach } from 'vitest';
import { makeInitialState, acquireTexture, releaseTexture } from '../../../src/entities';
import { makeGLStub } from '../utils/glStub';
import { expectPoolMaxFreeList } from '../utils/poolAssert';

describe('pooling per-key overflow strategies', () => {
  let gl: ReturnType<typeof makeGLStub>;

  beforeEach(() => {
    gl = makeGLStub();
  });

  it('discard-oldest trims oldest entries and calls disposer (textures)', () => {
    const state: any = makeInitialState();
    const key = 'explosion-small';
    // per-key config: max 2, discard-oldest
    state.assetPool.textures.set(key, { freeList: [], allocated: 0, config: { max: 2, strategy: 'discard-oldest' } });

    const t1 = acquireTexture(state, key, () => gl.createTexture());
    const t2 = acquireTexture(state, key, () => gl.createTexture());
    const t3 = acquireTexture(state, key, () => gl.createTexture());

    // release all with disposeFn so releaseTexture can call it when trimming
    releaseTexture(state, key, t1, (t: any) => gl.deleteTexture(t));
    releaseTexture(state, key, t2, (t: any) => gl.deleteTexture(t));
    releaseTexture(state, key, t3, (t: any) => gl.deleteTexture(t));

    const entry = state.assetPool.textures.get(key);
    expect(entry).toBeTruthy();
    expect(entry.freeList.length).toBe(2);
    // one texture should have been deleted from GL
    expect(gl.getCreatedCount()).toBe(2);
  });

  it('grow strategy allows exceeding max (textures)', () => {
    const state: any = makeInitialState();
    const key = 'grow-key';
    state.assetPool.textures.set(key, { freeList: [], allocated: 0, config: { max: 1, strategy: 'grow' } });

    const a = acquireTexture(state, key, () => gl.createTexture());
    const b = acquireTexture(state, key, () => gl.createTexture());
    releaseTexture(state, key, a, (t: any) => gl.deleteTexture(t));
    releaseTexture(state, key, b, (t: any) => gl.deleteTexture(t));

    const entry = state.assetPool.textures.get(key);
    expect(entry).toBeTruthy();
    // freeList can exceed per-key max when strategy=grow
    expect(entry.freeList.length).toBe(2);
  });

  it('error strategy throws when exceeding max (textures)', () => {
    const state: any = makeInitialState();
    const key = 'err-key';
    state.assetPool.textures.set(key, { freeList: [], allocated: 0, config: { max: 1, strategy: 'error' } });

    const t1 = acquireTexture(state, key, () => gl.createTexture());
    expect(() => acquireTexture(state, key, () => gl.createTexture())).toThrow();
    // cleanup
    releaseTexture(state, key, t1, (t: any) => gl.deleteTexture(t));
  });
});
