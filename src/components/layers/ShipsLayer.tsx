import type React from 'react';
import type { Archetype, GameEntity, ShipEntity } from '../../types/index.js';
import { useArchetypeEntities } from '../../hooks/useArchetypeEntities.js';
import { ShipObject } from '../Ship.js';
import { ParticleTrails } from '../ParticleTrails.js';

interface ShipsLayerProps {
  archetype: Archetype<GameEntity, ['ship']>;
}

export function ShipsLayer({ archetype }: ShipsLayerProps): React.ReactElement {
  const ships = useArchetypeEntities<ShipEntity>(archetype);
  return (
    <>
      {ships.map((ship) => (
        <ShipObject key={ship.id} entity={ship} />
      ))}
      <ParticleTrails ships={ships} />
    </>
  );
}
