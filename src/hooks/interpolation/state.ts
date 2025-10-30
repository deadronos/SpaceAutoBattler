import type { MutableRefObject } from 'react';
import { Quaternion, Vector3 } from 'three';
import type { ShipEntity } from '../../types/index.js';

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
  readonly bankValue: number;
  readonly lastTickIndex: number;
}

export function createInterpolationState(
  bankValueRef: MutableRefObject<number>,
  lastTickIndexRef: MutableRefObject<number>,
): InterpolationState {
  const state: Partial<InterpolationState> = {
    prevSimPosition: new Vector3(),
    prevSimRotation: new Quaternion(),
    currSimPosition: new Vector3(),
    currSimRotation: new Quaternion(),
    visualPosition: new Vector3(),
    visualRotation: new Quaternion(),
    targetVisualPosition: new Vector3(),
    visualLocalOffset: new Vector3(),
    visualOffset: new Vector3(),
    interpPosition: new Vector3(),
    interpRotation: new Quaternion(),
    inverseInterpRotation: new Quaternion(),
    bankQuaternion: new Quaternion(),
    forwardAxis: new Vector3(0, 0, 1),
    finalRotation: new Quaternion(),
  };

  Object.defineProperties(state, {
    bankValue: { get: () => bankValueRef.current },
    lastTickIndex: { get: () => lastTickIndexRef.current },
  });

  return state as InterpolationState;
}

export function resetInterpolationState(
  state: InterpolationState,
  entity: ShipEntity,
  lastTickIndex: number,
  bankValueRef: MutableRefObject<number>,
  bankVelocityRef: MutableRefObject<number>,
  lastTickIndexRef: MutableRefObject<number>,
): void {
  state.prevSimPosition.copy(entity.transform.position);
  state.currSimPosition.copy(entity.transform.position);
  state.visualPosition.copy(entity.transform.position);
  state.targetVisualPosition.copy(entity.transform.position);
  state.visualLocalOffset.set(0, 0, 0);
  state.visualOffset.set(0, 0, 0);
  state.prevSimRotation.copy(entity.transform.rotation);
  state.currSimRotation.copy(entity.transform.rotation);
  state.visualRotation.copy(entity.transform.rotation);
  state.interpPosition.copy(entity.transform.position);
  state.interpRotation.copy(entity.transform.rotation);
  state.inverseInterpRotation.copy(entity.transform.rotation).invert();
  state.finalRotation.copy(entity.transform.rotation);
  bankValueRef.current = 0;
  bankVelocityRef.current = 0;
  lastTickIndexRef.current = lastTickIndex;
}
