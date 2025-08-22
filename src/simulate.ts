// simulate.ts - TypeScript implementation ported from simulate.js
import { srange, srand, srandom } from './rng.js';

export type Bounds = { W: number; H: number };

export const SIM_DT_MS = 16; // ms
export const MAX_ACC_MS = 250;

function dist2(a: { x: number; y: number }, b: { x: number; y: number }) {
	const dx = a.x - b.x; const dy = a.y - b.y; return dx * dx + dy * dy;
}

export function simulateStep(state: any, dtSeconds: number, bounds: Bounds) {
	// Advance time
	state.t = (state.t || 0) + dtSeconds;

	// Move bullets
	for (let i = (state.bullets || []).length - 1; i >= 0; i--) {
		const b = state.bullets[i];
		b.x += (b.vx || 0) * dtSeconds;
		b.y += (b.vy || 0) * dtSeconds;
		b.ttl = (b.ttl || 0) - dtSeconds;
		if (b.ttl <= 0) state.bullets.splice(i, 1);
	}

	// Move ships
	for (const s of state.ships || []) {
		s.x += (s.vx || 0) * dtSeconds;
		s.y += (s.vy || 0) * dtSeconds;
		if (s.x < 0) s.x += bounds.W; if (s.x > bounds.W) s.x -= bounds.W;
		if (s.y < 0) s.y += bounds.H; if (s.y > bounds.H) s.y -= bounds.H;
	}

	// Bullet collisions
	for (let bi = (state.bullets || []).length - 1; bi >= 0; bi--) {
		const b = state.bullets[bi];
		for (let si = (state.ships || []).length - 1; si >= 0; si--) {
			const s = state.ships[si];
			if (s.team === b.team) continue;
			const r = ((s.radius || 6) + (b.radius || 1));
			if (dist2(b, s) <= r * r) {
				const shield = s.shield || 0;
				if (shield > 0) {
					const absorbed = Math.min(shield, b.damage || 0);
					s.shield = shield - absorbed;
					(state.shieldHits ||= []).push({ id: s.id, hitX: b.x, hitY: b.y, team: s.team, amount: absorbed });
					const remaining = (b.damage || 0) - absorbed;
					if (remaining > 0) {
						s.hp -= remaining;
						(state.healthHits ||= []).push({ id: s.id, hitX: b.x, hitY: b.y, team: s.team, amount: remaining });
					}
				} else {
					s.hp -= (b.damage || 0);
					(state.healthHits ||= []).push({ id: s.id, hitX: b.x, hitY: b.y, team: s.team, amount: b.damage || 0 });
				}
				state.bullets.splice(bi, 1);
				if (s.hp <= 0) {
					(state.explosions ||= []).push({ x: s.x, y: s.y, team: s.team });
					state.ships.splice(si, 1);
				}
				break;
			}
		}
	}

	// Shield regen
	for (const s of state.ships || []) {
		if (s.maxShield) s.shield = Math.min(s.maxShield, (s.shield || 0) + (s.shieldRegen || 0) * dtSeconds);
	}

	return state;
}

export default { simulateStep, SIM_DT_MS };
