import { srand, srange, srangeInt, unseed } from './rng.js';
import { simulateStep } from './simulate.js';
import { Ship, Team, spawnFleet } from './entities.js';

const canvas = document.getElementById('world');
const ctx = canvas.getContext('2d');
let W = canvas.width = window.innerWidth;
let H = canvas.height = window.innerHeight;
window.addEventListener('resize', () => { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; });

// --- Utilities ---
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (min=0, max=1) => min + (max-min) * Math.random();
const randInt = (min, max) => Math.floor(rand(min, max+1));

// UI toast
function toast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 1400); }

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
const teamColor = (t, alpha=1) => t===Team.RED ? `rgba(255,90,90,${alpha})` : `rgba(80,160,255,${alpha})`;

class Particle {
  constructor(x,y,vx,vy,life,color){ this.x=x; this.y=y; this.vx=vx; this.vy=vy; this.life=life; this.max=life; this.color=color; }
  update(dt){ this.x+=this.vx*dt; this.y+=this.vy*dt; this.vx*=Math.pow(0.9,dt*60); this.vy*=Math.pow(0.9,dt*60); this.life-=dt; }
  draw(){ if (this.life<=0) return; const a = this.life/this.max; ctx.fillStyle = this.color.replace('$a', a.toFixed(3)); ctx.fillRect(this.x, this.y, 2,2); }
}

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
    if (showTrails){ const tx = s.x - Math.cos(s.angle)*s.radius*1.2; const ty = s.y - Math.sin(s.angle)*s.radius*1.2; particles.push(new Particle(tx, ty, -s.vx*0.05 + srange(-10,10), -s.vy*0.05 + srange(-10,10), .25, teamColor(s.team, '$a'))); }

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
let ships = []; let bullets=[]; let particles=[]; let flashes=[]; let shieldFlashes = []; let healthFlashes = [];
let shipsVMap = new Map(); // id -> ShipV visual wrappers for logic ships
let running = false; let speed = 1; let showTrails = true; let lastTime = 0;
const score = { red:0, blue:0 };

// spawnFleet now lives in entities.js; renderer will call it and merge results

function reset(seedValue=null){ ships.length=0; bullets.length=0; particles.length=0; flashes.length=0; score.red=0; score.blue=0; if (seedValue!==null){ srand(seedValue>>>0); toast(`Seed set to ${seedValue>>>0}`); } else { unseed(); } ships.push(...spawnFleet(Team.RED, 12, W*0.25, H*0.5)); ships.push(...spawnFleet(Team.BLUE,12, W*0.75, H*0.5)); }

function simulate(dt){
  for (const s of stars){ s.phase += dt * 0.8 * s.d; }
  for (const s of ships){ s.update(dt, ships); }
  for (let i=bullets.length-1;i>=0;i--){ const b=bullets[i]; b.update(dt); if (!b.alive()){ bullets.splice(i,1); continue; } }

  // Use simulateStep (shared logic) for collisions and scoring
  // Provide a place to collect explosion events
  const shieldHits = [];
  const state = { ships, bullets, score, particles, explosions: [], shieldHits };
  simulateStep(state, dt, { W, H });
  if (state.explosions && state.explosions.length){
    for (const e of state.explosions){ // e: {x,y,team}
      flashes.push({ x: e.x, y: e.y, r: 2, life: .25, team: e.team });
      for (let i=0;i<20;i++){ const a = srange(0,TAU); const sp = srange(40,220); particles.push(new Particle(e.x, e.y, Math.cos(a)*sp, Math.sin(a)*sp, srange(.2,1), teamColor(e.team, '$a'))); }
    }
  }
  // handle shield hit visuals
  if (Array.isArray(state.shieldHits) && state.shieldHits.length) {
    for (const h of state.shieldHits) {
      // find the ship so we can compute hit direction relative to ship center
      const ship = ships.find(s => s.id === h.id);
      const shipX = ship ? ship.x : h.hitX;
      const shipY = ship ? ship.y : h.hitY;
      // push a short bright ring centered on the ship (visual flash)
      flashes.push({ x: shipX, y: shipY, r: 6 + Math.min(12, h.amount), life: 0.12, team: h.team, shieldHit: true });
      // particles at exact impact point
      for (let i=0;i<6;i++){ const a = srange(0,TAU); const sp = srange(40,120); particles.push(new Particle(h.hitX, h.hitY, Math.cos(a)*sp, Math.sin(a)*sp, srange(.12,0.4), 'rgba(200,230,255,$a)')); }
      // create an arc-highlight (shieldFlash) attached to ship id with angle from ship center to impact
      if (ship) {
        const ang = Math.atan2(h.hitY - shipY, h.hitX - shipX);
        shieldFlashes.push({ id: ship.id, angle: ang, life: 0.22, amount: h.amount });
      }
    }
  }
  // handle health hit visuals (for health bar flashing)
  if (Array.isArray(state.healthHits) && state.healthHits.length) {
    for (const hh of state.healthHits) {
      const ship = ships.find(s => s.id === hh.id);
      if (ship) {
        // create a health flash entry that renderer will use to animate the health bar color
        healthFlashes.push({ id: ship.id, life: 0.45, amount: hh.amount });
      }
    }
  }

  for (let i=particles.length-1;i>=0;i--){ const p=particles[i]; p.update(dt); if (p.life<=0) particles.splice(i,1); }
  for (let i=flashes.length-1;i>=0;i--){ const f=flashes[i]; f.life -= dt; f.r += 600*dt; if (f.life<=0) flashes.splice(i,1); }
  for (let i=shieldFlashes.length-1;i>=0;i--) { const sf = shieldFlashes[i]; sf.life -= dt; if (sf.life <= 0) shieldFlashes.splice(i,1); }
  for (let i=healthFlashes.length-1;i>=0;i--) { const hf = healthFlashes[i]; hf.life -= dt; if (hf.life <= 0) healthFlashes.splice(i,1); }

  // sync visual wrappers (persist between frames)
  const aliveIds = new Set(ships.map(s => s.id));
  // add or update wrappers
  for (const s of ships) {
    if (shipsVMap.has(s.id)) {
      shipsVMap.get(s.id).syncFromLogic();
    } else {
      shipsVMap.set(s.id, new ShipV(s));
    }
  }
  // remove wrappers for ships that no longer exist
  for (const id of Array.from(shipsVMap.keys())) {
    if (!aliveIds.has(id)) shipsVMap.delete(id);
  }
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
  for (const p of particles){ p.draw(); }
  for (const sv of shipsVMap.values()){ sv.draw(); }
  const redAlive = ships.some(s=>s.alive && s.team===Team.RED);
  const blueAlive = ships.some(s=>s.alive && s.team===Team.BLUE);
  if (!redAlive || !blueAlive){ ctx.save(); ctx.textAlign='center'; ctx.font = '700 36px Inter, system-ui, sans-serif'; const winner = redAlive? 'Red' : blueAlive? 'Blue' : 'Nobody'; const col = redAlive? teamColor(Team.RED, .95) : blueAlive? teamColor(Team.BLUE,.95) : 'rgba(255,255,255,.9)'; ctx.fillStyle = col; ctx.shadowBlur = 14; ctx.shadowColor = col; ctx.fillText(`${winner} Wins!`, W/2, 64); ctx.restore(); }
}

function loop(t){ if (!lastTime) lastTime=t; const rawDt = (t-lastTime)/1000; lastTime = t; const dt = clamp(rawDt, 0, 0.033) * (running? speed: 0); simulate(dt); render(); updateUI(); requestAnimationFrame(loop); }

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

function updateUI(){ redBadge.textContent = `Red ${score.red}`; blueBadge.textContent = `Blue ${score.blue}`; statsDiv.textContent = `Ships: ${ships.filter(s=>s.alive).length}  Bullets: ${bullets.length}  Particles: ${particles.length}`; }

startBtn.addEventListener('click', () => { running = !running; startBtn.textContent = running? '⏸ Pause' : '▶ Start'; });

resetBtn.addEventListener('click', () => { reset(); });
addRedBtn.addEventListener('click', () => { ships.push(new Ship(Team.RED, srange(40, W*0.35), srange(80,H-80))); toast('+1 Red'); });
addBlueBtn.addEventListener('click', () => { ships.push(new Ship(Team.BLUE, srange(W*0.65, W-40), srange(80,H-80))); toast('+1 Blue'); });
trailsBtn.addEventListener('click', () => { showTrails=!showTrails; trailsBtn.textContent = `☄ Trails: ${showTrails? 'On':'Off'}`; });

speedBtn.addEventListener('click', () => {
  const steps=[0.5,1,2,4]; const idx = (steps.indexOf(speed)+1)%steps.length; speed=steps[idx]; speedBtn.textContent = `Speed: ${speed}×`;
});

seedBtn.addEventListener('click', () => {
  const s = prompt('Enter numeric seed (32-bit):', (Math.random()*1e9>>>0)); if (s!==null){ reset(Number(s)); }
});

formationBtn.addEventListener('click', () => {
  const aliveR = ships.filter(s=>s.alive && s.team===Team.RED);
  const aliveB = ships.filter(s=>s.alive && s.team===Team.BLUE);
  const spaceY = 20; const cols=6;
  aliveR.forEach((s,i)=>{ const c=i%cols, r=Math.floor(i/cols); s.x=W*0.25 - c*20; s.y=H*0.5 + (r-cols/2)*spaceY; s.vx=s.vy=0; });
  aliveB.forEach((s,i)=>{ const c=i%cols, r=Math.floor(i/cols); s.x=W*0.75 + c*20; s.y=H*0.5 + (r-cols/2)*spaceY; s.vx=s.vy=0; });
  toast('Fleets re-formed');
});

canvas.addEventListener('click', (e)=>{ const r = 24; flashes.push({x:e.clientX,y:e.clientY,r,life:.25,team: srangeInt(0,1)}); for (let i=0;i<24;i++){ const a=srange(0,TAU), sp=srange(40,220); particles.push(new Particle(e.clientX,e.clientY,Math.cos(a)*sp,Math.sin(a)*sp,srange(.2,1),'rgba(255,255,255,$a)')); } });

// Init
reset();
requestAnimationFrame(loop);
