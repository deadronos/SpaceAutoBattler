import { useEffect, useState } from 'react';
import type { Archetype } from 'miniplex';
import type { GameEntity } from '../types/index.js';

export function useArchetypeEntities<T extends GameEntity>(
  archetype: Archetype<GameEntity, any>
): T[] {
  const [entities, setEntities] = useState<T[]>(() => archetype.entities as T[]);

  useEffect(() => {
    const handleChange = () => {
      setEntities([...archetype.entities] as T[]);
    };

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
