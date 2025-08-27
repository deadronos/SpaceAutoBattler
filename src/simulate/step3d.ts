import type { GameState3D, Ship3D } from '../types/threeTypes';
import { normalizePosition, wrappedDistance, Bounds3, Vec3 } from '../utils/wrapping';
import { BOUNDS_3D } from '../config/simConfig';
import { SHIP_TYPE_CONFIGS, getShipConfig } from '../config/threeConfig';

import { convertBounds3DToBounds3 } from '../simulate';

export const DT = 1 / 60; // fixed-step

export function simulateStep(state: GameState3D, bounds?: Bounds3): void {
  // Use 3D bounds if provided, otherwise convert from config
  const simBounds = bounds || convertBounds3DToBounds3(BOUNDS_3D);
  
  // integrate velocities and positions
  for (const s of state.ships as Ship3D[]) {
    // Apply ship-specific scaling and configuration
    const shipConfig = getShipConfig(s.type);
    const baseScale = shipConfig?.scale || 1.0;
    const shipScale = s.shipScale || 1.0;
    const finalScale = baseScale * shipScale;
    
    // Set collision radius based on ship type and scale
    if (shipConfig) {
      s.collisionRadius = shipConfig.collisionRadius * finalScale;
    } else {
      s.collisionRadius = s.collisionRadius || (8 * finalScale);
    }
    
    // Set base scale for rendering
    s.baseScale = baseScale;
    s.scale = finalScale;
    
    // Initialize component positions if not set
    if (shipConfig && !s.turrets) {
      s.turrets = shipConfig.turrets?.map((pos: any) => ({ ...pos })) || [];
    }
    if (shipConfig && !s.engines) {
      s.engines = shipConfig.engines?.map((pos: any) => ({ ...pos })) || [];
    }
    
    s.velocity.x += (s.acceleration?.x || 0) * DT;
    s.velocity.y += (s.acceleration?.y || 0) * DT;
    s.velocity.z += (s.acceleration?.z || 0) * DT;

    s.position.x += s.velocity.x * DT;
    s.position.y += s.velocity.y * DT;
    s.position.z += s.velocity.z * DT;

    // gentle damping
    s.velocity.x *= 0.999;
    s.velocity.y *= 0.999;
    s.velocity.z *= 0.999;
  }

  // naive broadphase/collision: O(n^2) separation using collisionRadius
  const ships = state.ships as Ship3D[];
  for (let i = 0; i < ships.length; i++) {
    for (let j = i + 1; j < ships.length; j++) {
      const a = ships[i];
      const b = ships[j];
      const dist = wrappedDistance(a.position, b.position, simBounds);
      const minDist = (a.collisionRadius || 8) + (b.collisionRadius || 8);
      if (dist < minDist && dist > 0.0001) {
        // separate along shortest displacement vector
        const dx = a.position.x - b.position.x || 0.0001;
        const dy = a.position.y - b.position.y || 0.0001;
        const dz = a.position.z - b.position.z || 0.0001;
        const len = Math.hypot(dx, dy, dz) || 1;
        const push = 0.5 * (minDist - dist) / len;
        a.position.x += (dx / len) * push;
        a.position.y += (dy / len) * push;
        a.position.z += (dz / len) * push;
        b.position.x -= (dx / len) * push;
        b.position.y -= (dy / len) * push;
        b.position.z -= (dz / len) * push;
      }
    }
  }

  // normalize (wrap) positions into bounds
  for (const s of state.ships as Ship3D[]) s.position = normalizePosition(s.position, simBounds);

  state.t = (state.t || 0) + DT;
}
