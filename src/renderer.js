
// Attach global export for robust auto-init in standalone/minified builds
if (typeof window !== 'undefined') {
  window.initRenderer = initRenderer;
}

import { srange, srangeInt } from './rng.js';
import { Ship, Team } from './entities.js';
import * as gm from './gamemanager.js';

// Defensive DOM/canvas initialization so importing this module in tests or
// headless environments doesn't throw if DOM elements or canvas are missing.
let canvas = null;
if (typeof document !== 'undefined') canvas = document.getElementById('world');
if (!canvas && typeof document !== 'undefined') {
  // create a lightweight canvas element so tests that import renderer at
  // module-evaluation time don't crash. Tests may override getContext later.
  canvas = document.createElement('canvas');
  canvas.id = 'world';
  // append if body exists
  if (document.body) document.body.appendChild(canvas);
}

// Ensure a Path2D class exists (some test environments may not provide it yet)
if (typeof globalThis.Path2D === 'undefined') {
  // minimal no-op Path2D implementation used for shape construction in tests
  class _Path2D {
    constructor() { /* no-op */ }
    moveTo() {}
    lineTo() {}
    quadraticCurveTo() {}
    ellipse() {}
    arc() {}
    closePath() {}
  }
  globalThis.Path2D = _Path2D;
}

// Do not acquire a 2D context at module load time — doing so can prevent
// later acquisition of a WebGL context on the same canvas in some browsers.
// We'll lazily obtain a 2D context only if we fall back to the canvas
// renderer inside initRenderer(). For now, set ctx to null and provide a
// no-op shim only as a fallback (created when needed).
let ctx = null;

let W = (canvas && canvas.width) ? (canvas.width = (typeof window !== 'undefined' ? window.innerWidth : 1024)) : 1024;
let H = (canvas && canvas.height) ? (canvas.height = (typeof window !== 'undefined' ? window.innerHeight : 768)) : 768;
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('resize', () => { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; recomputeBackgroundGradient(); initStars(); });
}

// --- Utilities ---
const TAU = Math.PI * 2;
const clamp = gm.clamp;

// UI toast
function toast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 1400); }

// Starfield background (parallax) - delegated to gamemanager
const stars = gm.stars;
// initStars is provided by gamemanager
const initStars = gm.initStars;

// --- Renderer caches & pools ---
// Cache Path2D hull shapes per type using unit-radius = 1 coordinates
const hullPaths = new Map();
function getHullPath(type){
  if (hullPaths.has(type)) return hullPaths.get(type);
  const p = new Path2D();
  // unit shapes (use radius = 1 as base scale)
  if (type === 'corvette'){
    p.moveTo(1.5,0); p.lineTo(-1,-0.7); p.lineTo(-0.4,0); p.lineTo(-1,0.7); p.closePath();
    p.ellipse(0,0,0.35,0.25,0,0,TAU);
  } else if (type === 'frigate'){
    p.moveTo(1.6,0); p.quadraticCurveTo(0.2,-1.1, -1.1, -0.6); p.lineTo(-0.6,0); p.lineTo(-1.1,0.6); p.quadraticCurveTo(0.2,1.1,1.6,0); p.closePath();
  } else if (type === 'destroyer'){
    p.moveTo(1.9,0); p.lineTo(0.3,-1.1); p.lineTo(-1.4,-0.6); p.lineTo(-1.4,0.6); p.lineTo(0.3,1.1); p.closePath();
  } else if (type === 'carrier'){
    p.ellipse(0,0,1.6,1.0,0,0,TAU);
  } else if (type === 'fighter'){
    p.moveTo(1.2,0); p.lineTo(-0.6,-0.45); p.lineTo(-0.2,0); p.lineTo(-0.6,0.45); p.closePath();
    p.ellipse(0.25,0,0.25,0.15,0,0,TAU);
  } else {
    p.moveTo(1.4,0); p.lineTo(-1,-0.8); p.lineTo(-0.4,0); p.lineTo(-1,0.8); p.closePath();
  }
  hullPaths.set(type, p);
  return p;
}

// --- Shape atlas (per-hull, multi-LOD) ---
// Per-hull atlas map: Map<type, Map<lodKey, atlasObject>>
const hullAtlases = new Map();
// LODs measured as base pixel radius. We'll create a few canonical LODs and
// choose the nearest one for a given ship radius and device pixel ratio.
const DEFAULT_LODS = [12, 20, 36]; // small, medium, large base radii in pixels

function createHullAtlasLOD(type, baseRadius){
  // internal map per type
  let typeMap = hullAtlases.get(type);
  if (!typeMap) { typeMap = new Map(); hullAtlases.set(type, typeMap); }
  if (typeMap.has(baseRadius)) return typeMap.get(baseRadius);

  // estimate canvas size: shapes can extend up to ~2.2 units * baseRadius each side
  const maxUnitExtent = 2.2;
  const size = Math.ceil(baseRadius * maxUnitExtent * 2 + 8);
  const c = typeof document !== 'undefined' ? document.createElement('canvas') : { width: size, height: size, getContext: () => null };
  c.width = size; c.height = size;
  const cc = c.getContext && c.getContext('2d');
  if (!cc) {
    const atlas = { canvas: c, size, baseRadius };
    typeMap.set(baseRadius, atlas);
    return atlas;
  }

  const cx = size/2;
  cc.clearRect(0,0,size,size);
  cc.save();
  cc.translate(cx, cx);
  cc.scale(baseRadius, baseRadius);
  cc.fillStyle = 'white'; cc.strokeStyle = 'white'; cc.lineWidth = 0.02;
  try { cc.fill(getHullPath(type)); } catch (e) { cc.beginPath(); cc.arc(0,0,1,0,TAU); cc.fill(); }

  // accents (simple approximations)
  cc.fillStyle = 'rgba(255,255,255,0.9)';
  if (type === 'corvette' || type === 'fighter') cc.beginPath(), cc.ellipse(0.25,0,0.25,0.15,0,0,TAU), cc.fill();
  else if (type === 'frigate') cc.fillRect(-0.2,-0.25,0.6,0.5);
  else if (type === 'destroyer') cc.fillRect(-0.9,-0.18,1.2,0.36);
  else if (type === 'carrier') cc.fillStyle = 'rgba(255,255,255,0.2)', cc.fillRect(-0.8,-0.25,1.6,0.5);

  cc.restore();
  const atlas = { canvas: c, size, baseRadius };
  typeMap.set(baseRadius, atlas);
  return atlas;
}

function ensureDefaultLODs(type){
  for (const lod of DEFAULT_LODS) createHullAtlasLOD(type, lod);
}

function getHullAtlas(type, baseRadius = DEFAULT_LODS[1]){
  const typeMap = hullAtlases.get(type);
  if (typeMap && typeMap.has(baseRadius)) return typeMap.get(baseRadius);
  return createHullAtlasLOD(type, baseRadius);
}

// Select best LOD entry for a requested radius (in CSS pixels) and devicePixelRatio
function getHullAtlasForRadius(type, radius, devicePixelRatio = (typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1)){
  // target pixel radius multiplied by DPR to choose LOD
  const pixelRadius = Math.max(1, Math.round(radius * devicePixelRatio));
  // ensure default LODs exist for this type
  ensureDefaultLODs(type);
  const typeMap = hullAtlases.get(type) || new Map();
  // find nearest baseRadius in typeMap
  let best = null; let bestDiff = Infinity;
  for (const [baseRadius, atlas] of typeMap.entries()){
    const diff = Math.abs(baseRadius - pixelRadius);
    if (diff < bestDiff) { bestDiff = diff; best = atlas; }
  }
  // If none found (shouldn't happen), create one at pixelRadius
  if (!best) best = createHullAtlasLOD(type, pixelRadius);
  return best;
}

// Background gradient cache (recomputed on resize)
let backgroundGradient = null;
function recomputeBackgroundGradient(){
  if (!ctx || typeof ctx.createRadialGradient !== 'function') {
    backgroundGradient = null;
    return;
  }
  backgroundGradient = ctx.createRadialGradient(W*0.6, H*0.3, 50, W*0.6, H*0.3, Math.max(W,H));
  backgroundGradient.addColorStop(0, 'rgba(60,80,140,0.10)');
  backgroundGradient.addColorStop(1, 'rgba(10,12,20,0.0)');
}
recomputeBackgroundGradient();

// Particle pooling is delegated to gamemanager
const particlePool = gm.particlePool;
const acquireParticle = gm.acquireParticle;
const releaseParticle = gm.releaseParticle;
// Particle class is provided by gamemanager for tests
const Particle = gm.Particle;

// Gradient cache keyed by outline radius (created after translate so gradients can be reused)
const radialGradientCache = new Map();

// --- Entities (renderer-local) ---
const teamColor = (t, alpha=1) => t===Team.RED ? `rgba(255,90,90,${alpha})` : `rgba(80,160,255,${alpha})`;

// Particle draw helper uses particles managed by gamemanager
function drawParticle(p){ if (p.life<=0) return; const a = p.life / p.max; ctx.fillStyle = (p.color || '').replace ? p.color.replace('$a', a.toFixed(3)) : p.color; ctx.fillRect(p.x, p.y, 2,2); }

// Keep Ship logic in entities.js, renderer keeps visual helpers and particle/flash handling.
// Visual Ship wrapper to reference logic ship instance
class ShipV {
  constructor(shipLogic){ this.logic = shipLogic; this.id = shipLogic.id; this.team = shipLogic.team; this.x = shipLogic.x; this.y = shipLogic.y; this.type = shipLogic.type; }
  syncFromLogic(){ this.x = this.logic.x; this.y = this.logic.y; this.type = this.logic.type; this.alive = this.logic.alive; }
  draw(){
    const s = this.logic;
    if (!s.alive) return;
  // compute whether this ship has a recent shield hit (look for flashes with shieldHit)
  const recentShieldFlash = flashes.some(f => f.shieldHit && f.x === s.x && f.y === s.y && f.life > 0);
  // trails
  if (showTrails){ const tx = s.x - Math.cos(s.angle)*s.radius*1.2; const ty = s.y - Math.sin(s.angle)*s.radius*1.2; acquireParticle(tx, ty, -s.vx*0.05 + srange(-10,10), -s.vy*0.05 + srange(-10,10), .25, teamColor(s.team, '$a')); }

    // Draw hull by type with scale from radius - prefer atlas sampling
    const r = s.radius || 8;
  const atlas = getHullAtlas(s.type);
  // Prefer selecting an LOD based on ship radius and devicePixelRatio
  const selectedAtlas = getHullAtlasForRadius(s.type, r, (typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1));
  if (selectedAtlas && selectedAtlas.canvas && ctx && typeof ctx.drawImage === 'function') {
      // Tinting workflow: draw atlas to temp canvas with tint, then draw scaled
      // However, creating a temp canvas per-ship per-frame is expensive. We'll
      // use global composite operations to tint during draw: draw white mask,
      // then use 'source-in' to colorize.
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.angle);
      // shadow
      ctx.shadowBlur = 12; ctx.shadowColor = teamColor(s.team, .9);

  const size = selectedAtlas.size;
      const scale = (r * 2) / (atlas.baseRadius * 2); // desired pixel scale
  const drawW = size * scale, drawH = size * scale;
      // draw mask
      ctx.save();
      // draw the white mask (atlas) centered at 0,0
      ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(selectedAtlas.canvas, -drawW/2, -drawH/2, drawW, drawH);
      // tint using source-in
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = teamColor(s.team, .96);
      ctx.fillRect(-drawW/2, -drawH/2, drawW, drawH);
      ctx.restore();
      ctx.restore();
    } else {
      // fallback to previous procedural drawing when atlas or ctx.drawImage is unavailable
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.angle); ctx.shadowBlur = 12; ctx.shadowColor = teamColor(s.team,.9);
      // base fill
      ctx.fillStyle = teamColor(s.team, .96);

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

      ctx.restore();
    }

    // shimmering shield outline (subtle)
    if (typeof s.shield === 'number' && typeof s.shieldMax === 'number'){
      const sp = s.shieldMax > 0 ? Math.max(0, Math.min(1, s.shield / s.shieldMax)) : 0;
      const outlineR = r + 4 + (1 - sp) * 2;
      ctx.save();
      // base full-outline shimmer
      ctx.beginPath(); ctx.arc(s.x, s.y, outlineR, 0, TAU);
      const g = ctx.createRadialGradient(s.x, s.y, outlineR*0.6, s.x, s.y, outlineR);
      g.addColorStop(0, `rgba(140,200,255,${0.06})`);
      g.addColorStop(1, `rgba(80,160,255,${0.02})`);
      ctx.fillStyle = g; ctx.globalCompositeOperation = 'lighter'; ctx.fill();

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
      ctx.restore();
    }

    // health and shield bars (scaled by radius)
    const w = Math.max(16, r*3.2), h = Math.max(3, r*0.4);
    const x = s.x - w/2;
    // shield bar above the ship (blue)
    const shieldY = s.y - (r + 12);
    if (typeof s.shield === 'number' && typeof s.shieldMax === 'number'){
      const sp = s.shieldMax > 0 ? Math.max(0, Math.min(1, s.shield / s.shieldMax)) : 0;
      ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(x, shieldY, w, h);
      ctx.fillStyle = 'rgba(80,160,255,.95)'; ctx.fillRect(x, shieldY, w * sp, h);
    }
    // health bar below the ship (green) with rounded corners
    const healthY = s.y + (r + 8);
    const p = Math.max(0, Math.min(1, s.hp / s.hpMax));
    // background rounded
    const radius = Math.min(6, h);
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
    ctx.restore();

    // level text above ship (small)
    if (typeof s.level === 'number' && s.level > 1){
      ctx.save(); ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.font = '700 12px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(`Lv ${s.level}`, s.x, s.y - (r + 18)); ctx.restore();
    }
  }
}

// --- Game State ---
// Game state is owned by gamemanager; renderer imports and uses gm.* symbols
let ships = gm.ships; let bullets = gm.bullets; let particles = gm.particles; let flashes = gm.flashes; let shieldFlashes = gm.shieldFlashes; let healthFlashes = gm.healthFlashes;
// score is maintained by gamemanager.simulate and used by updateUI/render
let score = { red: 0, blue: 0 };
let shipsVMap = new Map(); // id -> ShipV visual wrappers for logic ships
let running = false; let speed = 1; let showTrails = true; let lastTime = 0;

// Delegate reset and simulate to gamemanager. gm.simulate returns the latest
// state object which renderer uses for visuals. keep a local wrapper to call
// gm.simulate to advance the world state and to sync renderer-only wrappers.
function reset(seedValue=null){ return gm.reset(seedValue); }

function simulate(dt){
  // Let gamemanager advance game logic and emit visual events
  const state = gm.simulate(dt, W, H);
  // copy latest score for UI and render usage
  if (state && state.score) score = state.score;

  // sync local references (they point to gm arrays but rebind for clarity)
  ships = gm.ships; bullets = gm.bullets; particles = gm.particles; flashes = gm.flashes; shieldFlashes = gm.shieldFlashes; healthFlashes = gm.healthFlashes;

  // sync visual wrappers for ships
  const aliveIds = new Set(ships.map(s => s.id));
  for (const s of ships) {
    if (shipsVMap.has(s.id)) {
      shipsVMap.get(s.id).syncFromLogic();
    } else {
      shipsVMap.set(s.id, new ShipV(s));
    }
  }
  for (const id of Array.from(shipsVMap.keys())) { if (!aliveIds.has(id)) shipsVMap.delete(id); }
}

function render(){
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
  for (const p of particles){ drawParticle(p); }
  for (const sv of shipsVMap.values()){ sv.draw(); }
  const redAlive = ships.some(s=>s.alive && s.team===Team.RED);
  const blueAlive = ships.some(s=>s.alive && s.team===Team.BLUE);
  if (!redAlive || !blueAlive){ ctx.save(); ctx.textAlign='center'; ctx.font = '700 36px Inter, system-ui, sans-serif'; const winner = redAlive? 'Red' : blueAlive? 'Blue' : 'Nobody'; const col = redAlive? teamColor(Team.RED, .95) : blueAlive? teamColor(Team.BLUE,.95) : 'rgba(255,255,255,.9)'; ctx.fillStyle = col; ctx.shadowBlur = 14; ctx.shadowColor = col; ctx.fillText(`${winner} Wins!`, W/2, 64); ctx.restore(); }
}

function loop(t){
  if (!lastTime) lastTime=t;
  const rawDt = (t-lastTime)/1000; lastTime = t;
  const dt = clamp(rawDt, 0, 0.033) * (running? speed: 0);
  simulate(dt);

  // If a WebGL renderer is active, delegate drawing to it. Otherwise use 2D canvas renderer.
  if (runningRenderer && runningRenderer.type === 'webgl' && typeof runningRenderer.render === 'function') {
    try {
      runningRenderer.render({ W, H, ships, bullets, stars, particles, flashes, shipsVMap, score });
    } catch (e) {
      // If WebGL renderer throws, fall back to 2D canvas render to avoid stopping the loop
      console.error('WebGL render error, falling back to 2D render', e);
      render();
    }
  } else {
    render();
  }

  updateUI();
  requestAnimationFrame(loop);
}

// --- UI ---
const startBtn = document.getElementById('startPause');
const resetBtn = document.getElementById('reset');
const addRedBtn = document.getElementById('addRed');
const addBlueBtn = document.getElementById('addBlue');
const trailsBtn = document.getElementById('toggleTrails');
const speedBtn = document.getElementById('speed');
const redBadge = document.getElementById('redScore');
const blueBadge = document.getElementById('blueScore');
const statsDiv = document.getElementById('stats');
const seedBtn = document.getElementById('seedBtn');
const formationBtn = document.getElementById('formationBtn');

// Continuous reinforcement checkbox: prefer a static element in the HTML
// (we inject a static checkbox into the HTML templates). If it's missing
// (e.g., tests or older pages), create a lightweight fallback element.
let continuousCheckbox = document.getElementById('continuousCheckbox');
if (!continuousCheckbox) {
  continuousCheckbox = document.createElement('input');
  continuousCheckbox.type = 'checkbox';
  continuousCheckbox.id = 'continuousCheckbox';
  // do not attach to DOM in headless/test environments
}
// Let gamemanager read the checkbox state for reinforcement decisions
if (gm && typeof gm.setContinuousCheckbox === 'function') gm.setContinuousCheckbox(continuousCheckbox);
// so `updateUI()` exists regardless of whether handlers are installed already.
function updateUI(){
  redBadge.textContent = `Red ${score.red}`;
  blueBadge.textContent = `Blue ${score.blue}`;
  statsDiv.textContent = `Ships: ${ships.filter(s=>s.alive).length}  Bullets: ${bullets.length}  Particles: ${particles.length}`;
}

// --- Visible backend badge for demos ---
function ensureBackendBadge(){
  if (typeof document === 'undefined') return null;
  let b = document.getElementById('rendererBackendBadge');
  if (!b) {
    b = document.createElement('div');
    b.id = 'rendererBackendBadge';
    b.style.position = 'fixed';
    b.style.right = '12px';
    b.style.top = '12px';
    b.style.padding = '6px 10px';
    b.style.background = 'rgba(0,0,0,0.6)';
    b.style.color = '#fff';
    b.style.fontFamily = 'system-ui,Segoe UI,Roboto,Arial';
    b.style.fontSize = '12px';
    b.style.borderRadius = '6px';
    b.style.zIndex = '99999';
    b.style.pointerEvents = 'auto';
    b.style.cursor = 'default';
    b.title = 'Renderer backend';
    try { document.body.appendChild(b); } catch(e) {}
  }
  return b;
}

function setBackendBadge(text, details){
  const b = ensureBackendBadge();
  if (!b) return;
  b.textContent = text;
  if (details) b.title = details;
}

// Install UI handlers idempotently to avoid duplicate listeners if the bundle
// is accidentally inlined or executed more than once (defensive guard).
// Reinforcement and evaluation are delegated to gamemanager
const resetReinforcementCooldowns = gm.resetReinforcementCooldowns;
function setReinforcementInterval(seconds){ return gm.setReinforcementInterval(seconds); }
function getReinforcementInterval(){ return gm.getReinforcementInterval(); }
const evaluateReinforcement = gm.evaluateReinforcement;
const handleReinforcement = gm.handleReinforcement;
// UI handler installation: call from initRenderer() to attach listeners and
// start the animation loop. This keeps module import side-effects minimal so
// tests can import renderer helpers without starting the app.
function installUIHandlers() {
  if (typeof window === 'undefined' || !document) return;
  if (window.__uiHandlersInstalled) return;
  Object.defineProperty(window, '__uiHandlersInstalled', { value: true, configurable: false, writable: false });
  // Query elements at handler-install time and attach listeners only when present.
  const _startBtn = document.getElementById('startPause');
  if (_startBtn) _startBtn.addEventListener('click', () => { running = !running; _startBtn.textContent = running? '⏸ Pause' : '▶ Start'; });

  const _resetBtn = document.getElementById('reset');
  if (_resetBtn) _resetBtn.addEventListener('click', () => { reset(); });

  const _addRedBtn = document.getElementById('addRed');
  if (_addRedBtn) _addRedBtn.addEventListener('click', () => { ships.push(new Ship(Team.RED, srange(40, W*0.35), srange(80,H-80))); toast('+1 Red'); });

  const _addBlueBtn = document.getElementById('addBlue');
  if (_addBlueBtn) _addBlueBtn.addEventListener('click', () => { ships.push(new Ship(Team.BLUE, srange(W*0.65, W-40), srange(80,H-80))); toast('+1 Blue'); });

  const _trailsBtn = document.getElementById('toggleTrails');
  if (_trailsBtn) _trailsBtn.addEventListener('click', () => { showTrails=!showTrails; _trailsBtn.textContent = `☄ Trails: ${showTrails? 'On':'Off'}`; });

  const _speedBtn = document.getElementById('speed');
  if (_speedBtn) _speedBtn.addEventListener('click', () => { const steps=[0.5,1,2,4]; const idx = (steps.indexOf(speed)+1)%steps.length; speed=steps[idx]; _speedBtn.textContent = `Speed: ${speed}×`; });

  const _seedBtn = document.getElementById('seedBtn');
  if (_seedBtn) _seedBtn.addEventListener('click', () => { const s = prompt('Enter numeric seed (32-bit):', (Math.random()*1e9>>>0)); if (s!==null){ reset(Number(s)); } });

  const _formationBtn = document.getElementById('formationBtn');
  if (_formationBtn) _formationBtn.addEventListener('click', () => {
    const aliveR = ships.filter(s=>s.alive && s.team===Team.RED);
    const aliveB = ships.filter(s=>s.alive && s.team===Team.BLUE);
    const spaceY = 20; const cols=6;
    aliveR.forEach((s,i)=>{ const c=i%cols, r=Math.floor(i/cols); s.x=W*0.25 - c*20; s.y=H*0.5 + (r-cols/2)*spaceY; s.vx=s.vy=0; });
    aliveB.forEach((s,i)=>{ const c=i%cols, r=Math.floor(i/cols); s.x=W*0.75 + c*20; s.y=H*0.5 + (r-cols/2)*spaceY; s.vx=s.vy=0; });
    toast('Fleets re-formed');
  });

  const reinforceFreqBtn = document.getElementById('reinforceFreqBtn');
  const reinforcementFrequencyOptions = [0, 0.5, 1, 2];
  if (reinforceFreqBtn) {
    const _updateReinforceText = () => {
      const v = getReinforcementInterval();
      reinforceFreqBtn.textContent = v > 0 ? `${v}s` : 'Every step';
    };
    _updateReinforceText();
    reinforceFreqBtn.addEventListener('click', () => {
      const cur = getReinforcementInterval();
      const idx = (reinforcementFrequencyOptions.indexOf(cur) + 1) % reinforcementFrequencyOptions.length;
      setReinforcementInterval(reinforcementFrequencyOptions[idx]);
      _updateReinforceText();
      const v = getReinforcementInterval();
      toast(`Reinforcement check: ${v > 0 ? v + 's' : 'every step'}`);
    });
  }

  if (canvas && typeof canvas.addEventListener === 'function') {
    canvas.addEventListener('click', (e)=>{ const r = 24; flashes.push({x:e.clientX,y:e.clientY,r,life:.25,team: srangeInt(0,1)}); for (let i=0;i<24;i++){ const a=srange(0,TAU), sp=srange(40,220); acquireParticle(e.clientX,e.clientY,Math.cos(a)*sp,Math.sin(a)*sp,srange(.2,1),'rgba(255,255,255,$a)'); } });
  }
}

// Keep reset at module init so tests that import helpers still have a sane state.
if (ships.length === 0) reset();

// runtime renderer instance (either webgl or canvas loop)
let runningRenderer = null;
// diagnostics captured during initRenderer so the page can report why a
// particular backend (webgl vs canvas) was chosen. Exposed via
// getRendererDiagnostics() and also written to window.__rendererDiag when
// available for quick inspection from the console.
let __rendererDiag = { triedWebGL: false, gl2: false, gl1: false, importError: null, used: null };

// Temporary debug wrapper: wrap HTMLCanvasElement.prototype.getContext to
// capture stack traces when getContext returns null or throws. This helps
// diagnose cases where the browser refuses to provide a GL context for the
// page (for example when an extension or origin policy interferes).
try {
  if (typeof window !== 'undefined' && typeof HTMLCanvasElement !== 'undefined' && !HTMLCanvasElement.prototype.__getContextWrapped) {
    const _origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, attrs) {
      try {
        const ctx = _origGetContext.call(this, type, attrs);
        if (!ctx) {
          try {
            const stack = (new Error('getContext returned null for type ' + type)).stack;
            __rendererDiag.getContextNullStacks = __rendererDiag.getContextNullStacks || [];
            __rendererDiag.getContextNullStacks.push({ type, attrs, stack, time: Date.now() });
            if (typeof window !== 'undefined') try { window.__rendererDiag = __rendererDiag; } catch(e){}
            console.warn('DEBUG: HTMLCanvasElement.getContext returned null for', type, attrs, '\nstack:', stack);
          } catch (e) {}
        }
        return ctx;
      } catch (err) {
        try {
          const stack = (new Error('getContext threw for type ' + type)).stack;
          __rendererDiag.getContextThrowStacks = __rendererDiag.getContextThrowStacks || [];
          __rendererDiag.getContextThrowStacks.push({ type, attrs, err: String(err), stack, time: Date.now() });
          if (typeof window !== 'undefined') try { window.__rendererDiag = __rendererDiag; } catch(e){}
          console.warn('DEBUG: HTMLCanvasElement.getContext threw', err, '\nstack:', stack);
        } catch (e) {}
        throw err;
      }
    };
    try { Object.defineProperty(HTMLCanvasElement.prototype, '__getContextWrapped', { value: true, configurable: false }); } catch(e) { HTMLCanvasElement.prototype.__getContextWrapped = true; }
  }
} catch (e) {
  // non-fatal; in some test environments HTMLCanvasElement may not be writable
}

// Init guards — make initRenderer idempotent and re-entrant-safe.
// __initPromise: set while an initialization is in-flight so concurrent
// callers can await the same promise. __initDone marks completion.
let __initPromise = null;
let __initDone = false;

/**
 * Initialize the renderer and start the animation loop.
 * opts: { canvas?: HTMLCanvasElement, preferWebGL?: boolean }
 */
export async function initRenderer(opts = {}) {
  // Expose a stable global initializer for robust auto-init in bundled builds.
  if (typeof window !== 'undefined') window.initRenderer = initRenderer;
  // Fast-path: if a previous initialization completed (or a global auto-init
  // guard was set by the inlined bundle), return the existing renderer only
  // when we actually have a running instance. If the global guard exists but
  // no renderer instance is present (e.g. tests called stopRenderer), allow
  // re-initialization.
  if (typeof window !== 'undefined' && window.__autoRendererStarted) {
    if (__initDone && runningRenderer) return runningRenderer;
    if (__initPromise) {
      await __initPromise;
      return runningRenderer;
    }
  }

  // If this module previously finished init and a renderer instance still
  // exists, return it immediately. If init finished but the renderer was
  // stopped, allow re-initialization.
  if (__initDone && runningRenderer) return runningRenderer;

  // If an init is already in progress, await it and return the same renderer.
  if (__initPromise) {
    await __initPromise;
    return runningRenderer;
  }

  // Mark global guard so other inlined bundles or code paths know initialization
  // has at least started. This mirrors the standalone auto-init snippet.
  if (typeof window !== 'undefined') window.__autoRendererStarted = true;

  // Run the actual initialization inside a promise so concurrent callers
  // can await the same work and we can set completion flags consistently.
  __initPromise = (async () => {
    const { canvas: canvasEl = canvas, preferWebGL = true, startLoop = true } = opts;
    if (!canvasEl) throw new Error('No canvas available to initialize renderer');
    installUIHandlers();

    // prefer WebGL2 -> WebGL -> fallback
    if (preferWebGL && canvasEl.getContext) {
      __rendererDiag.triedWebGL = true;
      // Try multiple attribute sets to maximize the chance a browser will
      // provide a context. Some environments/flags disable antialiasing or
      // enforce performance caveats that cause getContext to return null.
      const tryAttrs = [
        {},
        { antialias: false },
        { powerPreference: 'high-performance' },
        { antialias: false, powerPreference: 'high-performance' },
        { antialias: false, powerPreference: 'high-performance', failIfMajorPerformanceCaveat: false }
      ];
      const webgl2Attempts = [];
      let gl2 = null;
      for (const attrs of tryAttrs) {
        try {
          const g = canvasEl.getContext('webgl2', attrs);
          webgl2Attempts.push({ attrs, ok: !!g });
          if (g && !gl2) gl2 = g;
        } catch (e) {
          webgl2Attempts.push({ attrs, ok: false, err: String(e) });
        }
      }
      const webglAttempts = [];
      let gl1 = null;
      if (!gl2) {
        for (const attrs of tryAttrs) {
          try {
            const g = canvasEl.getContext('webgl', attrs);
            webglAttempts.push({ attrs, ok: !!g });
            if (g && !gl1) gl1 = g;
          } catch (e) {
            webglAttempts.push({ attrs, ok: false, err: String(e) });
          }
        }
      }
      __rendererDiag.attempts = { webgl2: webgl2Attempts, webgl: webglAttempts };
      __rendererDiag.gl2 = !!gl2;
      __rendererDiag.gl1 = !!gl1;
      if (gl2 || gl1) {
        try {
            const { createWebGLRenderer } = await import('./webglRenderer.js');
            // Provide atlas accessor and desired LODs so the WebGL renderer can
            // create GPU textures from the offscreen canvases. We pass a small
            // adapter that binds the devicePixelRatio used by the browser.
            const atlasAccessor = (type, radius) => getHullAtlasForRadius(type, radius, (typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1));
            runningRenderer = createWebGLRenderer(canvasEl, { webgl2: !!gl2, atlasAccessor, atlasLODs: DEFAULT_LODS });
            runningRenderer.init();
            if (startLoop) runningRenderer.start(() => { requestAnimationFrame(loop); });
            __rendererDiag.used = 'webgl';
            if (typeof window !== 'undefined') try { window.__rendererDiag = __rendererDiag; } catch(e){}
            console.info('Renderer: using WebGL', { webgl2: !!gl2 });
            try { setBackendBadge('WebGL' + (gl2? '2':'1'), __rendererDiag.importError || 'Using GPU WebGL renderer'); } catch(e){}
            return runningRenderer;
          } catch (err) {
            // fall through to 2D canvas
              __rendererDiag.importError = String(err && err.stack ? err.stack : err);
              console.warn('WebGL init failed, falling back to 2D canvas renderer', err);
              try { setBackendBadge('Canvas (WebGL failed)', __rendererDiag.importError); } catch(e){}
          }
      } else {
        // No GL contexts available
    __rendererDiag.importError = 'No WebGL context (getContext returned null)';
    console.info('Renderer: no WebGL context available; using Canvas 2D fallback');
    try { setBackendBadge('Canvas (no WebGL)', __rendererDiag.importError); } catch(e){}
      }
    }

    // start 2D canvas-driven loop
    if (!runningRenderer) {
      runningRenderer = { type: 'canvas' };
  __rendererDiag.used = 'canvas';
  if (typeof window !== 'undefined') try { window.__rendererDiag = __rendererDiag; } catch(e){}
  console.info('Renderer: using Canvas 2D fallback');
  try { setBackendBadge('Canvas', __rendererDiag.importError || 'Using Canvas 2D fallback'); } catch(e){}
      if (startLoop) requestAnimationFrame(loop);
    }

    return runningRenderer;
  })();

  try {
    const res = await __initPromise;
    __initDone = true;
    return res;
  } finally {
    // clear in-flight promise if it still refers to this run (no-op if already cleared)
    if (__initPromise) __initPromise = null;
  }
}

export function getRendererType(){ return runningRenderer ? runningRenderer.type : null; }

export function getRendererDiagnostics(){ return __rendererDiag; }

export function stopRenderer(){ if (runningRenderer && typeof runningRenderer.stop === 'function') runningRenderer.stop(); if (runningRenderer && typeof runningRenderer.destroy === 'function') runningRenderer.destroy(); runningRenderer = null; __initDone = false; __initPromise = null; if (typeof window !== 'undefined') try { delete window.__autoRendererStarted; } catch(e){} }
// When tests call stopRenderer we also clear the init flags so a subsequent
// initRenderer() call can re-create the renderer instance.
export function stopRendererAndAllowReinit(){ stopRenderer(); __initDone = false; __initPromise = null; if (typeof window !== 'undefined') try { delete window.__autoRendererStarted; } catch(e){} }

// When stopping the renderer, clear init-done flag so callers can re-init in tests
// or in situations where the renderer was torn down and should be restarted.
export function _internal_resetInitFlags(){ __initDone = false; __initPromise = null; if (typeof window !== 'undefined') try { delete window.__autoRendererStarted; } catch(e){} }

// Expose simple global helpers so the standalone AUTO_INIT can reliably
// toggle the simulation running flag even if UI handlers experience a race.
if (typeof window !== 'undefined') {
  window.startSimulation = function startSimulation() {
    try { running = true; const b = document.getElementById('startPause'); if (b) b.textContent = '⏸ Pause'; } catch (e) {}
  };
  window.stopSimulation = function stopSimulation() {
    try { running = false; const b = document.getElementById('startPause'); if (b) b.textContent = '▶ Start'; } catch (e) {}
  };
}

// Exports for unit tests: expose pure helpers and internal pools so tests can
// validate cache/pool behavior without changing runtime logic.
export {
  clamp,
  getHullPath,
  recomputeBackgroundGradient,
  acquireParticle,
  releaseParticle,
  Particle,
  teamColor,
  initStars,
  // stateful internals (tests will snapshot/inspect then restore)
  stars,
  backgroundGradient,
  hullPaths,
  particlePool,
  particles,
  flashes,
  shieldFlashes,
  healthFlashes,
  shipsVMap,
  ships,
  bullets,
  // atlas exports (for WebGL renderer to create textures)
  hullAtlases,
  getHullAtlas,
  getHullAtlasForRadius,
  handleReinforcement,
  resetReinforcementCooldowns,
  evaluateReinforcement,
  // reinforcement frequency control API
  // setReinforcementInterval(seconds) - 0 means every step; >0 is seconds between checks
  setReinforcementInterval,
  getReinforcementInterval,
  // reset is provided by gamemanager
  reset,
};
