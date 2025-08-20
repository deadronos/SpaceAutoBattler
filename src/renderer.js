// Minimal Canvas renderer that respects the renderer spec (non-invasive, visual-only)
import { simulate } from './gamemanager.js';

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

  function renderFrame(t) {
    if (!_running) return;
    const now = t / 1000;
    const dt = _last ? Math.min(0.05, now - _last) : 1/60;
    _last = now;
    resize();
    const W = canvas.width; const H = canvas.height;
    const state = simulate(dt, W, H);
    // clear
    ctx.clearRect(0,0,canvas.width, canvas.height);
    // background stars placeholder
    ctx.fillStyle = '#081018'; ctx.fillRect(0,0,canvas.width, canvas.height);
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
    requestAnimationFrame(renderFrame);
  }

  return {
    init() { resize(); return true; },
    start() { if (!_running) { _running = true; _last = null; requestAnimationFrame(renderFrame); } },
    stop() { _running = false; },
    isRunning() { return _running; },
    render() { /* manual render placeholder */ },
    destroy() { this.stop(); }
  };
}

export default { createCanvasRenderer };
