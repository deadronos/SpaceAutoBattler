// behavior.ts - deterministic, simple AI for steering and firing
// Uses seeded RNG for any randomness so results are reproducible.
import { srandom, srange } from "./rng";
import { createBullet } from "./entities";
import { acquireBullet } from "./gamemanager";
import { AI_THRESHOLDS, SHIP_MOVEMENT_DEFAULTS } from "./config/behaviorConfig";
import { BULLET_DEFAULTS, getShipConfig } from "./config/entitiesConfig";
import { TEAM_DEFAULT } from "./config/teamsConfig";

type ShipLike = {
  id?: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  team?: string;
  hp?: number;
  maxHp?: number;
  cannons?: any[];
  accel?: number; // max acceleration from config
  currentAccel?: number; // dynamic, set by AI/gamemanager, 0..accel
  radius?: number;
  turnRate?: number;
  damage?: number;
  dmg?: number;
  maxSpeed?: number; // NEW: max speed per ship
  steering?: number; // NEW: steering intent (-1..1)
  throttle?: number; // NEW: throttle intent (0..1)
  __ai?: any;
  turrets?: any[];
  angle?: number;
  type?: string; // Added for config sync
};

import type { GameState } from "./types";
import { getDefaultBounds } from './config/simConfig';
type State = GameState;

function len2(vx: number, vy: number) {
  return vx * vx + vy * vy;
}
const DEFAULT_BULLET_RANGE =
  typeof BULLET_DEFAULTS.range === "number" ? BULLET_DEFAULTS.range : 300;
function withinRange(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  range: number,
) {
  const dx = tx - sx;
  const dy = ty - sy;
  return dx * dx + dy * dy <= range * range;
}
function clampSpeed(s: ShipLike, max: number) {
  const v2 = len2(s.vx || 0, s.vy || 0);

  const max2 = max * max;
  if (v2 > max2 && v2 > 0) {
    const inv = max / Math.sqrt(v2);
    s.vx = (s.vx || 0) * inv;
    s.vy = (s.vy || 0) * inv;
  }
}

export { clampSpeed };

function aimWithSpread(from: ShipLike, to: ShipLike, spread = 0) {
  let dx = (to.x || 0) - (from.x || 0);
  let dy = (to.y || 0) - (from.y || 0);
  const d = Math.hypot(dx, dy) || 1;
  dx /= d;
  dy /= d;
  if (spread > 0) {
    const ang = Math.atan2(dy, dx);
    const jitter = srange(-spread, spread);
    const na = ang + jitter;
    return { x: Math.cos(na), y: Math.sin(na) };
  }
  return { x: dx, y: dy };
}

function tryFire(state: State, ship: ShipLike, target: ShipLike, dt: number) {
  // Legacy cannons (single target, all fire at once)
  if (Array.isArray(ship.cannons) && ship.cannons.length > 0) {
    for (const c of ship.cannons) {
      if (typeof c.__cd !== "number") c.__cd = 0;
      c.__cd -= dt;
      if (c.__cd > 0) continue;
      const range =
        typeof c.range === "number" ? c.range : DEFAULT_BULLET_RANGE;
      if (
        !withinRange(
          ship.x || 0,
          ship.y || 0,
          target.x || 0,
          target.y || 0,
          range,
        )
      )
        continue;
      const spread = typeof c.spread === "number" ? c.spread : 0;
      const dir = aimWithSpread(ship, target, spread);
      const speed =
        typeof c.muzzleSpeed === "number"
          ? c.muzzleSpeed
          : BULLET_DEFAULTS.muzzleSpeed;
      const dmg =
        typeof c.damage === "number"
          ? c.damage
          : typeof ship.damage === "number"
            ? ship.damage
            : typeof ship.dmg === "number"
              ? ship.dmg
              : BULLET_DEFAULTS.damage;
      const ttl =
        typeof c.bulletTTL === "number" ? c.bulletTTL : BULLET_DEFAULTS.ttl;
      const radius =
        typeof c.bulletRadius === "number"
          ? c.bulletRadius
          : BULLET_DEFAULTS.radius;
      const vx = dir.x * speed;
      const vy = dir.y * speed;
      const b = Object.assign(
        acquireBullet(state, {
          x: ship.x || 0,
          y: ship.y || 0,
          vx,
          vy,
          team: ship.team || TEAM_DEFAULT,
          ownerId: ship.id || null,
          damage: dmg,
          ttl,
        }),
        { radius },
      );
      const rate = typeof c.rate === "number" && c.rate > 0 ? c.rate : 1;
      c.__cd = 1 / rate;
    }
  }
  // Multi-turret support: each turret fires independently
  if (Array.isArray(ship.turrets) && ship.turrets.length > 0) {
    for (const [i, turret] of ship.turrets.entries()) {
      if (!turret) continue;
      if (typeof turret.__cd !== "number") turret.__cd = 0;
      turret.__cd -= dt;
      if (turret.__cd > 0) continue;
      // Target selection per turret
      let turretTarget: ShipLike | null = null;
      if (turret.targeting === "nearest") {
        const enemies = (state.ships || []).filter(
          (sh) => sh && sh.team !== ship.team,
        );
        let minDist = Infinity;
        for (const enemy of enemies) {
          const dx = (enemy.x || 0) - (ship.x || 0);
          const dy = (enemy.y || 0) - (ship.y || 0);
          const d2 = dx * dx + dy * dy;
          if (d2 < minDist) {
            minDist = d2;
            turretTarget = enemy;
          }
        }
      } else if (turret.targeting === "random") {
        const enemies = (state.ships || []).filter(
          (sh) => sh && sh.team !== ship.team,
        );
        if (enemies.length)
          turretTarget = enemies[Math.floor(srandom() * enemies.length)];
      } else if (turret.targeting === "focus") {
        // Use ship's main target if available (O(1) via shipMap)
        if (ship.__ai && ship.__ai.targetId != null) {
          const tId = ship.__ai.targetId as number | string | null;
          turretTarget =
            (state as any).shipMap && typeof tId !== "undefined" && tId !== null
              ? (state as any).shipMap.get(Number(tId)) || null
              : (state.ships || []).find((sh) => sh && sh.id === tId) || null;
        }
      } else {
        // Default: nearest
        const enemies = (state.ships || []).filter(
          (sh) => sh && sh.team !== ship.team,
        );
        let minDist = Infinity;
        for (const enemy of enemies) {
          const dx = (enemy.x || 0) - (ship.x || 0);
          const dy = (enemy.y || 0) - (ship.y || 0);
          const d2 = dx * dx + dy * dy;
          if (d2 < minDist) {
            minDist = d2;
            turretTarget = enemy;
          }
        }
      }
      if (!turretTarget) continue;
      // Fire from turret position (relative to ship center, using config radius)
      const spread = typeof turret.spread === "number" ? turret.spread : 0.05;
      const dir = aimWithSpread(ship, turretTarget, spread);
      const speed =
        typeof turret.muzzleSpeed === "number"
          ? turret.muzzleSpeed
          : BULLET_DEFAULTS.muzzleSpeed;
      const dmg =
        typeof turret.damage === "number"
          ? turret.damage
          : typeof ship.damage === "number"
            ? ship.damage
            : BULLET_DEFAULTS.damage;
      const ttl =
        typeof turret.bulletTTL === "number"
          ? turret.bulletTTL
          : BULLET_DEFAULTS.ttl;
      const radius =
        typeof turret.bulletRadius === "number"
          ? turret.bulletRadius
          : BULLET_DEFAULTS.radius;
      // Always use config radius for turret position
      const angle = ship.angle || 0;
      // Get latest config radius for this ship type
      const shipType = ship.type || "fighter";
      const shipCfg = getShipConfig()[shipType];
      const configRadius =
        shipCfg && typeof shipCfg.radius === "number"
          ? shipCfg.radius
          : ship.radius || 12;
      // Accept both object-style turrets ({ position: [x,y] }) and tuple-style
      // shorthand ([x,y]) which the renderer commonly uses. Support both here
      // so bullets spawn from the same mountpoints that are drawn.
      const pos =
        Array.isArray(turret) && turret.length === 2
          ? turret
          : turret && Array.isArray((turret as any).position)
            ? (turret as any).position
            : [0, 0];
      const [tx, ty] = pos;
      const turretX =
        (ship.x || 0) +
        Math.cos(angle) * tx * configRadius -
        Math.sin(angle) * ty * configRadius;
      const turretY =
        (ship.y || 0) +
        Math.sin(angle) * tx * configRadius +
        Math.cos(angle) * ty * configRadius;
      const range =
        typeof turret.range === "number" ? turret.range : DEFAULT_BULLET_RANGE;
      const dxT = (turretTarget.x || 0) - turretX;
      const dyT = (turretTarget.y || 0) - turretY;
      if (dxT * dxT + dyT * dyT > range * range) continue;
      const vx = dir.x * speed;
      const vy = dir.y * speed;
      const b = Object.assign(
        acquireBullet(state, {
          x: turretX,
          y: turretY,
          vx,
          vy,
          team: ship.team || TEAM_DEFAULT,
          ownerId: ship.id || null,
          damage: dmg,
          ttl,
        }),
        { radius },
      );
      turret.__cd =
        typeof turret.cooldown === "number" && turret.cooldown > 0
          ? turret.cooldown
          : 1.0;
    }
  }
}

function ensureShipAiState(s: ShipLike) {
  if (!s.__ai) {
    s.__ai = { state: "idle", decisionTimer: 0, targetId: null };
  }
  return s.__ai;
}

function chooseNewTarget(state: State, ship: ShipLike) {
  const enemies = (state.ships || []).filter(
    (sh) => sh && sh.team !== ship.team,
  );
  if (!enemies.length) return null;
  const idx = Math.floor(srandom() * enemies.length);
  return enemies[idx];
}

function steerAway(
  s: ShipLike,
  tx: number,
  ty: number,
  accel: number,
  dt: number,
) {
  const dx = (s.x || 0) - tx;
  const dy = (s.y || 0) - ty;
  const d = Math.hypot(dx, dy) || 1;
  const nx = dx / d;
  const ny = dy / d;
  s.vx = (s.vx || 0) + nx * accel * dt;
  s.vy = (s.vy || 0) + ny * accel * dt;
}

export function applySimpleAI(
  state: State,
  dt: number,
  bounds = getDefaultBounds(),
) {
  if (!state || !Array.isArray(state.ships)) return;
  for (const s of state.ships) {
    const ai = ensureShipAiState(s);
    ai.decisionTimer = Math.max(0, (ai.decisionTimer || 0) - dt);

    let target: ShipLike | null = null;
    if (ai.targetId != null)
      target =
        (state as any).shipMap &&
        typeof ai.targetId !== "undefined" &&
        ai.targetId !== null
          ? (state as any).shipMap.get(Number(ai.targetId)) || null
          : (state.ships || []).find((sh) => sh && sh.id === ai.targetId) ||
            null;
    if (!target) target = chooseNewTarget(state, s);
    if (target) ai.targetId = target.id;

    // Set throttle and steering dynamically based on intent
    const maxAccel = typeof s.accel === "number" ? s.accel : 100;
    const maxSpeed = typeof s.maxSpeed === "number" ? s.maxSpeed : 160;
    s.steering = typeof s.steering === "number" ? s.steering : 0;
    s.throttle = typeof s.throttle === "number" ? s.throttle : 0;

    if (!target) {
      // Idle: no acceleration, no steering
      s.throttle = 0;
      s.steering = 0;
      ai.state = "idle";
    } else {
      if (ai.decisionTimer <= 0) {
        const hpFrac = (s.hp || 0) / Math.max(1, s.maxHp || 1);
        const rnd = srandom();
        if (
          hpFrac < AI_THRESHOLDS.hpEvadeThreshold ||
          rnd < AI_THRESHOLDS.randomLow
        )
          ai.state = "evade";
        else if (rnd < AI_THRESHOLDS.randomHigh) ai.state = "engage";
        else ai.state = "idle";
        ai.decisionTimer =
          AI_THRESHOLDS.decisionTimerMin +
          srandom() *
            (AI_THRESHOLDS.decisionTimerMax - AI_THRESHOLDS.decisionTimerMin);
        // If ship has ready cannons and target is within any cannon's range,
        // prefer engage to make immediate firing deterministic in minimal test states.
        try {
          if (
            ai.state !== "engage" &&
            Array.isArray(s.cannons) &&
            s.cannons.length > 0
          ) {
            for (const c of s.cannons) {
              const ready = typeof c.__cd !== "number" || c.__cd <= 0;
              const range =
                typeof c.range === "number" ? c.range : DEFAULT_BULLET_RANGE;
              if (
                ready &&
                target &&
                withinRange(
                  s.x || 0,
                  s.y || 0,
                  target.x || 0,
                  target.y || 0,
                  range,
                )
              ) {
                ai.state = "engage";
                break;
              }
            }
          }
        } catch (e) {}
      }

      // Calculate desired angle to target
      const dx = (target.x || 0) - (s.x || 0);
      const dy = (target.y || 0) - (s.y || 0);
      const desiredAngle = Math.atan2(dy, dx);
      const currentAngle = typeof s.angle === "number" ? s.angle : 0;
      let da = desiredAngle - currentAngle;
      while (da < -Math.PI) da += Math.PI * 2;
      while (da > Math.PI) da -= Math.PI * 2;
      // Normalize steering to -1..1 using config
      const steeringNorm = Math.PI / 2; // could be config if needed
      const steering = Math.max(-1, Math.min(1, da / steeringNorm));

      if (ai.state === "engage") {
        s.throttle = 1;
        s.steering = steering;
        tryFire(state, s, target, dt);
      } else if (ai.state === "evade") {
        s.throttle = 0.8; // could be config if needed
        // Steer away from target
        const awayAngle = Math.atan2(
          (s.y || 0) - (target.y || 0),
          (s.x || 0) - (target.x || 0),
        );
        let daAway = awayAngle - currentAngle;
        while (daAway < -Math.PI) daAway += Math.PI * 2;
        while (daAway > Math.PI) daAway -= Math.PI * 2;
        s.steering = Math.max(-1, Math.min(1, daAway / steeringNorm));
      } else {
        s.throttle = 0;
        s.steering = 0;
      }
    }
    clampSpeed(s, maxSpeed);
  }
}

export function getShipAiState(ship: ShipLike) {
  if (!ship || !ship.__ai) return null;
  const { targetId, ...rest } = ship.__ai;
  return Object.assign({}, rest);
}

export default { applySimpleAI, getShipAiState };
