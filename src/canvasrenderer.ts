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
    // Always use fixed logical bounds for drawing
  const LOGICAL_W = 1920, LOGICAL_H = 1080;
    // Get renderer scale and viewport fit scale/offset from config
    const rendererScale = (RendererConfig && typeof (RendererConfig as any).rendererScale === 'number') ? (RendererConfig as any).rendererScale : 1;
    const fitScale = (RendererConfig as any)._fitScale || 1;
    const offsetX = (RendererConfig as any)._offsetX || 0;
    const offsetY = (RendererConfig as any)._offsetY || 0;
    // Final scale for drawing entities
    const finalScale = this.pixelRatio * fitScale * rendererScale;
    // Set transform: scale and translate to center logical map
    ctx.setTransform(1, 0, 0, 1, 0, 0); // Identity for background
    // Clear the full canvas area
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    // Fill entire canvas with background color
    ctx.save();
    ctx.fillStyle = (AssetsConfig.palette as any).background || '#0b1220';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.restore();
    // Draw starCanvas if present, stretched to fill canvas
    if (state && state.starCanvas) {
      try {
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(state.starCanvas, 0, 0, this.canvas.width, this.canvas.height);
        ctx.restore();
      } catch (e) { /* ignore draw errors */ }
    }
    // Now set transform for entities
    ctx.setTransform(finalScale, 0, 0, finalScale, offsetX * this.pixelRatio, offsetY * this.pixelRatio);
    // Draw logical map background (optional, for debugging)
    // ctx.save();
    // ctx.fillStyle = (AssetsConfig.palette as any).background || '#0b1220';
    // ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    // ctx.restore();

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
        ctx.drawImage(state.starCanvas, 0, 0, LOGICAL_W, LOGICAL_H);
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
        const trailConf = vconf.animations[trailName];
        const maxLen = (trailConf && trailConf.maxLength) || 16;
        while (s.trail.length > maxLen) s.trail.shift();
      } else {
        s.trail = [];
      }
    }

    // Draw engine trails (before ships)
    if (engineTrailsEnabled) {
      for (const s of state.ships || []) {
        if (!s.trail || s.trail.length < 2) continue;
        const vconf = getVisualConfig(s.type || getDefaultShipType());
        const trailName = (vconf.visuals && vconf.visuals.engineTrail) || 'engineTrail';
        const trailConf = vconf.animations[trailName];
        const color = (trailConf && trailConf.color) || '#6cf2ff';
        const width = (trailConf && trailConf.width) || 0.18;
        const fade = (trailConf && trailConf.fade) || 0.7;
        const radius = s.radius || 6;
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (let i = 1; i < s.trail.length; i++) {
          const a = Math.pow(fade, s.trail.length - i);
          ctx.globalAlpha = a;
          ctx.strokeStyle = color;
          ctx.lineWidth = width * radius;
          ctx.beginPath();
          ctx.moveTo(s.trail[i - 1].x, s.trail[i - 1].y);
          ctx.lineTo(s.trail[i].x, s.trail[i].y);
          ctx.stroke();
        }
        ctx.globalAlpha = 1.0;
        ctx.restore();
      }
    }

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
            // If a recent shieldFlash exists for this ship with hitAngle, draw only an arc segment
            try {
              // TTL-based lookup: use shieldFlashIndex for fast per-ship lookup and pick freshest flash
              let flash: any = null;
              try {
                const nowT = (state && state.t) || 0;
                const arr = Array.isArray(shieldFlashes) ? shieldFlashes.filter(f => f.id === s.id) : [];
                let bestTs = -Infinity;
                for (const f of arr) {
                  if (!f) continue;
                  const fTs = (typeof f._ts === 'number') ? f._ts : 0;
                  const fTtl = (typeof f.ttl === 'number') ? f.ttl : ((AssetsConfig && (AssetsConfig as any).shield && (AssetsConfig as any).shield.ttl) || 0.4);
                  if (fTs + fTtl >= nowT - 1e-6 && fTs > bestTs) { bestTs = fTs; flash = f; }
                }
              } catch (e) { flash = null; }
              if (flash && typeof flash.hitAngle === 'number') {
                const arc = (typeof flash.arcWidth === 'number') ? flash.arcWidth : ((vconf && vconf.arcWidth) || (AssetsConfig && (AssetsConfig as any).shieldArcWidth) || Math.PI / 6);
                const start = flash.hitAngle - arc * 0.5 - angle; // account for rotation
                const end = flash.hitAngle + arc * 0.5 - angle;
                ctx.beginPath(); ctx.arc(0, 0, 1, start, end); ctx.stroke();
              } else {
                ctx.beginPath(); ctx.arc(0, 0, 1, 0, Math.PI * 2); ctx.stroke();
              }
            } catch (e) {
              ctx.beginPath(); ctx.arc(0, 0, 1, 0, Math.PI * 2); ctx.stroke();
            }
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

    // helper: draw a stroked ring (used for explosions / flashes)
    function drawRing(x: number, y: number, R: number, color: string, alpha = 1.0, thickness = 2) {
      try {
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
        ctx.strokeStyle = color;
        ctx.lineWidth = thickness;
        ctx.beginPath();
        ctx.arc(x, y, Math.max(1, R), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } catch (e) { /* ignore draw errors */ }
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
