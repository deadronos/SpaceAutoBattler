import React, { useMemo } from 'react';
import { createShieldHexShaderMaterial } from './shieldHexMaterialFactory.js';
import { useShieldHexUniforms } from './useShieldHexUniforms.js';
import type { ShieldHexMaterialProps } from './shieldHexMaterialFactory.js';
import { useUiStore } from '../../app/uiStore.js';
import { resolveQualitySettings } from '../../config/quality.js';

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
  const qualityPreset = useUiStore((s) => s.qualityPreset);
  const detectedQualityTier = useUiStore((s) => s.detectedQualityTier);
  // Ships are not tier-keyed/remounted, so the resolved tier is part of the
  // memo key to force a rebuild (and recompile with the LOW_QUALITY define)
  // whenever the preset changes.
  const qualityTier = useMemo(
    () => resolveQualitySettings(qualityPreset, detectedQualityTier).tier,
    [qualityPreset, detectedQualityTier],
  );
  // The factory reads RENDERER_VISUAL_CONFIG at creation time, so `qualityTier`
  // is intentionally part of the key to force a rebuild on preset change.
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  const mat = useMemo(() => createShieldHexShaderMaterial(hull, team), [hull, team, qualityTier]);

  useShieldHexUniforms(mat, team, opacity, ripple, simTime);

  return <primitive object={mat} attach="material" />;
};
