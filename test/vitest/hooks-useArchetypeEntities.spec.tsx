import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
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

// Mock an archetype that follows the Miniplex pattern. `entities` is exposed
// through a getter so tests can count how many snapshot reads the hook makes.
class MockArchetype {
  _entities = [];
  entitiesReadCount = 0;
  onEntityAdded = new MockEvent();
  onEntityRemoved = new MockEvent();

  constructor(initialEntities = []) {
    this._entities = [...initialEntities];
  }

  get entities() {
    this.entitiesReadCount += 1;
    return this._entities;
  }

  set entities(next) {
    this._entities = next;
  }

  addEntity(entity) {
    this._entities.push(entity);
    this.onEntityAdded.emit();
  }

  removeEntity(entity) {
    const index = this._entities.indexOf(entity);
    if (index > -1) {
      this._entities.splice(index, 1);
      this.onEntityRemoved.emit();
    }
  }
}

describe('useArchetypeEntities', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

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
    vi.useFakeTimers();
    const archetype = new MockArchetype([]);

    const { result } = renderHook(() => useArchetypeEntities(archetype));

    expect(result.current).toEqual([]);

    const newEntity = { id: 1 };

    act(() => {
      // Simulate the archetype change by directly calling the listener
      archetype.entities.push(newEntity);
      archetype.onEntityAdded.emit();
    });

    // The snapshot is coalesced to the next frame.
    act(() => {
      vi.advanceTimersToNextFrame();
    });

    expect(result.current).toEqual([newEntity]);
  });

  it('updates when entities are removed from archetype', () => {
    vi.useFakeTimers();
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

    act(() => {
      vi.advanceTimersToNextFrame();
    });

    expect(result.current).toEqual([entity2]);
  });

  it('coalesces a burst of entity events into one snapshot per frame', () => {
    vi.useFakeTimers();
    const entity1 = { id: 1 };
    const entity2 = { id: 2 };
    const archetype = new MockArchetype([]);

    const { result } = renderHook(() => useArchetypeEntities(archetype));

    expect(result.current).toEqual([]);

    const readsAfterMount = archetype.entitiesReadCount;

    // 3+ synchronous events without a frame boundary.
    act(() => {
      archetype.addEntity(entity1);
      archetype.addEntity(entity2);
      archetype.removeEntity(entity1);
    });

    // No per-event copy: the entity list was not read at all during the burst.
    expect(archetype.entitiesReadCount).toBe(readsAfterMount);

    act(() => {
      vi.advanceTimersToNextFrame();
    });

    // Exactly one additional snapshot copy at the frame boundary.
    expect(archetype.entitiesReadCount).toBe(readsAfterMount + 1);
    expect(result.current).toEqual([entity2]);
  });

  it('handles cleanup when component unmounts', () => {
    const archetype = new MockArchetype([]);

    const { unmount } = renderHook(() => useArchetypeEntities(archetype));

    unmount();

    expect(archetype.onEntityAdded.unsubscribeCallbacks).toHaveLength(1);
    expect(archetype.onEntityRemoved.unsubscribeCallbacks).toHaveLength(1);
  });

  it('cancels a pending flush on unmount without updating state', () => {
    vi.useFakeTimers();
    const entity = { id: 1 };
    const archetype = new MockArchetype([]);

    const { unmount } = renderHook(() => useArchetypeEntities(archetype));

    const readsAfterMount = archetype.entitiesReadCount;

    act(() => {
      archetype.addEntity(entity);
    });

    unmount();

    expect(() => {
      act(() => {
        vi.advanceTimersToNextFrame();
      });
    }).not.toThrow();

    // The pending flush was cancelled: no snapshot copy after unmount.
    expect(archetype.entitiesReadCount).toBe(readsAfterMount);
  });
});
