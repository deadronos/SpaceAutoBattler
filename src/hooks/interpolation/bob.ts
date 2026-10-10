import { MathUtils } from 'three';
import type { MotionVisualConfig } from '../../types/gameplay.js';
import type { ShipEntity } from '../../types/index.js';
import type { InterpolationState } from './state.js';

/**
 * Computes the visual target position for a ship, including the optional
 * speed/turn-dependent bob offset.
 */
export function updateVisualTargets(
  state: InterpolationState,
  entity: ShipEntity,
  visualCfg: MotionVisualConfig | undefined,
  bobEnabled: boolean,
  time: number,
): void {
  state.targetVisualPosition.copy(state.interpPosition);
  state.visualLocalOffset.set(0, 0, 0);

  if (!bobEnabled || !visualCfg?.bob || visualCfg.bob.enabled === false) {
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
