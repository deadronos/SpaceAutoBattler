import * as THREE from 'three';
import type { Ship } from '../../types/index.js';
import { RendererConfig } from '../../config/rendererConfig.js';
import { ShipVisualConfig } from '../../config/shipVisualConfig.js';
import { shieldVertexShader, createShieldFragmentShader } from './shieldShaders.js';

/**
 * Shield effects manager
 * Extracted from threeRenderer.ts for SRP compliance
 */

export interface ShieldEffectState {
  recentShieldHits: Map<number, { dir: THREE.Vector3; time: number; strength: number; }[]>;
}

export interface ShieldEffect {
  createShieldEffect(ship: Ship, state: ShieldEffectState): THREE.Object3D;
  updateShieldEffect(ship: Ship, shieldGroup: THREE.Object3D, currentTime: number, state: ShieldEffectState): void;
  disposeShieldEffect(shieldGroup: THREE.Object3D): void;
}

/**
 * Creates the shield effect state
 */
export function createShieldEffectState(): ShieldEffectState {
  return {
    recentShieldHits: new Map<number, { dir: THREE.Vector3; time: number; strength: number; }[]>()
  };
}

/**
 * Creates a shield effect for a ship
 */
export function createShieldEffect(ship: Ship, state: ShieldEffectState): THREE.Object3D {
  const config = RendererConfig.shield;
  const shieldGroup = new THREE.Group();

  // Spherical shield bubble with rim lighting and directional hit arc
  const geom = new THREE.SphereGeometry( 
    (ShipVisualConfig.ships[ship.class]?.collisionRadius ?? 16) * 1.1,
    24, 24
  );
  const teamColor = new THREE.Color(ship.team === 'red' ? config.colors.red : config.colors.blue);

  const HIT_MAX = Math.max(1, Math.floor(RendererConfig.shield.hexGrid.hitMax));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: teamColor },
      uTime: { value: 0.0 },
      uOpacity: { value: config.opacity.base },
      // Hex grid params
      uHexDensity: { value: config.hexGrid.density },
      uEdgeWidth: { value: config.hexGrid.edgeWidth },
      // Hit arc (directional)
      uHitDir: { value: new THREE.Vector3(0, 0, 1) },
      uHitStrength: { value: 0.0 },
      // Hex hit highlighting
      uHitCount: { value: 0 },
      uHitDirs: { value: Array.from({ length: HIT_MAX }, () => new THREE.Vector3(0,0,1)) },
      uHitTimes: { value: new Float32Array(HIT_MAX).fill(-1000) },
      uHitStrengths: { value: new Float32Array(HIT_MAX).fill(0) },
      uHitWindow: { value: config.hexGrid.hitWindow },
      uHexSplashRadius: { value: config.hexGrid.splashRadius },
      // Ripple settings
      uRippleAmplitude: { value: config.ripple.amplitude },
      uRippleSpeed: { value: config.ripple.speed },
      uRippleFalloff: { value: config.ripple.falloff },
      // Arc params
      uArcAlignStart: { value: config.arc.alignStart },
      uArcAlignEnd: { value: config.arc.alignEnd },
      uArcAlphaScale: { value: config.arc.alphaScale },
      uArcColorScale: { value: config.arc.colorScale },
      // Damage scaling
      uDamageNormalizeBy: { value: RendererConfig.shield.damage.normalizeBy },
      uDamageMinScale: { value: RendererConfig.shield.damage.minScale },
      uDamageMaxScale: { value: RendererConfig.shield.damage.maxScale },
    },
    vertexShader: shieldVertexShader,
    fragmentShader: createShieldFragmentShader(HIT_MAX),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });

  const shieldMesh = new THREE.Mesh(geom, material);
  shieldGroup.add(shieldMesh);

  // Store the mesh reference for updates
  (shieldGroup as any).shieldMesh = shieldMesh;

  return shieldGroup;
}

/**
 * Updates the shield effect based on ship status and hits
 */
export function updateShieldEffect(
  ship: Ship, 
  shieldGroup: THREE.Object3D, 
  currentTime: number, 
  state: ShieldEffectState
): void {
  const config = RendererConfig.shield;
  const shieldMesh = (shieldGroup as any).shieldMesh as THREE.Mesh;
  const mat = shieldMesh.material as THREE.ShaderMaterial;

  // Position the shield around the ship (3D)
  shieldGroup.position.set(ship.pos.x, ship.pos.y, ship.pos.z);

  // Scale based on ship class
  const scale = ShipVisualConfig.ships[ship.class]?.scale ?? RendererConfig.defaultScale;
  shieldGroup.scale.setScalar(scale);

  // Update uniforms
  mat.uniforms.uTime.value = currentTime;
  const shieldPercent = ship.maxShield > 0 ? ship.shield / ship.maxShield : 0;
  mat.uniforms.uOpacity.value = config.opacity.base * shieldPercent + config.opacity.min * (1 - shieldPercent);

  // Handle recent hit tracking and visual effects
  const lastHitTime = ship.lastShieldHitTime || 0;
  const hitWindow = RendererConfig.shield.hexGrid.hitWindow; // seconds
  let timeDecay = 0.0;
  
  if (currentTime - lastHitTime < hitWindow) {
    timeDecay = 1.0 - (currentTime - lastHitTime) / hitWindow;
    // Push into recent hits buffer for hex highlighting (avoid duplicates per hit)
    const list = state.recentShieldHits.get(ship.id) ?? [];
    const d = ship.lastShieldHitDir || { x: 0, y: 0, z: 1 };
    const dmg = Math.max(0, ship.lastShieldHitStrength ?? 0);
    
    // Only push once per unique hit time
    if (!list.find(h => Math.abs(h.time - lastHitTime) < 0.01)) {
      const HIT_MAX = Math.max(1, Math.floor(RendererConfig.shield.hexGrid.hitMax));
      list.push({ dir: new THREE.Vector3(d.x, d.y, d.z), time: lastHitTime, strength: dmg });
      // Keep only recent hits
      const pruned = list.filter(h => currentTime - h.time <= hitWindow);
      // Keep only the most recent HIT_MAX hits
      while (pruned.length > HIT_MAX) pruned.shift();
      state.recentShieldHits.set(ship.id, pruned);
    }
  }

  // Update damage visualization
  const dmgNorm = RendererConfig.shield.damage.normalizeBy;
  const dmgMin = RendererConfig.shield.damage.minScale;
  const dmgMax = RendererConfig.shield.damage.maxScale;
  const dmgScale = Math.min(dmgMax, Math.max(0.0, (ship.lastShieldHitStrength ?? 0) / dmgNorm));
  const dmgScaleClamped = Math.max(dmgMin, dmgScale);
  mat.uniforms.uHitStrength.value = timeDecay * dmgScaleClamped;
  const dir = ship.lastShieldHitDir || { x: 0, y: 0, z: 1 };
  (mat.uniforms.uHitDir.value as THREE.Vector3).set(dir.x, dir.y, dir.z).normalize();

  // Update array uniforms for hex highlights
  const list = state.recentShieldHits.get(ship.id) ?? [];
  const HIT_MAX = Math.max(1, Math.floor(RendererConfig.shield.hexGrid.hitMax));
  const maxN = Math.min(HIT_MAX, list.length);
  mat.uniforms.uHitCount.value = maxN;
  const uDirs = (mat.uniforms.uHitDirs.value as THREE.Vector3[]);
  const uTimes = (mat.uniforms.uHitTimes.value as Float32Array);
  const uStrengths = (mat.uniforms.uHitStrengths.value as Float32Array);
  
  for (let i = 0; i < HIT_MAX; i++) {
    if (i < maxN) {
      uDirs[i].copy(list[i].dir).normalize();
      uTimes[i] = list[i].time;
      uStrengths[i] = list[i].strength;
    } else {
      uDirs[i].set(0, 0, 1);
      uTimes[i] = -1000; // Very old time
      uStrengths[i] = 0;
    }
  }
}

/**
 * Disposes shield effect resources
 */
export function disposeShieldEffect(shieldGroup: THREE.Object3D): void {
  const shieldMesh = (shieldGroup as any).shieldMesh as THREE.Mesh;
  if (shieldMesh) {
    if (shieldMesh.geometry) shieldMesh.geometry.dispose();
    if (shieldMesh.material) {
      if (Array.isArray(shieldMesh.material)) {
        shieldMesh.material.forEach(mat => mat.dispose());
      } else {
        shieldMesh.material.dispose();
      }
    }
  }
}

/**
 * Default shield effect implementation
 */
export const shieldEffect: ShieldEffect = {
  createShieldEffect,
  updateShieldEffect,
  disposeShieldEffect
};