import { srange, srangeInt } from './rng.js';
import { Ship } from './entities.js';
import { XP_PER_DAMAGE, KILL_XP_BASE, KILL_XP_PER_TARGET_LEVEL } from './progressionConfig.js';

export function simulateStep(state, dt, bounds = { W: 800, H: 600 }) {
  // state: { ships: [], bullets: [], score: {red, blue}, particles: [] }
  // Update ships (they may push bullets into state.bullets when provided)
  for (const s of state.ships) {
    if (s.alive) s.update(dt, state.ships, state.bullets);
  }

  // Wrap ships across screen boundaries so they reappear on the opposite side
  if (bounds && typeof bounds.W === 'number' && typeof bounds.H === 'number') {
    const W = bounds.W, H = bounds.H;
    for (const s of state.ships) {
      if (!s.alive) continue;
      const r = s.radius || 0;
      if (s.x < -r) s.x += (W + r * 2);
      else if (s.x > W + r) s.x -= (W + r * 2);
      if (s.y < -r) s.y += (H + r * 2);
      else if (s.y > H + r) s.y -= (H + r * 2);
    }
  }

  // Carrier launches: centralize launch timing so simulation owns creation events
  for (const s of state.ships) {
    if (!s.alive || !s.isCarrier) continue;
    s.launchCooldown -= dt;
    if (s.launchCooldown <= 0) {
      // only launch if carrier hasn't reached its max active fighters
      const canLaunch = (Array.isArray(s.activeFighters) ? s.activeFighters.length : 0) < (s.maxFighters || 6);
      if (canLaunch) {
        const toLaunch = Math.max(1, Math.floor(s.launchAmount || 1));
        for (let k = 0; k < toLaunch; k++) {
          // don't exceed maxFighters
          if (s.activeFighters.length >= (s.maxFighters || 6)) break;
          const a = srange(0, Math.PI*2);
          const dist = s.radius + 12 + srange(4,12);
          const fx = s.x + Math.cos(a) * dist; const fy = s.y + Math.sin(a) * dist;
          const f = new Ship(s.team, fx, fy, 'fighter');
          const spd = srange(40,120);
          f.vx = Math.cos(a) * spd + (s.vx || 0) * 0.2;
          f.vy = Math.sin(a) * spd + (s.vy || 0) * 0.2;
          // assign owner carrier id and register in carrier's active list
          f.ownerCarrier = s.id;
          s.activeFighters.push(f.id);
          state.ships.push(f);
        }
      }
      s.launchCooldown = srange(2.5, 6.0);
    }
  }

  // Update bullets
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i];
    b.update(dt);
    if (!b.alive(bounds)) state.bullets.splice(i, 1);
  }

  // Bullet collisions
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i];
    for (const s of state.ships) {
      if (!s.alive || s.team === b.team) continue;
      const dx = s.x - b.x, dy = s.y - b.y;
      const d2 = dx * dx + dy * dy;
      const R = s.radius + b.radius;
      if (d2 < R * R) {
        // capture explosion info if any
        const dmg = b.dmg;
        // record shield and hp before damage so we can generate visuals for shield/hp hits
        const prevShield = typeof s.shield === 'number' ? s.shield : 0;
        const prevHp = typeof s.hp === 'number' ? s.hp : 0;
        const exp = s.damage(dmg);
        const shieldTaken = Math.max(0, prevShield - (typeof s.shield === 'number' ? s.shield : 0));
        const hpTaken = Math.max(0, prevHp - (typeof s.hp === 'number' ? s.hp : 0));
        if (shieldTaken > 0 && state && Array.isArray(state.shieldHits)) {
          // include the bullet impact coordinates so renderer can draw an arc at the impact direction
          state.shieldHits.push({ id: s.id, hitX: b.x, hitY: b.y, team: s.team, amount: shieldTaken });
        }
        if (hpTaken > 0 && state && Array.isArray(state.healthHits)) {
          state.healthHits.push({ id: s.id, hitX: b.x, hitY: b.y, team: s.team, amount: hpTaken });
        }
        // Award XP to owner (damage-based) if owner present
        if (b.ownerId != null) {
          const owner = state.ships.find(x => x.id === b.ownerId);
          if (owner) {
            owner.gainXp(dmg * XP_PER_DAMAGE);
          }
        }
        state.bullets.splice(i, 1);
        if (exp && state.explosions) state.explosions.push(exp);
        if (!s.alive) {
          if (b.team === 0) state.score.red++;
          else state.score.blue++;
          // kill XP bonus to owner
          if (b.ownerId != null) {
            const owner = state.ships.find(x => x.id === b.ownerId);
            if (owner) owner.gainXp(KILL_XP_BASE + (s.level || 1) * KILL_XP_PER_TARGET_LEVEL);
          }
        }
        break;
      }
    }
  }

  // Cleanup: when ships died, ensure carrier activeFighters lists are pruned
  for (const dead of (state.explosions || [])) {
    if (!dead || !dead.id) continue;
    const deadShipInfo = dead;
    // If a fighter died and had an ownerCarrier, remove it from the carrier's active list
    if (deadShipInfo.type === 'fighter' && typeof deadShipInfo.ownerCarrier === 'number') {
      const owner = state.ships.find(s => s.id === deadShipInfo.ownerCarrier);
      if (owner && Array.isArray(owner.activeFighters)) {
        const idx = owner.activeFighters.indexOf(deadShipInfo.id);
        if (idx >= 0) owner.activeFighters.splice(idx, 1);
      }
    }
    // If a carrier died, find its former fighters and clear their ownerCarrier and the carrier's activeFighters
    if (deadShipInfo.type === 'carrier') {
      const carrierId = deadShipInfo.id;
      // clear ownerCarrier for any fighters that still reference this carrier
      for (const s of state.ships) {
        if (!s.alive) continue;
        if (s.type === 'fighter' && s.ownerCarrier === carrierId) {
          s.ownerCarrier = null;
        }
      }
      // ensure any carrier entry in the ships list doesn't retain activeFighters (safety)
      const carrier = state.ships.find(s => s.id === carrierId);
      if (carrier && Array.isArray(carrier.activeFighters)) carrier.activeFighters.length = 0;
    }
  }
}
