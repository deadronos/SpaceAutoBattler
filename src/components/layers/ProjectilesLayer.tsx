import type React from 'react';
import type { Archetype, GameEntity } from '../../types/index.js';
import { ProjectilesInstancedLayer } from './ProjectilesInstancedLayer.js';

interface ProjectilesLayerProps {
  archetype: Archetype<GameEntity, ['projectile']>;
}

/**
 * Wrapper for the instanced projectile rendering layer.
 *
 * @param {object} props - Component props.
 * @param {Archetype<GameEntity, ['projectile']>} props.archetype - The projectile archetype.
 * @returns {React.ReactElement} The rendered projectiles layer.
 */
export function ProjectilesLayer(props: ProjectilesLayerProps): React.ReactElement {
  return <ProjectilesInstancedLayer {...props} />;
}
