import type React from 'react';
import type { Archetype, GameEntity } from '../../types/index.js';
import { ProjectilesInstancedLayer } from './ProjectilesInstancedLayer.js';

interface ProjectilesLayerProps {
  archetype: Archetype<GameEntity, ['projectile']>;
}

export function ProjectilesLayer(props: ProjectilesLayerProps): React.ReactElement {
  return <ProjectilesInstancedLayer {...props} />;
}
