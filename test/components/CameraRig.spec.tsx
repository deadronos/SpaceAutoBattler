import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { cleanup, render } from '@testing-library/react';
import { Euler, Vector3 } from 'three';
import type { ShipEntity } from '../../src/types/index.js';
import { CameraRig } from '../../src/components/CameraRig.js';

type FrameCallback = (state: { camera: MockCamera }, delta: number) => void;

interface MockCamera {
  position: Vector3;
  rotation: Euler;
  fov: number;
  updateProjectionMatrix: () => void;
}

const frameCallbacks: FrameCallback[] = [];

const mockCamera: MockCamera = {
  position: new Vector3(0, 0, 50),
  rotation: new Euler(0, 0, 0),
  fov: 60,
  updateProjectionMatrix: vi.fn(),
};

const mockControls = {
  target: new Vector3(0, 0, 0),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

vi.mock('@react-three/fiber', () => ({
  useFrame: (callback: FrameCallback) => {
    frameCallbacks.push(callback);
  },
  useThree: (selector: (state: unknown) => unknown) =>
    selector({ camera: mockCamera, controls: mockControls }),
}));

// Controllable UI store consumed by the component under test. Using a mock
// keeps the test focused on the follow math; store defaults are covered by
// `ui-store-defaults.spec.ts`.
const uiState = vi.hoisted(() => ({
  cameraShakeEnabled: false,
  cameraFollowEnabled: false,
  selectedShipId: null as number | null,
  selectShip: vi.fn(),
}));

vi.mock('../../src/app/uiStore.js', () => ({
  useUiStore: Object.assign((selector: (state: typeof uiState) => unknown) => selector(uiState), {
    getState: () => uiState,
  }),
}));

const gameState = {
  shipById: new Map<number, ShipEntity>(),
  explosions: [] as unknown[],
  time: 0,
};

vi.mock('../../src/app/context.js', () => ({
  useOptionalGameState: () => gameState,
}));

const reducedMotionState = vi.hoisted(() => ({ value: false }));

vi.mock('../../src/hooks/usePrefersReducedMotion.js', () => ({
  usePrefersReducedMotion: () => reducedMotionState.value,
}));

const ORBIT_OFFSET = new Vector3(0, 0, 50);
const DT = 0.1;

function createShip(id: number, x: number, y: number, z: number): ShipEntity {
  return {
    id,
    transform: { position: new Vector3(x, y, z) },
    ship: { velocity: new Vector3() },
  } as unknown as ShipEntity;
}

function runLatestFrame(delta = DT): void {
  const callback = frameCallbacks[frameCallbacks.length - 1];
  expect(typeof callback).toBe('function');
  callback?.({ camera: mockCamera }, delta);
}

function orbitOffset(): Vector3 {
  return mockCamera.position.clone().sub(mockControls.target);
}

beforeEach(() => {
  frameCallbacks.length = 0;
  uiState.cameraShakeEnabled = false;
  uiState.cameraFollowEnabled = false;
  uiState.selectedShipId = null;
  uiState.selectShip.mockReset();
  reducedMotionState.value = false;
  gameState.shipById = new Map();
  gameState.time = 0;
  mockCamera.position.set(0, 0, 50);
  mockCamera.rotation.set(0, 0, 0);
  mockControls.target.set(0, 0, 0);
});

afterEach(() => {
  cleanup();
  frameCallbacks.length = 0;
  vi.clearAllMocks();
});

describe('CameraRig ship follow', () => {
  it('leaves the camera untouched when follow is disabled', () => {
    uiState.selectedShipId = 7;
    gameState.shipById.set(7, createShip(7, 100, 0, 0));
    render(<CameraRig />);

    runLatestFrame();

    expect(mockCamera.position.toArray()).toEqual([0, 0, 50]);
    expect(mockControls.target.toArray()).toEqual([0, 0, 0]);
  });

  it('leaves the camera untouched when no ship is selected', () => {
    uiState.cameraFollowEnabled = true;
    render(<CameraRig />);

    runLatestFrame();

    expect(mockCamera.position.toArray()).toEqual([0, 0, 50]);
    expect(mockControls.target.toArray()).toEqual([0, 0, 0]);
  });

  it('applies the same delta to controls.target and camera.position', () => {
    uiState.cameraFollowEnabled = true;
    uiState.selectedShipId = 7;
    gameState.shipById.set(7, createShip(7, 100, 0, 0));
    render(<CameraRig />);

    runLatestFrame();

    const alpha = 1 - Math.exp(-6 * DT);
    const expectedX = 100 * alpha;
    expect(mockControls.target.x).toBeCloseTo(expectedX, 10);
    expect(mockCamera.position.x).toBeCloseTo(expectedX, 10);
    // The camera/target move together, so the orbit offset is unchanged.
    expect(mockControls.target.z).toBeCloseTo(0, 10);
    expect(mockCamera.position.z).toBeCloseTo(50, 10);
    expect(orbitOffset().toArray()).toEqual([0, 0, 50]);
  });

  it('preserves orbit distance and angle across successive frames', () => {
    uiState.cameraFollowEnabled = true;
    uiState.selectedShipId = 7;
    gameState.shipById.set(7, createShip(7, 100, 0, 0));
    render(<CameraRig />);

    for (let i = 0; i < 8; i += 1) {
      runLatestFrame();
    }

    const offset = orbitOffset();
    expect(offset.x).toBeCloseTo(ORBIT_OFFSET.x, 10);
    expect(offset.y).toBeCloseTo(ORBIT_OFFSET.y, 10);
    expect(offset.z).toBeCloseTo(ORBIT_OFFSET.z, 10);
    // Target has glided toward the ship without overshooting it.
    expect(mockControls.target.x).toBeGreaterThan(0);
    expect(mockControls.target.x).toBeLessThan(100);
  });

  it('smooths toward the ship instead of jumping on the first frame', () => {
    uiState.cameraFollowEnabled = true;
    uiState.selectedShipId = 7;
    gameState.shipById.set(7, createShip(7, 100, 0, 0));
    render(<CameraRig />);

    runLatestFrame();
    const afterFirst = mockControls.target.x;
    expect(afterFirst).toBeGreaterThan(0);
    expect(afterFirst).toBeLessThan(100);

    runLatestFrame();
    const afterSecond = mockControls.target.x;
    expect(afterSecond).toBeGreaterThan(afterFirst);
    expect(afterSecond).toBeLessThan(100);
  });

  it('leaves the camera untouched under reduced motion', () => {
    uiState.cameraFollowEnabled = true;
    uiState.selectedShipId = 7;
    gameState.shipById.set(7, createShip(7, 100, 0, 0));
    reducedMotionState.value = true;
    render(<CameraRig />);

    runLatestFrame();

    expect(mockCamera.position.toArray()).toEqual([0, 0, 50]);
    expect(mockControls.target.toArray()).toEqual([0, 0, 0]);
  });

  it('clears the selection and leaves the camera put when the ship is gone', () => {
    uiState.cameraFollowEnabled = true;
    uiState.selectedShipId = 99;
    render(<CameraRig />);

    runLatestFrame();

    expect(uiState.selectShip).toHaveBeenCalledWith(null);
    expect(mockCamera.position.toArray()).toEqual([0, 0, 50]);
    expect(mockControls.target.toArray()).toEqual([0, 0, 0]);
  });
});
