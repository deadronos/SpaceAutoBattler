// simulate.ts - TypeScript implementation ported from simulate.js
import { srange, srand, srandom } from "./rng";
import { progression as progressionCfg } from "./config/progressionConfig";
import { SIM, boundaryBehavior } from "./config/simConfig";
import { clampSpeed } from "./behavior";
import { acquireBullet, releaseBullet, acquireExplosion, releaseExplosion, acquireShieldHit, releaseShieldHit, acquireHealthHit, releaseHealthHit } from "./gamemanager";

export type Bounds = { W: number; H: number };

// SIM constants migrated to simConfig.ts
// Use SIM.DT_MS and SIM.MAX_ACC_MS instead

function dist2(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function simulateStep(state: any, dtSeconds: number, bounds: Bounds) {
  // Advance time
  state.t = (state.t || 0) + dtSeconds;

  // Move bullets and handle boundary behavior
  for (let i = (state.bullets || []).length - 1; i >= 0; i--) {
    const b = state.bullets[i];
    b.x += (b.vx || 0) * dtSeconds;
    b.y += (b.vy || 0) * dtSeconds;
    b.ttl = (b.ttl || 0) - dtSeconds;
    let outX = b.x < 0 || b.x >= bounds.W;
    let outY = b.y < 0 || b.y >= bounds.H;
    let outOfBounds = outX || outY;
    let remove = false;
    if (b.ttl <= 0) remove = true;
    else if (outOfBounds) {
      switch (boundaryBehavior.bullets) {
        case 'remove':
          remove = true;
          break;
        case 'wrap':
          if (b.x < 0) b.x += bounds.W;
          if (b.x >= bounds.W) b.x -= bounds.W;
          if (b.y < 0) b.y += bounds.H;
          if (b.y >= bounds.H) b.y -= bounds.H;
          break;
        case 'bounce':
          if (outX) {
            b.vx = -(b.vx || 0);
            b.x = Math.max(0, Math.min(bounds.W, b.x));
          }
          if (outY) {
            b.vy = -(b.vy || 0);
            b.y = Math.max(0, Math.min(bounds.H, b.y));
          }
          break;
      }
    }
    if (remove) releaseBullet(b);
  }
  // Prune out-of-bounds shieldHits, healthHits, explosions, damageEvents
  function pruneHits(arr: any[], bounds: Bounds) {
    if (!Array.isArray(arr)) return arr;
    return arr.filter(
      (e) =>
        typeof e.x === "number" &&
        typeof e.y === "number" &&
        e.x >= 0 &&
        e.x < bounds.W &&
        e.y >= 0 &&
        e.y < bounds.H,
    );
  }
  if (Array.isArray(state.shieldHits))
  // Prune particles/events after their lifetime
if (state.particles) {
  // In-place compaction (write pointer)
  let write = 0;
  for (let read = 0; read < state.particles.length; read++) {
    const p = state.particles[read];
    p.life = (p.life || p.ttl || 0) - dtSeconds;
    if (p.life > 0) {
      state.particles[write++] = p;
    } else {
      releaseParticle(p);
    }
  }
  state.particles.length = write;
}
  if (state.explosions) {
    for (let i = state.explosions.length - 1; i >= 0; i--) {
      const e = state.explosions[i];
      e.life = (e.life || e.ttl || 0) - dtSeconds;
      if (e.life <= 0) releaseExplosion(e);
    }
    state.explosions = state.explosions.filter((e: any) => e.life > 0);
  }
let writeShield = 0;
for (let read = 0; read < state.shieldHits.length; read++) {
  const sh = state.shieldHits[read];
  if (
    typeof sh.x === "number" &&
    typeof sh.y === "number" &&
    sh.x >= 0 && sh.x < bounds.W &&
    sh.y >= 0 && sh.y < bounds.H
  ) {
    state.shieldHits[writeShield++] = sh;
  } else {
    releaseShieldHit(sh);
  }
}
state.shieldHits.length = writeShield;
  if (Array.isArray(state.healthHits)) {
    for (let i = state.healthHits.length - 1; i >= 0; i--) {
      const hh = state.healthHits[i];
      if (
        typeof hh.x !== "number" ||
        typeof hh.y !== "number" ||
        hh.x < 0 ||
        hh.x >= bounds.W ||
        hh.y < 0 ||
        hh.y >= bounds.H
      ) {
        releaseHealthHit(hh);
      }
    }
    state.healthHits = pruneHits(state.healthHits, bounds);
  }
  if (Array.isArray(state.explosions)) {
    state.explosions = pruneHits(state.explosions, bounds);
  }
  if (Array.isArray(state.damageEvents)) {
    state.damageEvents = pruneHits(state.damageEvents, bounds);
  }

  // Move ships and update heading
  for (let si = (state.ships || []).length - 1; si >= 0; si--) {
    const s = state.ships[si];
    // --- Physics-based movement ---
    const throttle = typeof s.throttle === "number" ? s.throttle : 0;
    const steering = typeof s.steering === "number" ? s.steering : 0;
    const accel = typeof s.accel === "number" ? s.accel : 0;
    const turnRate = typeof s.turnRate === "number" ? s.turnRate : 3;
    const maxSpeed = typeof s.maxSpeed === "number" ? s.maxSpeed : 160;
    const angle = typeof s.angle === "number" ? s.angle : 0;

    // Update angle based on steering
    const maxTurn = turnRate * Math.abs(steering) * dtSeconds;
    if (steering !== 0) {
      let a = angle + Math.sign(steering) * maxTurn;
      while (a < -Math.PI) a += Math.PI * 2;
      while (a > Math.PI) a -= Math.PI * 2;
      s.angle = a;
    }

    // Update velocity based on throttle and angle
    const actualAccel = accel * throttle;
    if (actualAccel > 0) {
      s.vx = (s.vx || 0) + Math.cos(s.angle || 0) * actualAccel * dtSeconds;
      s.vy = (s.vy || 0) + Math.sin(s.angle || 0) * actualAccel * dtSeconds;
    }

    // Apply friction/damping to velocity
    const friction = typeof s.friction === "number" ? s.friction : 0.98;
    s.vx = (s.vx || 0) * friction;
    s.vy = (s.vy || 0) * friction;

    // Clamp speed using shared function
    clampSpeed(s, maxSpeed);

    // Move ship
    s.x += (s.vx || 0) * dtSeconds;
    s.y += (s.vy || 0) * dtSeconds;
    // Boundary behavior for ships
    const r = typeof s.radius === "number" ? s.radius : 12;
    let outX = s.x < -r || s.x > bounds.W + r;
    let outY = s.y < -r || s.y > bounds.H + r;
    let outOfBounds = outX || outY;
    let remove = false;
    if (outOfBounds) {
      switch (boundaryBehavior.ships) {
        case 'remove':
          remove = true;
          break;
        case 'wrap':
          if (s.x < -r) s.x += bounds.W + r * 2;
          if (s.x > bounds.W + r) s.x -= bounds.W + r * 2;
          if (s.y < -r) s.y += bounds.H + r * 2;
          if (s.y > bounds.H + r) s.y -= bounds.H + r * 2;
          break;
        case 'bounce':
          if (outX) {
            s.vx = -(s.vx || 0);
            s.x = Math.max(-r, Math.min(bounds.W + r, s.x));
          }
          if (outY) {
            s.vy = -(s.vy || 0);
            s.y = Math.max(-r, Math.min(bounds.H + r, s.y));
          }
          break;
      }
    }
    if (remove) state.ships.splice(si, 1);
  }

  // Bullet collisions
  for (let bi = (state.bullets || []).length - 1; bi >= 0; bi--) {
    const b = state.bullets[bi];
    for (let si = (state.ships || []).length - 1; si >= 0; si--) {
      const s = state.ships[si];
      if (s.team === b.team) continue;
      const r = (s.radius || 6) + (b.radius || 1);
      if (dist2(b, s) <= r * r) {
        const attacker =
          typeof b.ownerId === "number" || typeof b.ownerId === "string"
            ? (state.ships || []).find((sh: any) => sh.id === b.ownerId)
            : undefined;
        let dealtToShield = 0;
        let dealtToHealth = 0;
        const shield = s.shield || 0;
        if (shield > 0) {
          const absorbed = Math.min(shield, b.damage || 0);
          s.shield = shield - absorbed;
          const hitAngle = Math.atan2(
            (b.y || 0) - (s.y || 0),
            (b.x || 0) - (s.x || 0),
          );
          (state.shieldHits ||= []).push(acquireShieldHit({
            id: s.id,
            x: b.x,
            y: b.y,
            team: s.team,
            amount: absorbed,
            hitAngle,
          }));
          // expose damage event for renderer (shield hit)
          (state.damageEvents ||= []).push({
            id: s.id,
            type: "shield",
            amount: absorbed,
            x: b.x,
            y: b.y,
            team: s.team,
            attackerId: attacker && attacker.id,
          });
          const remaining = (b.damage || 0) - absorbed;
          if (remaining > 0) {
            s.hp -= remaining;
            (state.healthHits ||= []).push(acquireHealthHit({
              id: s.id,
              x: b.x,
              y: b.y,
              team: s.team,
              amount: remaining,
            }));
            // expose damage event for renderer (health hit)
            (state.damageEvents ||= []).push({
              id: s.id,
              type: "hp",
              amount: remaining,
              x: b.x,
              y: b.y,
              team: s.team,
              attackerId: attacker && attacker.id,
            });
          }
          dealtToShield = absorbed;
          dealtToHealth = Math.max(0, (b.damage || 0) - absorbed);
        } else {
          s.hp -= b.damage || 0;
          (state.healthHits ||= []).push(acquireHealthHit({
            id: s.id,
            x: b.x,
            y: b.y,
            team: s.team,
            amount: b.damage || 0,
          }));
          // expose damage event for renderer (health hit)
          (state.damageEvents ||= []).push({
            id: s.id,
            type: "hp",
            amount: b.damage || 0,
            x: b.x,
            y: b.y,
            team: s.team,
            attackerId: attacker && attacker.id,
          });
          dealtToHealth = b.damage || 0;
        }

        // Update percent fields for renderer convenience
        s.hpPercent = Math.max(0, Math.min(1, (s.hp || 0) / (s.maxHp || 1)));
        s.shieldPercent =
          typeof s.maxShield === "number" && s.maxShield > 0
            ? Math.max(0, Math.min(1, (s.shield || 0) / s.maxShield))
            : 0;
        // XP for damage
        if (attacker) {
          attacker.xp =
            (attacker.xp || 0) +
            (dealtToShield + dealtToHealth) * (progressionCfg.xpPerDamage || 0);
          while (
            (attacker.xp || 0) >= progressionCfg.xpToLevel(attacker.level || 1)
          ) {
            attacker.xp -= progressionCfg.xpToLevel(attacker.level || 1);
            attacker.level = (attacker.level || 1) + 1;
            // Support function or number scalars for progression
            const resolveScalar = (s: any, lvl: number) =>
              typeof s === "function" ? s(lvl) : s || 0;
            const lvl = attacker.level || 1;
            const hpScalar = resolveScalar(
              progressionCfg.hpPercentPerLevel,
              lvl,
            );
            const shScalar = resolveScalar(
              progressionCfg.shieldPercentPerLevel,
              lvl,
            );
            const dmgScalar = resolveScalar(
              progressionCfg.dmgPercentPerLevel,
              lvl,
            );
            const speedScalar = resolveScalar(
              (progressionCfg as any).speedPercentPerLevel,
              lvl,
            );
            const regenScalar = resolveScalar(
              (progressionCfg as any).regenPercentPerLevel,
              lvl,
            );

            const hpMul = 1 + hpScalar;
            const shMul = 1 + shScalar;
            const dmgMul = 1 + dmgScalar;

            attacker.maxHp = (attacker.maxHp || 0) * hpMul;
            attacker.hp = Math.min(attacker.maxHp, (attacker.hp || 0) * hpMul);
            if (typeof attacker.maxShield === "number") {
              attacker.maxShield = (attacker.maxShield || 0) * shMul;
              attacker.shield = Math.min(
                attacker.maxShield,
                (attacker.shield || 0) * shMul,
              );
            }
            if (Array.isArray(attacker.cannons)) {
              for (const c of attacker.cannons) {
                if (typeof c.damage === "number") c.damage *= dmgMul;
              }
            }
            // Apply optional speed and shield regen increases
            if (
              typeof speedScalar === "number" &&
              typeof attacker.accel === "number"
            )
              attacker.accel = attacker.accel * (1 + speedScalar);
            if (
              typeof regenScalar === "number" &&
              typeof attacker.shieldRegen === "number"
            )
              attacker.shieldRegen = attacker.shieldRegen * (1 + regenScalar);
          }
        }
        state.bullets.splice(bi, 1);
        if (s.hp <= 0) {
          // eslint-disable-next-line no-console
          console.log(
            "DEBUG: KILL BRANCH, attacker",
            attacker && attacker.id,
            "xp before",
            attacker && attacker.xp,
          );
          if (attacker) {
            attacker.xp = (attacker.xp || 0) + (progressionCfg.xpPerKill || 0);
            // eslint-disable-next-line no-console
            console.log(
              "DEBUG: KILL XP AWARDED, attacker",
              attacker.id,
              "xp after",
              attacker.xp,
            );
            while (
              (attacker.xp || 0) >=
              progressionCfg.xpToLevel(attacker.level || 1)
            ) {
              attacker.xp -= progressionCfg.xpToLevel(attacker.level || 1);
              attacker.level = (attacker.level || 1) + 1;
              // Support function or number scalars for progression on kill XP
              const resolveScalar = (s: any, lvl: number) =>
                typeof s === "function" ? s(lvl) : s || 0;
              const lvl = attacker.level || 1;
              const hpScalar = resolveScalar(
                progressionCfg.hpPercentPerLevel,
                lvl,
              );
              const shScalar = resolveScalar(
                progressionCfg.shieldPercentPerLevel,
                lvl,
              );
              const dmgScalar = resolveScalar(
                progressionCfg.dmgPercentPerLevel,
                lvl,
              );
              const speedScalar = resolveScalar(
                (progressionCfg as any).speedPercentPerLevel,
                lvl,
              );
              const regenScalar = resolveScalar(
                (progressionCfg as any).regenPercentPerLevel,
                lvl,
              );

              const hpMul = 1 + hpScalar;
              const shMul = 1 + shScalar;
              const dmgMul = 1 + dmgScalar;
              attacker.maxHp = (attacker.maxHp || 0) * hpMul;
              attacker.hp = Math.min(
                attacker.maxHp,
                (attacker.hp || 0) * hpMul,
              );
              if (typeof attacker.maxShield === "number") {
                attacker.maxShield = (attacker.maxShield || 0) * shMul;
                attacker.shield = Math.min(
                  attacker.maxShield,
                  (attacker.shield || 0) * shMul,
                );
              }
              if (Array.isArray(attacker.cannons)) {
                for (const c of attacker.cannons) {
                  if (typeof c.damage === "number") c.damage *= dmgMul;
                }
              }
              // Apply optional speed and shield regen increases
              if (
                typeof speedScalar === "number" &&
                typeof attacker.accel === "number"
              )
                attacker.accel = attacker.accel * (1 + speedScalar);
              if (
                typeof regenScalar === "number" &&
                typeof attacker.shieldRegen === "number"
              )
                attacker.shieldRegen = attacker.shieldRegen * (1 + regenScalar);
            }
          }
          (state.explosions ||= []).push(acquireExplosion({ x: s.x, y: s.y, team: s.team, life: 0.5, ttl: 0.5 }));
          state.ships.splice(si, 1);
        }
        break;
      }
    }
  }

  // Shield regen
  for (const s of state.ships || []) {
    if (s.maxShield)
      s.shield = Math.min(
        s.maxShield,
        (s.shield || 0) + (s.shieldRegen || 0) * dtSeconds,
      );
  }

  // refresh percent convenience fields after regen
  for (const s of state.ships || []) {
    s.hpPercent = Math.max(0, Math.min(1, (s.hp || 0) / (s.maxHp || 1)));
    s.shieldPercent =
      typeof s.maxShield === "number" && s.maxShield > 0
        ? Math.max(0, Math.min(1, (s.shield || 0) / s.maxShield))
        : 0;
  }

  return state;
}

export default { simulateStep };
cent =
      typeof s.maxShield === "number" && s.maxShield > 0
        ? Math.max(0, Math.min(1, (s.shield || 0) / s.maxShield))
        : 0;
  }

  return state;
}

export default { simulateStep };
