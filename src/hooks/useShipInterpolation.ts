import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import type { MutableRefObject, RefObject } from 'react';
import { MathUtils, Quaternion, Vector3, type Group } from 'three';
import type { ShipEntity } from '../types/index.js';
import { resolveRendererMotionConfig, RENDERER_VISUAL_CONFIG } from '../config/renderer.js';
import { useOptionalGameState } from '../game/context.js';
import type { MotionVisualConfig } from '../types/gameplay.js';

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
  rootRef: RefObject<Group | null>,
  visualRef?: RefObject<Group | null>,
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
  const bankVelocityRef = useRef(0);
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

  useFrame((_, dt) => {
    const root = rootRef.current;
    if (!root) return;

    const sim = state?.simulation;
    const tickIndex = sim?.lastTickIndex ?? lastTickIndexRef.current;
    const alpha = sim ? MathUtils.clamp(sim.alpha, 0, 1) : 1;

    updateInterpolation(
      entity,
      interpolationState,
      smoothing,
      alpha,
      dt,
      tickIndex,
      bankValueRef,
      bankVelocityRef,
      lastTickIndexRef,
    );

    // Root receives the physics-interpolated pose (no visual-only offsets)
    root.position.copy(interpolationState.interpPosition);
    root.quaternion.copy(interpolationState.interpRotation);
    root.scale.setScalar(entity.transform.scale);

    if (visualRef && visualRef.current) {
      const vRef = visualRef.current;
      // local position = visualWorld - interpWorld
      vRef.position.copy(interpolationState.visualPosition).sub(interpolationState.interpPosition);
      // local rotation = interpRotation^-1 * finalRotation
      const inv = interpolationState.interpRotation.clone().invert();
      vRef.quaternion.copy(inv).multiply(interpolationState.finalRotation);
      vRef.scale.setScalar(entity.transform.scale);
    }
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
  dt: number,
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
    }
  } else {
    state.currSimPosition.copy(entity.transform.position);
    state.currSimRotation.copy(entity.transform.rotation);
  }

  state.interpPosition.copy(state.prevSimPosition).lerp(state.currSimPosition, alpha);
  // Position smoothing: prefer new time-constant semantics when available
  const motion = entity.ship.motion;
  const visualCfg: MotionVisualConfig | undefined = motion.visual;
  const globalVisualEnabled = RENDERER_VISUAL_CONFIG.enableShipVisualSmoothing;

  const frameDt = RENDERER_VISUAL_CONFIG.legacyFrameDt;
  const legacyToAlpha = (f: number) => (f <= 0 ? 0 : 1 - Math.pow(1 - f, dt / frameDt));

  let posAlpha = 1;
  if (globalVisualEnabled && visualCfg?.position?.k != null && visualCfg.position.k > 0) {
    posAlpha = 1 - Math.exp(-visualCfg.position.k * Math.max(dt, 1e-6));
  } else {
    posAlpha = legacyToAlpha(smoothing.positionLerp);
  }

  if (posAlpha <= 0) {
    state.visualPosition.copy(state.interpPosition);
  } else {
    state.visualPosition.lerp(state.interpPosition, posAlpha);
  }

  state.interpRotation.copy(state.prevSimRotation).slerp(state.currSimRotation, alpha);
  let rotAlpha = 1;
  if (globalVisualEnabled && visualCfg?.rotation?.k != null && visualCfg.rotation.k > 0) {
    rotAlpha = 1 - Math.exp(-visualCfg.rotation.k * Math.max(dt, 1e-6));
  } else {
    rotAlpha = legacyToAlpha(smoothing.rotationSlerp);
  }

  if (rotAlpha <= 0) {
    state.visualRotation.copy(state.interpRotation);
  } else {
    state.visualRotation.slerp(state.interpRotation, rotAlpha);
  }

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
  // Bank smoothing: support critically-damped spring when configured
  if (globalVisualEnabled && visualCfg?.bank?.useCriticallyDamped && visualCfg.bank.k && visualCfg.bank.k > 0) {
    const omega = visualCfg.bank.k; // natural frequency
    // Critically-damped exact integration
    const x = bankValueRef.current;
    const v = bankVelocityRef.current;
    const C1 = x - targetBankRad;
    const C2 = v + omega * C1;
    const expTerm = Math.exp(-omega * dt);
    const xNew = targetBankRad + (C1 + C2 * dt) * expTerm;
    const vNew = (C2 - omega * (C1 + C2 * dt)) * expTerm;
    bankValueRef.current = xNew;
    bankVelocityRef.current = vNew;
  } else {
    // fallback to time-constant or legacy per-frame smoothing
    let bankAlpha = 1;
    if (globalVisualEnabled && visualCfg?.bank?.k != null && visualCfg.bank.k > 0) {
      bankAlpha = 1 - Math.exp(-visualCfg.bank.k * Math.max(dt, 1e-6));
    } else {
      bankAlpha = legacyToAlpha(smoothing.bankLerp);
    }
    bankValueRef.current = bankAlpha <= 0 ? targetBankRad : MathUtils.lerp(bankValueRef.current, targetBankRad, bankAlpha);
  }

  state.finalRotation.copy(state.visualRotation);
  const bankRoll = bankValueRef.current;
  if (Math.abs(bankRoll) > 1e-4) {
    state.bankQuaternion.setFromAxisAngle(state.forwardAxis, -bankRoll);
    state.finalRotation.multiply(state.bankQuaternion);
  }
}

