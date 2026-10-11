import React, { useEffect } from 'react';
import type { Archetype, GameEntity, ProjectileEntity } from '../../types/index.js';
import { useArchetypeEntities } from '../../hooks/useArchetypeEntities.js';
import { useGameState } from '../../game/context.js';
import { useBloomRegistration } from '../../renderer/bloom/index.js';
import {
  useProjectileInstancedGroups,
  type ProjectileGroupState,
} from '../../hooks/useProjectileInstancedGroups.js';

interface ProjectilesInstancedLayerProps {
  archetype: Archetype<GameEntity, ['projectile']>;
  capacityByType?: Partial<Record<string, number>>;
  defaultCapacity?: number;
  maxTotal?: number;
}

const DEFAULT_CAPACITY = 512;

function ProjectileGroupMesh({ group }: { group: ProjectileGroupState }): React.ReactElement {
  const { meshRef, materialInfo, geometry, capacity, baseColor } = group;
  useBloomRegistration(meshRef, { group: 'projectiles' });

  useEffect(() => {
    // Initialize mesh attributes via the group's manager (if attached)
    const manager = group.manager;
    const mesh = meshRef.current;
    manager.initMesh();
    return () => {
      if (mesh && mesh.instanceColor) {
        mesh.instanceColor = null;
      }
    };
  }, [group.manager, meshRef, materialInfo.supportsInstanceColor, capacity, baseColor]);

  useEffect(
    () => () => {
      materialInfo.material.dispose();
    },
    [materialInfo.material],
  );

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, materialInfo.material, capacity]}
      matrixAutoUpdate={false}
      frustumCulled
      visible={false}
    />
  );
}

/**
 * Instanced renderer for projectiles.
 * Groups projectiles by type/key and renders them using InstancedMesh for performance.
 * Handles beam visualization separately via scaling matrices.
 *
 * @param {object} props - Component props.
 * @param {Archetype<GameEntity, ['projectile']>} props.archetype - The projectile archetype.
 * @param {Partial<Record<string, number>>} [props.capacityByType] - Optional capacity overrides per type.
 * @param {number} [props.defaultCapacity=512] - Default capacity per group.
 * @param {number} [props.maxTotal=Infinity] - Maximum total rendered projectiles.
 * @returns {React.ReactElement} The rendered instanced meshes.
 */
export function ProjectilesInstancedLayer({
  archetype,
  capacityByType,
  defaultCapacity = DEFAULT_CAPACITY,
  maxTotal = Number.POSITIVE_INFINITY,
}: ProjectilesInstancedLayerProps): React.ReactElement {
  const projectiles = useArchetypeEntities<ProjectileEntity>(archetype);
  const state = useGameState();
  const groupsRef = useProjectileInstancedGroups({
    projectiles,
    state,
    capacityByType,
    defaultCapacity,
    maxTotal,
  });

  return (
    <>
      {Array.from(groupsRef.current.values()).map((group) => (
        <ProjectileGroupMesh key={group.key} group={group} />
      ))}
    </>
  );
}
