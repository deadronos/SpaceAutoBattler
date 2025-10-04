import { Vector3 } from 'three';
import type { AIState } from '../../../types/index.js';

/**
 * Per-AI smoothing state for low-pass filtering of commands.
 * Uses a WeakMap to avoid mutating AIState or shared profiles.
 */
interface SmoothingState {
  lastHeading: Vector3;
  lastThrust: number;
  lastUpdateTick: number;
}

const SMOOTHING_MAP = new WeakMap<AIState, SmoothingState>();

function ensureSmoothingState(ai: AIState): SmoothingState {
  let s = SMOOTHING_MAP.get(ai);
  if (!s) {
    s = {
      lastHeading: new Vector3(0, 0, 1),
      lastThrust: 0,
      lastUpdateTick: 0,
    };
    SMOOTHING_MAP.set(ai, s);
  }
  return s;
}

/**
 * Apply exponential moving average (low-pass filter) to commanded heading.
 * 
 * Purpose:
 * - Reduces high-frequency jitter and sharp direction changes that can cause
 *   steering oscillation or make motion look robotic.
 * - The smoothing factor (alpha) controls the blend: lower alpha = more smoothing
 *   but slower response; higher alpha = faster response but less damping.
 * 
 * Behavior:
 * - Alpha is scaled by patience (more patient ships get smoother commands) and
 *   by aggression (aggressive ships get snappier commands).
 * - Heavy ships (destroyer/carrier) get additional smoothing to reduce their
 *   tendency to overshoot due to high inertia.
 * 
 * @param ai - AIState for this ship (used to store smoothing history)
 * @param rawHeading - The newly computed heading direction (will be modified in-place)
 * @param patience - Patience value from profile (0..1)
 * @param aggression - Aggression value from profile (0..1)
 * @param hull - Ship hull type for mass-based smoothing adjustment
 * @param tickIndex - Current tick for detecting tick jumps
 */
export function smoothHeading(
  ai: AIState,
  rawHeading: Vector3,
  patience: number,
  aggression: number,
  hull: string,
  tickIndex: number,
): void {
  const s = ensureSmoothingState(ai);

  // Detect tick discontinuity (e.g., first call or time jump) and reset
  const tickDelta = tickIndex - s.lastUpdateTick;
  if (tickDelta > 5 || tickDelta < 0) {
    s.lastHeading.copy(rawHeading);
    s.lastUpdateTick = tickIndex;
    return;
  }

  // Base alpha: higher = less smoothing (faster response)
  // Start with moderate smoothing and adjust by behavior params
  let alpha = 0.35; // baseline ~35% new, 65% old per tick

  // Patience adjustment: more patient → more smoothing (lower alpha)
  const patienceFactor = 1 - Math.min(1, patience) * 0.3; // reduce alpha up to 30%
  alpha *= patienceFactor;

  // Aggression adjustment: more aggressive → less smoothing (higher alpha)
  const aggressionFactor = 1 + Math.min(1, aggression) * 0.2; // increase alpha up to 20%
  alpha *= aggressionFactor;

  // Hull mass adjustment: heavy ships need more smoothing to avoid overshoot
  if (hull === 'destroyer' || hull === 'carrier') {
    alpha *= 0.7; // 30% more smoothing for capitals
  } else if (hull === 'frigate' || hull === 'corvette') {
    alpha *= 0.85; // 15% more smoothing for medium hulls
  }
  // fighters get no additional smoothing (already nimble)

  // Clamp alpha to reasonable bounds
  alpha = Math.max(0.1, Math.min(0.6, alpha));

  // Apply exponential moving average (EMA)
  // smoothed = alpha * new + (1 - alpha) * old
  const newHeading = rawHeading.clone();
  rawHeading.copy(s.lastHeading).multiplyScalar(1 - alpha).addScaledVector(newHeading, alpha);

  // Renormalize to ensure heading remains unit-length
  const len = rawHeading.length();
  if (len > 1e-6) {
    rawHeading.divideScalar(len);
  } else {
    // Degenerate case: keep last heading
    rawHeading.copy(s.lastHeading);
  }

  // Store for next frame
  s.lastHeading.copy(rawHeading);
  s.lastUpdateTick = tickIndex;
}

/**
 * Apply exponential moving average (low-pass filter) to commanded thrust.
 * 
 * Purpose:
 * - Reduces abrupt throttle changes that cause acceleration spikes and overshoot.
 * - Smooths approach/retreat oscillations near desiredRange boundaries.
 * 
 * Behavior:
 * - Similar alpha scaling as heading smoothing: patience increases smoothing,
 *   aggression reduces it, and hull mass adds smoothing for heavy ships.
 * 
 * @param ai - AIState for this ship
 * @param rawThrust - The newly computed thrust value (0..1, will be modified)
 * @param patience - Patience value from profile (0..1)
 * @param aggression - Aggression value from profile (0..1)
 * @param hull - Ship hull type
 * @param tickIndex - Current tick
 * @returns Smoothed thrust value
 */
export function smoothThrust(
  ai: AIState,
  rawThrust: number,
  patience: number,
  aggression: number,
  hull: string,
  tickIndex: number,
): number {
  const s = ensureSmoothingState(ai);

  // Detect tick discontinuity and reset
  const tickDelta = tickIndex - s.lastUpdateTick;
  if (tickDelta > 5 || tickDelta < 0) {
    s.lastThrust = rawThrust;
    s.lastUpdateTick = tickIndex;
    return rawThrust;
  }

  // Base alpha for thrust (slightly higher than heading for responsiveness)
  let alpha = 0.4;

  // Patience: more patient → smoother throttle
  const patienceFactor = 1 - Math.min(1, patience) * 0.25;
  alpha *= patienceFactor;

  // Aggression: aggressive ships react faster
  const aggressionFactor = 1 + Math.min(1, aggression) * 0.15;
  alpha *= aggressionFactor;

  // Hull mass: capitals need smoother throttle to avoid momentum issues
  if (hull === 'destroyer' || hull === 'carrier') {
    alpha *= 0.75;
  } else if (hull === 'frigate' || hull === 'corvette') {
    alpha *= 0.9;
  }

  // Clamp
  alpha = Math.max(0.15, Math.min(0.65, alpha));

  // EMA
  const smoothedThrust = s.lastThrust * (1 - alpha) + rawThrust * alpha;

  // Store
  s.lastThrust = smoothedThrust;
  s.lastUpdateTick = tickIndex;

  return smoothedThrust;
}
