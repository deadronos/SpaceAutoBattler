// src/canvasrenderer.ts - TypeScript port of the simple Canvas2D renderer.
// This mirrors the behavior in src/canvasrenderer.js but provides types so
// other parts of the codebase can be migrated safely.


import type { GameState } from './types';
import { acquireSprite, releaseSprite, acquireEffect, releaseEffect, makePooled, createExplosionEffect, resetExplosionEffect, createHealthHitEffect, resetHealthHitEffect, ExplosionEffect, HealthHitEffect } from './entities';
import RendererConfig from './config/rendererConfig';
import { getDefaultBounds } from './config/simConfig';
import AssetsConfig, { getVisualConfig, getShipAsset, getBulletAsset, getTurretAsset } from './config/assets/assetsConfig';
import { getSpriteAsset } from './config/assets/assetsConfig';
import TeamsConfig from './config/teamsConfig';
import { getShipConfig, getDefaultShipType } from './config/entitiesConfig';

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
  // If running in a test environment (DOM emulation) getContext may be unimplemented.
    // Provide a minimal no-op 2D context so renderState can still resize buffers and run logic.
    if (!this.ctx) {
      // create a lightweight no-op ctx that satisfies the subset used by the renderer
      const noop = () => {};
      const noOpCtx: any = {
        setTransform: noop, imageSmoothingEnabled: true, clearRect: noop, save: noop, restore: noop,
        fillRect: noop, beginPath: noop, moveTo: noop, lineTo: noop, closePath: noop,
        fill: noop, stroke: noop, arc: noop, translate: noop, rotate: noop, drawImage: noop,
        globalAlpha: 1, strokeStyle: '#000', fillStyle: '#000', lineWidth: 1, globalCompositeOperation: 'source-over'
      };
      this.ctx = noOpCtx as unknown as CanvasRenderingContext2D;
    }
    this.bufferCtx = this.bufferCanvas.getContext('2d') || this.ctx;
    // bufferCtx must be present (either real or no-op) for renderState to proceed
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

  renderState(state: GameState, interpolation = 0): void {
    // helper: draw a stroked ring (used for explosions / flashes)
    function drawRing(x: number, y: number, R: number, color: string, alpha = 1.0, thickness = 2) {
          try {
            bufferCtx.save();
            bufferCtx.globalAlpha = Math.max(0, Math.min(1, alpha));
            bufferCtx.strokeStyle = color;
            bufferCtx.lineWidth = thickness * renderScale;
            bufferCtx.beginPath();
            bufferCtx.arc(x * renderScale, y * renderScale, Math.max(1, R * renderScale), 0, Math.PI * 2);
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
  // Prefer canonical logical bounds from simConfig so renderer matches simulation
  // defaults. If unavailable, fall back to previous hard-coded values.
  const defaultBounds = (typeof getDefaultBounds === 'function') ? getDefaultBounds() : { W: 1920, H: 1080 };
  const LOGICAL_W = (defaultBounds && typeof defaultBounds.W === 'number') ? defaultBounds.W : 1920;
  const LOGICAL_H = (defaultBounds && typeof defaultBounds.H === 'number') ? defaultBounds.H : 1080;
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
        activeBufferCtx.setTransform(1, 0, 0, 1, 0, 0); // No scaling here; scale coordinates instead
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
    for (const s of state.ships || []) {
      const sx = (s.x || 0) * renderScale;
      const sy = (s.y || 0) * renderScale;
      if (sx < 0 || sx >= bufferW || sy < 0 || sy >= bufferH) continue;
      // Update trail history (store in s.trail)
      if (state.engineTrailsEnabled) {
        s.trail = s.trail || [];
        // Only add new trail point if ship moved
        const last = s.trail.length ? s.trail[s.trail.length - 1] : null;
        if (!last || last.x !== s.x || last.y !== s.y) {
          s.trail.push({ x: s.x, y: s.y });
        }
        // Limit trail length using config
        const trailConfig = require('./config/assets/assetsConfig').getEngineTrailConfig(s.type || getDefaultShipType());
        const maxTrail = trailConfig?.maxLength || 40;
        while (s.trail.length > maxTrail) s.trail.shift();
      }

      // Draw engine trail (configurable shape, color, width, fade)
      if (Array.isArray(s.trail)) {
        const trailConfig = require('./config/assets/assetsConfig').getEngineTrailConfig(s.type || getDefaultShipType());
        const color = trailConfig?.color || '#aee1ff';
        const width = (trailConfig?.width || 0.35) * (s.radius || 12) * renderScale;
        const fade = trailConfig?.fade || 0.35;
        for (let i = 0; i < s.trail.length; i++) {
          const tx = s.trail[i].x || 0;
          const ty = s.trail[i].y || 0;
          // Fade alpha from fade to 1.0
          const tAlpha = fade + (1 - fade) * (i / s.trail.length);
          const txx = tx * renderScale;
          const tyy = ty * renderScale;
          if (txx < 0 || txx >= bufferW || tyy < 0 || tyy >= bufferH) continue;
          activeBufferCtx.save();
          activeBufferCtx.globalAlpha = tAlpha;
          activeBufferCtx.fillStyle = color;
          activeBufferCtx.beginPath();
          activeBufferCtx.arc(txx, tyy, width, 0, Math.PI * 2);
          activeBufferCtx.fill();
          activeBufferCtx.restore();
        }
      }

      // Draw ship hull using asset-agnostic sprite provider
      const sprite = getSpriteAsset(s.type || getDefaultShipType());
      activeBufferCtx.save();
      activeBufferCtx.translate((s.x || 0) * renderScale, (s.y || 0) * renderScale);
      activeBufferCtx.rotate((s.angle || 0));
      let teamColor = AssetsConfig.palette.shipHull || '#888';
      if (s.team === 'red' && TeamsConfig.teams.red) teamColor = TeamsConfig.teams.red.color;
      else if (s.team === 'blue' && TeamsConfig.teams.blue) teamColor = TeamsConfig.teams.blue.color;
      activeBufferCtx.fillStyle = teamColor;
      if (sprite.svg) {
        // Future: render SVG (not implemented yet)
        // For now, fallback to shape
      }
      if (sprite.model3d) {
        // Future: render 3D model (not implemented yet)
        // For now, fallback to shape
      }
      const shape = sprite.shape;
      if (shape) {
        if (shape.type === 'circle') {
          activeBufferCtx.beginPath();
          activeBufferCtx.arc(0, 0, (s.radius || 12) * renderScale, 0, Math.PI * 2);
          activeBufferCtx.fill();
        } else if (shape.type === 'polygon') {
          drawPolygon(shape.points as number[][]);
        } else if (shape.type === 'compound') {
          for (const part of shape.parts) {
            if (part.type === 'circle') {
              activeBufferCtx.beginPath();
              activeBufferCtx.arc(0, 0, (part.r || 1) * (s.radius || 12) * renderScale, 0, Math.PI * 2);
              activeBufferCtx.fill();
            } else if (part.type === 'polygon') {
              drawPolygon(part.points as number[][]);
            }
          }
        }
      }
      // Draw all turrets at their configured positions
      if (Array.isArray((s as any).turrets) && (s as any).turrets.length > 0) {
        for (const turret of (s as any).turrets) {
          if (!turret || !turret.position) continue;
          const turretShape = getTurretAsset(turret.kind || 'basic');
          // Always use latest config radius for turret position and scale
          const shipType = s.type || 'fighter';
          const shipCfg = require('./config/entitiesConfig').getShipConfig()[shipType];
          const configRadius = shipCfg && typeof shipCfg.radius === 'number' ? shipCfg.radius : (s.radius || 12);
          const turretScale = configRadius * renderScale * 0.5;
          // Calculate turret position relative to ship center, rotated by ship angle
          const angle = (s.angle || 0);
          const [tx, ty] = turret.position;
          const turretX = Math.cos(angle) * tx * configRadius - Math.sin(angle) * ty * configRadius;
          const turretY = Math.sin(angle) * tx * configRadius + Math.cos(angle) * ty * configRadius;
          activeBufferCtx.save();
          activeBufferCtx.translate(turretX, turretY);
          activeBufferCtx.rotate(0); // Optionally rotate for turret direction
          activeBufferCtx.fillStyle = AssetsConfig.palette.turret || '#94a3b8';
          if (turretShape.type === 'circle') {
            activeBufferCtx.beginPath();
            activeBufferCtx.arc(0, 0, (turretShape.r || 1) * turretScale, 0, Math.PI * 2);
            activeBufferCtx.fill();
          } else if (turretShape.type === 'polygon') {
            activeBufferCtx.save();
            activeBufferCtx.scale(turretScale, turretScale);
            drawPolygon(turretShape.points as number[][]);
            activeBufferCtx.restore();
          } else if (turretShape.type === 'compound') {
            for (const part of turretShape.parts) {
              if (part.type === 'circle') {
                activeBufferCtx.beginPath();
                activeBufferCtx.arc(0, 0, (part.r || 1) * turretScale, 0, Math.PI * 2);
                activeBufferCtx.fill();
              } else if (part.type === 'polygon') {
                activeBufferCtx.save();
                activeBufferCtx.scale(turretScale, turretScale);
                drawPolygon(part.points as number[][]);
                activeBufferCtx.restore();
              }
            }
          }
          activeBufferCtx.restore();
        }
      }

      // Draw shield effect (blue ring if shield > 0)
  if ((s.shield ?? 0) > 0) {
        if (sx >= 0 && sx < bufferW && sy >= 0 && sy < bufferH) {
          const shAnim = (AssetsConfig as any).animations && (AssetsConfig as any).animations.shieldEffect;
          try {
            if (shAnim) {
              // pulse based on time
              const pulse = (typeof shAnim.pulseRate === 'number') ? (0.5 + 0.5 * Math.sin(now * shAnim.pulseRate)) : 1.0;
              const shieldNorm = Math.max(0, Math.min(1, (s.shield || 0) / (s.maxShield || s.shield || 1)));
              const alphaBase = typeof shAnim.alphaBase === 'number' ? shAnim.alphaBase : (shAnim.alpha || 0.25);
              const alphaScale = typeof shAnim.alphaScale === 'number' ? shAnim.alphaScale : 0.75;
              const alpha = Math.max(0, Math.min(1, alphaBase + alphaScale * pulse * shieldNorm));
              const R = (shAnim.r || 1.2) * (s.radius || 12);
              activeBufferCtx.save();
              activeBufferCtx.globalAlpha = alpha;
              activeBufferCtx.strokeStyle = shAnim.color || '#3ab6ff';
              activeBufferCtx.lineWidth = (shAnim.strokeWidth || 0.08) * (s.radius || 12) * renderScale;
              activeBufferCtx.beginPath();
              activeBufferCtx.arc((s.x || 0) * renderScale, (s.y || 0) * renderScale, Math.max(1, R * renderScale), 0, Math.PI * 2);
              activeBufferCtx.stroke();
              activeBufferCtx.restore();
            } else {
              drawRing(s.x, s.y, (s.radius || 12) * 1.2, '#3ab6ff', 0.5, 3 * renderScale);
            }
          } catch (e) { /* ignore shield draw errors */ }
        }
      }

    }

    // Health hits: render freshest per-ship health flash using index (reddish rings), pooled
    try {
      const nowT = state.t || 0;
      for (const s of state.ships || []) {
        try {
          let flash: any = null;
          const arr = Array.isArray(state.healthFlashes) ? state.healthFlashes.filter((f: any) => f.id === s.id) : [];
          let bestTs = -Infinity;
          for (const f of arr) {
            if (!f) continue;
            const fTs = (typeof f._ts === 'number') ? f._ts : 0;
            const fTtl = (typeof f.ttl === 'number') ? f.ttl : 0.4;
            if (fTs + fTtl >= nowT - 1e-6 && fTs > bestTs) { bestTs = fTs; flash = f; }
          }
          if (flash) {
            // Use pooled effect for health flash
            const pooledFlash = acquireEffect(state, 'healthFlash', () => makePooled(
              // Use typed factory to create base health effect and attach render fields via reset
              createHealthHitEffect({ x: flash.x || s.x || 0, y: flash.y || s.y || 0 }),
              (obj, initArgs) => {
                // rehydrate base health fields
                resetHealthHitEffect(obj, initArgs as any);
                // attach/rehydrate render-specific fields
                (obj as any).ttl = initArgs?.ttl ?? 0.4;
                (obj as any).life = initArgs?.life ?? (obj as any).ttl;
                (obj as any).color = '#ff7766';
                (obj as any).radius = 6;
              }
            ), flash);
            type RenderHealthFlash = HealthHitEffect & { ttl: number; life: number; color: string; radius: number };
            const pf = pooledFlash as unknown as RenderHealthFlash;
            const t = Math.max(0, Math.min(1, pf.life / pf.ttl));
            const R = (pf.radius as number) + (1 - t) * 18;
            const alpha = 0.9 * t;
            const fx = (pf.x as number) * renderScale;
            const fy = (pf.y as number) * renderScale;
            if (fx >= 0 && fx < bufferW && fy >= 0 && fy < bufferH) {
              activeBufferCtx.save();
              activeBufferCtx.globalAlpha = Math.max(0, Math.min(1, alpha));
              activeBufferCtx.strokeStyle = pf.color;
              activeBufferCtx.lineWidth = 2 * renderScale;
              activeBufferCtx.beginPath();
              activeBufferCtx.arc(fx, fy, Math.max(1, R * renderScale), 0, Math.PI * 2);
              activeBufferCtx.stroke();
              activeBufferCtx.restore();
            }
            releaseEffect(state, 'healthFlash', pooledFlash);
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
  const kind = typeof b.bulletRadius === 'number' ? (b.bulletRadius < 2 ? 'small' : b.bulletRadius < 3 ? 'medium' : 'large') : 'small';
        const shape = getBulletAsset(kind as any);
        activeBufferCtx.save();
        activeBufferCtx.translate(bx, by);
        const px = Math.max(1, r * renderScale);
        activeBufferCtx.fillStyle = AssetsConfig.palette.bullet;
        if (shape.type === 'circle') {
          activeBufferCtx.beginPath(); activeBufferCtx.arc(0, 0, px, 0, Math.PI * 2); activeBufferCtx.fill();
        } else if (shape.type === 'polygon') {
          drawPolygon(shape.points as number[][]);
        } else if (shape.type === 'compound') {
          for (const part of shape.parts) {
            if (part.type === 'circle') {
              activeBufferCtx.beginPath();
              activeBufferCtx.arc(0, 0, (part.r || 1) * px, 0, Math.PI * 2);
              activeBufferCtx.fill();
            } else if (part.type === 'polygon') {
              drawPolygon(part.points as number[][]);
            }
          }
        }
        activeBufferCtx.restore();
      } catch (e) {}
    }
    // particles (pooled)
    try {
      const shapes = (AssetsConfig as any).shapes2d || {};
      for (const p of state.particles || []) {
        try {
          // Use pooled sprite for particle visuals
          const particle = acquireSprite(state, 'particle', () => makePooled({
            x: p.x || 0,
            y: p.y || 0,
            r: p.r || 1,
            color: p.color || '#ffdca8',
            age: p.age || 0,
            lifetime: p.lifetime || 1,
            assetShape: p.assetShape,
          }, (obj, initArgs) => {
            obj.x = initArgs?.x ?? 0;
            obj.y = initArgs?.y ?? 0;
            obj.r = initArgs?.r ?? 1;
            obj.color = initArgs?.color ?? '#ffdca8';
            obj.age = initArgs?.age ?? 0;
            obj.lifetime = initArgs?.lifetime ?? 1;
            obj.assetShape = initArgs?.assetShape;
          }), p);
          const px = particle.x * renderScale;
          const py = particle.y * renderScale;
          if (px < 0 || px >= bufferW || py < 0 || py >= bufferH) continue;
          activeBufferCtx.save();
          const shapeName = particle.assetShape || (particle.r > 0.5 ? 'particleMedium' : 'particleSmall');
          const shape = shapes[shapeName];
          activeBufferCtx.fillStyle = particle.color;
          activeBufferCtx.globalAlpha = Math.max(0, Math.min(1, 1 - (particle.age / particle.lifetime)));
          activeBufferCtx.translate(px, py);
          if (shape) {
            if (shape.type === 'circle') {
              const rr = (shape.r || 0.12) * particle.r * renderScale * 6;
              activeBufferCtx.beginPath(); activeBufferCtx.arc(0, 0, rr, 0, Math.PI * 2); activeBufferCtx.fill();
            } else if (shape.type === 'polygon') {
              activeBufferCtx.beginPath();
              const pts = shape.points || [];
              if (pts.length) {
                activeBufferCtx.moveTo((pts[0][0] || 0) * renderScale, (pts[0][1] || 0) * renderScale);
                for (let i = 1; i < pts.length; i++) activeBufferCtx.lineTo((pts[i][0] || 0) * renderScale, (pts[i][1] || 0) * renderScale);
                activeBufferCtx.closePath();
                activeBufferCtx.fill();
              }
            } else if (shape.type === 'compound') {
              for (const part of shape.parts || []) {
                if (part.type === 'circle') {
                  const rr = (part.r || 0.12) * particle.r * renderScale * 6;
                  activeBufferCtx.beginPath(); activeBufferCtx.arc(0, 0, rr, 0, Math.PI * 2); activeBufferCtx.fill();
                } else if (part.type === 'polygon') {
                  activeBufferCtx.beginPath();
                  const pts = part.points || [];
                  if (pts.length) {
                    activeBufferCtx.moveTo((pts[0][0] || 0) * renderScale, (pts[0][1] || 0) * renderScale);
                    for (let i = 1; i < pts.length; i++) activeBufferCtx.lineTo((pts[i][0] || 0) * renderScale, (pts[i][1] || 0) * renderScale);
                    activeBufferCtx.closePath();
                    activeBufferCtx.fill();
                  }
                }
              }
            } else {
              activeBufferCtx.beginPath(); activeBufferCtx.arc(0, 0, (particle.r || 2) * renderScale, 0, Math.PI * 2); activeBufferCtx.fill();
            }
          } else {
            activeBufferCtx.beginPath(); activeBufferCtx.arc(0, 0, (particle.r || 2) * renderScale, 0, Math.PI * 2); activeBufferCtx.fill();
          }
          activeBufferCtx.restore();
          releaseSprite(state, 'particle', particle);
        } catch (e) {}
      }
    } catch (e) { /* ignore particle render errors */ }

    // Explosions (flashes) use explosionParticle if available, pooled via acquireEffect
    try {
      const expShape = (AssetsConfig as any).shapes2d && (AssetsConfig as any).shapes2d.explosionParticle;
      for (const ex of state.explosions || []) {
        try {
          // Use pooled effect for explosion visuals
          const effect = acquireEffect(state, 'explosion', () => makePooled(
            createExplosionEffect({ x: ex.x || 0, y: ex.y || 0, r: (expShape && expShape.r) || 0.32 }),
            (obj, initArgs) => {
              // rehydrate base explosion fields
              resetExplosionEffect(obj, initArgs as any);
              // attach/rehydrate render-specific fields
              (obj as any).scale = initArgs?.scale ?? 1;
              (obj as any).color = initArgs?.color ?? '#ffd089';
              (obj as any).alpha = initArgs?.alpha ?? ((1 - ((ex.life || 0.5) / (ex.ttl || 0.5))) * 0.9);
            }
          ), ex);
          type RenderExplosion = ExplosionEffect & { scale?: number; color?: string; alpha?: number };
          const ef = effect as unknown as RenderExplosion;
          activeBufferCtx.save();
          activeBufferCtx.globalAlpha = (ef.alpha as number) || 0;
          activeBufferCtx.translate((ef.x as number) * renderScale, (ef.y as number) * renderScale);
          activeBufferCtx.fillStyle = ef.color || '#ffd089';
          if (expShape && expShape.type === 'circle') {
            const rr = (ef.r || 0.32) * (ef.scale || 1) * renderScale * 6;
            activeBufferCtx.beginPath(); activeBufferCtx.arc(0, 0, rr * (1 + (1 - ((ex.life || 0.5) / (ex.ttl || 0.5)))), 0, Math.PI * 2); activeBufferCtx.fill();
          } else {
            activeBufferCtx.beginPath(); activeBufferCtx.arc(0, 0, Math.max(2, (ef.scale || 1) * 12 * (1 - ((ex.life || 0.5) / (ex.ttl || 0.5)))), 0, Math.PI * 2); activeBufferCtx.fill();
          }
          activeBufferCtx.restore();
          releaseEffect(state, 'explosion', effect);
        } catch (e) {}
      }
    } catch (e) {}

    // --- Copy bufferCanvas to main canvas, scaling to fit window ---
    // Only copy after all drawing is finished
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform for drawImage
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.imageSmoothingEnabled = false;
      // Copy buffer to canvas at 1:1 scaling; let CSS handle visual scaling if needed
      ctx.drawImage(
        this.bufferCanvas,
        0, 0, this.bufferCanvas.width, this.bufferCanvas.height,
        0, 0,
        this.canvas.width,
        this.canvas.height
      );
    ctx.restore();
  }
}

export default CanvasRenderer;
