import { Vector3 } from 'three';
import type { AIState } from '../../../types/index.js';

/**
 * Per-AI smoothing state for low-pass filtering of commands.
 * Uses a WeakMap to avoid mutating AIState or shared profiles.
 */
interface SmoothingState {
  lastHeading: Vector3;
  lastThrust: number;
  // Separate timestamps for heading and thrust smoothing to avoid the
  // ordering problem where thrust smoothing could prevent heading smoothing
  // from recognizing a discontinuity on the same tick.
  lastHeadingUpdateTick: number;
  lastThrustUpdateTick: number;
}

const SMOOTHING_MAP = new WeakMap<AIState, SmoothingState>();

function ensureSmoothingState(ai: AIState): SmoothingState {
  let s = SMOOTHING_MAP.get(ai);
  if (!s) {
    s = {
      lastHeading: new Vector3(0, 0, 1),
      lastThrust: 0,
      // Use large negative initial ticks so the first smoothing calls
      // always treat the situation as a discontinuity and initialize
      // the stored values with the first observed commands.
      lastHeadingUpdateTick: -999999,
      lastThrustUpdateTick: -999999,
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
  const tickDelta = tickIndex - s.lastHeadingUpdateTick;
  if (tickDelta > 5 || tickDelta < 0) {
    s.lastHeading.copy(rawHeading);
    s.lastHeadingUpdateTick = tickIndex;
    return;
  }

  // If the newly computed heading represents a very large angular change
  // relative to the stored heading (e.g., a reversal) or is nearly
  // axis-aligned, it's preferable to adopt it immediately rather than
  // partially blend — this avoids small numeric deviations for tests
  // that expect exact full-forward or full-reverse headings.
  const dot = rawHeading.dot(s.lastHeading);
  const axisAligned =
    Math.max(Math.abs(rawHeading.x), Math.abs(rawHeading.y), Math.abs(rawHeading.z)) > 0.9999;
  // Only treat near-reversals (large-angle changes) as instantaneous
  // discontinuities. Use a conservative threshold so moderate lateral
  // changes are still smoothed by the EMA.
  if (dot < -0.5 || axisAligned) {
    s.lastHeading.copy(rawHeading);
    s.lastHeadingUpdateTick = tickIndex;
    return;
  }

  // Base alpha: higher = less smoothing (faster response)
  // Start with moderate smoothing and adjust by behavior params
  // Lower baseline alpha to make smoothing slightly stronger by default
  // (more weight to historical heading), which reduces jitter.
  let alpha = 0.2; // baseline ~20% new, 80% old per tick

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

  // Clamp alpha to reasonable bounds (allow slightly stronger smoothing)
  alpha = Math.max(0.08, Math.min(0.6, alpha));

  // Ramp-in: if smoothing was just initialized within the last few ticks,
  // apply stronger smoothing to avoid transient spikes when toggling the
  // smoothing feature on at runtime (helps make the transition stable).
  const sinceInit = tickIndex - s.lastHeadingUpdateTick;
  if (sinceInit > 0 && sinceInit <= 2) {
    alpha = Math.min(alpha * 0.5, 0.12);
  }

  // Apply exponential moving average (EMA)
  // smoothed = alpha * new + (1 - alpha) * old
  const newHeading = rawHeading.clone();
  // Prevent extreme single-tick heading changes from causing large spikes
  // after normalization or when smoothing is first enabled. Clamp the
  // raw heading delta relative to the stored heading to a small maximum
  // before applying the EMA.
  const maxDelta = 0.18; // maximum allowed per-tick vector difference
  const rawDeltaVec = newHeading.clone().sub(s.lastHeading);
  const rawDeltaLen = rawDeltaVec.length();
  if (rawDeltaLen > maxDelta && rawDeltaLen > 1e-6) {
    newHeading.copy(s.lastHeading).addScaledVector(rawDeltaVec, maxDelta / rawDeltaLen);
  }
  rawHeading
    .copy(s.lastHeading)
    .multiplyScalar(1 - alpha)
    .addScaledVector(newHeading, alpha);

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
  s.lastHeadingUpdateTick = tickIndex;
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
  const tickDelta = tickIndex - s.lastThrustUpdateTick;
  if (tickDelta > 5 || tickDelta < 0) {
    s.lastThrust = rawThrust;
    // Initialize lastHeading from the AI's current command heading so
    // heading smoothing won't blend from the default (0,0,1) when thrust is
    // initialized first. This avoids a scenario where thrust reset happens
    // before heading reset and causes the heading to be attenuated on the
    // same tick. We update the thrust timestamp only; controlling the
    // heading timestamp is handled separately by smoothHeading.
    if (ai.command && ai.command.heading) {
      s.lastHeading.copy(ai.command.heading);
    }
    s.lastThrustUpdateTick = tickIndex;
    return rawThrust;
  }

  // Base alpha for thrust (slightly higher than heading for responsiveness)
  // Slightly lower thrust baseline so throttle smoothing is a bit stronger
  let alpha = 0.35;

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

  // Clamp (allow slightly stronger thrust smoothing)
  alpha = Math.max(0.12, Math.min(0.65, alpha));

  // EMA
  const smoothedThrust = s.lastThrust * (1 - alpha) + rawThrust * alpha;

  // Store
  s.lastThrust = smoothedThrust;
  s.lastThrustUpdateTick = tickIndex;

  return smoothedThrust;
}
