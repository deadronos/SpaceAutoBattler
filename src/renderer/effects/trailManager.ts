// TrailManager: per-ship additive point-sprite trails using a ring buffer.
// Respects RendererConfig.trails and scales by ShipVisualConfig.
// Avoids external assets by generating a soft-circle sprite at runtime.

import * as THREE from 'three';
import { RendererConfig } from '../../config/rendererConfig.js';
import { ShipVisualConfig } from '../../config/shipVisualConfig.js';
import type { Ship } from '../../types/index.js';

type Vec3 = { x: number; y: number; z: number };

// Module-level caches (avoid attaching to function objects which trips strict typings)
let _softCircleTextureCache: THREE.Texture | null = null;
let _softCircleTextureCacheSize = 0;

function makeSoftCircleTexture(size = 64): THREE.Texture {
  // Create a shared canvas texture once and reuse it; creating many
  // canvas textures is expensive and caused GC pressure in heavy scenes.
  if (_softCircleTextureCache && _softCircleTextureCacheSize === size) {
    return _softCircleTextureCache;
  }
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.6)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0,0,size,size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  _softCircleTextureCache = tex;
  _softCircleTextureCacheSize = size;
  return tex;
}

function createTrailMaterial(colorHex: string): THREE.ShaderMaterial {
  // Cache shader materials by color so we don't recreate shader programs
  // every time a trail is created. Key by color string.
  const globalAny = createTrailMaterial as unknown as { _trailMaterialCache?: Map<string, THREE.ShaderMaterial> };
  globalAny._trailMaterialCache = globalAny._trailMaterialCache || new Map<string, THREE.ShaderMaterial>();
  const cache = globalAny._trailMaterialCache;
  const key = colorHex;
  const existing = cache.get(key);
  if (existing) return existing.clone();

  const uniforms: Record<string, THREE.IUniform> = {
    uPointTexture: { value: makeSoftCircleTexture(64) },
    uStartOpacity: { value: RendererConfig.trails.opacity.start },
    uEndOpacity: { value: RendererConfig.trails.opacity.end },
    uColor: { value: new THREE.Color(colorHex) },
    uPixelRatio: { value: Math.max(1, (typeof window !== 'undefined' ? window.devicePixelRatio : 1)) }
  };

  const vert = `
    attribute float aAge; // 0..1
    attribute float aSize; // in pixels (pre-attenuation)
    varying float vAge;
    uniform float uPixelRatio;
    void main() {
      vAge = aAge;
      vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mvPos;
      // simple size attenuation; keep trail points visible across DPIs
      float atten = 300.0 / max(1.0, (300.0 - mvPos.z));
      gl_PointSize = aSize * uPixelRatio * atten;
    }
  `;

  const frag = `
    precision mediump float;
    varying float vAge;
    uniform sampler2D uPointTexture;
    uniform vec3 uColor;
    uniform float uStartOpacity;
    uniform float uEndOpacity;
    void main() {
      // Discard fully aged particles
      if (vAge >= 1.0) discard;
      vec4 tex = texture2D(uPointTexture, gl_PointCoord);
      float alpha = mix(uStartOpacity, uEndOpacity, clamp(vAge, 0.0, 1.0));
      vec4 col = vec4(uColor, alpha);
      col.rgb *= tex.rgb;
      col.a *= tex.a;
      if (col.a < 0.002) discard;
      gl_FragColor = col;
    }
  `;

  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: vert,
    fragmentShader: frag,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  cache.set(key, mat);
  return mat.clone();
}

class ShipTrail {
  shipId: number;
  max: number;
  head = 0;
  count = 0;
  positions: Float32Array;
  ages: Float32Array;
  sizes: Float32Array;
  geometry: THREE.BufferGeometry;
  points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;

  constructor(shipId: number, maxParticles: number, colorHex: string) {
    this.shipId = shipId;
    this.max = Math.max(16, maxParticles);
    this.positions = new Float32Array(this.max * 3);
    this.ages = new Float32Array(this.max);
    this.sizes = new Float32Array(this.max);

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('aAge', new THREE.BufferAttribute(this.ages, 1).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setDrawRange(0, 0);

    const mat = createTrailMaterial(colorHex);
    this.points = new THREE.Points(this.geometry, mat);
    this.points.frustumCulled = false;
  }

  push(pos: Vec3, size: number) {
    const i = this.head;
    const base = i * 3;
    this.positions[base] = pos.x;
    this.positions[base + 1] = pos.y;
    this.positions[base + 2] = pos.z;
    this.ages[i] = 0.0;
    this.sizes[i] = size;
    this.head = (this.head + 1) % this.max;
    this.count = Math.min(this.count + 1, this.max);
  // Mark attributes as dirty; draw range is set once during construction
  this.geometry.attributes.position.needsUpdate = true;
  this.geometry.attributes.aAge.needsUpdate = true;
  this.geometry.attributes.aSize.needsUpdate = true;
  }

  step(dt: number, lifetime: number) {
    const inc = dt / Math.max(1e-3, lifetime);
    for (let i = 0; i < this.count; i++) {
      const idx = (this.head - 1 - i + this.max) % this.max;
      this.ages[idx] = Math.min(1.5, this.ages[idx] + inc);
    }
    this.geometry.attributes.aAge.needsUpdate = true;
  }

  setPixelRatio(dpr: number) {
    try { (this.points.material as THREE.ShaderMaterial).uniforms.uPixelRatio.value = Math.max(1, dpr); } catch { /* noop */ }
  }

  dispose() {
    try { this.geometry.dispose(); } catch { /* ignore */ }
    try { (this.points.material as THREE.ShaderMaterial).dispose(); } catch { /* ignore */ }
  }
}

export class TrailManager {
  scene: THREE.Scene;
  trails = new Map<number, ShipTrail>();
  maxPerTrail: number;
  lifetime: number;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    // Map config length (world units) to max particles heuristically (1 particle per ~2 units)
    this.maxPerTrail = Math.min(2048, Math.max(32, Math.floor(RendererConfig.trails.length * 0.5)));
    // Convert fadeSpeed (higher = faster) into lifetime seconds
    this.lifetime = Math.max(0.2, 2.0 / Math.max(0.1, RendererConfig.trails.fadeSpeed));
  }

  private ensureTrail(shipId: number, colorHex: string) {
    let t = this.trails.get(shipId);
    if (!t) {
      t = new ShipTrail(shipId, this.maxPerTrail, colorHex);
      this.trails.set(shipId, t);
      this.scene.add(t.points);
    }
    return t;
  }

  update(ships: Ship[], dt: number) {
    if (!RendererConfig.visual.enableTrails) return;
    const alive = new Set<number>();
    for (const s of ships) {
      if (!s) continue;
      alive.add(s.id);
  const vel = s.vel || { x: 0, y: 0, z: 0 };
  const speedSq = vel.x*vel.x + vel.y*vel.y + vel.z*vel.z;
  const speed = Math.sqrt(speedSq);
      const color = s.team === 'red' ? RendererConfig.trails.colors.red : RendererConfig.trails.colors.blue;
      const trail = this.ensureTrail(s.id, color);

      // Always age existing particles
      trail.step(dt, this.lifetime);

      if (speedSq > 0.25) {
        // Offset behind the ship along -velocity
        const inv = 1 / speed;
        const back = { x: -vel.x * inv, y: -vel.y * inv, z: -vel.z * inv };
        const offset = (ShipVisualConfig.ships[s.class]?.collisionRadius ?? RendererConfig.defaultCollisionRadius) * 0.7;
        const pos = { x: s.pos.x + back.x * offset, y: s.pos.y + back.y * offset, z: s.pos.z + back.z * offset };
        const size = Math.max(1, RendererConfig.trails.width) * ((ShipVisualConfig.ships[s.class]?.scale ?? 1) * 2.0);
        trail.push(pos, size);
      }
    }

    // Remove trails for ships that no longer exist
    for (const id of Array.from(this.trails.keys())) {
      if (!alive.has(id)) this.remove(id);
    }
  }

  setPixelRatio(dpr: number) {
    for (const t of this.trails.values()) t.setPixelRatio(dpr);
  }

  remove(shipId: number) {
    const t = this.trails.get(shipId);
    if (!t) return;
    try { this.scene.remove(t.points); } catch { /* ignore */ }
    t.dispose();
    this.trails.delete(shipId);
  }

  dispose() {
    for (const id of Array.from(this.trails.keys())) this.remove(id);
  }
}

export default TrailManager;
