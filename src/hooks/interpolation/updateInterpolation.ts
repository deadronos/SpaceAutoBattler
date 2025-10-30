import type { MutableRefObject } from 'react';
import { MathUtils } from 'three';
import { RENDERER_VISUAL_CONFIG } from '../../config/renderer.js';
import type { MotionVisualConfig } from '../../types/gameplay.js';
import type { ShipEntity } from '../../types/index.js';
import type { SmoothingConfig } from './config.js';
import type { InterpolationState } from './state.js';
import { kToAlpha } from './math.js';

export function updateInterpolation(
  entity: ShipEntity,
  state: InterpolationState,
  smoothing: SmoothingConfig,
  alpha: number,
  dt: number,
  time: number,
  tickIndex: number,
  bankValueRef: MutableRefObject<number>,
  bankVelocityRef: MutableRefObject<number>,
  lastTickIndexRef: MutableRefObject<number>,
): void {
  advanceSimulationState(
    entity,
    state,
    smoothing,
    tickIndex,
    bankValueRef,
    bankVelocityRef,
    lastTickIndexRef,
  );

  applyInterpolatedPose(state, alpha);

  const motion = entity.ship.motion;
  const visualCfg = motion.visual;
  const smoothingEnabled = shouldApplyVisualSmoothing(visualCfg);

  updateVisualTargets(state, entity, motion.visual, smoothingEnabled, time);

  if (!smoothingEnabled) {
    state.visualPosition.copy(state.targetVisualPosition);
    state.visualRotation.copy(state.interpRotation);
    bankValueRef.current = 0;
    bankVelocityRef.current = 0;
  } else {
    smoothVisualPosition(state, visualCfg, smoothing, dt);
    smoothVisualRotation(state, visualCfg, smoothing, dt);
    updateBanking(entity, smoothing, visualCfg, dt, bankValueRef, bankVelocityRef);
  }

  finaliseVisualState(state, smoothingEnabled, bankValueRef);
}

function advanceSimulationState(
  entity: ShipEntity,
  state: InterpolationState,
  smoothing: SmoothingConfig,
  tickIndex: number,
  bankValueRef: MutableRefObject<number>,
  bankVelocityRef: MutableRefObject<number>,
  lastTickIndexRef: MutableRefObject<number>,
): void {
  if (tickIndex !== lastTickIndexRef.current) {
    state.prevSimPosition.copy(state.currSimPosition);
    state.prevSimRotation.copy(state.currSimRotation);
    state.currSimPosition.copy(entity.transform.position);
    state.currSimRotation.copy(entity.transform.rotation);
    lastTickIndexRef.current = tickIndex;

    const distSq = state.prevSimPosition.distanceToSquared(state.currSimPosition);
    if (distSq > smoothing.teleportThresholdSq) {
      state.prevSimPosition.copy(state.currSimPosition);
      state.prevSimRotation.copy(state.currSimRotation);
      state.visualPosition.copy(state.currSimPosition);
      state.visualRotation.copy(state.currSimRotation);
      state.targetVisualPosition.copy(state.currSimPosition);
      state.visualLocalOffset.set(0, 0, 0);
      state.visualOffset.set(0, 0, 0);
      bankValueRef.current = 0;
      bankVelocityRef.current = 0;
    }
  } else {
    state.currSimPosition.copy(entity.transform.position);
    state.currSimRotation.copy(entity.transform.rotation);
  }
}

function applyInterpolatedPose(state: InterpolationState, alpha: number): void {
  const clampedAlpha = MathUtils.clamp(alpha, 0, 1);
  state.interpPosition.copy(state.prevSimPosition).lerp(state.currSimPosition, clampedAlpha);
  state.interpRotation.copy(state.prevSimRotation).slerp(state.currSimRotation, clampedAlpha);
  state.inverseInterpRotation.copy(state.interpRotation).invert();
}

function shouldApplyVisualSmoothing(visualCfg?: MotionVisualConfig): boolean {
  const globalVisualEnabled = RENDERER_VISUAL_CONFIG.enableShipVisualSmoothing;
  const visualEnabled = visualCfg?.enabled ?? true;
  return globalVisualEnabled && visualEnabled;
}

function updateVisualTargets(
  state: InterpolationState,
  entity: ShipEntity,
  visualCfg: MotionVisualConfig | undefined,
  smoothingEnabled: boolean,
  time: number,
): void {
  state.targetVisualPosition.copy(state.interpPosition);
  state.visualLocalOffset.set(0, 0, 0);

  if (!smoothingEnabled || !visualCfg?.bob || visualCfg.bob.enabled === false) {
    return;
  }

  const baseAmp = Math.max(0, visualCfg.bob.baseAmp ?? 0);
  const freq = Math.max(0, visualCfg.bob.freq ?? 0);
  const speedScale = Math.max(0, visualCfg.bob.speedScale ?? 0);
  const maxAmp = Math.max(baseAmp, visualCfg.bob.maxAmp ?? baseAmp);
  if (freq <= 0 || (baseAmp <= 0 && speedScale <= 0)) {
    return;
  }

  const motion = entity.ship.motion;
  const speed = entity.ship.velocity.length();
  const maxSpeed = Math.max(motion.maxSpeed, 1e-3);
  const speedRatio = MathUtils.clamp(speed / maxSpeed, 0, 1);
  const turnRate = Math.abs(entity.ship.angularVelocity.y);
  const maxTurn = Math.max(motion.maxTurnRate, 1e-3);
  const turnRatio = MathUtils.clamp(turnRate / maxTurn, 0, 1);

  let amplitude = baseAmp + baseAmp * speedScale * speedRatio;
  amplitude += baseAmp * 0.25 * turnRatio;
  amplitude = Math.min(maxAmp, amplitude);

  if (speedRatio < 0.05) {
    const fade = speedRatio / 0.05;
    amplitude *= MathUtils.clamp(fade, 0, 1);
  }

  if (amplitude <= 1e-5) {
    return;
  }

  const phase = time * freq * Math.PI * 2;
  const vertical = Math.sin(phase) * amplitude;
  const lateralSign = Math.sign(entity.ship.angularVelocity.y);
  const lateral = Math.cos(phase * 0.5) * amplitude * 0.35 * lateralSign * turnRatio;
  state.visualLocalOffset.set(lateral, vertical, 0);
  state.visualOffset.copy(state.visualLocalOffset).applyQuaternion(state.interpRotation);
  state.targetVisualPosition.add(state.visualOffset);
  state.visualOffset.set(0, 0, 0);
}

function smoothVisualPosition(
  state: InterpolationState,
  visualCfg: MotionVisualConfig | undefined,
  smoothing: SmoothingConfig,
  dt: number,
): void {
  const posAlpha = kToAlpha(visualCfg?.position?.k ?? smoothing.positionK, dt);
  if (posAlpha <= 0 || posAlpha >= 1) {
    state.visualPosition.copy(state.targetVisualPosition);
    return;
  }

  state.visualPosition.lerp(state.targetVisualPosition, MathUtils.clamp(posAlpha, 0, 1));
}

function smoothVisualRotation(
  state: InterpolationState,
  visualCfg: MotionVisualConfig | undefined,
  smoothing: SmoothingConfig,
  dt: number,
): void {
  const rotAlpha = kToAlpha(visualCfg?.rotation?.k ?? smoothing.rotationK, dt);
  if (rotAlpha <= 0 || rotAlpha >= 1) {
    state.visualRotation.copy(state.interpRotation);
    return;
  }

  state.visualRotation.slerp(state.interpRotation, MathUtils.clamp(rotAlpha, 0, 1));
}

function updateBanking(
  entity: ShipEntity,
  smoothing: SmoothingConfig,
  visualCfg: MotionVisualConfig | undefined,
  dt: number,
  bankValueRef: MutableRefObject<number>,
  bankVelocityRef: MutableRefObject<number>,
): void {
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

  if (visualCfg?.bank?.useCriticallyDamped && visualCfg.bank.k && visualCfg.bank.k > 0) {
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

function finaliseVisualState(
  state: InterpolationState,
  smoothingEnabled: boolean,
  bankValueRef: MutableRefObject<number>,
): void {
  state.visualOffset
    .copy(state.visualPosition)
    .sub(state.interpPosition)
    .applyQuaternion(state.inverseInterpRotation);

  state.finalRotation.copy(state.visualRotation);
  if (smoothingEnabled) {
    const bankRoll = bankValueRef.current;
    if (Math.abs(bankRoll) > 1e-4) {
      state.bankQuaternion.setFromAxisAngle(state.forwardAxis, -bankRoll);
      state.finalRotation.multiply(state.bankQuaternion);
    }
  }
}
