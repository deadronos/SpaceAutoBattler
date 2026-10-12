import type { MutableRefObject } from 'react';
import { MathUtils } from 'three';
import type { ShipEntity } from '../../types/index.js';
import type { SmoothingConfig } from './config.js';
import type { InterpolationState } from './state.js';
import {
  resolveEntityDetailLevel,
  resolveInterpolationPolicy,
  type InterpolationPolicy,
} from './detailPolicy.js';
import { updateVisualTargets } from './bob.js';
import { smoothVisualPosition, smoothVisualRotation } from './smoothing.js';
import { updateBanking } from './banking.js';

function applyTrivialInterpolation(state: InterpolationState, alpha: number): void {
  const usePrevious = alpha <= 0;
  const sourcePosition = usePrevious ? state.prevSimPosition : state.currSimPosition;
  const sourceRotation = usePrevious ? state.prevSimRotation : state.currSimRotation;

  state.interpPosition.copy(sourcePosition);
  state.interpRotation.copy(sourceRotation);
  state.inverseInterpRotation.copy(state.interpRotation).invert();
  state.visualPosition.copy(sourcePosition);
  state.visualRotation.copy(sourceRotation);
  state.targetVisualPosition.copy(sourcePosition);
  state.visualLocalOffset.set(0, 0, 0);
  state.visualOffset.set(0, 0, 0);
  state.finalRotation.copy(state.visualRotation);
}

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
  policy?: InterpolationPolicy,
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

  const motion = entity.ship.motion;
  const visualCfg = motion.visual;
  const resolved =
    policy ?? resolveInterpolationPolicy(visualCfg, resolveEntityDetailLevel(entity));
  const { smoothingEnabled, bobEnabled, bankingMode } = resolved;

  const clampedAlpha = MathUtils.clamp(alpha, 0, 1);
  const alphaIsExtreme = clampedAlpha <= 0 || clampedAlpha >= 1;
  const trivialPath =
    !smoothingEnabled && !bobEnabled && bankingMode === 'disabled' && alphaIsExtreme;

  if (trivialPath) {
    applyTrivialInterpolation(state, clampedAlpha);
    bankValueRef.current = 0;
    bankVelocityRef.current = 0;
    return;
  }

  applyInterpolatedPose(state, clampedAlpha);

  updateVisualTargets(state, entity, motion.visual, bobEnabled, time);

  if (!smoothingEnabled) {
    state.visualPosition.copy(state.targetVisualPosition);
    state.visualRotation.copy(state.interpRotation);
    bankValueRef.current = 0;
    bankVelocityRef.current = 0;
  } else {
    smoothVisualPosition(state, visualCfg, smoothing, dt);
    smoothVisualRotation(state, visualCfg, smoothing, dt);
    updateBanking(entity, smoothing, visualCfg, dt, bankingMode, bankValueRef, bankVelocityRef);
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
