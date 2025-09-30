import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { MathUtils, Quaternion, Vector3, type Group } from 'three';
import type { ShipEntity } from '../types/index.js';
import { resolveRendererMotionConfig } from '../config/renderer.js';
import { useOptionalGameState } from '../game/context.js';

export interface InterpolationState {
  prevSimPosition: Vector3;
  prevSimRotation: Quaternion;
  currSimPosition: Vector3;
  currSimRotation: Quaternion;
  visualPosition: Vector3;
  visualRotation: Quaternion;
  interpPosition: Vector3;
  interpRotation: Quaternion;
  bankQuaternion: Quaternion;
  forwardAxis: Vector3;
  finalRotation: Quaternion;
  bankValue: number;
  lastTickIndex: number;
}

export interface SmoothingConfig {
  positionLerp: number;
  rotationSlerp: number;
  bankLerp: number;
  teleportThresholdSq: number;
  bankFactor: number;
  maxBankDeg: number;
  thrusterIntensity: { base: number; range: number };
}

export function useShipInterpolation(
  entity: ShipEntity,
  groupRef: React.RefObject<Group | null>,
): {
  state: InterpolationState;
  smoothing: SmoothingConfig;
} {
  const state = useOptionalGameState();
  const lastTickIndex = state?.simulation.lastTickIndex ?? 0;

  const smoothing = useMemo(() => {
    const cfg = resolveRendererMotionConfig(entity.ship.motion);
    return {
      positionLerp: MathUtils.clamp(cfg.positionLerp, 0, 1),
      rotationSlerp: MathUtils.clamp(cfg.rotationSlerp, 0, 1),
      bankLerp: MathUtils.clamp(cfg.bankLerp, 0, 1),
      teleportThresholdSq: Math.max(1, cfg.teleportDistance * cfg.teleportDistance),
      bankFactor: cfg.bankFactor,
      maxBankDeg: cfg.maxBankDeg,
      thrusterIntensity: cfg.thrusterIntensity,
    };
  }, [entity.ship.motion]);

  const prevSimPosition = useMemo(() => new Vector3(), []);
  const prevSimRotation = useMemo(() => new Quaternion(), []);
  const currSimPosition = useMemo(() => new Vector3(), []);
  const currSimRotation = useMemo(() => new Quaternion(), []);
  const visualPosition = useMemo(() => new Vector3(), []);
  const visualRotation = useMemo(() => new Quaternion(), []);
  const interpPosition = useMemo(() => new Vector3(), []);
  const interpRotation = useMemo(() => new Quaternion(), []);
  const bankQuaternion = useMemo(() => new Quaternion(), []);
  const forwardAxis = useMemo(() => new Vector3(0, 0, 1), []);
  const finalRotation = useMemo(() => new Quaternion(), []);
  const bankValueRef = useRef(0);
  const lastTickIndexRef = useRef(-1);

  const interpolationState = useMemo((): InterpolationState => ({
    prevSimPosition,
    prevSimRotation,
    currSimPosition,
    currSimRotation,
    visualPosition,
    visualRotation,
    interpPosition,
    interpRotation,
    bankQuaternion,
    forwardAxis,
    finalRotation,
    get bankValue() { return bankValueRef.current; },
    get lastTickIndex() { return lastTickIndexRef.current; },
  }), [
    prevSimPosition, prevSimRotation, currSimPosition, currSimRotation,
    visualPosition, visualRotation, interpPosition, interpRotation,
    bankQuaternion, forwardAxis, finalRotation
  ]);

  useLayoutEffect(() => {
    prevSimPosition.copy(entity.transform.position);
    currSimPosition.copy(entity.transform.position);
    visualPosition.copy(entity.transform.position);
    prevSimRotation.copy(entity.transform.rotation);
    currSimRotation.copy(entity.transform.rotation);
    visualRotation.copy(entity.transform.rotation);
    bankValueRef.current = 0;
    lastTickIndexRef.current = lastTickIndex;
  }, [entity.id, lastTickIndex]);

  useFrame(() => {
    const ref = groupRef.current;
    if (!ref) return;

    const sim = state?.simulation;
    const tickIndex = sim?.lastTickIndex ?? lastTickIndexRef.current;
    const alpha = sim ? MathUtils.clamp(sim.alpha, 0, 1) : 1;

    updateInterpolation(
      entity,
      interpolationState,
      smoothing,
      alpha,
      tickIndex,
      bankValueRef,
      lastTickIndexRef,
    );

    ref.position.copy(interpolationState.visualPosition);
    ref.quaternion.copy(interpolationState.finalRotation);
    ref.scale.setScalar(entity.transform.scale);
  });

  return {
    state: interpolationState,
    smoothing,
  };
}

export function updateInterpolation(
  entity: ShipEntity,
  state: InterpolationState,
  smoothing: SmoothingConfig,
  alpha: number,
  tickIndex: number,
  bankValueRef: React.MutableRefObject<number>,
  lastTickIndexRef: React.MutableRefObject<number>,
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
    }
  } else {
    state.currSimPosition.copy(entity.transform.position);
    state.currSimRotation.copy(entity.transform.rotation);
  }

  state.interpPosition.copy(state.prevSimPosition).lerp(state.currSimPosition, alpha);
  if (smoothing.positionLerp <= 0) {
    state.visualPosition.copy(state.interpPosition);
  } else {
    state.visualPosition.lerp(state.interpPosition, smoothing.positionLerp);
  }

  state.interpRotation.copy(state.prevSimRotation).slerp(state.currSimRotation, alpha);
  if (smoothing.rotationSlerp <= 0) {
    state.visualRotation.copy(state.interpRotation);
  } else {
    state.visualRotation.slerp(state.interpRotation, smoothing.rotationSlerp);
  }

  const motion = entity.ship.motion;
  const bankFactor = motion.visualBankFactor ?? smoothing.bankFactor;
  const maxBankDeg = motion.maxBankDeg ?? smoothing.maxBankDeg;
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
  bankValueRef.current =
    smoothing.bankLerp <= 0
      ? targetBankRad
      : MathUtils.lerp(bankValueRef.current, targetBankRad, smoothing.bankLerp);

  state.finalRotation.copy(state.visualRotation);
  const bankRoll = bankValueRef.current;
  if (Math.abs(bankRoll) > 1e-4) {
    state.bankQuaternion.setFromAxisAngle(state.forwardAxis, -bankRoll);
    state.finalRotation.multiply(state.bankQuaternion);
  }
}