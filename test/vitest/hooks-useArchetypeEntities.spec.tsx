import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useArchetypeEntities } from '../../src/hooks/useArchetypeEntities.js';

class MockEvent {
  listeners = new Set();
  unsubscribeCallbacks = [];

  subscribe = vi.fn((listener) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
      this.unsubscribeCallbacks.push(listener);
    };
  });

  emit() {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

// Mock an archetype that follows the Miniplex pattern
class MockArchetype {
  entities = [];
  onEntityAdded = new MockEvent();
  onEntityRemoved = new MockEvent();

  constructor(initialEntities = []) {
    this.entities = [...initialEntities];
  }

  addEntity(entity) {
    this.entities.push(entity);
    this.onEntityAdded.emit();
  }

  removeEntity(entity) {
    const index = this.entities.indexOf(entity);
    if (index > -1) {
      this.entities.splice(index, 1);
      this.onEntityRemoved.emit();
    }
  }
}

describe('useArchetypeEntities', () => {
  it('returns empty array when archetype is null', () => {
    const { result } = renderHook(() => useArchetypeEntities(null));

    expect(result.current).toEqual([]);
  });

  it('returns initial entities from archetype', () => {
    const entity1 = { id: 1 };
    const entity2 = { id: 2 };
    const archetype = new MockArchetype([entity1, entity2]);

    const { result } = renderHook(() => useArchetypeEntities(archetype));

    expect(result.current).toEqual([entity1, entity2]);
  });

  it('subscribes to archetype entity changes', () => {
    const archetype = new MockArchetype([]);

    renderHook(() => useArchetypeEntities(archetype));

    expect(archetype.onEntityAdded.subscribe).toHaveBeenCalledWith(expect.any(Function));
    expect(archetype.onEntityRemoved.subscribe).toHaveBeenCalledWith(expect.any(Function));
  });

  it('updates entities when archetype changes', () => {
    const entity1 = { id: 1 };
    const entity2 = { id: 2 };
    const archetype1 = new MockArchetype([entity1]);
    const archetype2 = new MockArchetype([entity2]);

    const { result, rerender } = renderHook(({ archetype }) => useArchetypeEntities(archetype), {
      initialProps: { archetype: archetype1 },
    });

    expect(result.current).toEqual([entity1]);

    // Change archetype
    rerender({ archetype: archetype2 });

    expect(result.current).toEqual([entity2]);
  });

  it('clears entities when archetype becomes null', () => {
    const entity1 = { id: 1 };
    const archetype = new MockArchetype([entity1]);

    const { result, rerender } = renderHook(({ archetype }) => useArchetypeEntities(archetype), {
      initialProps: { archetype },
    });

    expect(result.current).toEqual([entity1]);

    // Set archetype to null
    rerender({ archetype: null });

    expect(result.current).toEqual([]);
  });

  it('unsubscribes from old archetype when changing', () => {
    const archetype1 = new MockArchetype([]);
    const archetype2 = new MockArchetype([]);

    const { rerender } = renderHook(({ archetype }) => useArchetypeEntities(archetype), {
      initialProps: { archetype: archetype1 },
    });

    // Change archetype
    rerender({ archetype: archetype2 });

    expect(archetype1.onEntityAdded.unsubscribeCallbacks).toHaveLength(1);
    expect(archetype1.onEntityRemoved.unsubscribeCallbacks).toHaveLength(1);
  });

  it('updates when entities are added to archetype', () => {
    const archetype = new MockArchetype([]);

    const { result } = renderHook(() => useArchetypeEntities(archetype));

    expect(result.current).toEqual([]);

    const newEntity = { id: 1 };

    act(() => {
      // Simulate the archetype change by directly calling the listener
      archetype.entities.push(newEntity);
      archetype.onEntityAdded.emit();
    });

    expect(result.current).toEqual([newEntity]);
  });

  it('updates when entities are removed from archetype', () => {
    const entity1 = { id: 1 };
    const entity2 = { id: 2 };
    const archetype = new MockArchetype([entity1, entity2]);

    const { result } = renderHook(() => useArchetypeEntities(archetype));

    expect(result.current).toEqual([entity1, entity2]);

    act(() => {
      // Simulate the archetype change by directly calling the listener
      archetype.entities.splice(0, 1); // Remove first entity
      archetype.onEntityRemoved.emit();
    });

    expect(result.current).toEqual([entity2]);
  });

  it('handles cleanup when component unmounts', () => {
    const archetype = new MockArchetype([]);

    const { unmount } = renderHook(() => useArchetypeEntities(archetype));

    unmount();

    expect(archetype.onEntityAdded.unsubscribeCallbacks).toHaveLength(1);
    expect(archetype.onEntityRemoved.unsubscribeCallbacks).toHaveLength(1);
  });
});
