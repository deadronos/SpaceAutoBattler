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
};

/** Peak shake rotation in radians (bounded to stay readable, not nauseating). */
const SHAKE_MAX_PITCH = 0.025;
const SHAKE_MAX_YAW = 0.03;
const SHAKE_MAX_ROLL = 0.02;
/** Noise sampling frequencies (per second of sim time). */
const SHAKE_PITCH_FREQ = 7;
const SHAKE_YAW_FREQ = 6;
const SHAKE_ROLL_FREQ = 9;

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
 * small FOV kick. Reads `state.time` and `state.explosions` read-only and never
 * writes `GameState`; the shake noise is a pure function of sim time (no
 * `Math.random`). The camera rotation offset is layered on top of the base pose
 * captured from the OrbitControls `change` event, so it never fights the
 * controls (the proven drei `CameraShake` pattern).
 *
 * @returns {null} This component renders no DOM.
 */
export function CameraRig(): null {
  const state = useOptionalGameState();
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls);
  const shakeEnabled = useUiStore((s) => s.cameraShakeEnabled);
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

  useFrame(({ camera: frameCamera }) => {
    if (!state) return;

    if (baseRotationRef.current === null) {
      baseRotationRef.current = captureRotation(frameCamera);
    }
    if (baseFovRef.current === null) {
      baseFovRef.current = readFov(frameCamera);
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
