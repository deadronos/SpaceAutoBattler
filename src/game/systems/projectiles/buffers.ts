import type { GameState } from '../../../types/index.js';
import type { KinematicBody } from '../../physics/types.js';

const MAX_UPDATES = 10000;

interface ProjectileBuffers {
  t_bodies: (KinematicBody | null)[];
  t_values: Float32Array;
  t_count: number;
  r_bodies: (KinematicBody | null)[];
  r_values: Float32Array;
  r_count: number;
}

const bufferCache = new WeakMap<GameState, ProjectileBuffers>();

export function getProjectileBuffers(state: GameState): ProjectileBuffers {
  let buffers = bufferCache.get(state);
  if (!buffers) {
    buffers = {
      t_bodies: Array.from({ length: MAX_UPDATES }, () => null),
      t_values: new Float32Array(MAX_UPDATES * 3),
      t_count: 0,
      r_bodies: Array.from({ length: MAX_UPDATES }, () => null),
      r_values: new Float32Array(MAX_UPDATES * 4),
      r_count: 0,
    };
    bufferCache.set(state, buffers);
  }
  return buffers;
}

export function flushProjectileBuffers(buffers: ProjectileBuffers): void {
  const { t_count, t_bodies, t_values, r_count, r_bodies, r_values } = buffers;

  // Apply translations
  for (let i = 0; i < t_count; i++) {
    const body = t_bodies[i];
    if (body) {
      const idx = i * 3;
      body.setNextKinematicTranslation({
        x: t_values[idx],
        y: t_values[idx + 1],
        z: t_values[idx + 2],
      });
    }
  }
  t_bodies.fill(null, 0, t_count);
  buffers.t_count = 0;

  // Apply rotations
  for (let i = 0; i < r_count; i++) {
    const body = r_bodies[i];
    if (body?.setNextKinematicRotation) {
      const idx = i * 4;
      body.setNextKinematicRotation({
        x: r_values[idx],
        y: r_values[idx + 1],
        z: r_values[idx + 2],
        w: r_values[idx + 3],
      });
    }
  }
  r_bodies.fill(null, 0, r_count);
  buffers.r_count = 0;
}
