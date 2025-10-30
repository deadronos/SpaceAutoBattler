import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import type { Group } from 'three';
import type { ShipEntity } from '../types/index.js';
import { useOptionalGameState } from '../game/context.js';
import { createSmoothingConfig, type SmoothingConfig } from './interpolation/config.js';
import {
  createInterpolationState,
  resetInterpolationState,
  type InterpolationState,
} from './interpolation/state.js';
import { updateInterpolation } from './interpolation/updateInterpolation.js';

export { kToAlpha } from './interpolation/math.js';
export type { InterpolationState } from './interpolation/state.js';
export type { SmoothingConfig } from './interpolation/config.js';
export { updateInterpolation };

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

  const smoothing = useMemo(() => createSmoothingConfig(entity.ship.motion), [entity.ship.motion]);

  const bankValueRef = useRef(0);
  const bankVelocityRef = useRef(0);
  const lastTickIndexRef = useRef(-1);

  const interpolationState = useMemo(
    () => createInterpolationState(bankValueRef, lastTickIndexRef),
    [],
  );

  useLayoutEffect(() => {
    resetInterpolationState(
      interpolationState,
      entity,
      lastTickIndex,
      bankValueRef,
      bankVelocityRef,
      lastTickIndexRef,
    );
  }, [
    entity.id,
    lastTickIndex,
    interpolationState,
    bankValueRef,
    bankVelocityRef,
    lastTickIndexRef,
  ]);

  useFrame((_, dt) => {
    const root = rootRef.current;
    if (!root) return;

    const sim = state?.simulation;
    const tickIndex = sim?.lastTickIndex ?? lastTickIndexRef.current;
    const alpha = sim ? Math.min(Math.max(sim.alpha, 0), 1) : 1;
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

    root.position.copy(interpolationState.interpPosition);
    root.quaternion.copy(interpolationState.interpRotation);
    root.scale.setScalar(entity.transform.scale);

    if (visualRef?.current) {
      const visual = visualRef.current;
      visual.position.copy(interpolationState.visualOffset);
      visual.quaternion
        .copy(interpolationState.inverseInterpRotation)
        .multiply(interpolationState.finalRotation);
      visual.scale.setScalar(entity.transform.scale);
    }
  });

  return {
    state: interpolationState,
    smoothing,
  };
}
