import type { GameState } from '../types/index.js';
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

  state.renderer.cameraTarget.x = centerX;
  state.renderer.cameraTarget.y = centerY;
  state.renderer.cameraTarget.z = centerZ;

  const _fovRadians = (RendererConfig.camera.fov * Math.PI) / 180;
  const optimalDistance =
    (maxSpread / 2 / Math.tan(_fovRadians / 2)) * CameraConfig.resetToCinematic.fovMultiplier;
  state.renderer.cameraDistance = Math.max(
    CameraConfig.cinematic.minDistance,
    Math.min(CameraConfig.cinematic.maxDistance, optimalDistance),
  );

  state.renderer.cameraRotation.x = CameraConfig.resetToCinematic.cameraRotation.x;
  state.renderer.cameraRotation.y = CameraConfig.resetToCinematic.cameraRotation.y;
  state.renderer.cameraRotation.z = CameraConfig.resetToCinematic.cameraRotation.z;
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
  state.renderer.cameraTarget.x += (centerX - state.renderer.cameraTarget.x) * lerpFactor;
  state.renderer.cameraTarget.y += (centerY - state.renderer.cameraTarget.y) * lerpFactor;
  state.renderer.cameraTarget.z += (centerZ - state.renderer.cameraTarget.z) * lerpFactor;

  const distanceLerpFactor = Math.min(dt * CameraConfig.cinematic.distanceLerpFactor, 1);
  state.renderer.cameraDistance +=
    (optimalDistance - state.renderer.cameraDistance) * distanceLerpFactor;
  state.renderer.cameraDistance = Math.max(
    CameraConfig.cinematic.minDistance,
    Math.min(CameraConfig.cinematic.maxDistance, state.renderer.cameraDistance),
  );
}
