// src/canvasrenderer.ts - TypeScript port of the simple Canvas2D renderer.
// This mirrors the behavior in src/canvasrenderer.js but provides types so
// other parts of the codebase can be migrated safely.

import { AssetsConfig, getShipAsset, getBulletAsset, getTurretAsset, getVisualConfig } from './config/assets/assetsConfig';
import { TeamsConfig } from './config/teamsConfig';
import type { VisualMappingConfig } from './types';
import { bulletKindForRadius, getDefaultShipType } from './config/entitiesConfig';
import { RendererConfig } from './config/rendererConfig';
import { shieldFlashes, healthFlashes } from './gamemanager';

export type AnyState = any;

export class CanvasRenderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D | null = null;
  bufferCanvas: HTMLCanvasElement;
  bufferCtx: CanvasRenderingContext2D | null = null;
  providesOwnLoop = false;
  type = 'canvas';
  // ratio between backing store pixels and CSS (logical) pixels
  pixelRatio = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    // Create offscreen buffer sized at logical map × renderer scale
    this.bufferCanvas = document.createElement('canvas');
    this.bufferCtx = this.bufferCanvas.getContext('2d');
  }

  init(): boolean {
    this.ctx = this.canvas.getContext('2d');
    if (!this.ctx) return false;
    this.bufferCtx = this.bufferCanvas.getContext('2d');
    if (!this.bufferCtx) return false;
    // compute pixelRatio from backing store vs CSS size so logical coordinates
    // (ships.x / ships.y are in CSS pixels) map correctly to the backing store.
    try {
      const cssW = this.canvas.clientWidth || this.canvas.width || 1;
      this.pixelRatio = (this.canvas.width || cssW) / cssW;
      this.ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
      this.ctx.imageSmoothingEnabled = true;
    } catch (e) {
      this.pixelRatio = 1;
    }
    return true;
  }

  isRunning(): boolean { return false; }

  renderState(state: AnyState, interpolation = 0): void {
    // helper: draw a stroked ring (used for explosions / flashes)
    function drawRing(x: number, y: number, R: number, color: string, alpha = 1.0, thickness = 2) {
      try {
        bufferCtx.save();
        bufferCtx.globalAlpha = Math.max(0, Math.min(1, alpha));
        bufferCtx.strokeStyle = color;
        bufferCtx.lineWidth = thickness;
        bufferCtx.beginPath();
        bufferCtx.arc(x, y, Math.max(1, R), 0, Math.PI * 2);
        bufferCtx.stroke();
        bufferCtx.restore();
      } catch (e) { /* ignore draw errors */ }
    }
    // --- Offscreen buffer rendering ---
    // 1. Draw all simulation visuals to bufferCanvas at logical size × renderer scale
    // 2. Copy bufferCanvas to main canvas, scaling to fit window (fitScale, aspect ratio)
    const ctx = this.ctx!;
    const bufferCtx = this.bufferCtx!;
    if (!ctx || !bufferCtx) return;
    const LOGICAL_W = 1920, LOGICAL_H = 1080;
    const rendererScale = (RendererConfig && typeof (RendererConfig as any).rendererScale === 'number') ? (RendererConfig as any).rendererScale : 1;
    const fitScale = (RendererConfig as any)._fitScale || 1;
    const offsetX = (RendererConfig as any)._offsetX || 0;
    const offsetY = (RendererConfig as any)._offsetY || 0;
    // Resize bufferCanvas if needed
    const bufferW = Math.round(LOGICAL_W * rendererScale);
    const bufferH = Math.round(LOGICAL_H * rendererScale);
    if (this.bufferCanvas.width !== bufferW || this.bufferCanvas.height !== bufferH) {
      this.bufferCanvas.width = bufferW;
      this.bufferCanvas.height = bufferH;
    }
    // Draw simulation to bufferCanvas
    bufferCtx.setTransform(rendererScale, 0, 0, rendererScale, 0, 0);
    bufferCtx.clearRect(0, 0, bufferW, bufferH);
    bufferCtx.save();
    bufferCtx.fillStyle = (AssetsConfig.palette as any).background || '#0b1220';
    bufferCtx.fillRect(0, 0, bufferW, bufferH);
    bufferCtx.restore();

    // helper: draw a polygon path from points (already scaled/rotated by transform)
    function drawPolygon(points: number[][]) {
      if (!points || points.length === 0) return;
      bufferCtx.beginPath();
      bufferCtx.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < points.length; i++) bufferCtx.lineTo(points[i][0], points[i][1]);
      bufferCtx.closePath();
      bufferCtx.fill();
    }

    // background starCanvas if present
    if (state && state.starCanvas) {
      try {
        bufferCtx.save();
        bufferCtx.globalCompositeOperation = 'source-over';
        bufferCtx.drawImage(state.starCanvas, 0, 0, LOGICAL_W, LOGICAL_H);
        bufferCtx.restore();
      } catch (e) { /* ignore draw errors */ }
    }

    // helper: current time for animation pulses
    const now = (state && state.t) || 0;

    // Spawn damage particles from recent damage events (renderer-owned particle bursts)
    try {
      const dmgAnim = AssetsConfig.animations && AssetsConfig.animations.damageParticles;
      if (Array.isArray(state.damageEvents) && dmgAnim) {
        state.particles = state.particles || [];
        for (const ev of state.damageEvents) {
          const count = dmgAnim.count || 6;
          for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = (Math.random() * (dmgAnim.spread || 0.6));
            state.particles.push({
              x: ev.x || 0,
              y: ev.y || 0,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              r: 0.6 + Math.random() * 0.8,
              color: dmgAnim.color || '#ff6b6b',
              lifetime: dmgAnim.lifetime || 0.8,
              age: 0,
              shape: 'circle'
            });
          }
        }
        // clear damageEvents after spawning so they are one-shot
        state.damageEvents = [];
      }
    } catch (e) { /* ignore particle spawn errors */ }

    // Engine trail rendering (config-driven, per ship)
    const engineTrailsEnabled = !!state.engineTrailsEnabled;
    for (const s of state.ships || []) {
      // Update trail history (store in s.trail)
      if (engineTrailsEnabled) {
        s.trail = s.trail || [];
        // Only add new trail point if ship moved
        const last = s.trail.length ? s.trail[s.trail.length - 1] : null;
        if (!last || last.x !== s.x || last.y !== s.y) {
          s.trail.push({ x: s.x, y: s.y });
        }
        // Limit trail length
        const vconf = getVisualConfig(s.type || getDefaultShipType());
        const trailName = (vconf.visuals && vconf.visuals.engineTrail) || 'engineTrail';
        // No catch block needed here
      }
    }

    // Health hits: render freshest per-ship health flash using index (reddish rings)
    try {
      const nowT = (state && state.t) || 0;
      for (const s of state.ships || []) {
        try {
          let flash: any = null;
          const arr = Array.isArray(healthFlashes) ? healthFlashes.filter(f => f.id === s.id) : [];
          let bestTs = -Infinity;
          for (const f of arr) {
            if (!f) continue;
            const fTs = (typeof f._ts === 'number') ? f._ts : 0;
            const fTtl = (typeof f.ttl === 'number') ? f.ttl : 0.4;
            if (fTs + fTtl >= nowT - 1e-6 && fTs > bestTs) { bestTs = fTs; flash = f; }
          }
          if (flash) {
            const ttl = flash.ttl || 0.4; const life = flash.life != null ? flash.life : ttl;
            const t = Math.max(0, Math.min(1, life / ttl));
            const R = 6 + (1 - t) * 18;
            const alpha = 0.9 * t;
            drawRing(flash.x || (s.x || 0), flash.y || (s.y || 0), R, '#ff7766', alpha, 2);
          }
        } catch (e) {}
      }
    } catch (e) {}

    // bullets
    for (const b of state.bullets || []) {
      try {
        const r = b.radius || b.bulletRadius || 1.5;
        const kind = bulletKindForRadius((r / 6)) as any;
        const shape = getBulletAsset(kind as any);
        bufferCtx.save();
        bufferCtx.translate(b.x || 0, b.y || 0);
        const px = Math.max(1, r);
        if (shape.type === 'circle') {
          bufferCtx.beginPath(); bufferCtx.fillStyle = AssetsConfig.palette.bullet; bufferCtx.arc(0, 0, px, 0, Math.PI * 2); bufferCtx.fill();
        } else if (shape.type === 'polygon') {
          bufferCtx.fillStyle = AssetsConfig.palette.bullet; drawPolygon(shape.points as number[][]);
        }
        bufferCtx.restore();
      } catch (e) {}
    }

    // --- Copy bufferCanvas to main canvas, scaling to fit window ---
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform for drawImage
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      this.bufferCanvas,
      0, 0, this.bufferCanvas.width, this.bufferCanvas.height,
      offsetX, offsetY,
      this.bufferCanvas.width * fitScale,
      this.bufferCanvas.height * fitScale
    );
    ctx.restore();
  }
}

export default CanvasRenderer;
