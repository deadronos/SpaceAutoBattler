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

    const updateEntities = () => {
      setEntities(Array.from(archetype.entities) as T[]);
    };

    // Initialize and subscribe to entity changes
    updateEntities();

    const unsubscribeAdded = archetype.onEntityAdded.subscribe(updateEntities);
    const unsubscribeRemoved = archetype.onEntityRemoved.subscribe(updateEntities);

    return () => {
      unsubscribeAdded();
      unsubscribeRemoved();
    };
  }, [archetype]);

  return entities;
}
