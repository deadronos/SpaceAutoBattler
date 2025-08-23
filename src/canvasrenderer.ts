// src/canvasrenderer.ts - TypeScript port of the simple Canvas2D renderer.
// This mirrors the behavior in src/canvasrenderer.js but provides types so
// other parts of the codebase can be migrated safely.

import { AssetsConfig, getShipAsset, getBulletAsset, getTurretAsset, getVisualConfig } from './config/assets/assetsConfig';
import { TeamsConfig } from './config/teamsConfig';
import type { AssetsConfig as AssetsConfigType, TeamsConfig as TeamsConfigType, ShipSpec } from './types';
import { VisualMappingConfig, bulletKindForRadius, getDefaultShipType } from './config/entitiesConfig';
import { RendererConfig } from './config/rendererConfig';

export type AnyState = any;

export class CanvasRenderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D | null = null;
  providesOwnLoop = false;
  type = 'canvas';
  // ratio between backing store pixels and CSS (logical) pixels
  pixelRatio = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  init(): boolean {
    this.ctx = this.canvas.getContext('2d');
    if (!this.ctx) return false;
    // compute pixelRatio from backing store vs CSS size so logical coordinates
    // (ships.x / ships.y are in CSS pixels) map correctly to the backing store.
    try {
      const cssW = this.canvas.clientWidth || this.canvas.width || 1;
      this.pixelRatio = (this.canvas.width || cssW) / cssW;
      // reset any previous transforms and set a scale so the renderer can draw
      // using logical (CSS) pixels. This lets main.fitCanvasToWindow change
      // the backing store size (dpr * rendererScale) and the renderer will
      // automatically render at the correct scale.
      this.ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
      // smoothing can be toggled if desired; keep enabled for nicer visuals
      this.ctx.imageSmoothingEnabled = true;
    } catch (e) {
      // ignore and fall back to defaults
      this.pixelRatio = 1;
    }
    return true;
  }

  isRunning(): boolean { return false; }

  renderState(state: AnyState, interpolation = 0): void {
  const ctx = this.ctx!;
  if (!ctx) return;
    // Use CSS (logical) pixel dimensions for layout/drawing now that we
    // applied a transform in init(). This keeps the scene size stable when
    // the backing store (canvas.width/height) is scaled by devicePixelRatio
    // and RendererConfig.rendererScale.
    const w = this.canvas.clientWidth || Math.round(this.canvas.width / this.pixelRatio);
    const h = this.canvas.clientHeight || Math.round(this.canvas.height / this.pixelRatio);
    // clear logical area
    ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.fillStyle = (AssetsConfig.palette as any).background || '#0b1220';
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
        // drawImage will scale to logical size because we've set the transform
        ctx.drawImage(state.starCanvas, 0, 0, w, h);
        ctx.restore();
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

    // draw ships using shapes
    for (const s of state.ships || []) {
      try {
        const teamObj = (s.team === 'blue') ? TeamsConfig.teams.blue : TeamsConfig.teams.red;
        const color = (teamObj && teamObj.color) || AssetsConfig.palette.shipHull;
        const radius = s.radius || 6;
        const angle = s.angle || 0;
  const fallback = getDefaultShipType();
  const shape = getShipAsset(s.type || fallback);

  // visual config helper
  const vconf = getVisualConfig(s.type || fallback);

        // Draw base ship shape (scaled by radius and rotated by heading)
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

        // damage tint overlay based on hpPercent -> map to damageStates
        try {
          const hpPct = (typeof s.hpPercent === 'number') ? s.hpPercent : Math.max(0, Math.min(1, (s.hp || 0) / (s.maxHp || 1)));
          const thresholds = (AssetsConfig as any).damageThresholds || { moderate: 0.66, heavy: 0.33 };
          let ds = 'light';
          if (hpPct < thresholds.heavy) ds = 'heavy';
          else if (hpPct < thresholds.moderate) ds = 'moderate';
          const dcfg = vconf.damageStates?.[ds] || AssetsConfig.damageStates?.[ds];
          if (dcfg) {
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = dcfg.accentColor || '#ff6b6b';
            ctx.globalAlpha = (1 - (hpPct || 0)) * (dcfg.opacity || 0.5);
            if (shape.type === 'polygon') drawPolygon(shape.points as number[][]);
            else if (shape.type === 'circle') { ctx.beginPath(); ctx.arc(0, 0, shape.r || 1, 0, Math.PI * 2); ctx.fill(); }
            else if (shape.type === 'compound' && Array.isArray(shape.parts)) {
              for (const part of shape.parts) {
                if (part.type === 'polygon') drawPolygon(part.points as number[][]);
                else if (part.type === 'circle') { ctx.beginPath(); ctx.arc(0, 0, part.r || 1, 0, Math.PI * 2); ctx.fill(); }
              }
            }
            ctx.globalAlpha = 1.0;
          }
        } catch (e) { /* ignore damage tint errors */ }

        ctx.restore();

        // engine flare animation (positioned behind the ship, along -X local axis)
        try {
          const engineName = (vconf.visuals && vconf.visuals.engine) || 'engineFlare';
          const engine = vconf.animations[engineName];
          if (engine && engine.type === 'polygon') {
            const pulse = 0.5 + 0.5 * Math.sin((now || 0) * (engine.pulseRate || 6) * Math.PI * 2);
            ctx.save();
            ctx.translate(s.x || 0, s.y || 0);
            ctx.rotate(angle);
            // place behind ship using configured offset
            const engOffset = (engine.offset != null ? engine.offset : -0.9);
            ctx.translate(engOffset * radius, 0);
            ctx.scale(radius, radius);
            ctx.fillStyle = vconf.palette.shipAccent || AssetsConfig.palette.shipAccent;
            const engAlpha = (engine.alpha != null ? engine.alpha : 0.4);
            ctx.globalAlpha = engAlpha * pulse;
            drawPolygon(engine.points as number[][]);
            ctx.globalAlpha = 1.0;
            ctx.restore();
          }
        } catch (e) {}

        // shield effect: when shieldPercent > 0 draw stroked circle with pulsing alpha
        try {
          const shieldName = (vconf.visuals && vconf.visuals.shield) || 'shieldEffect';
          const sh = vconf.animations[shieldName];
          const shieldPct = (typeof s.shieldPercent === 'number') ? s.shieldPercent : ((s.maxShield && s.maxShield > 0) ? Math.max(0, Math.min(1, (s.shield || 0) / s.maxShield)) : 0);
          if (sh && shieldPct > 0) {
            const pulse = 0.6 + 0.4 * Math.sin((now || 0) * (sh.pulseRate || 2) * Math.PI * 2);
            ctx.save();
            ctx.translate(s.x || 0, s.y || 0);
            ctx.rotate(angle);
            ctx.scale(radius * (sh.r || 1), radius * (sh.r || 1));
            ctx.lineWidth = (sh.strokeWidth != null ? sh.strokeWidth : 0.08) * radius;
            ctx.strokeStyle = sh.color || '#88ccff';
            const aBase = (sh.alphaBase != null ? sh.alphaBase : 0.25);
            const aScale = (sh.alphaScale != null ? sh.alphaScale : 0.75);
            ctx.globalAlpha = Math.min(1, aBase + aScale * shieldPct) * pulse;
            ctx.beginPath(); ctx.arc(0, 0, 1, 0, Math.PI * 2); ctx.stroke();
            ctx.globalAlpha = 1.0;
            ctx.restore();
          }
        } catch (e) {}

        // hp bar (configurable via RendererConfig.hpBar)
        try {
          const hpBar = (RendererConfig as any).hpBar || { bg: '#222', fill: '#4caf50', w: 20, h: 4, dx: -10, dy: -12 };
          const pct = Math.max(0, (s.hp || 0) / (s.maxHp || 1));
          ctx.fillStyle = hpBar.bg; ctx.fillRect((s.x || 0) + (hpBar.dx || -10), (s.y || 0) + (hpBar.dy || -12), (hpBar.w || 20), (hpBar.h || 4));
          ctx.fillStyle = hpBar.fill; ctx.fillRect((s.x || 0) + (hpBar.dx || -10), (s.y || 0) + (hpBar.dy || -12), (hpBar.w || 20) * pct, (hpBar.h || 4));
        } catch (e) {
          ctx.fillStyle = '#222'; ctx.fillRect((s.x || 0) - 10, (s.y || 0) - 12, 20, 4);
          ctx.fillStyle = '#4caf50'; ctx.fillRect((s.x || 0) - 10, (s.y || 0) - 12, 20 * Math.max(0, (s.hp || 0) / (s.maxHp || 1)), 4);
        }
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
