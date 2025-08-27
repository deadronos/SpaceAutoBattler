// simulate.ts - TypeScript implementation ported from simulate.js
import { srange, srand, srandom } from "./rng";
import { createShip, updateTeamCount, normalizeTurrets } from "./entities";
import { getRuntimeShipConfigSafe } from "./config/runtimeConfigResolver";
import AssetsConfig from "./config/assets/assetsConfig";
import { progression as progressionCfg } from "./config/progressionConfig";
import { SIM, boundaryBehavior } from "./config/simConfig";
import { clampSpeed } from "./behavior";
import {
  acquireBullet,
  releaseBullet,
  acquireExplosion,
  releaseExplosion,
  acquireShieldHit,
  releaseShieldHit,
  acquireHealthHit,
  releaseHealthHit,
  releaseParticle,
} from "./gamemanager";
import type { GameState } from "./types";
import * as SpatialGridModule from "./spatialGrid";
// typed as any to avoid strict import/typing issues in this hotpath
const SpatialGrid: any =
  (SpatialGridModule as any).default || SpatialGridModule;
const segmentIntersectsCircle: any = (SpatialGridModule as any)
  .segmentIntersectsCircle;

export type Bounds = { W: number; H: number };

// SIM constants migrated to simConfig.ts
// Use SIM.DT_MS and SIM.MAX_ACC_MS instead

function dist2(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function simulateStep(
  state: GameState,
  dtSeconds: number,
  bounds: Bounds,
) {
  pruneAll(state, dtSeconds, bounds);
  // Advance time
  state.t = (state.t || 0) + dtSeconds;

  // Move bullets and handle boundary behavior
  for (let i = (state.bullets || []).length - 1; i >= 0; i--) {
    const b = state.bullets[i];
    // store previous position for swept collision tests (both legacy and
    // internal names). Some compiled code reads _prevX/_prevY while other
    // paths read prevX/prevY; keep them synchronized.
    const prevXVal = typeof b.x === "number" ? b.x : 0;
    const prevYVal = typeof b.y === "number" ? b.y : 0;
    b.prevX = prevXVal;
    b.prevY = prevYVal;
    (b as any)._prevX = prevXVal;
    (b as any)._prevY = prevYVal;
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
        case "remove":
          remove = true;
          break;
        case "wrap":
          if (b.x < 0) b.x += bounds.W;
          if (b.x >= bounds.W) b.x -= bounds.W;
          if (b.y < 0) b.y += bounds.H;
          if (b.y >= bounds.H) b.y -= bounds.H;
          break;
        case "bounce":
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
    if (remove) {
      try {
        releaseBullet(state, b);
      } catch (e) {}
    }
  }
  // Batched in-place pruning for all high-frequency event arrays
  function pruneAll(state: GameState, dtSeconds: number, bounds: Bounds) {
    // Ensure all event arrays are initialized
    state.particles = state.particles || [];
    state.explosions = state.explosions || [];
    state.shieldHits = state.shieldHits || [];
    state.healthHits = state.healthHits || [];
    state.flashes = state.flashes || [];
    state.shieldFlashes = state.shieldFlashes || [];
    state.healthFlashes = state.healthFlashes || [];
    // Bullets: prune expired/out-of-bounds
    let writeBullet = 0;
    for (let read = 0; read < state.bullets.length; read++) {
      const b = state.bullets[read];
      const prevXVal = typeof b.x === "number" ? b.x : 0;
      const prevYVal = typeof b.y === "number" ? b.y : 0;
      b.prevX = prevXVal;
      b.prevY = prevYVal;
      (b as any)._prevX = prevXVal;
      (b as any)._prevY = prevYVal;
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
          case "remove":
            remove = true;
            break;
          case "wrap":
            if (b.x < 0) b.x += bounds.W;
            if (b.x >= bounds.W) b.x -= bounds.W;
            if (b.y < 0) b.y += bounds.H;
            if (b.y >= bounds.H) b.y -= bounds.H;
            break;
          case "bounce":
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
      if (!remove) {
        state.bullets[writeBullet++] = b;
      } else {
        releaseBullet(state, b);
      }
    }
    state.bullets.length = writeBullet;

    // Particles: prune expired
    let writeParticle = 0;
    for (let read = 0; read < state.particles.length; read++) {
      const p = state.particles[read];
      p.life = (p.life || p.ttl || 0) - dtSeconds;
      if (p.life > 0) {
        state.particles[writeParticle++] = p;
      } else {
        releaseParticle(p);
      }
    }
    state.particles.length = writeParticle;

    // Explosions: prune expired
    let writeExplosion = 0;
    for (let read = 0; read < state.explosions.length; read++) {
      const e = state.explosions[read];
      e.life = (e.life || e.ttl || 0) - dtSeconds;
      if (e.life > 0) {
        state.explosions[writeExplosion++] = e;
      } else {
        releaseExplosion(e);
      }
    }
    state.explosions.length = writeExplosion;

    // ShieldHits: prune out-of-bounds
    let writeShield = 0;
    for (let read = 0; read < state.shieldHits.length; read++) {
      const sh = state.shieldHits[read];
      if (
        typeof sh.x === "number" &&
        typeof sh.y === "number" &&
        sh.x >= 0 &&
        sh.x < bounds.W &&
        sh.y >= 0 &&
        sh.y < bounds.H
      ) {
        state.shieldHits[writeShield++] = sh;
      } else {
        releaseShieldHit(sh);
      }
    }
    state.shieldHits.length = writeShield;

    // HealthHits: prune out-of-bounds
    let writeHealth = 0;
    for (let read = 0; read < state.healthHits.length; read++) {
      const hh = state.healthHits[read];
      if (
        typeof hh.x === "number" &&
        typeof hh.y === "number" &&
        hh.x >= 0 &&
        hh.x < bounds.W &&
        hh.y >= 0 &&
        hh.y < bounds.H
      ) {
        state.healthHits[writeHealth++] = hh;
      } else {
        releaseHealthHit(hh);
      }
    }
    state.healthHits.length = writeHealth;
  }

  // Move ships and update heading
  // Precompute parent->fighter count map once per frame to avoid O(N) filters per carrier
  const fighterCountsByParent: Map<number, number> = new Map();
  try {
    for (const sh of state.ships || []) {
      if (sh && sh.parentId && sh.type === "fighter") {
        const pid = Number(sh.parentId);
        fighterCountsByParent.set(pid, (fighterCountsByParent.get(pid) || 0) + 1);
      }
    }
  } catch (e) {}
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

    // Apply friction/damping to velocity (from simConfig)
    const friction = typeof SIM.friction === "number" ? SIM.friction : 0.98;
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
        case "remove":
          remove = true;
          break;
        case "wrap":
          if (s.x < -r) s.x += bounds.W + r * 2;
          if (s.x > bounds.W + r) s.x -= bounds.W + r * 2;
          if (s.y < -r) s.y += bounds.H + r * 2;
          if (s.y > bounds.H + r) s.y -= bounds.H + r * 2;
          break;
        case "bounce":
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
    if (remove) {
      const rem = state.ships.splice(si, 1);
      if (rem && rem.length) {
        try {
          (state as any).shipMap && (state as any).shipMap.delete(rem[0].id);
        } catch (e) {}
        try {
          if (rem[0] && rem[0].team)
            state.teamCounts[rem[0].team] = Math.max(
              0,
              (state.teamCounts[rem[0].team] || 0) - 1,
            );
        } catch (e) {}
      }
    }
    // --- Turret per-frame integration: advance turret.angle toward targetAngle using turnRate ---
    try {
      // Normalize turret definitions via single helper so tuple shorthand
      // ([x,y]) and object turrets are made consistent across systems before AI
      try {
        normalizeTurrets(s as any);
      } catch (e) {}
      // Basic turret AI: if turret has no explicit targetAngle, aim at nearest enemy ship
      try {
        if (
          Array.isArray(state.ships) &&
          Array.isArray((s as any).turrets) &&
          (s as any).turrets.length
        ) {
          for (let ti = 0; ti < (s as any).turrets.length; ti++) {
            try {
              const t = (s as any).turrets[ti];
              if (!t || Array.isArray(t)) continue; // skip tuple mounts
              // If caller already provided a targetAngle, don't override
              if (typeof t.targetAngle === "number") continue;
              // Find nearest enemy ship (team different from s.team)
              let best: any = null;
              let bestDist = Infinity;
              for (const other of state.ships || []) {
                if (!other || other.id === s.id) continue;
                if (other.team === s.team) continue;
                const dx = (other.x || 0) - (s.x || 0);
                const dy = (other.y || 0) - (s.y || 0);
                const d2 = dx * dx + dy * dy;
                if (d2 < bestDist) {
                  bestDist = d2;
                  best = other;
                }
              }
              if (best) {
                // Compute desired world angle from turret mount to target
                const mount = Array.isArray(t.position)
                  ? {
                      x:
                        (Math.cos(s.angle || 0) * t.position[0] -
                          Math.sin(s.angle || 0) * t.position[1]) *
                          (s.radius || 12) +
                        (s.x || 0),
                      y:
                        (Math.sin(s.angle || 0) * t.position[0] +
                          Math.cos(s.angle || 0) * t.position[1]) *
                          (s.radius || 12) +
                        (s.y || 0),
                    }
                  : { x: s.x || 0, y: s.y || 0 };
                const desiredWorld = Math.atan2(
                  (best.y || 0) - mount.y,
                  (best.x || 0) - mount.x,
                );
                // Store targetAngle as local angle relative to ship (so simulate integration uses local space)
                // Store targetAngle as local angle relative to ship (so simulate integration uses local space)
                // Note: ensure we normalize into -PI..PI to avoid opposite-angle miswrap
                let local = desiredWorld - (s.angle || 0);
                while (local < -Math.PI) local += Math.PI * 2;
                while (local > Math.PI) local -= Math.PI * 2;
                t.targetAngle = local;
              }
            } catch (e) {}
          }
        }
      } catch (e) {}
      // Normalize turret definitions via single helper so tuple shorthand
      // ([x,y]) and object turrets are made consistent across systems.
      try {
        normalizeTurrets(s as any);
      } catch (e) {}
      // Ensure per-turret numeric fields and integrate turret angles
      if (Array.isArray((s as any).turrets) && (s as any).turrets.length) {
        const turretDefs = (s as any).turrets;
        for (let ti = 0; ti < turretDefs.length; ti++) {
          try {
            const t = turretDefs[ti];
            if (!t) continue;
            // Ensure numeric fields exist and perform per-turret integration
            t.angle =
              typeof t.angle === "number"
                ? t.angle
                : typeof (s as any).turretAngle === "number"
                  ? (s as any).turretAngle
                  : s.angle || 0;
            t.targetAngle =
              typeof t.targetAngle === "number"
                ? t.targetAngle
                : typeof t.desiredAngle === "number"
                  ? t.desiredAngle
                  : t.angle;
            // Determine turret turnRate: use instance value, else turretDefaults by kind, else fallback
            let defaultTurn = Math.PI * 1.5;
            try {
              const td =
                (AssetsConfig as any).turretDefaults &&
                (AssetsConfig as any).turretDefaults[t.kind || "basic"];
              if (td && typeof td.turnRate === "number")
                defaultTurn = td.turnRate;
            } catch (e) {}
            const maxTurn =
              (typeof t.turnRate === "number" ? t.turnRate : defaultTurn) *
              dtSeconds;
            // Shortest angular difference
            let diff = t.targetAngle - t.angle;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            const step = Math.sign(diff) * Math.min(Math.abs(diff), maxTurn);
            t.angle = t.angle + step;
            // Normalize angle into -PI..PI
            while (t.angle < -Math.PI) t.angle += Math.PI * 2;
            while (t.angle > Math.PI) t.angle -= Math.PI * 2;
            turretDefs[ti] = t;
          } catch (e) {}
        }
      }
    } catch (e) {}
    // Carrier spawning: if this ship type has a carrier config, accumulate
    // a per-ship timer and spawn fighters as children up to maxFighters.
    try {
      // Resolve ship config via centralized, ESM/CJS-safe runtime resolver
      const shipCfg: any = getRuntimeShipConfigSafe();
      const typeCfg = shipCfg && s.type ? shipCfg[s.type] : undefined;
      // Treat ships explicitly typed as 'carrier' as carrier-capable even if config missing
      if (s.type === "carrier" || (typeCfg && (typeCfg as any).carrier)) {
        const carrierCfg = (typeCfg && (typeCfg as any).carrier) || {
          fighterCooldown: 1.5,
          maxFighters: 6,
          spawnPerCooldown: 2,
        };
        // ensure timer exists
        (s as any)._carrierTimer = (s as any)._carrierTimer || 0;
        (s as any)._carrierTimer += dtSeconds;
        const cooldown = Number(carrierCfg.fighterCooldown) || 1.5;
        if ((s as any)._carrierTimer >= cooldown) {
          (s as any)._carrierTimer = 0;
          // use precomputed count map instead of per-carrier filter
          const existing = fighterCountsByParent.get(s.id) || 0;
          const maxF = Number(carrierCfg.maxFighters) || 0;
          const spawnPer = Number(carrierCfg.spawnPerCooldown) || 1;
          const canSpawn = Math.max(0, maxF - existing);
          let toSpawn = Math.min(canSpawn, spawnPer);
          while (toSpawn > 0) {
            const angle = srandom() * Math.PI * 2;
            const dist = (s.radius || 20) + 8 + srandom() * 8;
            const nx = (s.x || 0) + Math.cos(angle) * dist;
            const ny = (s.y || 0) + Math.sin(angle) * dist;
            try {
              const f = createShip("fighter", nx, ny, s.team);
              f.parentId = s.id;
              f.angle = s.angle;
              (state.ships ||= []).push(f);
              // update cached fighter count for this parent
              fighterCountsByParent.set(s.id, (fighterCountsByParent.get(s.id) || 0) + 1);
              try {
                (state as any).shipMap && (state as any).shipMap.set(f.id, f);
              } catch (e) {}
              try {
                updateTeamCount(state as any, undefined, String(f.team));
              } catch (e) {}
            } catch (e) {}
            toSpawn--;
          }
        }
      }
    } catch (e) {}
  }

  // Bullet collisions
  // Use spatial grid to reduce collision checks from O(N*M) to local queries
  // Acquire a pooled grid instance and reuse it between frames to avoid allocations
  const cellSize = (SIM && (SIM as any).gridCellSize) || 64;
  const grid = SpatialGrid.acquire(cellSize);
  const ships = state.ships || [];
  for (let i = 0; i < ships.length; i++) grid.insert(ships[i]);
  // Track ships removed during collision processing to avoid double-collision
  const removedShipIds = new Set<any>();

  for (let bi = (state.bullets || []).length - 1; bi >= 0; bi--) {
    const b = state.bullets[bi];
    const searchRadius = (b.radius || 1) + 64; // conservative search radius (cell-sized)
    const candidates = grid.queryRadius(b.x || 0, b.y || 0, searchRadius);
    let collided = false;
    for (let ci = 0; ci < candidates.length; ci++) {
      const s = candidates[ci];
      if (!s || removedShipIds.has(s.id)) continue;
      if (s.team === b.team) continue;
      const r = (s.radius || 6) + (b.radius || 1);
      // Swept collision: check segment from previous bullet pos (if available) to current pos
      const bxPrev =
        typeof (b as any)._prevX === "number"
          ? (b as any)._prevX
          : b.x - (b.vx || 0) * dtSeconds;
      const byPrev =
        typeof (b as any)._prevY === "number"
          ? (b as any)._prevY
          : b.y - (b.vy || 0) * dtSeconds;
      const didHit =
        dist2(b, s) <= r * r ||
        segmentIntersectsCircle(
          bxPrev,
          byPrev,
          b.x || 0,
          b.y || 0,
          s.x || 0,
          s.y || 0,
          r,
        );
      if (didHit) {
        const attacker =
          typeof b.ownerId === "number" || typeof b.ownerId === "string"
            ? (state as any).shipMap &&
              (state as any).shipMap.get(Number(b.ownerId))
            : (undefined as any);
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
          (state.shieldHits ||= []).push(
            acquireShieldHit(state, {
              id: s.id,
              x: b.x,
              y: b.y,
              team: s.team,
              amount: absorbed,
              hitAngle,
            }),
          );
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
            // Apply armor reduction to damage dealt to hull. Each armor point
            // reduces incoming hull damage by 10% (config uses small integers).
            const armor = s.armor || 0;
            const dmgMul = Math.max(0, 1 - 0.1 * armor);
            const dealt = Math.max(0, remaining * dmgMul);
            s.hp -= dealt;
            (state.healthHits ||= []).push(
              acquireHealthHit(state, {
                id: s.id,
                x: b.x,
                y: b.y,
                team: s.team,
                amount: dealt,
              }),
            );
            // expose damage event for renderer (health hit)
            (state.damageEvents ||= []).push({
              id: s.id,
              type: "hp",
              amount: dealt,
              x: b.x,
              y: b.y,
              team: s.team,
              attackerId: attacker && attacker.id,
            });
          }
          dealtToShield = absorbed;
          // remaining damage after shields, reduced by armor
          const remainingAfterShield = Math.max(0, (b.damage || 0) - absorbed);
          const armorAfterShield = s.armor || 0;
          dealtToHealth = Math.max(
            0,
            remainingAfterShield * Math.max(0, 1 - 0.1 * armorAfterShield),
          );
        } else {
          // No shields - apply armor reduction directly to bullet damage
          const armor = s.armor || 0;
          const dmgMulNoShield = Math.max(0, 1 - 0.1 * armor);
          const dealtNoShield = Math.max(0, (b.damage || 0) * dmgMulNoShield);
          s.hp -= dealtNoShield;
          (state.healthHits ||= []).push(
            acquireHealthHit(state, {
              id: s.id,
              x: b.x,
              y: b.y,
              team: s.team,
              amount: dealtNoShield,
            }),
          );
          // expose damage event for renderer (health hit)
          (state.damageEvents ||= []).push({
            id: s.id,
            type: "hp",
            amount: dealtNoShield,
            x: b.x,
            y: b.y,
            team: s.team,
            attackerId: attacker && attacker.id,
          });
          dealtToHealth = dealtNoShield;
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

        try {
          releaseBullet(state, b);
        } catch (e) {
          try {
            state.bullets.splice(bi, 1);
          } catch (e) {}
        }
        collided = true;
        // No need to check other candidates for this bullet
        if (s.hp <= 0) {
          if (attacker) {
            attacker.xp = (attacker.xp || 0) + (progressionCfg.xpPerKill || 0);
            while (
              (attacker.xp || 0) >=
              progressionCfg.xpToLevel(attacker.level || 1)
            ) {
              attacker.xp -= progressionCfg.xpToLevel(attacker.level || 1);
              attacker.level = (attacker.level || 1) + 1;
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
          (state.explosions ||= []).push(
            acquireExplosion(state, {
              x: s.x,
              y: s.y,
              team: s.team,
              life: 0.5,
              ttl: 0.5,
            }),
          );
          // remove from ships array and mark as removed for this frame
          const idx = (state.ships || []).findIndex(
            (sh: any) => sh && sh.id === s.id,
          );
          if (idx >= 0) {
            state.ships.splice(idx, 1);
            try {
              (state as any).shipMap && (state as any).shipMap.delete(s.id);
            } catch (e) {}
            try {
              if (s && s.team)
                state.teamCounts[s.team] = Math.max(
                  0,
                  (state.teamCounts[s.team] || 0) - 1,
                );
            } catch (e) {}
          }
          removedShipIds.add(s.id);
        }
        break;
      }
    }
    // continue to next bullet
  }
  // release pooled grid for reuse next frame
  SpatialGrid.release(grid);

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
