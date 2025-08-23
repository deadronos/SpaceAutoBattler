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
    // compute pixelRatio from renderScale only
    try {
      const renderScale = (RendererConfig && typeof (RendererConfig as any).renderScale === 'number') ? (RendererConfig as any).renderScale : 1;
      this.pixelRatio = renderScale;
      this.ctx.setTransform(1, 0, 0, 1, 0, 0); // No scaling here; only when compositing buffer
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
    // 1. Resize bufferCanvas to logical size × renderer scale BEFORE any drawing
    // 2. Draw all simulation visuals to bufferCanvas
    // 3. Copy bufferCanvas to main canvas ONLY after all drawing is finished
    const ctx = this.ctx!;
    const bufferCtx = this.bufferCtx!;
    if (!ctx || !bufferCtx) return;
    const LOGICAL_W = 1920, LOGICAL_H = 1080;
    const renderScale = (RendererConfig && typeof (RendererConfig as any).renderScale === 'number') ? (RendererConfig as any).renderScale : 1;
    const fitScale = (RendererConfig as any)._fitScale || 1;
    // Resize bufferCanvas if needed (before any drawing)
    const bufferW = Math.round(LOGICAL_W * renderScale);
    const bufferH = Math.round(LOGICAL_H * renderScale);
    if (this.bufferCanvas.width !== bufferW || this.bufferCanvas.height !== bufferH) {
      this.bufferCanvas.width = bufferW;
      this.bufferCanvas.height = bufferH;
      // After resizing, need to re-acquire bufferCtx
      this.bufferCtx = this.bufferCanvas.getContext('2d');
      if (!this.bufferCtx) return;
    }
    // Always use latest bufferCtx after possible resize
    const activeBufferCtx = this.bufferCtx!;
    // Draw simulation to bufferCanvas
    activeBufferCtx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
    activeBufferCtx.clearRect(0, 0, bufferW, bufferH);
    activeBufferCtx.save();
    activeBufferCtx.fillStyle = (AssetsConfig.palette as any).background || '#0b1220';
    activeBufferCtx.fillRect(0, 0, bufferW, bufferH);
    activeBufferCtx.restore();

    // helper: draw a polygon path from points (already scaled/rotated by transform)
    function drawPolygon(points: number[][]) {
      if (!points || points.length === 0) return;
      activeBufferCtx.beginPath();
      activeBufferCtx.moveTo(points[0][0] * renderScale, points[0][1] * renderScale);
      for (let i = 1; i < points.length; i++) activeBufferCtx.lineTo(points[i][0] * renderScale, points[i][1] * renderScale);
      activeBufferCtx.closePath();
      activeBufferCtx.fill();
    }

    // background starCanvas if present
    if (state && state.starCanvas) {
      try {
        activeBufferCtx.save();
        activeBufferCtx.globalCompositeOperation = 'source-over';
        activeBufferCtx.drawImage(state.starCanvas, 0, 0, bufferW, bufferH);
        activeBufferCtx.restore();
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
      const sx = (s.x || 0) * renderScale;
      const sy = (s.y || 0) * renderScale;
      if (sx < 0 || sx >= bufferW || sy < 0 || sy >= bufferH) continue;
      if (s.team === 'blue') {
        console.log('[DEBUG] Blue ship:', {
          id: s.id,
          x: s.x,
          y: s.y,
          radius: s.radius,
          type: s.type,
          visible: true
        });
      }
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

      // Draw engine trail (faded circles)
      if (Array.isArray(s.trail)) {
        for (let i = 0; i < s.trail.length; i++) {
          const tx = s.trail[i].x || 0;
          const ty = s.trail[i].y || 0;
          const tAlpha = 0.2 + 0.5 * (i / s.trail.length);
          const txx = tx * renderScale;
          const tyy = ty * renderScale;
          if (txx < 0 || txx >= bufferW || tyy < 0 || tyy >= bufferH) continue;
          activeBufferCtx.save();
          activeBufferCtx.globalAlpha = tAlpha;
          activeBufferCtx.fillStyle = '#aee1ff';
          activeBufferCtx.beginPath();
          activeBufferCtx.arc(txx, tyy, 6 * renderScale, 0, Math.PI * 2);
          activeBufferCtx.fill();
          activeBufferCtx.restore();
        }
      }

      // Draw ship hull (polygon or circle)
      const vconf = getVisualConfig(s.type || getDefaultShipType());
      const shape = getShipAsset(s.type || getDefaultShipType());
      activeBufferCtx.save();
      activeBufferCtx.translate((s.x || 0) * renderScale, (s.y || 0) * renderScale);
      activeBufferCtx.rotate((s.angle || 0));
  let teamColor = AssetsConfig.palette.shipHull || '#888';
  if (s.team === 'red' && TeamsConfig.teams.red) teamColor = TeamsConfig.teams.red.color;
  else if (s.team === 'blue' && TeamsConfig.teams.blue) teamColor = TeamsConfig.teams.blue.color;
  activeBufferCtx.fillStyle = teamColor;
      if (shape.type === 'circle') {
        activeBufferCtx.beginPath();
        activeBufferCtx.arc(0, 0, (s.radius || 12) * renderScale, 0, Math.PI * 2);
        activeBufferCtx.fill();
      } else if (shape.type === 'polygon') {
        drawPolygon(shape.points as number[][]);
      }
      activeBufferCtx.restore();

      // Draw shield effect (blue ring if shield > 0)
      if (s.shield > 0) {
        if (sx >= 0 && sx < bufferW && sy >= 0 && sy < bufferH) {
          drawRing(s.x, s.y, (s.radius || 12) * 1.2, '#3ab6ff', 0.5, 3 * renderScale);
        }
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
            const fx = (flash.x || (s.x || 0)) * renderScale;
            const fy = (flash.y || (s.y || 0)) * renderScale;
            if (fx >= 0 && fx < bufferW && fy >= 0 && fy < bufferH) {
              activeBufferCtx.save();
              activeBufferCtx.globalAlpha = Math.max(0, Math.min(1, alpha));
              activeBufferCtx.strokeStyle = '#ff7766';
              activeBufferCtx.lineWidth = 2 * renderScale;
              activeBufferCtx.beginPath();
              activeBufferCtx.arc(fx, fy, Math.max(1, R * renderScale), 0, Math.PI * 2);
              activeBufferCtx.stroke();
              activeBufferCtx.restore();
            }
          }
        } catch (e) {}
      }
    } catch (e) {}

    // bullets
    for (const b of state.bullets || []) {
      try {
        const bx = (b.x || 0) * renderScale;
        const by = (b.y || 0) * renderScale;
        if (bx < 0 || bx >= bufferW || by < 0 || by >= bufferH) continue;
        const r = b.radius || b.bulletRadius || 1.5;
        const kind = bulletKindForRadius((r / 6)) as any;
        const shape = getBulletAsset(kind as any);
        activeBufferCtx.save();
        activeBufferCtx.translate(bx, by);
        const px = Math.max(1, r * renderScale);
        if (shape.type === 'circle') {
          activeBufferCtx.beginPath(); activeBufferCtx.fillStyle = AssetsConfig.palette.bullet; activeBufferCtx.arc(0, 0, px, 0, Math.PI * 2); activeBufferCtx.fill();
        } else if (shape.type === 'polygon') {
          activeBufferCtx.fillStyle = AssetsConfig.palette.bullet; drawPolygon(shape.points as number[][]);
        }
        activeBufferCtx.restore();
      } catch (e) {}
    }

    // --- Copy bufferCanvas to main canvas, scaling to fit window ---
    // Only copy after all drawing is finished
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform for drawImage
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      this.bufferCanvas,
      0, 0, this.bufferCanvas.width, this.bufferCanvas.height,
      0, 0,
      this.bufferCanvas.width * fitScale,
      this.bufferCanvas.height * fitScale
    );
    ctx.restore();
  }
}

export default CanvasRenderer;
