import { describe, it, expect } from 'vitest';
import { acquireSprite, releaseSprite } from '../../src/pools';
// Minimal fake GameState
const makeMinimalState = () => ({
    // no assetPool provided
    ships: [],
    bullets: [],
});
describe('assetPool defaults', () => {
    it('creates assetPool when acquireSprite called on minimal state', () => {
        const state = makeMinimalState();
        const sprite = acquireSprite(state, 'test', () => ({ x: 1, y: 2 }));
        expect(state.assetPool).toBeDefined();
        expect(state.assetPool.sprites).toBeDefined();
        // release and ensure freeList has the object
        releaseSprite(state, 'test', sprite);
        const entry = state.assetPool.sprites.get('test');
        expect(entry).toBeDefined();
        expect(entry.freeList.length).toBeGreaterThanOrEqual(1);
    });
});
