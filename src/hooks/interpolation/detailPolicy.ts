import { RENDERER_VISUAL_CONFIG } from '../../config/renderer.js';
import type { MotionVisualConfig } from '../../types/gameplay.js';
import type { ShipEntity, VisualDetailLevel } from '../../types/index.js';
import { shouldApplyVisualSmoothing } from './smoothing.js';

export type BankingMode = 'disabled' | 'simple' | 'criticallyDamped';

export interface InterpolationPolicy {
  effectiveDetail: VisualDetailLevel;
  smoothingEnabled: boolean;
  bobEnabled: boolean;
  bankingMode: BankingMode;
}

const DETAIL_RANK: Record<VisualDetailLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

export function resolvePerformanceTier(): VisualDetailLevel {
  const tier = RENDERER_VISUAL_CONFIG.performanceTier;
  return tier === 'medium' || tier === 'low' ? tier : 'high';
}

export function resolveEntityDetailLevelFromParts(
  visualDetailLevel: VisualDetailLevel | undefined,
  aiLod: number | undefined,
): VisualDetailLevel {
  if (visualDetailLevel) {
    return visualDetailLevel;
  }
  if (aiLod === 2) return 'low';
  if (aiLod === 1) return 'medium';
  return 'high';
}

export function resolveEntityDetailLevel(entity: ShipEntity): VisualDetailLevel {
  return resolveEntityDetailLevelFromParts(entity.ship.visualDetailLevel, entity.ai?.lod);
}

export function pickEffectiveDetailLevel(
  entityDetail: VisualDetailLevel,
  performanceTier: VisualDetailLevel,
): VisualDetailLevel {
  return DETAIL_RANK[performanceTier] < DETAIL_RANK[entityDetail] ? performanceTier : entityDetail;
}

export function shouldEnableBob(
  visualCfg: MotionVisualConfig | undefined,
  detailLevel: VisualDetailLevel,
): boolean {
  if (!RENDERER_VISUAL_CONFIG.enableShipBob) return false;
  if (detailLevel !== 'high') return false;
  return visualCfg?.bob?.enabled !== false;
}

export function resolveBankingMode(
  visualCfg: MotionVisualConfig | undefined,
  detailLevel: VisualDetailLevel,
): BankingMode {
  if (!RENDERER_VISUAL_CONFIG.enableShipBanking) return 'disabled';
  if (!visualCfg?.bank) return 'disabled';
  if (visualCfg.bank.maxDeg === 0) return 'disabled';
  if (detailLevel === 'low') return 'disabled';
  if (visualCfg.bank.useCriticallyDamped && detailLevel === 'high') {
    return 'criticallyDamped';
  }
  return 'simple';
}

export function resolveInterpolationPolicy(
  visualCfg: MotionVisualConfig | undefined,
  entityDetail: VisualDetailLevel,
): InterpolationPolicy {
  const performanceTier = resolvePerformanceTier();
  const effectiveDetail = pickEffectiveDetailLevel(entityDetail, performanceTier);
  const smoothingAllowed = effectiveDetail !== 'low';
  const smoothingEnabled = smoothingAllowed && shouldApplyVisualSmoothing(visualCfg);
  const bobEnabled = smoothingEnabled && shouldEnableBob(visualCfg, effectiveDetail);
  const bankingMode = resolveBankingMode(visualCfg, effectiveDetail);
  return { effectiveDetail, smoothingEnabled, bobEnabled, bankingMode };
}
