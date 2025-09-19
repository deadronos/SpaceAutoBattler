import { describe, it, expect, beforeEach } from 'vitest';
import { setupCameraControls } from '../../src/renderer/cameraControls.js';
import { CameraConfig } from '../../src/config/cameraConfig.js';
import type { GameState } from '../../src/types/index.js';

// Lightweight fake renderer implementing only the get/set camera target API used by controls
class FakeRenderer {
  target = { x: 0, y: 0, z: 0 };
  getCameraTarget() {
    return { ...this.target };
  }
  setCameraTarget(t: { x?: number; y?: number; z?: number }) {
    if (typeof t.x === 'number') this.target.x = t.x;
    if (typeof t.y === 'number') this.target.y = t.y;
    if (typeof t.z === 'number') this.target.z = t.z;
  }
}

describe('cameraControls WASD mapping', () => {
  let state: Partial<GameState> & { renderer?: any };
  let canvas: HTMLCanvasElement;
  let fakeR: FakeRenderer;

  beforeEach(() => {
    fakeR = new FakeRenderer();
    state = { renderer: fakeR } as any;

    // Minimal DOM canvas element for event dispatching
    canvas = document.createElement('canvas');
    document.body.appendChild(canvas);

    // Ensure camera controls are attached
    setupCameraControls(state as GameState, canvas);
  });

  it('moves forward with W and back with S along X axis', () => {
    const move = CameraConfig.controls.moveSpeed;
    const initial = fakeR.getCameraTarget();

    // Dispatch W key
    const w = new KeyboardEvent('keydown', { key: 'w' });
    window.dispatchEvent(w);
    expect(fakeR.getCameraTarget().x).toBe(initial.x - move);

    // Dispatch S key
    const s = new KeyboardEvent('keydown', { key: 's' });
    window.dispatchEvent(s);
    // after S we should be back to initial.x (moved -move then +move)
    expect(fakeR.getCameraTarget().x).toBe(initial.x);
  });

  it('moves left with A and right with D along Z axis (signed correctly)', () => {
    const move = CameraConfig.controls.moveSpeed;
    const initial = fakeR.getCameraTarget();

    // A should move left (z increases or decreases depending on renderer convention).
    const a = new KeyboardEvent('keydown', { key: 'a' });
    window.dispatchEvent(a);
    // Based on src/renderer/cameraControls.ts the A handler adds move to Z
    expect(fakeR.getCameraTarget().z).toBe(initial.z + move);

    // D should move right (opposite sign)
    const d = new KeyboardEvent('keydown', { key: 'd' });
    window.dispatchEvent(d);
    expect(fakeR.getCameraTarget().z).toBe(initial.z);
  });
});
