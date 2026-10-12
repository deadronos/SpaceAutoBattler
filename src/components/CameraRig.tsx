import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { Camera, PerspectiveCamera } from 'three';
import { SimplexNoise } from 'three/examples/jsm/math/SimplexNoise.js';
import { useOptionalGameState } from '../app/context.js';
import { useUiStore } from '../app/uiStore.js';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion.js';
import {
  advanceExplosionCursor,
  createTraumaState,
  maxExplosionId,
  traumaAmplitude,
  updateTrauma,
} from '../renderer/cameraRig/shake.js';

type DebugWindow = Window & {
  __copilot_forceCameraTrauma?: number;
  __copilot_forceCameraFollowId?: number;
};

/** Peak shake rotation in radians (bounded to stay readable, not nauseating). */
const SHAKE_MAX_PITCH = 0.025;
const SHAKE_MAX_YAW = 0.03;
const SHAKE_MAX_ROLL = 0.02;
/** Noise sampling frequencies (per second of sim time). */
const SHAKE_PITCH_FREQ = 7;
const SHAKE_YAW_FREQ = 6;
const SHAKE_ROLL_FREQ = 9;

/**
 * Exponential smoothing rate for the opt-in ship follow retarget (per second).
 * The frame-rate-independent factor is `1 - exp(-k * dt)`.
 */
const FOLLOW_SMOOTHING_K = 6;
/**
 * Follow look-ahead distance along the ship's velocity direction (world
 * units). Zero tracks the hull centre exactly; a small positive value frames
 * the ship slightly ahead of its motion. Flagged for human tuning.
 */
const FOLLOW_LEAD = 0;

interface BasePose {
  x: number;
  y: number;
  z: number;
}

/** Minimal shape of the OrbitControls `change` event source used here. */
interface ControlsLike {
  addEventListener: (type: 'change', listener: () => void) => void;
  removeEventListener: (type: 'change', listener: () => void) => void;
}

/** Minimal shape of the OrbitControls instance used for follow retargeting. */
interface FollowControlsLike {
  target?: { x: number; y: number; z: number };
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

/**
 * Builds a `SimplexNoise` instance whose permutation table is fixed, so the
 * shake is a pure function of sim time. The default `SimplexNoise` constructor
 * seeds its table from `Math.random`, which would make the effect
 * non-reproducible; this deterministic xorshift32 generator avoids that.
 *
 * @returns {SimplexNoise} A deterministically seeded noise sampler.
 */
function createDeterministicNoise(): SimplexNoise {
  let state = 0x1a2b3c4d;
  const generator = {
    random: (): number => {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      return (state >>> 0) / 0x100000000;
    },
  };
  return new SimplexNoise(generator);
}

function readFov(camera: Camera): number | null {
  const perspective = camera as PerspectiveCamera;
  return typeof perspective.fov === 'number' ? perspective.fov : null;
}

function captureRotation(camera: Camera): BasePose {
  return { x: camera.rotation.x, y: camera.rotation.y, z: camera.rotation.z };
}

/** Restores the captured base rotation/FOV exactly (no shake). */
function restoreBasePose(camera: Camera, base: BasePose | null, baseFov: number | null): void {
  if (base) {
    camera.rotation.set(base.x, base.y, base.z);
  }
  const perspective = camera as PerspectiveCamera;
  if (baseFov !== null && typeof perspective.fov === 'number' && perspective.fov !== baseFov) {
    perspective.fov = baseFov;
    perspective.updateProjectionMatrix();
  }
}

/** Applies the FOV kick on top of the base FOV, updating only on change. */
function applyFov(camera: Camera, baseFov: number | null, fovKick: number): void {
  const perspective = camera as PerspectiveCamera;
  if (baseFov === null || typeof perspective.fov !== 'number') return;
  const targetFov = baseFov + fovKick;
  if (perspective.fov !== targetFov) {
    perspective.fov = targetFov;
    perspective.updateProjectionMatrix();
  }
}

/**
 * Render-only camera rig: deterministic trauma-based explosion shake plus a
 * small FOV kick, plus an opt-in smooth follow of a click-selected ship.
 * Reads `state.time`, `state.explosions`, and the selected ship's transform
 * read-only and never writes `GameState`; the shake noise is a pure function of
 * sim time (no `Math.random`). The camera rotation offset is layered on top of
 * the base pose captured from the OrbitControls `change` event, so it never
 * fights the controls (the proven drei `CameraShake` pattern). Follow moves both
 * `controls.target` and `camera.position` by the same delta, preserving the
 * user's orbit distance/angle, and is suppressed by reduced motion.
 *
 * @returns {null} This component renders no DOM.
 */
export function CameraRig(): null {
  const state = useOptionalGameState();
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls);
  const shakeEnabled = useUiStore((s) => s.cameraShakeEnabled);
  const followEnabled = useUiStore((s) => s.cameraFollowEnabled);
  const selectedShipId = useUiStore((s) => s.selectedShipId);
  const reducedMotion = usePrefersReducedMotion();

  const traumaRef = useRef(createTraumaState());
  const noiseRef = useRef<SimplexNoise | null>(null);
  if (noiseRef.current === null) {
    noiseRef.current = createDeterministicNoise();
  }

  const baseRotationRef = useRef<BasePose | null>(null);
  const baseFovRef = useRef<number | null>(null);
  const lastSeenExplosionIdRef = useRef(0);
  const lastSimTimeRef = useRef<number | null>(null);
  // Debug override for deterministic visual capture, mirroring
  // `__copilot_forceAmbientOcclusion`: hold a constant trauma and skip
  // explosion-driven accrual so screenshots are reproducible. Read at mount.
  const forcedTraumaRef = useRef<number | undefined>(
    typeof window !== 'undefined' ? (window as DebugWindow).__copilot_forceCameraTrauma : undefined,
  );
  // Debug override for deterministic visual capture of the follow camera:
  // when set, follow that ship id regardless of the UI toggle/selection.
  const forcedFollowIdRef = useRef<number | undefined>(
    typeof window !== 'undefined'
      ? (window as DebugWindow).__copilot_forceCameraFollowId
      : undefined,
  );
  // Smoothed absolute follow target (world space). `null` means "not tracking";
  // re-adopts the current orbit target on the next active frame so toggling the
  // feature on/off never yanks the camera.
  const followTargetRef = useRef<BasePose | null>(null);

  useEffect(() => {
    if (baseRotationRef.current === null) {
      baseRotationRef.current = captureRotation(camera);
    }
    if (baseFovRef.current === null) {
      baseFovRef.current = readFov(camera);
    }
    if (!controls) return;

    const controlsLike = controls as unknown as ControlsLike;
    // The controls call `lookAt` before dispatching `change`, so this captures
    // the un-shaken orbit pose; shake is applied after, in the frame callback.
    const onChange = (): void => {
      baseRotationRef.current = captureRotation(camera);
    };
    controlsLike.addEventListener('change', onChange);
    return () => {
      controlsLike.removeEventListener('change', onChange);
    };
  }, [controls, camera]);

  useFrame(({ camera: frameCamera }, delta) => {
    if (!state) return;

    if (baseRotationRef.current === null) {
      baseRotationRef.current = captureRotation(frameCamera);
    }
    if (baseFovRef.current === null) {
      baseFovRef.current = readFov(frameCamera);
    }

    // Opt-in ship follow (render-only): move `controls.target` and
    // `camera.position` by the same delta so the user's orbit distance/angle is
    // preserved. Off / reduced-motion / no ship is a no-op that leaves the
    // camera exactly where the user left it.
    const followControls = controls as unknown as FollowControlsLike | null;
    const followShipId = forcedFollowIdRef.current ?? selectedShipId;
    const followActive =
      !reducedMotion &&
      followControls?.target !== undefined &&
      followShipId !== null &&
      (followEnabled || forcedFollowIdRef.current !== undefined);
    if (!followActive || !followControls?.target) {
      followTargetRef.current = null;
    } else {
      const ship = state.shipById?.get(followShipId);
      if (!ship) {
        // Ship no longer exists: clear the selection and leave the camera put.
        followTargetRef.current = null;
        if (forcedFollowIdRef.current === undefined) {
          useUiStore.getState().selectShip(null);
        }
      } else {
        const position = ship.transform.position;
        let desiredX = position.x;
        let desiredY = position.y;
        let desiredZ = position.z;
        const velocity = ship.ship?.velocity;
        if (FOLLOW_LEAD !== 0 && velocity) {
          desiredX += velocity.x * FOLLOW_LEAD;
          desiredY += velocity.y * FOLLOW_LEAD;
          desiredZ += velocity.z * FOLLOW_LEAD;
        }

        const orbitTarget = followControls.target;
        let smoothed = followTargetRef.current;
        if (smoothed === null) {
          // Start from the user's current orbit target so the retarget glides
          // instead of jumping when follow is toggled on.
          smoothed = { x: orbitTarget.x, y: orbitTarget.y, z: orbitTarget.z };
          followTargetRef.current = smoothed;
        }
        const dt = Math.max(0, delta);
        const alpha = 1 - Math.exp(-FOLLOW_SMOOTHING_K * dt);
        smoothed.x += (desiredX - smoothed.x) * alpha;
        smoothed.y += (desiredY - smoothed.y) * alpha;
        smoothed.z += (desiredZ - smoothed.z) * alpha;

        const dx = smoothed.x - orbitTarget.x;
        const dy = smoothed.y - orbitTarget.y;
        const dz = smoothed.z - orbitTarget.z;
        orbitTarget.x += dx;
        orbitTarget.y += dy;
        orbitTarget.z += dz;
        frameCamera.position.x += dx;
        frameCamera.position.y += dy;
        frameCamera.position.z += dz;
      }
    }

    const s = traumaRef.current;
    const forced = forcedTraumaRef.current;
    const active = shakeEnabled && !reducedMotion;
    const base = baseRotationRef.current;
    const baseFov = baseFovRef.current;

    // Disabled or reduced motion: drop pending trauma and restore the exact
    // base pose so the camera is bit-identical to the no-rig build.
    if (!active) {
      s.trauma = 0;
      s.fovKick = 0;
      lastSeenExplosionIdRef.current = maxExplosionId(
        state.explosions,
        lastSeenExplosionIdRef.current,
      );
      lastSimTimeRef.current = state.time;
      restoreBasePose(frameCamera, base, baseFov);
      return;
    }

    const previousTime = lastSimTimeRef.current;
    if (previousTime === null) {
      // First active frame: adopt the current pose/cursor without a burst of
      // trauma from explosions that predate the rig mount.
      lastSeenExplosionIdRef.current = maxExplosionId(
        state.explosions,
        lastSeenExplosionIdRef.current,
      );
      lastSimTimeRef.current = state.time;
      restoreBasePose(frameCamera, base, baseFov);
      return;
    }

    // Advance the model using sim-time delta so shake decays with the sim and
    // freezes when paused.
    const simDt = Math.max(0, state.time - previousTime);
    lastSimTimeRef.current = state.time;

    if (forced === undefined) {
      lastSeenExplosionIdRef.current = advanceExplosionCursor(
        state.explosions,
        lastSeenExplosionIdRef.current,
        s,
      );
      updateTrauma(s, simDt);
    } else {
      lastSeenExplosionIdRef.current = maxExplosionId(
        state.explosions,
        lastSeenExplosionIdRef.current,
      );
      s.trauma = clamp01(forced);
      s.fovKick = 0;
    }

    const amplitude = traumaAmplitude(s.trauma);
    if (amplitude === 0 && s.fovKick === 0) {
      restoreBasePose(frameCamera, base, baseFov);
      return;
    }

    const noise = noiseRef.current;
    if (base && noise) {
      const time = state.time;
      const pitch = amplitude * SHAKE_MAX_PITCH * noise.noise(time * SHAKE_PITCH_FREQ, 1);
      const yaw = amplitude * SHAKE_MAX_YAW * noise.noise(time * SHAKE_YAW_FREQ, 2);
      const roll = amplitude * SHAKE_MAX_ROLL * noise.noise(time * SHAKE_ROLL_FREQ, 3);
      frameCamera.rotation.set(base.x + pitch, base.y + yaw, base.z + roll);
    }

    applyFov(frameCamera, baseFov, s.fovKick);
  });

  return null;
}

export default CameraRig;
