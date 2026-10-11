import { useEffect, useState } from 'react';
import type { GameEntity } from '../types/index.js';

interface ArchetypeSubscription {
  subscribe: (listener: () => void) => () => void;
}

interface ArchetypeLike<T> {
  entities: readonly T[];
  onEntityAdded: ArchetypeSubscription;
  onEntityRemoved: ArchetypeSubscription;
}

// Schedule a callback for the next animation frame, returning a cancel handle.
// Falls back to a macrotask (`setTimeout`) when `requestAnimationFrame` is
// unavailable (e.g. non-DOM environments) so updates still coalesce off the
// event stack.
function scheduleFrame(callback: () => void): () => void {
  if (typeof requestAnimationFrame === 'function') {
    const id = requestAnimationFrame(callback);
    return () => cancelAnimationFrame(id);
  }
  const id = setTimeout(callback, 0);
  return () => clearTimeout(id);
}

// Accept a nullable archetype so callers can use this hook unconditionally
// (avoids violating React's rules of hooks). When `archetype` is null the hook
// returns an empty array and does not subscribe to events.
export function useArchetypeEntities<T extends GameEntity>(
  archetype: ArchetypeLike<T> | null,
): T[] {
  const [entities, setEntities] = useState<T[]>(() =>
    archetype ? (archetype.entities as T[]) : [],
  );

  useEffect(() => {
    if (!archetype) {
      // If archetype becomes null, ensure we clear the list.
      setEntities([]);
      return;
    }

    let scheduled = false;
    let cancelScheduled: (() => void) | null = null;

    const flush = () => {
      scheduled = false;
      cancelScheduled = null;
      setEntities(Array.from(archetype.entities) as T[]);
    };

    // Initialize synchronously on mount / archetype change so the initial
    // value and archetype swaps stay synchronous.
    flush();

    // Coalesce a burst of add/remove events into a single snapshot copy at the
    // next frame; events that arrive before the flush are dropped.
    const scheduleUpdate = () => {
      if (scheduled) return;
      scheduled = true;
      cancelScheduled = scheduleFrame(flush);
    };

    const unsubscribeAdded = archetype.onEntityAdded.subscribe(scheduleUpdate);
    const unsubscribeRemoved = archetype.onEntityRemoved.subscribe(scheduleUpdate);

    return () => {
      unsubscribeAdded();
      unsubscribeRemoved();
      // Cancel any pending flush so no setState fires after unmount.
      cancelScheduled?.();
      scheduled = false;
    };
  }, [archetype]);

  return entities;
}
