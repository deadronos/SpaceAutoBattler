import type React from 'react';
import type { Archetype, GameEntity, TurretEntity } from '../../types/index.js';
import { useArchetypeEntities } from '../../hooks/useArchetypeEntities.js';
import { TurretObject } from '../Turret.js';

interface TurretsLayerProps {
  archetype: Archetype<GameEntity, ['turret']>;
}

export function TurretsLayer({ archetype }: TurretsLayerProps): React.ReactElement {
  const turrets = useArchetypeEntities<TurretEntity>(archetype);
  return (
    <>
      {turrets.map((e) => (
        <TurretObject key={e.id} entity={e} />
      ))}
    </>
  );
}
