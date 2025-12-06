import type React from 'react';
import type { Archetype, GameEntity, ShipEntity } from '../../types/index.js';
import { useArchetypeEntities } from '../../hooks/useArchetypeEntities.js';
import { ShipLODManager } from '../lod/ShipLODManager.js';

interface ShipsLayerProps {
  archetype: Archetype<GameEntity, ['ship']>;
}

/**
 * Layer component for rendering all ship entities.
 * Manages Level of Detail (LOD) and instancing for ships.
 *
 * @param {object} props - Component props.
 * @param {Archetype<GameEntity, ['ship']>} props.archetype - The Miniplex archetype for ships.
 * @returns {React.ReactElement} The rendered ship layer.
 */
export function ShipsLayer({ archetype }: ShipsLayerProps): React.ReactElement {
  const ships = useArchetypeEntities<ShipEntity>(archetype);
  return <ShipLODManager ships={ships} />;
}
