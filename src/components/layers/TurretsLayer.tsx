import type React from 'react';
import type { Archetype, GameEntity, TurretEntity } from '../../types/index.js';
import { useArchetypeEntities } from '../../hooks/useArchetypeEntities.js';
import { TurretObject } from '../Turret.js';

const SHOW_TURRET_GIZMOS = false;

interface TurretsLayerProps {
  archetype: Archetype<GameEntity, ['turret']>;
}

/**
 * Layer component for rendering turret entities.
 *
 * @param {object} props - Component props.
 * @param {Archetype<GameEntity, ['turret']>} props.archetype - The Miniplex archetype for turrets.
 * @returns The turret layer when the debug gizmos are enabled.
 */
export function TurretsLayer(props: TurretsLayerProps): React.ReactElement | null {
  return SHOW_TURRET_GIZMOS ? <TurretGizmos {...props} /> : null;
}

function TurretGizmos({ archetype }: TurretsLayerProps): React.ReactElement {
  const turrets = useArchetypeEntities<TurretEntity>(archetype);
  return (
    <>
      {turrets.map((e) => (
        <TurretObject key={e.id} entity={e} />
      ))}
    </>
  );
}
