// canvasrenderer.js - simple Canvas2D fallback renderer
export class CanvasRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = null;
    this.providesOwnLoop = false;
  }
  init() {
    this.ctx = this.canvas.getContext('2d');
    if (!this.ctx) return false;
    return true;
  }
  isRunning() { return false; }
  renderState(state, interpolation = 0) {
    const ctx = this.ctx; if (!ctx) return;
    const w = this.canvas.width; const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.fillStyle = '#0b1220';
    ctx.fillRect(0, 0, w, h);

    // draw ships
    for (const s of state.ships) {
      ctx.beginPath();
      ctx.fillStyle = s.team === 'red' ? '#ff8b8b' : '#9fc8ff';
      ctx.arc(s.x, s.y, s.radius || 6, 0, Math.PI*2);
      ctx.fill();
      // hp bar
      ctx.fillStyle = '#222'; ctx.fillRect(s.x - 10, s.y - 12, 20, 4);
      ctx.fillStyle = '#4caf50'; ctx.fillRect(s.x - 10, s.y - 12, 20 * Math.max(0, s.hp / s.maxHp), 4);
    }

    // bullets
    ctx.fillStyle = '#ffd080';
    for (const b of state.bullets) ctx.fillRect(b.x-1, b.y-1, 2, 2);

    ctx.restore();
  }
}

export default CanvasRenderer;
