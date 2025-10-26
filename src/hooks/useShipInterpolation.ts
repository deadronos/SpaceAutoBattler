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
  targetVisualPosition: Vector3;
  visualLocalOffset: Vector3;
  visualOffset: Vector3;
  interpPosition: Vector3;
  interpRotation: Quaternion;
  inverseInterpRotation: Quaternion;
  bankQuaternion: Quaternion;
  forwardAxis: Vector3;
  finalRotation: Quaternion;
  bankValue: number;
  lastTickIndex: number;
}

export interface SmoothingConfig {
  positionK: number;
  rotationK: number;
  bankK: number;
  teleportThresholdSq: number;
  bankFactor: number;
  maxBankDeg: number;
  thrusterIntensity: { base: number; range: number };
}

export function kToAlpha(k: number | undefined, dt: number): number {
  if (!k || k <= 0 || dt <= 0) {
    return 0;
  }
  return 1 - Math.exp(-k * dt);
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
      positionK: Math.max(0, cfg.positionK),
      rotationK: Math.max(0, cfg.rotationK),
      bankK: Math.max(0, cfg.bankK),
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
  const targetVisualPosition = useMemo(() => new Vector3(), []);
  const visualLocalOffset = useMemo(() => new Vector3(), []);
  const visualOffset = useMemo(() => new Vector3(), []);
  const visualRotation = useMemo(() => new Quaternion(), []);
  const interpPosition = useMemo(() => new Vector3(), []);
  const interpRotation = useMemo(() => new Quaternion(), []);
  const inverseInterpRotation = useMemo(() => new Quaternion(), []);
  const bankQuaternion = useMemo(() => new Quaternion(), []);
  const forwardAxis = useMemo(() => new Vector3(0, 0, 1), []);
  const finalRotation = useMemo(() => new Quaternion(), []);
  const bankValueRef = useRef(0);
  const bankVelocityRef = useRef(0);
  const lastTickIndexRef = useRef(-1);

  const interpolationState = useMemo(
    (): InterpolationState => ({
      prevSimPosition,
      prevSimRotation,
      currSimPosition,
      currSimRotation,
      visualPosition,
      visualRotation,
      targetVisualPosition,
      visualLocalOffset,
      visualOffset,
      interpPosition,
      interpRotation,
      inverseInterpRotation,
      bankQuaternion,
      forwardAxis,
      finalRotation,
      get bankValue() {
        return bankValueRef.current;
      },
      get lastTickIndex() {
        return lastTickIndexRef.current;
      },
    }),
    [
      prevSimPosition,
      prevSimRotation,
      currSimPosition,
      currSimRotation,
      visualPosition,
      visualRotation,
      targetVisualPosition,
      visualLocalOffset,
      visualOffset,
      interpPosition,
      interpRotation,
      inverseInterpRotation,
      bankQuaternion,
      forwardAxis,
      finalRotation,
    ],
  );

  useLayoutEffect(() => {
    prevSimPosition.copy(entity.transform.position);
    currSimPosition.copy(entity.transform.position);
    visualPosition.copy(entity.transform.position);
    targetVisualPosition.copy(entity.transform.position);
    visualLocalOffset.set(0, 0, 0);
    visualOffset.set(0, 0, 0);
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
    const time = state?.time ?? 0;

    updateInterpolation(
      entity,
      interpolationState,
      smoothing,
      alpha,
      dt,
      time,
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
      // local position provided as visual offset (local-space)
      vRef.position.copy(interpolationState.visualOffset);
      // local rotation = interpRotation^-1 * finalRotation
      vRef.quaternion
        .copy(interpolationState.inverseInterpRotation)
        .multiply(interpolationState.finalRotation);
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
  time: number,
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

  state.interpPosition.copy(state.prevSimPosition).lerp(state.currSimPosition, alpha);
  state.interpRotation.copy(state.prevSimRotation).slerp(state.currSimRotation, alpha);
  state.inverseInterpRotation.copy(state.interpRotation).invert();

  const motion = entity.ship.motion;
  const visualCfg: MotionVisualConfig | undefined = motion.visual;
  const globalVisualEnabled = RENDERER_VISUAL_CONFIG.enableShipVisualSmoothing;
  const visualEnabled = visualCfg?.enabled ?? true;
  const smoothingEnabled = globalVisualEnabled && visualEnabled;

  state.targetVisualPosition.copy(state.interpPosition);
  state.visualLocalOffset.set(0, 0, 0);

  if (smoothingEnabled && visualCfg?.bob && visualCfg.bob.enabled !== false) {
    const baseAmp = Math.max(0, visualCfg.bob.baseAmp ?? 0);
    const freq = Math.max(0, visualCfg.bob.freq ?? 0);
    const speedScale = Math.max(0, visualCfg.bob.speedScale ?? 0);
    const maxAmp = Math.max(baseAmp, visualCfg.bob.maxAmp ?? baseAmp);
    if (freq > 0 && (baseAmp > 0 || speedScale > 0)) {
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

      if (amplitude > 1e-5) {
        const phase = time * freq * Math.PI * 2;
        const vertical = Math.sin(phase) * amplitude;
        const lateralSign = Math.sign(entity.ship.angularVelocity.y);
        const lateral = Math.cos(phase * 0.5) * amplitude * 0.35 * lateralSign * turnRatio;
        state.visualLocalOffset.set(lateral, vertical, 0);
        state.visualOffset.copy(state.visualLocalOffset).applyQuaternion(state.interpRotation);
        state.targetVisualPosition.add(state.visualOffset);
        state.visualOffset.set(0, 0, 0);
      }
    }
  }

  if (!smoothingEnabled) {
    state.visualPosition.copy(state.targetVisualPosition);
    state.visualRotation.copy(state.interpRotation);
    bankValueRef.current = 0;
    bankVelocityRef.current = 0;
  } else {
    const posAlpha = kToAlpha(visualCfg?.position?.k ?? smoothing.positionK, dt);

    if (posAlpha <= 0) {
      state.visualPosition.copy(state.targetVisualPosition);
    } else if (posAlpha >= 1) {
      state.visualPosition.copy(state.targetVisualPosition);
    } else {
      state.visualPosition.lerp(state.targetVisualPosition, MathUtils.clamp(posAlpha, 0, 1));
    }

    const rotAlpha = kToAlpha(visualCfg?.rotation?.k ?? smoothing.rotationK, dt);

    if (rotAlpha <= 0) {
      state.visualRotation.copy(state.interpRotation);
    } else if (rotAlpha >= 1) {
      state.visualRotation.copy(state.interpRotation);
    } else {
      state.visualRotation.slerp(state.interpRotation, MathUtils.clamp(rotAlpha, 0, 1));
    }

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
      if (bankAlpha <= 0) {
        bankValueRef.current = targetBankRad;
      } else if (bankAlpha >= 1) {
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
