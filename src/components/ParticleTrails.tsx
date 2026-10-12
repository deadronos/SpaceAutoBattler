import React, { useEffect, useMemo } from 'react';
import { PARTICLE_TRAILS_CONFIG, THRUSTER_GLOW_CONFIG } from '../config/effects.js';
import type { ShipEntity } from '../types/index.js';
import { useUiStore } from '../app/uiStore.js';
import { resolveQualitySettings } from '../config/quality.js';
import {
  createParticleTrailResources,
  disposeParticleTrailResources,
  type ParticleTrailResources,
} from '../renderer/particles/trailResources.js';
import { useParticleTrailSimulation } from '../hooks/useParticleTrailSimulation.js';

interface ParticleTrailProps {
  ships: ShipEntity[];
  /** Optional GPU resources for testing */
  resources?: ParticleTrailResources;
}

/**
 * Simple particle trail system for ship thrusters.
 * Spawns small particles from ship thruster anchors that fade out over time.
 *
 * @param {ParticleTrailProps} props - Component properties.
 * @returns {React.ReactElement} The rendered particle system mesh.
 */
export function ParticleTrails({ ships, resources }: ParticleTrailProps): React.ReactElement {
  // Resolved quality knobs (render-only). `high` keeps the shipped pool/spawn
  // rate from PARTICLE_TRAILS_CONFIG, so this is a no-op by default.
  const qualityPreset = useUiStore((s) => s.qualityPreset);
  const detectedQualityTier = useUiStore((s) => s.detectedQualityTier);
  const quality = resolveQualitySettings(qualityPreset, detectedQualityTier);

  if (!PARTICLE_TRAILS_CONFIG.enabled) return <></>;

  const ownsResources = resources == null;
  const trailResources = useMemo(() => {
    if (resources) return resources;
    return createParticleTrailResources(quality.particles.maxParticles, {
      size: PARTICLE_TRAILS_CONFIG.size,
      color: PARTICLE_TRAILS_CONFIG.color || THRUSTER_GLOW_CONFIG.defaultEmissiveColor,
      opacity: PARTICLE_TRAILS_CONFIG.opacity,
      additiveBlending: PARTICLE_TRAILS_CONFIG.additiveBlending,
      depthTest: PARTICLE_TRAILS_CONFIG.depthTest,
      depthWrite: PARTICLE_TRAILS_CONFIG.depthWrite,
      spriteSoftness: PARTICLE_TRAILS_CONFIG.spriteSoftness,
    });
  }, [resources, quality.particles.maxParticles]);

  useEffect(() => {
    if (!ownsResources) return;
    return () => {
      disposeParticleTrailResources(trailResources);
    };
  }, [ownsResources, trailResources]);

  const meshRef = useParticleTrailSimulation(
    ships,
    trailResources,
    quality.particles.spawnRatePerAnchor,
  );

  return (
    <mesh
      ref={meshRef}
      geometry={trailResources.geometry}
      material={trailResources.material}
      frustumCulled={false}
    />
  );
}
