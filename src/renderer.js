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

// Acquire a 2D rendering context; if unavailable, provide a no-op shim so
// the renderer can still be imported and some pure helpers tested.
let ctx = null;
if (canvas && typeof canvas.getContext === 'function') {
  try { ctx = canvas.getContext('2d'); } catch (e) { ctx = null; }
}
if (!ctx) {
  const noop = () => {};
  ctx = {
    beginPath: noop, moveTo: noop, lineTo: noop, quadraticCurveTo: noop, arc: noop, ellipse: noop, fill: noop, stroke: noop, closePath: noop,
    fillRect: noop, clearRect: noop, createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }),
    fillText: noop, measureText: () => ({ width: 0 }), setLineDash: noop, save: noop, restore: noop, translate: noop, rotate: noop, clip: noop,
    // drawing properties
    shadowBlur: 0, shadowColor: '', globalAlpha: 1, fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: 'start', globalCompositeOperation: 'source-over'
  };
  if (canvas) canvas.getContext = () => ctx;
}

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

// Background gradient cache (recomputed on resize)
let backgroundGradient = null;
function recomputeBackgroundGradient(){ backgroundGradient = ctx.createRadialGradient(W*0.6, H*0.3, 50, W*0.6, H*0.3, Math.max(W,H)); backgroundGradient.addColorStop(0, 'rgba(60,80,140,0.10)'); backgroundGradient.addColorStop(1, 'rgba(10,12,20,0.0)'); }
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

    // Draw hull by type with scale from radius
    ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.angle); ctx.shadowBlur = 12; ctx.shadowColor = teamColor(s.team,.9);
    const r = s.radius || 8;
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
let shipsVMap = new Map(); // id -> ShipV visual wrappers for logic ships
let running = false; let speed = 1; let showTrails = true; let lastTime = 0;

// Delegate reset and simulate to gamemanager. gm.simulate returns the latest
// state object which renderer uses for visuals. keep a local wrapper to call
// gm.simulate to advance the world state and to sync renderer-only wrappers.
function reset(seedValue=null){ return gm.reset(seedValue); }

function simulate(dt){
  // Let gamemanager advance game logic and emit visual events
  const state = gm.simulate(dt, W, H);

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
      runningRenderer.render({ W, H, ships, bullets, particles, flashes, stars, shipsVMap, score });
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

  startBtn.addEventListener('click', () => { running = !running; startBtn.textContent = running? '⏸ Pause' : '▶ Start'; });
  resetBtn.addEventListener('click', () => { reset(); });
  addRedBtn.addEventListener('click', () => { ships.push(new Ship(Team.RED, srange(40, W*0.35), srange(80,H-80))); toast('+1 Red'); });
  addBlueBtn.addEventListener('click', () => { ships.push(new Ship(Team.BLUE, srange(W*0.65, W-40), srange(80,H-80))); toast('+1 Blue'); });
  trailsBtn.addEventListener('click', () => { showTrails=!showTrails; trailsBtn.textContent = `☄ Trails: ${showTrails? 'On':'Off'}`; });

  speedBtn.addEventListener('click', () => { const steps=[0.5,1,2,4]; const idx = (steps.indexOf(speed)+1)%steps.length; speed=steps[idx]; speedBtn.textContent = `Speed: ${speed}×`; });

  seedBtn.addEventListener('click', () => { const s = prompt('Enter numeric seed (32-bit):', (Math.random()*1e9>>>0)); if (s!==null){ reset(Number(s)); } });

  formationBtn.addEventListener('click', () => {
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

  canvas.addEventListener('click', (e)=>{ const r = 24; flashes.push({x:e.clientX,y:e.clientY,r,life:.25,team: srangeInt(0,1)}); for (let i=0;i<24;i++){ const a=srange(0,TAU), sp=srange(40,220); acquireParticle(e.clientX,e.clientY,Math.cos(a)*sp,Math.sin(a)*sp,srange(.2,1),'rgba(255,255,255,$a)'); } });
}

// Keep reset at module init so tests that import helpers still have a sane state.
if (ships.length === 0) reset();

// runtime renderer instance (either webgl or canvas loop)
let runningRenderer = null;

/**
 * Initialize the renderer and start the animation loop.
 * opts: { canvas?: HTMLCanvasElement, preferWebGL?: boolean }
 */
export async function initRenderer(opts = {}) {
  const { canvas: canvasEl = canvas, preferWebGL = true, startLoop = true } = opts;
  if (!canvasEl) throw new Error('No canvas available to initialize renderer');
  installUIHandlers();

  // prefer WebGL2 -> WebGL -> fallback
  if (preferWebGL && canvasEl.getContext) {
    const gl2 = canvasEl.getContext('webgl2');
    const gl1 = !gl2 ? canvasEl.getContext('webgl') : null;
    if (gl2 || gl1) {
      try {
          const { createWebGLRenderer } = await import('./webglRenderer.js');
          runningRenderer = createWebGLRenderer(canvasEl, { webgl2: !!gl2 });
          runningRenderer.init();
          if (startLoop) runningRenderer.start(() => { requestAnimationFrame(loop); });
          return;
        } catch (err) {
          // fall through to 2D canvas
          console.warn('WebGL init failed, falling back to 2D canvas renderer', err);
        }
    }
  }

  // start 2D canvas-driven loop
  if (!runningRenderer) {
    runningRenderer = { type: 'canvas' };
    if (startLoop) requestAnimationFrame(loop);
  }
}

export function getRendererType(){ return runningRenderer ? runningRenderer.type : null; }

export function stopRenderer(){ if (runningRenderer && typeof runningRenderer.stop === 'function') runningRenderer.stop(); if (runningRenderer && typeof runningRenderer.destroy === 'function') runningRenderer.destroy(); runningRenderer = null; }

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
