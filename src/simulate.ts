// simulate.ts - TypeScript implementation ported from simulate.js
import { srange, srand, srandom } from './rng';
import { progression as progressionCfg } from './config/progressionConfig';

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
				const attacker = (typeof b.ownerId === 'number' || typeof b.ownerId === 'string')
					? (state.ships || []).find((sh: any) => sh.id === b.ownerId)
					: undefined;
				let dealtToShield = 0;
				let dealtToHealth = 0;
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
					dealtToShield = absorbed;
					dealtToHealth = Math.max(0, (b.damage || 0) - absorbed);
				} else {
					s.hp -= (b.damage || 0);
					(state.healthHits ||= []).push({ id: s.id, hitX: b.x, hitY: b.y, team: s.team, amount: b.damage || 0 });
					dealtToHealth = (b.damage || 0);
				}
				// XP for damage
				if (attacker) {
					attacker.xp = (attacker.xp || 0) + (dealtToShield + dealtToHealth) * (progressionCfg.xpPerDamage || 0);
					while ((attacker.xp || 0) >= progressionCfg.xpToLevel((attacker.level || 1))) {
						attacker.xp -= progressionCfg.xpToLevel((attacker.level || 1));
						attacker.level = (attacker.level || 1) + 1;
						const hpMul = 1 + (progressionCfg.hpPercentPerLevel || 0);
						const shMul = 1 + (progressionCfg.shieldPercentPerLevel || 0);
						const dmgMul = 1 + (progressionCfg.dmgPercentPerLevel || 0);
						attacker.maxHp = (attacker.maxHp || 0) * hpMul;
						attacker.hp = Math.min(attacker.maxHp, (attacker.hp || 0) * hpMul);
						if (typeof attacker.maxShield === 'number') {
							attacker.maxShield = (attacker.maxShield || 0) * shMul;
							attacker.shield = Math.min(attacker.maxShield, (attacker.shield || 0) * shMul);
						}
						if (Array.isArray(attacker.cannons)) {
							for (const c of attacker.cannons) {
								if (typeof c.damage === 'number') c.damage *= dmgMul;
							}
						}
					}
				}
				state.bullets.splice(bi, 1);
				if (s.hp <= 0) {
					if (attacker) {
						attacker.xp = (attacker.xp || 0) + (progressionCfg.xpPerKill || 0);
						while ((attacker.xp || 0) >= progressionCfg.xpToLevel((attacker.level || 1))) {
							attacker.xp -= progressionCfg.xpToLevel((attacker.level || 1));
							attacker.level = (attacker.level || 1) + 1;
							const hpMul = 1 + (progressionCfg.hpPercentPerLevel || 0);
							const shMul = 1 + (progressionCfg.shieldPercentPerLevel || 0);
							const dmgMul = 1 + (progressionCfg.dmgPercentPerLevel || 0);
							attacker.maxHp = (attacker.maxHp || 0) * hpMul;
							attacker.hp = Math.min(attacker.maxHp, (attacker.hp || 0) * hpMul);
							if (typeof attacker.maxShield === 'number') {
								attacker.maxShield = (attacker.maxShield || 0) * shMul;
								attacker.shield = Math.min(attacker.maxShield, (attacker.shield || 0) * shMul);
							}
							if (Array.isArray(attacker.cannons)) {
								for (const c of attacker.cannons) {
									if (typeof c.damage === 'number') c.damage *= dmgMul;
								}
							}
						}
					}
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
