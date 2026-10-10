import React, { useMemo } from 'react';
import { createShieldHexShaderMaterial } from './shieldHexMaterialFactory.js';
import { useShieldHexUniforms } from './useShieldHexUniforms.js';
import type { ShieldHexMaterialProps } from './shieldHexMaterialFactory.js';

export { createShieldHexShaderMaterial } from './shieldHexMaterialFactory.js';
export type { ShieldHexMaterialProps } from './shieldHexMaterialFactory.js';

/**
 * Shield hex material component. Creates the material for the hull/team and
 * delegates per-frame uniform updates to {@link useShieldHexUniforms}.
 */
export const ShieldHexMaterial: React.FC<ShieldHexMaterialProps> = ({
  hull,
  team,
  opacity,
  ripple,
  simTime,
}) => {
  const mat = useMemo(() => createShieldHexShaderMaterial(hull, team), [hull, team]);

  useShieldHexUniforms(mat, team, opacity, ripple, simTime);

  return <primitive object={mat} attach="material" />;
};
