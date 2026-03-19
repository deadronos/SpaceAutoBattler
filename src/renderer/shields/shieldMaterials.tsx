import React, { useMemo } from 'react';
import { useRef } from 'react';
import { MeshTransmissionMaterial } from '@react-three/drei';
import type { Material } from 'three';
import type { ShipHull, Team } from '../../types/index.js';
import { getShieldVisuals, SHIELD_TUNING, TEAM_COLORS } from '../../config/renderer.js';
import { colorFromConfig } from '../../utils/color.js';

export type ShieldTransmissionMaterialProps = {
  hull: ShipHull;
  team: Team;
  opacity: number;
};

export const ShieldTransmissionMaterial: React.FC<ShieldTransmissionMaterialProps> = ({
  hull,
  team,
  opacity,
}) => {
  const cfg = getShieldVisuals(hull);
  const tint = useMemo(
    () => colorFromConfig(team === 'blue' ? TEAM_COLORS.blue : SHIELD_TUNING.redTint),
    [team],
  );
  const alpha = Math.max(0, Math.min(1, opacity * cfg.maxAlpha));
  const matRef = useRef<Material>(null);

  return (
    <MeshTransmissionMaterial
      ref={matRef}
      userData={{ __copilot_forceColorWrite: true }}
      transparent
      depthWrite={false}
      depthTest={false}
      color={tint}
      resolution={256}
      attenuationColor={tint}
      thickness={cfg.meshtransmission.thickness}
      chromaticAberration={cfg.meshtransmission.chromaticAberration}
      anisotropicBlur={cfg.meshtransmission.anisotropicBlur}
      distortion={cfg.meshtransmission.distortion}
      distortionScale={cfg.meshtransmission.distortionScale}
      temporalDistortion={cfg.meshtransmission.temporalDistortion}
      attenuationDistance={cfg.meshtransmission.attenuationDistance}
      roughness={cfg.meshtransmission.roughness}
      clearcoat={cfg.meshtransmission.clearcoat}
      ior={cfg.meshtransmission.ior}
      opacity={alpha}
    />
  );
};
