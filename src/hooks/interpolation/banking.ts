import { MathUtils } from 'three';
import type { MutableRefObject } from 'react';
import type { MotionVisualConfig } from '../../types/gameplay.js';
import type { ShipEntity } from '../../types/index.js';
import type { SmoothingConfig } from './config.js';
import type { BankingMode } from './detailPolicy.js';
import { kToAlpha } from './math.js';

export function updateBanking(
  entity: ShipEntity,
  smoothing: SmoothingConfig,
  visualCfg: MotionVisualConfig | undefined,
  dt: number,
  mode: BankingMode,
  bankValueRef: MutableRefObject<number>,
  bankVelocityRef: MutableRefObject<number>,
): void {
  if (mode === 'disabled') {
    bankValueRef.current = 0;
    bankVelocityRef.current = 0;
    return;
  }

  const motion = entity.ship.motion;
  const bankFactor = motion.visualBankFactor ?? smoothing.bankFactor;
  const maxBankDeg = visualCfg?.bank?.maxDeg ?? motion.maxBankDeg ?? smoothing.maxBankDeg;
  const yawRate = entity.ship.angularVelocity.y;
  let bankDeg = yawRate * bankFactor;

  if (motion.maxLateralAcceleration && motion.maxLateralAcceleration > 0) {
    const lateralRatio = MathUtils.clamp(
      entity.ship.lateralAcceleration / motion.maxLateralAcceleration,
      -1,
      1,
    );
    bankDeg += lateralRatio * maxBankDeg * 0.5;
  }

  const targetBankRad = MathUtils.degToRad(MathUtils.clamp(bankDeg, -maxBankDeg, maxBankDeg));
  const safeDt = Math.max(dt, 1e-6);

  if (mode === 'criticallyDamped' && visualCfg?.bank?.k && visualCfg.bank.k > 0) {
    const omega = visualCfg.bank.k;
    const x = bankValueRef.current;
    const v = bankVelocityRef.current;
    const C1 = x - targetBankRad;
    const C2 = v + omega * C1;
    const expTerm = Math.exp(-omega * safeDt);
    const xNew = targetBankRad + (C1 + C2 * safeDt) * expTerm;
    const vNew = (C2 - omega * (C1 + C2 * safeDt)) * expTerm;
    bankValueRef.current = xNew;
    bankVelocityRef.current = vNew;
  } else {
    const bankAlpha = kToAlpha(visualCfg?.bank?.k ?? smoothing.bankK, dt);
    if (bankAlpha <= 0 || bankAlpha >= 1) {
      bankValueRef.current = targetBankRad;
    } else {
      bankValueRef.current = MathUtils.lerp(
        bankValueRef.current,
        targetBankRad,
        MathUtils.clamp(bankAlpha, 0, 1),
      );
    }
    bankVelocityRef.current = 0;
  }
}
