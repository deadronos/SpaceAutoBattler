// Minimal Canvas renderer that respects the renderer spec (non-invasive, visual-only)
import { simulate, acquireParticle, releaseParticle, particles, shieldFlashes, healthFlashes, config } from './gamemanager.js';
import { srandom } from './rng.js';

export function createCanvasRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let _running = false;
  let _last = null;
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.floor(canvas.clientWidth * dpr);
    const h = Math.floor(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  }

  function doRender(t) {
    const now = t / 1000;
    const dt = _last ? Math.min(0.05, now - _last) : 1/60;
    _last = now;
    resize();
    const W = canvas.width; const H = canvas.height;
    const state = simulate(dt, W, H);
    // clear
    ctx.clearRect(0,0,canvas.width, canvas.height);
    // background: prefer pre-rendered starCanvas (fast) otherwise draw individual stars
    if (state.starCanvas) {
      try {
        ctx.drawImage(state.starCanvas, 0, 0, canvas.width, canvas.height);
      } catch (e) {
        // fallback to per-star drawing if drawImage fails
        ctx.fillStyle = '#041018'; ctx.fillRect(0,0,canvas.width, canvas.height);
        if (state.stars && state.stars.length) {
          for (const s of state.stars) {
            ctx.globalAlpha = s.a != null ? s.a : 1.0;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath(); ctx.arc(s.x, s.y, s.r || 1, 0, Math.PI*2); ctx.fill();
          }
          ctx.globalAlpha = 1.0;
        }
      }
    } else {
      // per-star fallback
      if (state.stars && state.stars.length) {
        ctx.fillStyle = '#041018'; ctx.fillRect(0,0,canvas.width, canvas.height);
        // draw stars (cheap: 1-2px circles)
        for (const s of state.stars) {
          ctx.globalAlpha = s.a != null ? s.a : 1.0;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.arc(s.x, s.y, s.r || 1, 0, Math.PI*2); ctx.fill();
        }
        ctx.globalAlpha = 1.0;
      } else {
        ctx.fillStyle = '#081018'; ctx.fillRect(0,0,canvas.width, canvas.height);
      }
    }
    // draw ships
    for (const s of state.ships) {
      ctx.beginPath();
      ctx.fillStyle = s.team === 'red' ? '#ff8080' : '#80b8ff';
      ctx.arc(s.x, s.y, s.radius || 8, 0, Math.PI*2);
      ctx.fill();
      // shield ring
      if (s.shield > 0) {
        ctx.strokeStyle = 'rgba(160,200,255,0.35)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(s.x, s.y, Math.max((s.radius||8)+3, (s.radius||8)*1.2), 0, Math.PI*2); ctx.stroke();
      }
    }
    // draw bullets
    for (const b of state.bullets) {
      ctx.fillStyle = '#ffd080'; ctx.beginPath(); ctx.arc(b.x, b.y, b.radius||2, 0, Math.PI*2); ctx.fill();
    }

    // process shield/health flashes: persist events and spawn particles once
    for (let i = shieldFlashes.length - 1; i >= 0; i--) {
      const ev = shieldFlashes[i];
      // spawn particles once
      if (!ev.spawned) {
        ev.spawned = true;
        const pc = config.shield.particleCount || 6;
        for (let j = 0; j < pc; j++) {
          const a = (j / pc) * Math.PI * 2;
          const speed = 30 + j * 6;
          acquireParticle(ev.hitX, ev.hitY, { vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, ttl: config.shield.particleTTL, color: config.shield.particleColor, size: config.shield.particleSize });
        }
      }
      // draw a faint expanding ring based on life
      const t = Math.max(0, Math.min(1, ev.life / ev.ttl));
      const radius = (ev.radius || 8) * (1 + (1 - t) * 1.5);
      ctx.strokeStyle = `rgba(160,200,255,${0.6 * t})`;
      ctx.lineWidth = 2 * t;
      ctx.beginPath(); ctx.arc(ev.hitX, ev.hitY, radius, 0, Math.PI * 2); ctx.stroke();
      // decay
      ev.life -= dt;
      if (ev.life <= 0) shieldFlashes.splice(i, 1);
    }

    for (let i = healthFlashes.length - 1; i >= 0; i--) {
      const ev = healthFlashes[i];
      if (!ev.spawned) {
        ev.spawned = true;
        const pc = config.health.particleCount || 8;
        for (let j = 0; j < pc; j++) {
          const a = srandom() * Math.PI * 2;
          const speed = 40 * srandom();
          acquireParticle(ev.hitX, ev.hitY, { vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, ttl: config.health.particleTTL, color: config.health.particleColor, size: config.health.particleSize + srandom() * 2 });
        }
      }
      const t = Math.max(0, Math.min(1, ev.life / ev.ttl));
      const radius = (ev.radius || 8) * (1 + (1 - t) * 2.0);
      ctx.strokeStyle = `rgba(255,120,80,${0.7 * t})`;
      ctx.lineWidth = 2 * t;
      ctx.beginPath(); ctx.arc(ev.hitX, ev.hitY, radius, 0, Math.PI * 2); ctx.stroke();
      ev.life -= dt;
      if (ev.life <= 0) healthFlashes.splice(i, 1);
    }

    // update & draw particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        releaseParticle(p);
        continue;
      }
      // simple motion
      p.x += p.vx * dt; p.y += p.vy * dt;
      const alpha = Math.max(0, p.life / p.ttl);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = alpha;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size || 1, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1.0;
    }
  }

  function renderFrame(t) {
    if (!_running) return;
    doRender(t);
    requestAnimationFrame(renderFrame);
  }

  // perform a single synchronous render step (useful for tests)
  function renderOnce(nowMs = performance.now()) {
    // pass a millisecond timestamp consistent with requestAnimationFrame
    doRender(nowMs);
  }

  return {
    init() { resize(); return true; },
    start() { if (!_running) { _running = true; _last = null; requestAnimationFrame(renderFrame); } },
    stop() { _running = false; },
    isRunning() { return _running; },
  render() { /* manual render placeholder */ },
  renderOnce,
    destroy() { this.stop(); }
  };
}

export default { createCanvasRenderer };
