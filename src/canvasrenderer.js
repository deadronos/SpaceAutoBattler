// canvasrenderer.js - simple Canvas2D fallback renderer
import { AssetsConfig, getShipAsset, getBulletAsset, getTurretAsset } from './config/assets/assetsConfig';
import { TeamsConfig } from './config/teamsConfig.js';
import { VisualMappingConfig, bulletKindForRadius } from './config/entitiesConfig.js';

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
      const shape = getShipAsset(s.type || 'fighter');

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

    ctx.restore();
  }
}

export default CanvasRenderer;
