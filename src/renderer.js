import { srand, srange, srangeInt, unseed } from './rng.js';
import { simulateStep } from './simulate.js';
import { Ship, Team, spawnFleet } from './entities.js';

let canvas, ctx, W, H;
// (Removed duplicate export statement; exports are already declared at the top level)

export function initRenderer() {
  canvas = document.getElementById('world');
  ctx = canvas.getContext('2d');
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
  window.addEventListener('resize', () => { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; });
}

// Helper to allow tests to inject a mock canvas context via global.ctx
function ensureCtx() {
  // If a test injects a mock canvas context as global.ctx prefer that so tests can
  // control drawing even if a real canvas context was previously assigned by initRenderer.
  if (typeof globalThis !== 'undefined' && globalThis.ctx) {
    ctx = globalThis.ctx;
    return ctx;
  }
  // Treat undefined or null ctx as "not set" otherwise
  if ((typeof ctx === 'undefined' || ctx === undefined || ctx === null) && typeof globalThis !== 'undefined' && globalThis.ctx) {
    ctx = globalThis.ctx;
  }
  return ctx;
}

// Renderer-global visual state (safe defaults so module can be imported in Node tests)
const particles = [];
const flashes = [];
const shieldFlashes = [];
const healthFlashes = [];
/**
 * Transient level-up animation entries.
 * Each entry is an object: { id: <shipId>, life: <seconds remaining> }.
 * Renderer uses these to animate (scale/glow) the level pill for a short time
 * when a ship's `level` increments.
 */
const levelFlashes = [];
const shipsVMap = new Map();
let ships = [];
let bullets = [];
let lastTime = 0;
let running = false;
export let speed = 1;
let showTrails = true;
const score = { red: 0, blue: 0 };

export { particles, flashes, shieldFlashes, healthFlashes, levelFlashes, shipsVMap, ships, bullets, lastTime, running, showTrails, score };

// canonical speed steps for UI control (exported so tests can assert the real values)
export const SPEED_STEPS = [0.5, 1, 2, 4];

// `state` is the simulation state object used by simulateStep; expose a simple wrapper
export const state = { ships, bullets, score, particles, shieldHits: [], healthHits: [], explosions: [] };

// --- Utilities ---
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// Use seeded RNG helpers from rng.js so visual randomness can be controlled by srand(seed)
const rand = (min=0, max=1) => srange(min, max);
const randInt = (min, max) => srangeInt(min, max);

// small helper to draw rounded rectangles (x, y, w, h, r)
function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, h/2, w/2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

// UI toast
export function toast(msg) { if (!document) return; const t = document.getElementById('toast'); if (!t) return; t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 1400); }

// Starfield background (parallax)
const stars = [];
function initStars() {
  stars.length = 0;
  const layers = [0.2, 0.5, 1.0];
  for (const depth of layers) {
    for (let i=0;i<120;i++) {
      stars.push({ x: rand(0,W), y: rand(0,H), r: rand(0.3, 1.8) * depth, d: depth, tw: rand(0.4,1), phase: rand(0,TAU) });
    }
  }
}
initStars();

// --- Entities (renderer-local) ---
export const teamColor = (t, alpha=1) => t===Team.RED ? `rgba(255,90,90,${alpha})` : `rgba(80,160,255,${alpha})`;

// Pick a random ship type (uses seeded srangeInt)
export function randomShipType() {
  const types = ['corvette','frigate','destroyer','carrier','fighter'];
  const idx = srangeInt(0, types.length - 1);
  return types[idx];
}

// Test helper: perform the same actions as the UI add buttons. Exported so tests
// can call this directly to avoid timing/RAF issues and to keep RNG consumption
// identical to the UI.
export function createShipFromUI(team) {
  const t = randomShipType();
  if (team === Team.RED) {
    const x = srange(40, W * 0.35);
    const y = srange(80, H - 80);
    ships.push(new Ship(Team.RED, x, y, t));
    if (typeof toast === 'function') toast(`+1 Red (${t})`);
  } else {
    const x = srange(W * 0.65, W - 40);
    const y = srange(80, H - 80);
    ships.push(new Ship(Team.BLUE, x, y, t));
    if (typeof toast === 'function') toast(`+1 Blue (${t})`);
  }
}

// Small testing-only API surface to group helpers used by tests. This keeps
// test imports tidy and makes it clear these are testing utilities.
export const testHelpers = {
  createShipFromUI,
  randomShipType,
  ships,
  state,
};

export class Particle {
  constructor(x,y,vx,vy,life,color){ this.x=x; this.y=y; this.vx=vx; this.vy=vy; this.life=life; this.max=life; this.color=color; }
  update(dt){ this.x+=this.vx*dt; this.y+=this.vy*dt; this.vx*=Math.pow(0.9,dt*60); this.vy*=Math.pow(0.9,dt*60); this.life-=dt; }
  draw(){ if (this.life<=0) return; const a = this.life/this.max; ensureCtx(); if (typeof ctx === 'undefined' || !ctx) return; ctx.fillStyle = this.color.replace('$a', a.toFixed(3)); ctx.fillRect(this.x, this.y, 2,2); }
}

// Keep Ship logic in entities.js, renderer keeps visual helpers and particle/flash handling.
// Visual Ship wrapper to reference logic ship instance
export class ShipV {
  constructor(shipLogic){ this.logic = shipLogic; this.id = shipLogic.id; this.team = shipLogic.team; this.x = shipLogic.x; this.y = shipLogic.y; this.type = shipLogic.type; }
  syncFromLogic(){ this.x = this.logic.x; this.y = this.logic.y; this.type = this.logic.type; this.alive = this.logic.alive; }
  draw(){
    const s = this.logic;
    if (!s.alive) return;
  ensureCtx();
  // compute whether this ship has a recent shield hit (look for flashes with shieldHit)
  const recentShieldFlash = flashes.some(f => f.shieldHit && f.x === s.x && f.y === s.y && f.life > 0);
    // trails
    if (showTrails){ const tx = s.x - Math.cos(s.angle)*s.radius*1.2; const ty = s.y - Math.sin(s.angle)*s.radius*1.2; particles.push(new Particle(tx, ty, -s.vx*0.05 + srange(-10,10), -s.vy*0.05 + srange(-10,10), .25, teamColor(s.team, '$a'))); }

    // Draw hull by type with scale from radius
    if (typeof ctx !== 'undefined') { ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.angle); ctx.shadowBlur = 12; ctx.shadowColor = teamColor(s.team,.9); }
    const r = s.radius || 8;
    // base fill
    if (typeof ctx !== 'undefined') ctx.fillStyle = teamColor(s.team, .96);

    if (s.type === 'corvette') {
      // small arrow-like hull
      ctx.beginPath(); ctx.moveTo(r*1.5,0); ctx.lineTo(-r,-r*0.7); ctx.lineTo(-r*0.4,0); ctx.lineTo(-r,r*0.7); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.ellipse(0,0,r*0.35,r*0.25,0,0,TAU); ctx.fill();
    } else if (s.type === 'frigate') {
      // sleeker hull with a small dorsal
      ctx.beginPath(); ctx.moveTo(r*1.6,0); ctx.quadraticCurveTo(r*0.2,-r*1.1, -r*1.1, -r*0.6); ctx.lineTo(-r*0.6,0); ctx.lineTo(-r*1.1, r*0.6); ctx.quadraticCurveTo(r*0.2,r*1.1, r*1.6,0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.fillRect(-r*0.2, -r*0.25, r*0.6, r*0.5);
    } else if (s.type === 'destroyer') {
      // broad hull with angular plates
      ctx.beginPath(); ctx.moveTo(r*1.9,0); ctx.lineTo(r*0.3, -r*1.1); ctx.lineTo(-r*1.4, -r*0.6); ctx.lineTo(-r*1.4, r*0.6); ctx.lineTo(r*0.3, r*1.1); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(-r*0.9, -r*0.18, r*1.2, r*0.36);
    } else if (s.type === 'carrier') {
      // larger carrier silhouette with hangar markings
      ctx.beginPath(); ctx.ellipse(0, 0, r*1.6, r*1.0, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(-r*0.8, -r*0.25, r*1.6, r*0.5);
    } else if (s.type === 'fighter') {
      // tiny fast fighter
      ctx.beginPath(); ctx.moveTo(r*1.2,0); ctx.lineTo(-r*0.6, -r*0.45); ctx.lineTo(-r*0.2, 0); ctx.lineTo(-r*0.6, r*0.45); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.ellipse(r*0.25,0,r*0.25,r*0.15,0,0,TAU); ctx.fill();
    } else {
      // fallback generic hull
      ctx.beginPath(); ctx.moveTo(r*1.4,0); ctx.lineTo(-r, -r*0.8); ctx.lineTo(-r*0.4,0); ctx.lineTo(-r, r*0.8); ctx.closePath(); ctx.fill();
    }

    if (typeof ctx !== 'undefined') ctx.restore();

    // shimmering shield outline (subtle)
    if (typeof s.shield === 'number' && typeof s.shieldMax === 'number'){
      const sp = s.shieldMax > 0 ? Math.max(0, Math.min(1, s.shield / s.shieldMax)) : 0;
      const outlineR = r + 4 + (1 - sp) * 2;
      if (typeof ctx !== 'undefined') ctx.save();
      // base full-outline shimmer
      ctx.beginPath(); ctx.arc(s.x, s.y, outlineR, 0, TAU);
      const g = ctx.createRadialGradient(s.x, s.y, outlineR*0.6, s.x, s.y, outlineR);
      g.addColorStop(0, `rgba(140,200,255,${0.06})`);
      g.addColorStop(1, `rgba(80,160,255,${0.02})`);
      if (typeof ctx !== 'undefined') { ctx.fillStyle = g; ctx.globalCompositeOperation = 'lighter'; ctx.fill(); }

      // arc highlights for recent directional hits
      for (const sf of shieldFlashes) {
        if (sf.id !== s.id) continue;
        const lifeFactor = Math.max(0, Math.min(1, sf.life / 0.22));
        // amount-based scaling (normalize against ship shieldMax where possible)
        const amtBase = (s.shieldMax && s.shieldMax > 0) ? (sf.amount / s.shieldMax) : Math.min(1, sf.amount / (s.hpMax * 0.6 || 1));
        const amtFactor = Math.max(0.08, Math.min(1, amtBase));
        // spread increases with hit strength and also animates as it ages
        const baseSpread = Math.PI * 0.25 + Math.PI * 0.6 * (1 - lifeFactor);
        const spread = baseSpread * (0.6 + 1.6 * amtFactor);
        const start = sf.angle - spread/2;
        const end = sf.angle + spread/2;
        const radiusOffset = outlineR + 4 * (1 - lifeFactor) + 2 * amtFactor;
        ctx.beginPath(); ctx.arc(s.x, s.y, radiusOffset, start, end);
        // line width and alpha scale with amount and remaining life
        ctx.lineWidth = (3 + 6 * lifeFactor) * (1 + 4 * amtFactor);
        const alpha = Math.min(1, 0.25 + lifeFactor * (0.9 + 1.6 * amtFactor));
        ctx.strokeStyle = `rgba(160,220,255,${alpha})`;
        // add a soft glow proportional to amount
        ctx.save(); ctx.shadowBlur = 12 * amtFactor; ctx.shadowColor = 'rgba(140,200,255,0.8)'; ctx.stroke(); ctx.restore();
      }
      if (typeof ctx !== 'undefined') ctx.restore();
    }

    // health and shield bars (scaled by radius)
    const w = Math.max(16, r*3.2), h = Math.max(3, r*0.4);
    const x = s.x - w/2;
    // shield bar above the ship (blue)
    const shieldY = s.y - (r + 12);
    if (typeof s.shield === 'number' && typeof s.shieldMax === 'number'){
      const sp = s.shieldMax > 0 ? Math.max(0, Math.min(1, s.shield / s.shieldMax)) : 0;
      if (typeof ctx !== 'undefined') {
        ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(x, shieldY, w, h);
        ctx.fillStyle = 'rgba(80,160,255,.95)'; ctx.fillRect(x, shieldY, w * sp, h);
      }
    }
    // health bar below the ship (green) with rounded corners
    const healthY = s.y + (r + 8);
    const p = Math.max(0, Math.min(1, s.hp / s.hpMax));
    // background rounded
    const radius = Math.min(6, h);
    // draw level pill left of the health bar (animated on level-up)
    if (typeof ctx !== 'undefined' && ctx && typeof ctx.measureText === 'function') {
      try {
        const lvlText = String(s.level || 1);
  // choose a readable font size relative to ship size (bumped for visibility)
  const FONT_SIZE_SCALE = 6; // scale factor for font size calculation
  const fontSize = Math.max(12, Math.round(h * FONT_SIZE_SCALE));
        ctx.save();
        ctx.font = `700 ${fontSize}px Inter, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const textW = ctx.measureText(lvlText).width;
  const padX = 8; // horizontal padding inside pill (increased)
  const padY = Math.max(2, Math.round((fontSize - h) / 2));
        const pillW = Math.max(18, textW + padX * 2);
        const pillH = Math.max(h + 2, fontSize * 0.9);
        const pillX = x - 8 - pillW; // 8px gap from health bar
        const pillY = healthY + h/2 - pillH/2;
        const pillR = pillH / 2;
  // draw a subtle dark backdrop for contrast behind the pill
  const backdropPad = 4;
  const backdropX = pillX - backdropPad;
  const backdropY = pillY - backdropPad;
  const backdropW = pillW + backdropPad*2;
  const backdropH = pillH + backdropPad*2;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  roundRect(ctx, backdropX, backdropY, backdropW, backdropH, (backdropH)/2);
  ctx.fill();
  ctx.restore();

  // check for level-up flash for this ship to animate the pill
        const lf = levelFlashes.find(l => l.id === s.id && l.life > 0);
        let scale = 1;
        if (lf) {
          // scale from 1.6 down to 1.0 over life (lf.life is in seconds)
          const t = Math.max(0, Math.min(1, lf.life / 1.0));
          scale = 1 + 0.6 * t; // larger when just leveled
        }
        const scaledPillW = pillW * scale;
        const scaledPillH = pillH * scale;
        // adjust pill position so scaling expands outward from center-left of health bar
        const pillXScaled = pillX - (scaledPillW - pillW);
        const pillYScaled = pillY - (scaledPillH - pillH) / 2;
        const pillRScaled = scaledPillH / 2;
        ctx.beginPath();
        ctx.moveTo(pillXScaled + pillRScaled, pillYScaled);
        ctx.lineTo(pillXScaled + scaledPillW - pillRScaled, pillYScaled);
        ctx.quadraticCurveTo(pillXScaled + scaledPillW, pillYScaled, pillXScaled + scaledPillW, pillYScaled + pillRScaled);
        ctx.lineTo(pillXScaled + scaledPillW, pillYScaled + scaledPillH - pillRScaled);
        ctx.quadraticCurveTo(pillXScaled + scaledPillW, pillYScaled + scaledPillH, pillXScaled + scaledPillW - pillRScaled, pillYScaled + scaledPillH);
        ctx.lineTo(pillXScaled + pillRScaled, pillYScaled + scaledPillH);
        ctx.quadraticCurveTo(pillXScaled, pillYScaled + scaledPillH, pillXScaled, pillYScaled + scaledPillH - pillRScaled);
        ctx.lineTo(pillXScaled, pillYScaled + pillRScaled);
        ctx.quadraticCurveTo(pillXScaled, pillYScaled, pillXScaled + pillRScaled, pillYScaled);
        ctx.closePath();
        // when flashing, add a glow/stroke to emphasize
        if (lf) {
          const glow = Math.max(0.6, Math.min(1, lf.life));
          ctx.save(); ctx.shadowBlur = 20 * glow; ctx.shadowColor = 'rgba(255,255,255,0.95)';
          ctx.fillStyle = teamColor(s.team, 0.98);
          ctx.fill(); ctx.restore();
          ctx.lineWidth = 2;
          ctx.strokeStyle = `rgba(255,255,255,${0.28 + 0.6 * glow})`;
          ctx.stroke();
        } else {
          ctx.fillStyle = teamColor(s.team, 0.98);
          ctx.fill();
          ctx.lineWidth = 1.25;
          ctx.strokeStyle = 'rgba(255,255,255,0.14)';
          ctx.stroke();
        }
        // draw text scaled centered in scaled pill (stronger contrast)
        ctx.fillStyle = 'rgba(255,255,255,1)';
        ctx.font = `700 ${Math.round(fontSize * scale)}px Inter, system-ui, sans-serif`;
        ctx.fillText(lvlText, pillXScaled + scaledPillW/2, pillYScaled + scaledPillH/2 + 0.5);
        ctx.restore();
      } catch (e) {
        // swallow any canvas measurement/draw errors in headless tests
      }
    }
    if (typeof ctx !== 'undefined') {
      ctx.beginPath();
      ctx.moveTo(x + radius, healthY);
      ctx.lineTo(x + w - radius, healthY);
      ctx.quadraticCurveTo(x + w, healthY, x + w, healthY + radius);
      ctx.lineTo(x + w, healthY + h - radius);
      ctx.quadraticCurveTo(x + w, healthY + h, x + w - radius, healthY + h);
      ctx.lineTo(x + radius, healthY + h);
      ctx.quadraticCurveTo(x, healthY + h, x, healthY + h - radius);
      ctx.lineTo(x, healthY + radius);
      ctx.quadraticCurveTo(x, healthY, x + radius, healthY);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fill();
    }

    // determine if there's a recent health flash for this ship
    const hf = healthFlashes.find(hf => hf.id === s.id && hf.life > 0);
    let healthColor = `rgba(120,220,120,${0.95})`;
    if (hf) {
      // flash intensity based on remaining life and damage amount
      const t = Math.max(0, Math.min(1, hf.life / 0.45));
      const amtFactor = Math.min(1, hf.amount / (s.hpMax || 1));
      // interpolate between red and green
      const rCol = Math.floor(220 * (1 - amtFactor * t));
      const gCol = Math.floor(60 + 160 * (1 - t * amtFactor));
      healthColor = `rgba(${Math.min(255, rCol)},${Math.min(255, gCol)},60,${0.95})`;
    }

    // filled rounded clip
    if (typeof ctx !== 'undefined') {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x + radius, healthY);
      ctx.lineTo(x + w - radius, healthY);
      ctx.quadraticCurveTo(x + w, healthY, x + w, healthY + radius);
      ctx.lineTo(x + w, healthY + h - radius);
      ctx.quadraticCurveTo(x + w, healthY + h, x + w - radius, healthY + h);
      ctx.lineTo(x + radius, healthY + h);
      ctx.quadraticCurveTo(x, healthY + h, x, healthY + h - radius);
      ctx.lineTo(x, healthY + radius);
      ctx.quadraticCurveTo(x, healthY, x + radius, healthY);
      ctx.closePath();
      ctx.clip();
      ctx.fillStyle = healthColor; ctx.fillRect(x, healthY, w * p, h);
      
  // Note: the earlier implementation referenced out-of-scope variables (shipX, shipY, h).
  // Health/shield impact visual creation is handled below in the per-frame processing
  // which consumes entries from `state.healthHits` and `state.shieldHits` and pushes
  // appropriate flashes/particles using well-scoped variables.
    }
  }
}
// safe no-op updateUI for headless/test environments (overridden by UI init)
export function updateUI(){ /* no-op until UI is initialized */ }

// Exported simulate wrapper: run simulation step then update renderer visual state
export function simulate(dt) {
  // run core simulation step (mutates state.ships, state.bullets, and pushes hits)
  simulateStep(state, dt, { W, H });

  // handle health hit visuals (for health bar flashing)
  if (Array.isArray(state.healthHits) && state.healthHits.length) {
    for (const hh of state.healthHits) {
      const shipHit = ships.find(s => s.id === hh.id);
      if (shipHit) {
        // create a health flash entry that renderer will use to animate the health bar color
        healthFlashes.push({ id: shipHit.id, life: 0.45, amount: hh.amount });
        // create particles at impact point
        for (let i=0;i<6;i++){
          const a = srange(0,TAU);
          const sp = srange(40,120);
          particles.push(new Particle(hh.hitX, hh.hitY, Math.cos(a)*sp, Math.sin(a)*sp, srange(.12,0.4), 'rgba(200,230,255,$a)'));
        }
      }
    }
    // clear processed healthHits so they are not re-processed next frame
    state.healthHits.length = 0;
  }

  // handle shield hit visuals (arc highlights attached to ship id)
  if (Array.isArray(state.shieldHits) && state.shieldHits.length) {
    for (const sh of state.shieldHits) {
      const shipHit = ships.find(s => s.id === sh.id);
      if (shipHit) {
        const ang = Math.atan2(sh.hitY - shipHit.y, sh.hitX - shipHit.x);
        shieldFlashes.push({ id: shipHit.id, angle: ang, life: 0.22, amount: sh.amount });
        // small bright flash at impact
        flashes.push({ x: sh.hitX, y: sh.hitY, r: 6 + Math.min(12, sh.amount), life: 0.12, team: sh.team, shieldHit: true });
      }
    }
    // clear processed shieldHits
    state.shieldHits.length = 0;
  }

  for (let i=particles.length-1;i>=0;i--){ const p=particles[i]; p.update(dt); if (p.life<=0) particles.splice(i,1); }
  for (let i=flashes.length-1;i>=0;i--){ const f=flashes[i]; f.life -= dt; f.r += 600*dt; if (f.life<=0) flashes.splice(i,1); }
  for (let i=shieldFlashes.length-1;i>=0;i--) { const sf = shieldFlashes[i]; sf.life -= dt; if (sf.life <= 0) shieldFlashes.splice(i,1); }
  for (let i=healthFlashes.length-1;i>=0;i--) { const hf = healthFlashes[i]; hf.life -= dt; if (hf.life <= 0) healthFlashes.splice(i,1); }
  for (let i=levelFlashes.length-1;i>=0;i--) { const lf = levelFlashes[i]; lf.life -= dt; if (lf.life <= 0) levelFlashes.splice(i,1); }

  // sync visual wrappers (persist between frames)
  const aliveIds = new Set(ships.map(s => s.id));
  // add or update wrappers
  for (const s of ships) {
    if (shipsVMap.has(s.id)) {
      const sv = shipsVMap.get(s.id);
      // detect level changes and trigger level flash animations
      if (sv.level !== s.level) {
        // push a level flash object with a short life
        levelFlashes.push({ id: s.id, life: 1.0 });
        // small particle burst to emphasize level-up
        for (let i=0;i<18;i++){
          const a = srange(0, TAU);
          const sp = srange(60, 240);
          particles.push(new Particle(s.x + Math.cos(a)*2, s.y + Math.sin(a)*2, Math.cos(a)*sp, Math.sin(a)*sp, srange(0.3, 0.9), 'rgba(200,255,220,$a)'));
        }
        sv.level = s.level;
      }
      sv.syncFromLogic();
    } else {
      const newSv = new ShipV(s);
      // initialize visual-level tracking
      newSv.level = s.level;
      shipsVMap.set(s.id, newSv);
    }
  }
  // remove wrappers for ships that no longer exist
  for (const id of Array.from(shipsVMap.keys())) {
    if (!aliveIds.has(id)) shipsVMap.delete(id);
  }
}

export function render() {
  ensureCtx();
  if (typeof ctx === 'undefined' || !ctx) return;
  ctx.clearRect(0,0,W,H);
  const g = ctx.createRadialGradient(W*0.6, H*0.3, 50, W*0.6, H*0.3, Math.max(W,H));
  g.addColorStop(0, 'rgba(60,80,140,0.10)'); g.addColorStop(1, 'rgba(10,12,20,0.0)'); ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
  for (const s of stars){ const tw = 0.6 + 0.4 * Math.sin(s.phase); ctx.globalAlpha = clamp(0.5*tw * (0.6 + 0.5*s.d), 0, 1); ctx.fillStyle = '#e9f2ff'; ctx.fillRect(s.x, s.y, s.r, s.r); }
  ctx.globalAlpha = 1;
  for (const f of flashes){ const a = clamp(f.life/0.25,0,1); ctx.strokeStyle = teamColor(f.team, a*0.6); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(f.x,f.y,f.r,0,TAU); ctx.stroke(); }
  for (const b of bullets){
    // bullets are logic objects from entities.Bullet; draw them here
    ctx.save(); ctx.shadowBlur = 12; ctx.shadowColor = teamColor(b.team, .9); ctx.fillStyle = teamColor(b.team, .95);
    ctx.beginPath(); ctx.arc(b.x, b.y, b.radius || 2.2, 0, TAU); ctx.fill(); ctx.restore();
  }
  for (const p of particles){ p.draw(); }
  for (const sv of shipsVMap.values()){ sv.draw(); }
  const redAlive = ships.some(s=>s.alive && s.team===Team.RED);
  const blueAlive = ships.some(s=>s.alive && s.team===Team.BLUE);
  if (!redAlive || !blueAlive){ ctx.save(); ctx.textAlign='center'; ctx.font = '700 36px Inter, system-ui, sans-serif'; const winner = redAlive? 'Red' : blueAlive? 'Blue' : 'Nobody'; const col = redAlive? teamColor(Team.RED, .95) : blueAlive? teamColor(Team.BLUE,.95) : 'rgba(255,255,255,.9)'; ctx.fillStyle = col; ctx.shadowBlur = 14; ctx.shadowColor = col; ctx.fillText(`${winner} Wins!`, W/2, 64); ctx.restore(); }
}

function loop(t){ if (!lastTime) lastTime=t; const rawDt = (t-lastTime)/1000; lastTime = t; const dt = clamp(rawDt, 0, 0.033) * (running? speed: 0); simulate(dt); render(); updateUI(); requestAnimationFrame(loop); }

// --- UI ---
export function initRendererUI() {
  if (typeof document === 'undefined') return;
  const startBtn = document.getElementById && document.getElementById('startPause');
  const resetBtn = document.getElementById && document.getElementById('reset');
  const addRedBtn = document.getElementById && document.getElementById('addRed');
  const addBlueBtn = document.getElementById && document.getElementById('addBlue');
  const trailsBtn = document.getElementById && document.getElementById('toggleTrails');
  const speedBtn = document.getElementById && document.getElementById('speed');
  const redBadge = document.getElementById && document.getElementById('redScore');
  const blueBadge = document.getElementById && document.getElementById('blueScore');
  const statsDiv = document.getElementById && document.getElementById('stats');
  const seedBtn = document.getElementById && document.getElementById('seedBtn');
  const formationBtn = document.getElementById && document.getElementById('formationBtn');

  function updateUI(){
    if (redBadge) redBadge.textContent = `Red ${score.red}`;
    if (blueBadge) blueBadge.textContent = `Blue ${score.blue}`;
    if (statsDiv) statsDiv.textContent = `Ships: ${ships.filter(s=>s.alive).length}  Bullets: ${bullets.length}  Particles: ${particles.length}`;
  }

  if (startBtn && typeof startBtn.addEventListener === 'function') startBtn.addEventListener('click', () => { running = !running; startBtn.textContent = running? '⏸ Pause' : '▶ Start'; });
  if (resetBtn && typeof resetBtn.addEventListener === 'function') resetBtn.addEventListener('click', () => { reset(); });
  
  // (randomShipType is exported at module scope)

  if (addRedBtn && typeof addRedBtn.addEventListener === 'function') addRedBtn.addEventListener('click', () => {
  const t = randomShipType();
  ships.push(new Ship(Team.RED, srange(40, W*0.35), srange(80, H-80), t));
  toast(`+1 Red (${t})`);
  });
  if (addBlueBtn && typeof addBlueBtn.addEventListener === 'function') addBlueBtn.addEventListener('click', () => {
  const t = randomShipType();
  ships.push(new Ship(Team.BLUE, srange(W*0.65, W-40), srange(80, H-80), t));
  toast(`+1 Blue (${t})`);
  });
  if (trailsBtn && typeof trailsBtn.addEventListener === 'function') trailsBtn.addEventListener('click', () => { showTrails=!showTrails; trailsBtn.textContent = `☄ Trails: ${showTrails? 'On':'Off'}`; });
  if (speedBtn && typeof speedBtn.addEventListener === 'function') speedBtn.addEventListener('click', () => {
    const idx = (SPEED_STEPS.indexOf(speed) + 1) % SPEED_STEPS.length;
    speed = SPEED_STEPS[idx];
    speedBtn.textContent = `Speed: ${speed}×`;
  });
  if (seedBtn && typeof seedBtn.addEventListener === 'function') seedBtn.addEventListener('click', () => {
    const defaultSeed = srangeInt(0, 0xFFFFFFFF);
    const s = prompt('Enter numeric seed (32-bit):', defaultSeed); if (s!==null){ reset(Number(s)); }
  });
  if (formationBtn && typeof formationBtn.addEventListener === 'function') formationBtn.addEventListener('click', () => {
    const aliveR = ships.filter(s=>s.alive && s.team===Team.RED);
    const aliveB = ships.filter(s=>s.alive && s.team===Team.BLUE);
    const spaceY = 20; const cols=6;
    aliveR.forEach((s,i)=>{ const c=i%cols, r=Math.floor(i/cols); s.x=W*0.25 - c*20; s.y=H*0.5 + (r-cols/2)*spaceY; s.vx=s.vy=0; });
    aliveB.forEach((s,i)=>{ const c=i%cols, r=Math.floor(i/cols); s.x=W*0.75 + c*20; s.y=H*0.5 + (r-cols/2)*spaceY; s.vx=s.vy=0; });
    toast('Fleets re-formed');
  });
  if (canvas && typeof canvas.addEventListener === 'function') canvas.addEventListener('click', (e)=>{ const r = 24; flashes.push({x:e.clientX,y:e.clientY,r,life:.25,team: srangeInt(0,1)}); for (let i=0;i<24;i++){ const a=srange(0,TAU), sp=srange(40,220); particles.push(new Particle(e.clientX,e.clientY,Math.cos(a)*sp,Math.sin(a)*sp,srange(.2,1),'rgba(255,255,255,$a)')); } });

  // Test helper is defined at module scope below

  // UI update loop
  function loop(t){ if (!lastTime) lastTime=t; const rawDt = (t-lastTime)/1000; lastTime = t; const dt = clamp(rawDt, 0, 0.033) * (running? speed: 0); simulate(dt); render(); updateUI(); if (typeof requestAnimationFrame === 'function') requestAnimationFrame(loop); }
  if (typeof reset === 'function') reset();
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(loop);
}
