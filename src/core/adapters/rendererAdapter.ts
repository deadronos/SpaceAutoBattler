import type { Ship, Bullet, Vector3 } from '../../types/index.js';

/**
 * RendererAdapter defines the minimal contract the simulation uses to
 * create/update/remove renderable entities. The current threeRenderer
 * can implement this, and tests may use a no-op stub.
 */
export interface RendererAdapter {
  ensureMeshForShip(ship: Ship): void;
  updateMeshFromShip(ship: Ship): void;
  removeShip(id: number): void;

  ensureMeshForBullet(bullet: Bullet): void;
  updateMeshFromBullet(bullet: Bullet): void;
  removeBullet(id: number): void;

  // Camera / scene helpers (optional)
  setCameraTarget?(pos: Vector3): void;
  render?(dt: number): void;
  dispose?(): void;
}

/**
 * No-op adapter for tests or headless runs.
 */
export class NoopRendererAdapter implements RendererAdapter {
  ensureMeshForShip(_ship: Ship): void {}
  updateMeshFromShip(_ship: Ship): void {}
  removeShip(_id: number): void {}
  ensureMeshForBullet(_bullet: Bullet): void {}
  updateMeshFromBullet(_bullet: Bullet): void {}
  removeBullet(_id: number): void {}
  setCameraTarget?(_pos: Vector3): void {}
  render?(_dt: number): void {}
  dispose?(): void {}
}
