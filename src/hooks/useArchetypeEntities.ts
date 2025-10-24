/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import type { Archetype } from '../types/index.js';
import type { GameEntity } from '../types/index.js';

// Accept a nullable archetype so callers can use this hook unconditionally
// (avoids violating React's rules of hooks). When `archetype` is null the hook
// returns an empty array and does not subscribe to events.
export function useArchetypeEntities<T extends GameEntity>(
  archetype: Archetype<GameEntity> | null,
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

    const handleChange = () => {
      setEntities([...archetype.entities] as T[]);
    };

    // Initialize and subscribe to entity changes
    handleChange();

    // Support both legacy/mock API (onEntityAdded.add/remove) and the newer
    // miniplex v2 API (onEntityAdded.subscribe which may return an
    // unsubscribe function, or a subscription object with `unsubscribe`).
    let cleanupAdded: (() => void) | null = null;
    let cleanupRemoved: (() => void) | null = null;

    const tryRegister = (eventObj: any, cb: () => void): (() => void) | null => {
      if (!eventObj) return null;

      // Legacy add/remove pair
      if (typeof eventObj.add === 'function') {
        eventObj.add(cb);
        return () => {
          if (typeof eventObj.remove === 'function') eventObj.remove(cb);
        };
      }

      // Newer subscribe style. Subscribe may return an unsubscribe fn or an
      // object with an `unsubscribe` method. It may also return nothing, in
      // which case try to call eventObj.unsubscribe(cb) on cleanup.
      if (typeof eventObj.subscribe === 'function') {
        const ret = eventObj.subscribe(cb);
        if (typeof ret === 'function') return ret as () => void;
        if (ret && typeof (ret as any).unsubscribe === 'function') {
          return () => (ret as any).unsubscribe();
        }
        if (typeof eventObj.unsubscribe === 'function') {
          return () => eventObj.unsubscribe(cb);
        }

        // No reliable cleanup returned; best-effort no-op
        return null;
      }

      return null;
    };

    cleanupAdded = tryRegister(archetype.onEntityAdded as any, handleChange);
    cleanupRemoved = tryRegister(archetype.onEntityRemoved as any, handleChange);

    return () => {
      if (cleanupAdded) cleanupAdded();
      else if (archetype && typeof (archetype.onEntityAdded as any).remove === 'function') {
        // Fallback to legacy removal if present but we didn't record cleanup
        (archetype.onEntityAdded as any).remove(handleChange);
      }

      if (cleanupRemoved) cleanupRemoved();
      else if (archetype && typeof (archetype.onEntityRemoved as any).remove === 'function') {
        (archetype.onEntityRemoved as any).remove(handleChange);
      }
    };
  }, [archetype]);

  return entities;
}
