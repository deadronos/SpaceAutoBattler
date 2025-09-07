import type { GameState } from '../types/index.js';
import { CameraConfig } from '../config/cameraConfig.js';
import { resetToCinematicView, updateCinematicCamera } from './cinematicCamera.js';

export function setupCameraControls(state: GameState, canvas: HTMLCanvasElement): void {
  if (!state.renderer) return;

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

    const sensitivity = CameraConfig.controls.mouseSensitivity;
    const deltaX = (e.clientX - lastMouseX) * sensitivity;
    const deltaY = (e.clientY - lastMouseY) * sensitivity;

    state.renderer.cameraRotation.y -= deltaX;
    state.renderer.cameraRotation.x -= deltaY;

    const pitchLimit = (Math.PI / 2) - 0.001;
    state.renderer.cameraRotation.x = Math.max(-pitchLimit, Math.min(pitchLimit, state.renderer.cameraRotation.x));
    if (state.renderer.cameraRotation.y > Math.PI) state.renderer.cameraRotation.y -= Math.PI * 2;
    if (state.renderer.cameraRotation.y < -Math.PI) state.renderer.cameraRotation.y += Math.PI * 2;

    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
  });

  canvas.addEventListener('wheel', (e) => {
    if (!state.renderer) return;
    e.preventDefault();

    const zoomSpeed = CameraConfig.controls.zoomSpeed;
    const zoomDirection = e.deltaY > 0 ? 1 : -1;
    state.renderer.cameraDistance += zoomDirection * zoomSpeed;
    state.renderer.cameraDistance = Math.max(
      CameraConfig.cinematic.minDistance,
      Math.min(CameraConfig.cinematic.maxDistance, state.renderer.cameraDistance)
    );
  });

  window.addEventListener('keydown', (e) => {
    if (!state.renderer) return;
    const moveSpeed = CameraConfig.controls.moveSpeed;
    switch (e.key) {
      case 'w':
      case 'ArrowUp':
        state.renderer.cameraTarget.z -= moveSpeed;
        break;
      case 's':
      case 'ArrowDown':
        state.renderer.cameraTarget.z += moveSpeed;
        break;
      case 'a':
      case 'ArrowLeft':
        state.renderer.cameraTarget.x -= moveSpeed;
        break;
      case 'd':
      case 'ArrowRight':
        state.renderer.cameraTarget.x += moveSpeed;
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
    requestAnimationFrame(cameraLoop);
  }
  requestAnimationFrame(cameraLoop);
}
