import type React from 'react';
import type { Archetype, GameEntity, ShipEntity } from '../../types/index.js';
import { useArchetypeEntities } from '../../hooks/useArchetypeEntities.js';
import { ShipLODManager } from '../lod/ShipLODManager.js';

interface ShipsLayerProps {
  archetype: Archetype<GameEntity, ['ship']>;
}

export function ShipsLayer({ archetype }: ShipsLayerProps): React.ReactElement {
  const ships = useArchetypeEntities<ShipEntity>(archetype);
  return <ShipLODManager ships={ships} />;
}
