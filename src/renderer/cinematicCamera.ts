import type { GameState } from '../types/index.js';
// Use renderer handle helpers (get/set) instead of accessing transitional `_cameraState`
import { RendererConfig } from '../config/rendererConfig.js';
import { CameraConfig } from '../config/cameraConfig.js';

export function resetToCinematicView(state: GameState): void {
  if (!state.renderer || state.ships.length === 0) return;

  let centerX = 0,
    centerY = 0,
    centerZ = 0;
  let shipCount = 0;

  for (const ship of state.ships) {
    if (ship.health > 0) {
      centerX += ship.pos.x;
      centerY += ship.pos.y;
      centerZ += ship.pos.z;
      shipCount++;
    }
  }
  if (shipCount === 0) return;

  centerX /= shipCount;
  centerY /= shipCount;
  centerZ /= shipCount;

  let minX = Infinity,
    maxX = -Infinity;
  let minY = Infinity,
    maxY = -Infinity;
  let minZ = Infinity,
    maxZ = -Infinity;

  for (const ship of state.ships) {
    if (ship.health > 0) {
      minX = Math.min(minX, ship.pos.x);
      maxX = Math.max(maxX, ship.pos.x);
      minY = Math.min(minY, ship.pos.y);
      maxY = Math.max(maxY, ship.pos.y);
      minZ = Math.min(minZ, ship.pos.z);
      maxZ = Math.max(maxZ, ship.pos.z);
    }
  }

  const spreadX = maxX - minX;
  const spreadY = maxY - minY;
  const spreadZ = maxZ - minZ;
  const maxSpread = Math.max(spreadX, spreadY, spreadZ);

  // Prefer renderer handle helpers when available for staged migration.
  const rh = state.renderer as unknown as {
    getCameraTarget?: () => { x: number; y: number; z: number };
    setCameraTarget?: (t: { x?: number; y?: number; z?: number }) => void;
    getCameraDistance?: () => number;
    setCameraDistance?: (d: number) => void;
    setCameraRotation?: (r: { x?: number; y?: number; z?: number }) => void;
  } | undefined;

  const setTarget = rh?.setCameraTarget?.bind(rh);
  const setDistance = rh?.setCameraDistance?.bind(rh);
  const setRotation = rh?.setCameraRotation?.bind(rh);

  if (setTarget && setDistance) {
    setTarget({ x: centerX, y: centerY, z: centerZ });
    const _fovRadians = (RendererConfig.camera.fov * Math.PI) / 180;
    const optimalDistance = (maxSpread / 2 / Math.tan(_fovRadians / 2)) * CameraConfig.resetToCinematic.fovMultiplier;
    setDistance(Math.max(CameraConfig.cinematic.minDistance, Math.min(CameraConfig.cinematic.maxDistance, optimalDistance)));
    if (setRotation) setRotation(CameraConfig.resetToCinematic.cameraRotation);
  }
}

export function updateCinematicCamera(state: GameState, dt: number): void {
  if (!state.renderer || state.ships.length === 0) return;

  const redShips = state.ships.filter((s) => s.team === 'red' && s.health > 0);
  const blueShips = state.ships.filter((s) => s.team === 'blue' && s.health > 0);
  if (redShips.length === 0 || blueShips.length === 0) return;

  let redCenterX = 0,
    redCenterY = 0,
    redCenterZ = 0;
  let blueCenterX = 0,
    blueCenterY = 0,
    blueCenterZ = 0;

  for (const ship of redShips) {
    redCenterX += ship.pos.x;
    redCenterY += ship.pos.y;
    redCenterZ += ship.pos.z;
  }
  redCenterX /= redShips.length;
  redCenterY /= redShips.length;
  redCenterZ /= redShips.length;

  for (const ship of blueShips) {
    blueCenterX += ship.pos.x;
    blueCenterY += ship.pos.y;
    blueCenterZ += ship.pos.z;
  }
  blueCenterX /= blueShips.length;
  blueCenterY /= blueShips.length;
  blueCenterZ /= blueShips.length;

  const centerX = (redCenterX + blueCenterX) / 2;
  const centerY = (redCenterY + blueCenterY) / 2;
  const centerZ = (redCenterZ + blueCenterZ) / 2;

  const dxF = redCenterX - blueCenterX;
  const dyF = redCenterY - blueCenterY;
  const dzF = redCenterZ - blueCenterZ;
  const fleetDistance = Math.sqrt(dxF * dxF + dyF * dyF + dzF * dzF);

  const _fovRadians = (RendererConfig.camera.fov * Math.PI) / 180;
  const optimalDistance = Math.max(
    fleetDistance * CameraConfig.cinematic.fleetDistanceMultiplier,
    CameraConfig.cinematic.minDistance,
  );

  const lerpFactor = Math.min(dt * CameraConfig.cinematic.lerpFactor, 1);
  // Update camera target and distance via renderer helper methods when available
  const rh2 = state.renderer as unknown as {
    getCameraTarget?: () => { x: number; y: number; z: number };
    setCameraTarget?: (t: { x?: number; y?: number; z?: number }) => void;
    getCameraDistance?: () => number;
    setCameraDistance?: (d: number) => void;
  } | undefined;

  const getTarget = rh2?.getCameraTarget?.bind(rh2);
  const setTarget2 = rh2?.setCameraTarget?.bind(rh2);
  const getDistance = rh2?.getCameraDistance?.bind(rh2);
  const setDistance2 = rh2?.setCameraDistance?.bind(rh2);

  if (getTarget && setTarget2 && getDistance && setDistance2) {
    const cur = getTarget();
    const newX = cur.x + (centerX - cur.x) * lerpFactor;
    const newY = cur.y + (centerY - cur.y) * lerpFactor;
    const newZ = cur.z + (centerZ - cur.z) * lerpFactor;
    setTarget2({ x: newX, y: newY, z: newZ });

    const distanceLerpFactor = Math.min(dt * CameraConfig.cinematic.distanceLerpFactor, 1);
    const curDist = getDistance();
    const newDist = curDist + (optimalDistance - curDist) * distanceLerpFactor;
    setDistance2(Math.max(CameraConfig.cinematic.minDistance, Math.min(CameraConfig.cinematic.maxDistance, newDist)));
  }
}
