import type React from 'react';
import type { Archetype, GameEntity, ProjectileEntity } from '../../types/index.js';
import { useArchetypeEntities } from '../../hooks/useArchetypeEntities.js';
import { ProjectileObject } from '../Projectile.js';

interface ProjectilesLayerProps {
  archetype: Archetype<GameEntity, ['projectile']>;
}

export function ProjectilesLayer({ archetype }: ProjectilesLayerProps): React.ReactElement {
  const projectiles = useArchetypeEntities<ProjectileEntity>(archetype);
  return (
    <>
      {projectiles.map((projectile) => (
        <ProjectileObject key={projectile.id} entity={projectile} />
      ))}
    </>
  );
}
