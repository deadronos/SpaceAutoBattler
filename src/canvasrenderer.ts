// src/canvasrenderer.ts - TypeScript port of the simple Canvas2D renderer.
// This mirrors the behavior in src/canvasrenderer.js but provides types so
// other parts of the codebase can be migrated safely.

import { AssetsConfig, getShipAsset, getBulletAsset, getTurretAsset } from './config/assets/assetsConfig.js';
import { TeamsConfig } from './config/teamsConfig.js';
import { VisualMappingConfig, bulletKindForRadius } from './config/entitiesConfig.js';

export type AnyState = any;

export class CanvasRenderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D | null = null;
  providesOwnLoop = false;
  type = 'canvas';

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  init(): boolean {
    this.ctx = this.canvas.getContext('2d');
    if (!this.ctx) return false;
    return true;
  }

  isRunning(): boolean { return false; }

  renderState(state: AnyState, interpolation = 0): void {
  const ctx = this.ctx!;
  if (!ctx) return;
    const w = this.canvas.width; const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.fillStyle = '#0b1220';
    ctx.fillRect(0, 0, w, h);

    // helper: draw a polygon path from points (already scaled/rotated by transform)
    function drawPolygon(points: number[][]) {
      if (!points || points.length === 0) return;
      ctx.beginPath();
      ctx.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
      ctx.closePath();
      ctx.fill();
    }

    // background starCanvas if present
    if (state && state.starCanvas) {
      try {
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(state.starCanvas, 0, 0, w, h);
        ctx.restore();
      } catch (e) { /* ignore draw errors */ }
    }

    // draw ships using shapes
    for (const s of state.ships || []) {
      try {
        const teamObj = (s.team === 'blue') ? TeamsConfig.teams.blue : TeamsConfig.teams.red;
        const color = (teamObj && teamObj.color) || AssetsConfig.palette.shipHull;
        const radius = s.radius || 6;
        const angle = s.angle || 0;
        const shape = getShipAsset(s.type || 'fighter');

        ctx.save();
        ctx.translate(s.x || 0, s.y || 0);
        ctx.rotate(angle);
        ctx.scale(radius, radius);
        ctx.fillStyle = color;

        if (shape.type === 'polygon') drawPolygon(shape.points as number[][]);
        else if (shape.type === 'circle') { ctx.beginPath(); ctx.arc(0, 0, shape.r || 1, 0, Math.PI * 2); ctx.fill(); }
        else if (shape.type === 'compound' && Array.isArray(shape.parts)) {
          for (const part of shape.parts) {
            if (part.type === 'polygon') drawPolygon(part.points as number[][]);
            else if (part.type === 'circle') { ctx.beginPath(); ctx.arc(0, 0, part.r || 1, 0, Math.PI * 2); ctx.fill(); }
          }
        }
        ctx.restore();

        // hp bar
        ctx.fillStyle = '#222'; ctx.fillRect((s.x || 0) - 10, (s.y || 0) - 12, 20, 4);
        ctx.fillStyle = '#4caf50'; ctx.fillRect((s.x || 0) - 10, (s.y || 0) - 12, 20 * Math.max(0, (s.hp || 0) / (s.maxHp || 1)), 4);
      } catch (e) { /* protect renderer from bad state */ }
    }

    // draw turrets as simple overlays
    for (const s of state.ships || []) {
      try {
        const radius = (s.radius || 6) * 0.6;
        const angle = s.angle || 0;
        const tShape = getTurretAsset('basic');
        ctx.save();
        ctx.translate(s.x || 0, s.y || 0);
        ctx.rotate(angle);
        ctx.scale(radius, radius);
        ctx.fillStyle = AssetsConfig.palette.turret;
        if (tShape.type === 'compound') {
          for (const part of tShape.parts) {
            if (part.type === 'polygon') drawPolygon(part.points as number[][]);
            else if (part.type === 'circle') { ctx.beginPath(); ctx.arc(0, 0, part.r || 1, 0, Math.PI * 2); ctx.fill(); }
          }
        } else if (tShape.type === 'polygon') drawPolygon((tShape as any).points || []);
        else if (tShape.type === 'circle') { ctx.beginPath(); ctx.arc(0, 0, (tShape as any).r || 1, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
      } catch (e) {}
    }

    // particles
    if (Array.isArray(state.particles)) {
      for (const p of state.particles) {
        try {
          ctx.save();
          ctx.translate(p.x || 0, p.y || 0);
          ctx.fillStyle = p.color || '#fff';
          if (p.shape === 'circle' || p.r) {
            ctx.beginPath(); ctx.arc(0, 0, p.r || p.size || 1, 0, Math.PI * 2); ctx.fill();
          } else {
            ctx.fillRect(-1, -1, 2, 2);
          }
          ctx.restore();
        } catch (e) {}
      }
    }

    // bullets
  for (const b of state.bullets || []) {
      try {
        const r = b.radius || b.bulletRadius || 1.5;
    const kind = bulletKindForRadius((r / 6)) as any;
    const shape = getBulletAsset(kind as any);
        ctx.save();
        ctx.translate(b.x || 0, b.y || 0);
        const px = Math.max(1, r);
        if (shape.type === 'circle') {
          ctx.beginPath(); ctx.fillStyle = AssetsConfig.palette.bullet; ctx.arc(0, 0, px, 0, Math.PI * 2); ctx.fill();
        } else if (shape.type === 'polygon') {
          ctx.fillStyle = AssetsConfig.palette.bullet; ctx.scale(px, px); drawPolygon(shape.points as number[][]);
        }
        ctx.restore();
      } catch (e) {}
    }

    ctx.restore();
  }
}

export default CanvasRenderer;
