import type { Color, ColorRepresentation, IUniform, Material, Vector3, Vector4 } from 'three';
import type { ShipHull } from './gameplay.js';

/**
 * Type-safe wrapper for Three.js uniform value with known type.
 * Use this instead of `as any` when accessing shader uniform values.
 */
export interface TypedUniform<T> extends IUniform<T> {
  value: T;
}

/**
 * Uniforms for ShieldHexShader material.
 */
export interface ShieldHexUniforms {
  uTime: TypedUniform<number>;
  uTint: TypedUniform<Color>;
  uTeamIsRed: TypedUniform<number>;
  uEnableRedBoost: TypedUniform<number>;
  uRedBoostPow: TypedUniform<number>;
  uRedBoostMul: TypedUniform<number>;
  uEdgeAlphaMul: TypedUniform<number>;
  uFillAlphaMul: TypedUniform<number>;
  uMinAlphaFloor: TypedUniform<number>;
  uFillTintMul: TypedUniform<number>;
  uOpacity: TypedUniform<number>;
  uHexScale: TypedUniform<number>;
  uEdgeWidth: TypedUniform<number>;
  uMaxAlpha: TypedUniform<number>;
  uRippleCount: TypedUniform<number>;
  uRippleData: TypedUniform<Vector4[]>;
  uRippleT0s: TypedUniform<number[]>;
  uRippleSpeed: TypedUniform<number>;
  uRippleWidthBase: TypedUniform<number>;
  uRippleBlendMode: TypedUniform<number>;
  uRippleIgnoreMaxAlpha: TypedUniform<number>;
  uRippleColorMul: TypedUniform<number>;
  uRippleStrength: TypedUniform<number>;
  uDisplacementScale: TypedUniform<number>;
  uRippleTintMix: TypedUniform<number>;
}

/**
 * Uniforms for PlanetRings shader material.
 */
export interface PlanetRingsUniforms {
  uColor: TypedUniform<Color>;
  uOpacity: TypedUniform<number>;
  uInnerRadius: TypedUniform<number>;
  uOuterRadius: TypedUniform<number>;
  uFresnelStrength: TypedUniform<number>;
  uBrightness: TypedUniform<number>;
  uTintColor: TypedUniform<Color>;
  uTintMix: TypedUniform<number>;
  uBandFreq: TypedUniform<number>;
  uBandStrength: TypedUniform<number>;
  uBandNoiseScale: TypedUniform<number>;
  uBandDarkness: TypedUniform<number>;
  uPlanetCenter: TypedUniform<[number, number, number]>;
  uPlanetRadius: TypedUniform<number>;
  uShadowStrength: TypedUniform<number>;
  uPenumbra: TypedUniform<number>;
  uLightDir: TypedUniform<[number, number, number]>;
}

/**
 * Extended Material type with optional userData for bloom/colorWrite flags.
 */
export interface MaterialWithUserData extends Material {
  userData: {
    __copilot_forceColorWrite?: boolean;
    __copilot_bloomOnly?: boolean;
  };
}

export interface ExplosionEvent {
  id: number;
  seed: number;
  faction: 'alliance' | 'reavers';
  hull: ShipHull;
  position: Vector3;
  radius: number;
  startTime: number;
  duration: number;
  lightDuration: number;
  lightFalloff: number;
  lightColor: ColorRepresentation;
  flashIntensity: number;
  shockwave: { delay: number; duration: number; maxRadius: number };
  fireball: { delay: number; duration: number };
  debris: { count: number; speed: [number, number] };
  particles: { sparks: number; plasma: number; smoke: number };
  palette: {
    flash: string;
    shockwave: string;
    fireballHot: string;
    smoke: string;
  };
  variant?: string;
  elapsed: number;
  lightElapsed: number;
}

export interface ExplosionConfigEntry {
  baseRadius: number;
  flashIntensity: number;
  lightColor: ColorRepresentation;
  lightFalloff: number;
  debrisCount: number;
  particleCounts: { sparks: number; plasma: number; smoke: number };
  palette: {
    flash: string;
    shockwave: string;
    fireballHot: string;
    smoke: string;
  };
  timing: {
    duration: number;
    lightDuration: number;
    shockwave: { delay: number; duration: number };
    fireball: { delay: number; duration: number };
    debrisSpeed: [number, number];
  };
  /** Multiplier applied to the configured explosion radius to compute the shockwave max radius. Default: 1.8 */
  shockwaveMaxRadiusMulti?: number;
}
