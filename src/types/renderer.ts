import type { Color, ColorRepresentation, IUniform, Material, Vector3, Vector4 } from 'three';
import type { ShipHull } from './gameplay.js';

/**
 * Type-safe wrapper for Three.js uniform value with known type.
 * Use this instead of `as any` when accessing shader uniform values.
 *
 * @template T The type of the uniform value.
 */
export interface TypedUniform<T> extends IUniform<T> {
  value: T;
}

/**
 * Uniforms for ShieldHexShader material.
 */
export interface ShieldHexUniforms {
  /** Simulation time uniform. */
  uTime: TypedUniform<number>;
  /** Base tint color. */
  uTint: TypedUniform<Color>;
  /** Boolean uniform (0/1) indicating if team is red. */
  uTeamIsRed: TypedUniform<number>;
  /** Boolean uniform (0/1) for red boost effect. */
  uEnableRedBoost: TypedUniform<number>;
  /** Power exponent for red boost. */
  uRedBoostPow: TypedUniform<number>;
  /** Multiplier for red boost intensity. */
  uRedBoostMul: TypedUniform<number>;
  /** Alpha multiplier for hex edges. */
  uEdgeAlphaMul: TypedUniform<number>;
  /** Alpha multiplier for hex interior. */
  uFillAlphaMul: TypedUniform<number>;
  /** Minimum alpha floor. */
  uMinAlphaFloor: TypedUniform<number>;
  /** Tint multiplier for fill color. */
  uFillTintMul: TypedUniform<number>;
  /** Global opacity control. */
  uOpacity: TypedUniform<number>;
  /** Scale factor for hex grid. */
  uHexScale: TypedUniform<number>;
  /** Width of hex edges. */
  uEdgeWidth: TypedUniform<number>;
  /** Maximum alpha value cap. */
  uMaxAlpha: TypedUniform<number>;
  /** Number of active ripples. */
  uRippleCount: TypedUniform<number>;
  /** Ripple data vectors (packed). */
  uRippleData: TypedUniform<Vector4[]>;
  /** Ripple start timestamps. */
  uRippleT0s: TypedUniform<number[]>;
  /** Speed of ripple propagation. */
  uRippleSpeed: TypedUniform<number>;
  /** Base width of ripples. */
  uRippleWidthBase: TypedUniform<number>;
  /** Blend mode for ripples. */
  uRippleBlendMode: TypedUniform<number>;
  /** Boolean uniform to ignore max alpha cap for ripples. */
  uRippleIgnoreMaxAlpha: TypedUniform<number>;
  /** Color multiplier for ripples. */
  uRippleColorMul: TypedUniform<number>;
  /** Strength/intensity of ripples. */
  uRippleStrength: TypedUniform<number>;
  /** Scale for vertex displacement. */
  uDisplacementScale: TypedUniform<number>;
  /** Mix factor for ripple tinting. */
  uRippleTintMix: TypedUniform<number>;
}

/**
 * Uniforms for PlanetRings shader material.
 */
export interface PlanetRingsUniforms {
  /** Base ring color. */
  uColor: TypedUniform<Color>;
  /** Global opacity. */
  uOpacity: TypedUniform<number>;
  /** Inner radius of the ring system. */
  uInnerRadius: TypedUniform<number>;
  /** Outer radius of the ring system. */
  uOuterRadius: TypedUniform<number>;
  /** Strength of fresnel effect. */
  uFresnelStrength: TypedUniform<number>;
  /** Overall brightness multiplier. */
  uBrightness: TypedUniform<number>;
  /** Tint color for variations. */
  uTintColor: TypedUniform<Color>;
  /** Mix factor for tint color. */
  uTintMix: TypedUniform<number>;
  /** Frequency of ring bands. */
  uBandFreq: TypedUniform<number>;
  /** Strength/contrast of ring bands. */
  uBandStrength: TypedUniform<number>;
  /** Scale for noise applied to bands. */
  uBandNoiseScale: TypedUniform<number>;
  /** Darkness factor for gaps between bands. */
  uBandDarkness: TypedUniform<number>;
  /** Center position of the planet. */
  uPlanetCenter: TypedUniform<[number, number, number]>;
  /** Radius of the planet body. */
  uPlanetRadius: TypedUniform<number>;
  /** Strength of shadow casting. */
  uShadowStrength: TypedUniform<number>;
  /** Softness of the shadow edge. */
  uPenumbra: TypedUniform<number>;
  /** Direction of the main light source. */
  uLightDir: TypedUniform<[number, number, number]>;
}

/**
 * Extended Material type with optional userData for bloom/colorWrite flags.
 */
export interface MaterialWithUserData extends Material {
  /** Custom user data attached to the material. */
  userData: {
    /** Force color write during certain passes if true. */
    __copilot_forceColorWrite?: boolean;
    /** If true, this material only renders during bloom passes. */
    __copilot_bloomOnly?: boolean;
  };
}

/**
 * Represents an active explosion instance in the scene.
 */
export interface ExplosionEvent {
  /** Unique ID of the explosion. */
  id: number;
  /** Seed for random variation. */
  seed: number;
  /** Faction of the ship that exploded. */
  faction: 'alliance' | 'reavers';
  /** Hull type of the ship that exploded. */
  hull: ShipHull;
  /** World position of the explosion. */
  position: Vector3;
  /** Base radius of the explosion. */
  radius: number;
  /** Game time when the explosion started. */
  startTime: number;
  /** Total duration of the explosion sequence. */
  duration: number;
  /** Duration of the dynamic light effect. */
  lightDuration: number;
  /** Exponent for light intensity falloff. */
  lightFalloff: number;
  /** Color of the light emitted. */
  lightColor: ColorRepresentation;
  /** Intensity of the initial flash. */
  flashIntensity: number;
  /** Shockwave animation parameters. */
  shockwave: { delay: number; duration: number; maxRadius: number };
  /** Fireball animation parameters. */
  fireball: { delay: number; duration: number };
  /** Debris particle parameters. */
  debris: { count: number; speed: [number, number] };
  /** Particle counts for various effects. */
  particles: { sparks: number; plasma: number; smoke: number };
  /** Color palette for explosion elements. */
  palette: {
    flash: string;
    shockwave: string;
    fireballHot: string;
    smoke: string;
  };
  /** Optional variant name for visual diversity. */
  variant?: string;
  /** Time elapsed since start (updated per frame). */
  elapsed: number;
  /** Time elapsed for light effect (updated per frame). */
  lightElapsed: number;
}

/**
 * Configuration template for generating explosion events.
 */
export interface ExplosionConfigEntry {
  /** Base radius of the explosion. */
  baseRadius: number;
  /** Intensity of the initial flash. */
  flashIntensity: number;
  /** Color of the light emitted. */
  lightColor: ColorRepresentation;
  /** Exponent for light intensity falloff. */
  lightFalloff: number;
  /** Number of debris pieces to spawn. */
  debrisCount: number;
  /** Counts for other particle types. */
  particleCounts: { sparks: number; plasma: number; smoke: number };
  /** Color palette for explosion elements. */
  palette: {
    flash: string;
    shockwave: string;
    fireballHot: string;
    smoke: string;
  };
  /** Timing parameters for various stages. */
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
