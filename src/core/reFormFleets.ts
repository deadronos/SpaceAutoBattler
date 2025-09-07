import type { GameState } from '../types/index.js';
import { FleetConfig } from '../config/fleetConfig.js';

export function reFormFleets(state: GameState): void {
  const leftX = FleetConfig.positioning.leftMargin;
  const rightX = state.simConfig.simBounds.width - FleetConfig.positioning.rightMargin;
  const centerZ = state.simConfig.simBounds.depth / 2 + FleetConfig.positioning.centerZOffset;
  let ri = 0, bi = 0;
  const row = FleetConfig.positioning.rowSize;
  const spacing = FleetConfig.positioning.spacing;
  for (const s of state.ships) {
    const i = (s.team === 'red' ? ri++ : bi++);
    const col = i % row; const r = Math.floor(i / row);
    const x = s.team === 'red' ? leftX + col * spacing : rightX - col * spacing;
    const y = 400 + r * spacing;
    const z = centerZ + (state.rng.next() - 0.5) * 100; // Random z position around center
    s.pos.x = x; s.pos.y = y; s.pos.z = z;
    s.vel.x = 0; s.vel.y = 0; s.vel.z = 0;
  }
}
