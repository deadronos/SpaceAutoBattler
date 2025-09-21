/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import type { Archetype } from 'miniplex';
import type { GameEntity } from '../types/index.js';

// Accept a nullable archetype so callers can use this hook unconditionally
// (avoids violating React's rules of hooks). When `archetype` is null the hook
// returns an empty array and does not subscribe to events.
export function useArchetypeEntities<T extends GameEntity>(
  archetype: Archetype<GameEntity, any> | null,
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
    archetype.onEntityAdded.add(handleChange);
    archetype.onEntityRemoved.add(handleChange);

    return () => {
      archetype.onEntityAdded.remove(handleChange);
      archetype.onEntityRemoved.remove(handleChange);
    };
  }, [archetype]);

  return entities;
}
