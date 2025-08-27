import { describe, it, expect } from 'vitest';
import { acquireTexture, releaseTexture } from '../../src/pools';
import { makeDeterministicState } from './utils/stateFixture';
describe('texture pool disposer and overflow', () => {
    it('calls disposer when overflow occurs with discard-oldest', () => {
        const state = makeDeterministicState();
        // make per-key pool size small
        state.assetPool.config.texturePoolSize = 1;
        state.assetPool.config.textureOverflowStrategy = 'discard-oldest';
        const created = [];
        const disposerCalled = [];
        const key = 'k1';
        // dummy texture objects
        function create() {
            const t = { id: Math.random() };
            created.push(t);
            return t;
        }
        function disposer(t) {
            disposerCalled.push(t);
        }
        const t1 = acquireTexture(state, key, create);
        // Acquire a second texture (allocate beyond configured max)
        const t2 = acquireTexture(state, key, create);
        // Now release both textures which should cause the pool free list to exceed
        // the max (1) and trigger disposer for the victim.
        releaseTexture(state, key, t1, disposer);
        releaseTexture(state, key, t2, disposer);
        // The disposer should have been called at least once for the victim
        expect(disposerCalled.length).toBeGreaterThanOrEqual(1);
    });
    it('grow strategy does not call disposer and allows more allocations', () => {
        const state = makeDeterministicState();
        state.assetPool.config.texturePoolSize = 1;
        state.assetPool.config.textureOverflowStrategy = 'grow';
        const created = [];
        const key = 'k2';
        function create() {
            const t = { id: Math.random() };
            created.push(t);
            return t;
        }
        function disposer(_t) {
            throw new Error('disposer should not be called in grow strategy');
        }
        const t1 = acquireTexture(state, key, create);
        const t2 = acquireTexture(state, key, create);
        // We should have allocated two distinct textures
        expect(created.length).toBeGreaterThanOrEqual(2);
        // cleanup
        releaseTexture(state, key, t1, disposer);
        releaseTexture(state, key, t2, disposer);
    });
});
