import { describe, it, expect, beforeEach } from 'vite-plus/test';
import { Selection } from 'postprocessing';
import { Object3D, Mesh, BoxGeometry, MeshBasicMaterial } from 'three';
import {
  createSelection,
  addObjectToSelection,
  removeObjectFromSelection,
  ensureSelectionForGroup,
  getSelectionLayer,
  selectionHasObject,
  clearSelection,
} from '../../../../src/renderer/bloom/selectionManager.js';
import { createAllocatorState } from '../../../../src/renderer/bloom/layerAllocator.js';

describe('selectionManager', () => {
  describe('createSelection', () => {
    it('creates a selection with the specified layer', () => {
      const selection = createSelection(15);
      expect(selection).toBeInstanceOf(Selection);
      expect(selection.layer).toBe(15);
    });

    it('creates a non-exclusive selection by default', () => {
      const selection = createSelection(11);
      expect(selection.exclusive).toBe(false);
    });

    it('creates an exclusive selection when specified', () => {
      const selection = createSelection(11, true);
      expect(selection.exclusive).toBe(true);
    });

    it('creates a non-exclusive selection when explicitly false', () => {
      const selection = createSelection(11, false);
      expect(selection.exclusive).toBe(false);
    });
  });

  describe('addObjectToSelection', () => {
    let selection: Selection;
    let mesh: Mesh;

    beforeEach(() => {
      selection = createSelection(11);
      mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
    });

    it('adds an object to the selection', () => {
      const result = addObjectToSelection(selection, mesh);
      expect(result).toBe(true);
      expect(selection.has(mesh)).toBe(true);
    });

    it('returns false when object is already in selection', () => {
      addObjectToSelection(selection, mesh);
      const result = addObjectToSelection(selection, mesh);
      expect(result).toBe(false);
    });

    it('can add multiple different objects', () => {
      const mesh2 = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
      addObjectToSelection(selection, mesh);
      addObjectToSelection(selection, mesh2);
      expect(selection.has(mesh)).toBe(true);
      expect(selection.has(mesh2)).toBe(true);
    });

    it('handles Object3D (not just Mesh)', () => {
      const obj = new Object3D();
      const result = addObjectToSelection(selection, obj);
      expect(result).toBe(true);
      expect(selection.has(obj)).toBe(true);
    });
  });

  describe('removeObjectFromSelection', () => {
    let selection: Selection;
    let mesh: Mesh;

    beforeEach(() => {
      selection = createSelection(11);
      mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
    });

    it('removes an object from the selection', () => {
      addObjectToSelection(selection, mesh);
      const result = removeObjectFromSelection(selection, mesh);
      expect(result).toBe(true);
      expect(selection.has(mesh)).toBe(false);
    });

    it('returns false when object is not in selection', () => {
      const result = removeObjectFromSelection(selection, mesh);
      expect(result).toBe(false);
    });

    it('only removes the specified object', () => {
      const mesh2 = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
      addObjectToSelection(selection, mesh);
      addObjectToSelection(selection, mesh2);
      removeObjectFromSelection(selection, mesh);
      expect(selection.has(mesh)).toBe(false);
      expect(selection.has(mesh2)).toBe(true);
    });
  });

  describe('ensureSelectionForGroup', () => {
    let selections: Map<string, Selection>;

    beforeEach(() => {
      selections = new Map();
    });

    it('creates a new selection for a new group', () => {
      const allocator = createAllocatorState(11);
      const selection = ensureSelectionForGroup(selections, 'groupA', allocator);
      expect(selection).toBeInstanceOf(Selection);
      expect(selections.has('groupA')).toBe(true);
    });

    it('returns existing selection for known group', () => {
      const allocator = createAllocatorState(11);
      const selection1 = ensureSelectionForGroup(selections, 'groupA', allocator);
      const selection2 = ensureSelectionForGroup(selections, 'groupA', allocator);
      expect(selection1).toBe(selection2);
    });

    it('allocates different layers for different groups', () => {
      const allocator = createAllocatorState(11);
      const selA = ensureSelectionForGroup(selections, 'a', allocator);
      const selB = ensureSelectionForGroup(selections, 'b', allocator);
      expect(selA.layer).toBe(11);
      expect(selB.layer).toBe(12);
    });

    it('creates non-exclusive selections', () => {
      const allocator = createAllocatorState(11);
      const selection = ensureSelectionForGroup(selections, 'group', allocator);
      expect(selection.exclusive).toBe(false);
    });
  });

  describe('getSelectionLayer', () => {
    it('returns the layer from a selection', () => {
      const selection = createSelection(15);
      expect(getSelectionLayer(selection)).toBe(15);
    });

    it('returns undefined when layer is not a number', () => {
      const selection = createSelection(11);
      (selection as any).layer = 'invalid';
      expect(getSelectionLayer(selection)).toBeUndefined();
    });

    it('returns undefined when layer is NaN', () => {
      const selection = createSelection(11);
      (selection as any).layer = NaN;
      expect(getSelectionLayer(selection)).toBeUndefined();
    });
  });

  describe('selectionHasObject', () => {
    it('returns true when object is in selection', () => {
      const selection = createSelection(11);
      const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
      addObjectToSelection(selection, mesh);
      expect(selectionHasObject(selection, mesh)).toBe(true);
    });

    it('returns false when object is not in selection', () => {
      const selection = createSelection(11);
      const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
      expect(selectionHasObject(selection, mesh)).toBe(false);
    });
  });

  describe('clearSelection', () => {
    it('removes all objects from selection', () => {
      const selection = createSelection(11);
      const mesh1 = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
      const mesh2 = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
      addObjectToSelection(selection, mesh1);
      addObjectToSelection(selection, mesh2);
      clearSelection(selection);
      expect(selection.has(mesh1)).toBe(false);
      expect(selection.has(mesh2)).toBe(false);
    });
  });
});
