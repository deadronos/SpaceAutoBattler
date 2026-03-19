import { describe, it, expect } from 'vite-plus/test';
import {
  normalizeLayerIndex,
  allocateLayer,
  createAllocatorState,
  computeLayerMask,
  isValidLayer,
} from '../../../../src/renderer/bloom/layerAllocator.js';
import { LAYER_START } from '../../../../src/renderer/bloom/constants.js';

describe('layerAllocator', () => {
  describe('normalizeLayerIndex', () => {
    it('returns the value when it is a valid integer in range', () => {
      expect(normalizeLayerIndex(15)).toBe(15);
      expect(normalizeLayerIndex(0)).toBe(0);
      expect(normalizeLayerIndex(31)).toBe(31);
    });

    it('floors decimal values', () => {
      expect(normalizeLayerIndex(15.7)).toBe(15);
      expect(normalizeLayerIndex(15.1)).toBe(15);
    });

    it('clamps values below minimum to 0', () => {
      expect(normalizeLayerIndex(-1)).toBe(0);
      expect(normalizeLayerIndex(-100)).toBe(0);
    });

    it('clamps values above maximum to 31', () => {
      expect(normalizeLayerIndex(32)).toBe(31);
      expect(normalizeLayerIndex(100)).toBe(31);
    });

    it('returns fallback for NaN', () => {
      expect(normalizeLayerIndex(NaN, 11)).toBe(11);
    });

    it('returns fallback for Infinity', () => {
      expect(normalizeLayerIndex(Infinity, 11)).toBe(11);
      expect(normalizeLayerIndex(-Infinity, 11)).toBe(11);
    });

    it('returns fallback for non-numeric strings', () => {
      expect(normalizeLayerIndex('hello', 11)).toBe(11);
    });

    it('parses numeric strings', () => {
      expect(normalizeLayerIndex('15')).toBe(15);
      expect(normalizeLayerIndex('15.7')).toBe(15);
    });

    it('coerces null and undefined to 0', () => {
      // Number(null) = 0, Number(undefined) = NaN
      expect(normalizeLayerIndex(null)).toBe(0);
      expect(normalizeLayerIndex(undefined, 11)).toBe(11); // NaN uses fallback
    });

    it('clamps the fallback itself if out of range', () => {
      expect(normalizeLayerIndex(NaN, 50)).toBe(31);
      expect(normalizeLayerIndex(NaN, -5)).toBe(0);
    });

    it('uses LAYER_START as default fallback', () => {
      expect(normalizeLayerIndex(NaN)).toBe(LAYER_START);
    });
  });

  describe('allocateLayer', () => {
    it('allocates the next available layer for a new group', () => {
      const state = createAllocatorState(11);
      const layer = allocateLayer(state, 'groupA');
      expect(layer).toBe(11);
      expect(state.allocatedLayers.get('groupA')).toBe(11);
    });

    it('returns the same layer for an already allocated group', () => {
      const state = createAllocatorState(11);
      const layer1 = allocateLayer(state, 'groupA');
      const layer2 = allocateLayer(state, 'groupA');
      expect(layer1).toBe(layer2);
      expect(state.nextLayer).toBe(12); // Only advanced once
    });

    it('advances nextLayer after allocation', () => {
      const state = createAllocatorState(11);
      allocateLayer(state, 'groupA');
      expect(state.nextLayer).toBe(12);
      allocateLayer(state, 'groupB');
      expect(state.nextLayer).toBe(13);
    });

    it('does not exceed LAYER_MAX when advancing', () => {
      const state = createAllocatorState(31);
      allocateLayer(state, 'groupA');
      expect(state.nextLayer).toBe(31); // Stays at max
      allocateLayer(state, 'groupB');
      expect(state.allocatedLayers.get('groupB')).toBe(31);
    });

    it('handles multiple groups correctly', () => {
      const state = createAllocatorState(11);
      expect(allocateLayer(state, 'a')).toBe(11);
      expect(allocateLayer(state, 'b')).toBe(12);
      expect(allocateLayer(state, 'c')).toBe(13);
      expect(allocateLayer(state, 'a')).toBe(11); // Returns cached
    });
  });

  describe('createAllocatorState', () => {
    it('creates state with default start layer', () => {
      const state = createAllocatorState();
      expect(state.nextLayer).toBe(LAYER_START);
      expect(state.allocatedLayers.size).toBe(0);
    });

    it('creates state with custom start layer', () => {
      const state = createAllocatorState(5);
      expect(state.nextLayer).toBe(5);
    });

    it('normalizes invalid start layer', () => {
      const state = createAllocatorState(50);
      expect(state.nextLayer).toBe(31);
    });
  });

  describe('computeLayerMask', () => {
    it('returns 0 for empty selections', () => {
      const selections = new Map();
      expect(computeLayerMask(selections)).toBe(0);
    });

    it('computes mask for single selection', () => {
      const selections = new Map();
      selections.set('a', { layer: 11 });
      expect(computeLayerMask(selections)).toBe(1 << 11);
    });

    it('computes union mask for multiple selections', () => {
      const selections = new Map();
      selections.set('a', { layer: 11 });
      selections.set('b', { layer: 12 });
      selections.set('c', { layer: 15 });
      const expected = (1 << 11) | (1 << 12) | (1 << 15);
      expect(computeLayerMask(selections)).toBe(expected);
    });

    it('ignores selections with invalid layer values', () => {
      const selections = new Map();
      selections.set('valid', { layer: 11 });
      selections.set('nan', { layer: NaN });
      selections.set('negative', { layer: -1 });
      selections.set('tooHigh', { layer: 32 });
      selections.set('nonNumber', { layer: 'hello' });
      expect(computeLayerMask(selections)).toBe(1 << 11);
    });

    it('handles layer 0 correctly', () => {
      const selections = new Map();
      selections.set('zero', { layer: 0 });
      expect(computeLayerMask(selections)).toBe(1);
    });

    it('handles layer 31 correctly', () => {
      const selections = new Map();
      selections.set('max', { layer: 31 });
      expect(computeLayerMask(selections)).toBe(1 << 31);
    });
  });

  describe('isValidLayer', () => {
    it('returns true for valid layer indices', () => {
      expect(isValidLayer(0)).toBe(true);
      expect(isValidLayer(15)).toBe(true);
      expect(isValidLayer(31)).toBe(true);
    });

    it('returns false for decimal numbers', () => {
      expect(isValidLayer(15.5)).toBe(false);
    });

    it('returns false for out-of-range integers', () => {
      expect(isValidLayer(-1)).toBe(false);
      expect(isValidLayer(32)).toBe(false);
    });

    it('returns false for non-numbers', () => {
      expect(isValidLayer('15')).toBe(false);
      expect(isValidLayer(null)).toBe(false);
      expect(isValidLayer(undefined)).toBe(false);
      expect(isValidLayer({})).toBe(false);
    });

    it('returns false for NaN and Infinity', () => {
      expect(isValidLayer(NaN)).toBe(false);
      expect(isValidLayer(Infinity)).toBe(false);
    });
  });
});
