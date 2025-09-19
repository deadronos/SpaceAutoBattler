import type { GameState } from '../types/index.js';
import { CameraConfig } from '../config/cameraConfig.js';
import { resetToCinematicView, updateCinematicCamera } from './cinematicCamera.js';
// CameraManager helpers are accessed via the renderer handles (get/set methods)

export function setupCameraControls(state: GameState, canvas: HTMLCanvasElement): void {
  // If renderer or canvas are not available (tests / headless), skip wiring
  if (!state.renderer || !canvas) return;

  let isMouseDown = false;
  let lastMouseX = 0;
  let lastMouseY = 0;
  let isCinematicMode = false;

  canvas.addEventListener('mousedown', (e) => {
    isMouseDown = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
  });

  canvas.addEventListener('mouseup', () => {
    isMouseDown = false;
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!isMouseDown || !state.renderer) return;

    const rh = state.renderer as unknown as
      | {
          getCameraRotation?: () => { x: number; y: number; z: number };
          setCameraRotation?: (r: { x?: number; y?: number; z?: number }) => void;
        }
      | undefined;
    const getRotation = rh?.getCameraRotation?.bind(rh);
    const setRotation = rh?.setCameraRotation?.bind(rh);

    const sensitivity = CameraConfig.controls.mouseSensitivity;
    const deltaX = (e.clientX - lastMouseX) * sensitivity;
    const deltaY = (e.clientY - lastMouseY) * sensitivity;

    if (getRotation && setRotation) {
      const rot = getRotation();
      const newX = rot.x - deltaY;
      const newY = rot.y - deltaX;
      // Clamp pitch and normalize yaw
      const pitchLimit = Math.PI / 2 - 0.001;
      const clampedX = Math.max(-pitchLimit, Math.min(pitchLimit, newX));
      let normY = newY;
      if (normY > Math.PI) normY -= Math.PI * 2;
      if (normY < -Math.PI) normY += Math.PI * 2;
      setRotation({ x: clampedX, y: normY });
    }

    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
  });

  canvas.addEventListener('wheel', (e) => {
    if (!state.renderer) return;
    e.preventDefault();

    const zoomSpeed = CameraConfig.controls.zoomSpeed;
    const zoomDirection = e.deltaY > 0 ? 1 : -1;
    // Compute camState per-handler to avoid referencing out-of-scope variable
    const rhWheel = state.renderer as unknown as
      | { getCameraDistance?: () => number; setCameraDistance?: (d: number) => void }
      | undefined;
    const getDistance = rhWheel?.getCameraDistance?.bind(rhWheel);
    const setDistance = rhWheel?.setCameraDistance?.bind(rhWheel);
    if (getDistance && setDistance) {
      const current = getDistance();
      const newDist = Math.max(
        CameraConfig.cinematic.minDistance,
        Math.min(CameraConfig.cinematic.maxDistance, current + zoomDirection * zoomSpeed),
      );
      setDistance(newDist);
    }
  });

  window.addEventListener('keydown', (e) => {
    if (!state.renderer) return;
    const moveSpeed = CameraConfig.controls.moveSpeed;
    const rh = state.renderer as unknown as
      | {
          getCameraTarget?: () => { x: number; y: number; z: number };
          setCameraTarget?: (t: { x?: number; y?: number; z?: number }) => void;
        }
      | undefined;
    const getTarget = rh?.getCameraTarget?.bind(rh);
    const setTarget = rh?.setCameraTarget?.bind(rh);
    if (!getTarget || !setTarget) return;
    switch (e.key) {
      // WASD: forward/left/back/right mapped to X/Z axes used by renderer
      case 'w':
      case 'ArrowUp':
        {
          const t = getTarget();
          // move forward along -X
          setTarget({ x: t.x - moveSpeed, y: t.y, z: t.z });
        }
        break;
      case 's':
      case 'ArrowDown':
        {
          const t = getTarget();
          // move back along +X
          setTarget({ x: t.x + moveSpeed, y: t.y, z: t.z });
        }
        break;
      case 'a':
      case 'ArrowLeft':
        {
          const t = getTarget();
          // move left: renderer uses inverted Z, so add to move left
          setTarget({ x: t.x, y: t.y, z: t.z + moveSpeed });
        }
        break;
      case 'd':
      case 'ArrowRight':
        {
          const t = getTarget();
          // move right: renderer uses inverted Z, so subtract to move right
          setTarget({ x: t.x, y: t.y, z: t.z - moveSpeed });
        }
        break;
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'c') {
      isCinematicMode = !isCinematicMode;
      if (isCinematicMode) {
        resetToCinematicView(state);
      }
    }
  });

  function cameraLoop() {
    if (isCinematicMode) {
      const dt = 1 / 60;
      updateCinematicCamera(state, dt);
    }
    // In Node/Vitest, requestAnimationFrame may be undefined. Avoid scheduling
    // the loop in that environment to prevent unhandled exceptions after tests.
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(cameraLoop);
    }
  }
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(cameraLoop);
  }
}
