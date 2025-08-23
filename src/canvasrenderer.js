// canvasrenderer.js - simple Canvas2D fallback renderer
/**
 * @typedef {import('./types').AssetsConfig} AssetsConfig
 * @typedef {import('./types').TeamsConfig} TeamsConfig
 * @typedef {import('./types').ShipSpec} ShipSpec
 */
import { AssetsConfig, getShipAsset, getBulletAsset, getTurretAsset } from './config/assets/assetsConfig';
import { TeamsConfig } from './config/teamsConfig';
import { VisualMappingConfig, bulletKindForRadius, getDefaultShipType } from './config/entitiesConfig';
import { RendererConfig } from './config/rendererConfig';

export class CanvasRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = null;
    this.providesOwnLoop = false;
  }
  init() {
    this.ctx = this.canvas.getContext('2d');
    if (!this.ctx) return false;
    // Ensure drawing uses CSS (logical) pixels so simulation coordinates
    // (which operate in logical bounds) map correctly to the canvas.
    // The main entry sets canvas.width/height = bounds * devicePixelRatio
    // and canvas.style.width/height = bounds in CSS pixels. Scale the
    // 2D context by the DPR so drawing coordinates match CSS pixels.
    // devicePixelRatio multiplied by an optional rendererScale allows us to
    // make the entire scene larger or smaller while preserving crispness on
    // high-DPI screens. rendererScale defaults to 1.
    // initialize scale, but allow runtime updates via updateScale()
    this.updateScale();
    return true;
  }
  isRunning() { return false; }
  renderState(state, interpolation = 0) {
    const ctx = this.ctx; if (!ctx) return;
    // The canvas' drawing context is reset when canvas.width/height changes
    // (which happens on window resize). Re-apply the last-computed transform
    // so simulation coordinates map correctly. updateScale() should be called
    // when the rendererScale changes to refresh this.dpr and reapply transforms.
    const dpr = (typeof this.dpr === 'number' && this.dpr > 0) ? this.dpr : ((typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1);
    try {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    } catch (e) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    }
    // Compute logical (CSS) width/height from the canvas backing store size
    // divided by the applied dpr. This ensures clearRect operates in logical
    // pixels that match simulation coordinates.
    const w = Math.round(this.canvas.width / dpr);
    const h = Math.round(this.canvas.height / dpr);
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.fillStyle = '#0b1220';
  ctx.fillRect(0, 0, w, h);

    // helper: draw a polygon path from points (already scaled/rotated by transform)
    function drawPolygon(points) {
      if (!points || points.length === 0) return;
      ctx.beginPath();
      ctx.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
      ctx.closePath();
      ctx.fill();
    }

    // draw ships using shapes
    for (const s of state.ships) {
      const team = s.team === 'blue' ? TeamsConfig.teams.blue : TeamsConfig.teams.red;
      const color = team.color || AssetsConfig.palette.shipHull;
      const radius = s.radius || 6;
      const angle = s.angle || 0;
  const fallback = getDefaultShipType();
  const shape = getShipAsset(s.type || fallback);

      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(angle);
      ctx.scale(radius, radius);
      ctx.fillStyle = color;
      if (shape.type === 'polygon') {
        drawPolygon(shape.points);
      } else if (shape.type === 'circle') {
        ctx.beginPath(); ctx.arc(0, 0, shape.r || 1, 0, Math.PI * 2); ctx.fill();
      } else if (shape.type === 'compound' && Array.isArray(shape.parts)) {
        for (const part of shape.parts) {
          if (part.type === 'polygon') drawPolygon(part.points);
          else if (part.type === 'circle') { ctx.beginPath(); ctx.arc(0, 0, part.r || 1, 0, Math.PI * 2); ctx.fill(); }
        }
      }
      ctx.restore();

      // hp bar
      ctx.fillStyle = '#222'; ctx.fillRect(s.x - 10, s.y - 12, 20, 4);
      ctx.fillStyle = '#4caf50'; ctx.fillRect(s.x - 10, s.y - 12, 20 * Math.max(0, (s.hp || 0) / (s.maxHp || 1)), 4);
    }

    // draw turrets as simple overlays (optional)
    // This placeholder draws one turret per ship at the ship origin, rotated with ship
    for (const s of state.ships) {
      const radius = (s.radius || 6) * 0.6;
      const angle = s.angle || 0;
      const tShape = getTurretAsset('basic');
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(angle);
      ctx.scale(radius, radius);
      ctx.fillStyle = AssetsConfig.palette.turret;
      if (tShape.type === 'compound') {
        for (const part of tShape.parts) {
          if (part.type === 'polygon') drawPolygon(part.points);
          else if (part.type === 'circle') { ctx.beginPath(); ctx.arc(0, 0, part.r || 1, 0, Math.PI * 2); ctx.fill(); }
        }
      }
      ctx.restore();
    }

    // bullets using radius mapping to kind (small/medium/large)
    for (const b of state.bullets) {
      const r = b.radius || b.bulletRadius || 1.5;
      const kind = bulletKindForRadius(r / 6 /* normalize roughly by typical ship radius */);
      const shape = getBulletAsset(kind);
      ctx.save();
      ctx.translate(b.x, b.y);
      // scale bullet circle to approximate projectile radius in pixels
      const px = Math.max(1, r);
      if (shape.type === 'circle') {
        ctx.beginPath();
        ctx.fillStyle = AssetsConfig.palette.bullet;
        ctx.arc(0, 0, px, 0, Math.PI * 2);
        ctx.fill();
      } else if (shape.type === 'polygon') {
        ctx.fillStyle = AssetsConfig.palette.bullet; ctx.scale(px, px); drawPolygon(shape.points);
      }
      ctx.restore();
    }

    // visual effects: explosions (flashes), shield hits, health hits
    function drawRing(x, y, R, color, alpha = 1.0, thickness = 2) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      ctx.strokeStyle = color;
      ctx.lineWidth = thickness;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(1, R), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Explosions: warm rings that expand and fade
    if (Array.isArray(state.flashes)) {
      for (const f of state.flashes) {
        const ttl = f.ttl || 0.6; const life = f.life != null ? f.life : ttl;
        const t = Math.max(0, Math.min(1, life / ttl));
        const R = 8 + (1 - t) * 28; // expands as it fades
        const alpha = 0.8 * t;
        const color = '#ffaa33';
        drawRing(f.x || 0, f.y || 0, R, color, alpha, 3);
      }
    }

    // Shield hits: cool blue rings
    if (Array.isArray(state.shieldFlashes)) {
      for (const s of state.shieldFlashes) {
        const ttl = s.ttl || 0.4; const life = s.life != null ? s.life : ttl;
        const t = Math.max(0, Math.min(1, life / ttl));
        const R = 6 + (1 - t) * 16;
        const alpha = 0.9 * t;
        drawRing(s.x || 0, s.y || 0, R, '#88ccff', alpha, 2);
      }
    }

    // Health hits: reddish rings
    if (Array.isArray(state.healthFlashes)) {
      for (const s of state.healthFlashes) {
        const ttl = s.ttl || 0.6; const life = s.life != null ? s.life : ttl;
        const t = Math.max(0, Math.min(1, life / ttl));
        const R = 6 + (1 - t) * 18;
        const alpha = 0.9 * t;
        drawRing(s.x || 0, s.y || 0, R, '#ff7766', alpha, 2);
      }
    }

    ctx.restore();
  }

  // Recompute combined DPR (devicePixelRatio * rendererScale) and apply the
  // transform to the context. Call this when RendererConfig.rendererScale
  // changes (e.g., user moved the dev slider) or when window.devicePixelRatio
  // changes.
  updateScale() {
    if (!this.ctx) this.ctx = this.canvas.getContext('2d');
    // The backing store DPR should be devicePixelRatio only. main.js sets
    // canvas.width/height based on devicePixelRatio * CSS_size. The renderer
    // here uses dpr=baseDpr to scale drawing into the backing store pixels.
    const baseDpr = (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1;
    this.dpr = baseDpr;
    // Diagnostic log to verify updateScale is called during tests/standalone runtime.
    try { console.debug && console.debug('CanvasRenderer.updateScale -> dpr=', this.dpr); } catch (e) {}
    try {
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    } catch (e) {
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.scale(this.dpr, this.dpr);
    }
  }
}

export default CanvasRenderer;
