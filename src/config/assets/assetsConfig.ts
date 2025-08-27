/**
 * Returns the engine trail config for a given ship type.
 * If not present, returns the default engineTrail animation config.
 */
export function getEngineTrailConfig(type: string): any {
  const vconf = getVisualConfig(type);
  const trailName = (vconf.visuals && vconf.visuals.engineTrail) || 'engineTrail';
  return (AssetsConfig.animations && AssetsConfig.animations[trailName]) || (AssetsConfig.animations && AssetsConfig.animations.engineTrail);
}
/**
 * Asset-agnostic sprite provider: returns a sprite object for a given type.
 * Supports fallback to vector shapes or SVG files.
 * Usage: getSpriteAsset('fighter'), getSpriteAsset('carrier'), etc.
 */
export function getSpriteAsset(type: string): { shape?: Shape2D; svg?: string } {
  // Prefer an inlined SVG string from AssetsConfig.svgAssets (standalone build)
  // if present and looks like SVG markup. This allows the build-time inlined
  // SVGs to be used directly by the renderer. If not inlined, fall back to
  // any `svg` field on the shapes2d entry (legacy) or vector shape data.
  const inlineSvg = (AssetsConfig as any).svgAssets && (AssetsConfig as any).svgAssets[type];
  if (typeof inlineSvg === 'string' && inlineSvg.trim().startsWith('<svg')) {
    return { svg: inlineSvg };
  }
  // For backward compatibility, check shapes2d entry for an embedded svg string
  const shapeEntry = AssetsConfig.shapes2d[type] || AssetsConfig.shapes2d.fighter;
  if ((shapeEntry as any).svg) {
    return { svg: (shapeEntry as any).svg };
  }
  // Fallback to vector shape
  return { shape: shapeEntry };
}
// Basic asset templates for 2D top-down rendering.
// Orientation: shapes face +X (to the right). Scale is in logical units; renderer
// should scale to entity radius and rotate by entity heading if present.

export type PolygonShape = {
  type: 'polygon';
  points: number[][]; // [[x,y], ...]
  strokeWidth?: number;
};

export type CircleShape = {
  type: 'circle';
  r: number;
  strokeWidth?: number;
};

export type CompoundPart = PolygonShape | CircleShape;

export type CompoundShape = {
  type: 'compound';
  parts: CompoundPart[];
  strokeWidth?: number;
};

export type Shape2D = PolygonShape | CircleShape | CompoundShape;
export type TurretVisualConfig = {
  kind: string;
  position: [number, number]; // relative to ship center, in radius units
};

export type TurretDefaultConfig = {
  turnRate?: number; // radians per second default
  sprite?: string; // optional sprite key to use for turret visuals
};

export type AssetsConfigType = {
  meta: { orientation: string; coordinateSystem: string };
  palette: Record<string, string>;
  shapes2d: Record<string, Shape2D & { turrets?: TurretVisualConfig[] }>;
  // Optional mapping of ship type -> svg filename (for future svg-based rendering)
  svgAssets?: Record<string, string>;
  // Optional explicit mountpoints extracted from SVGs or authored here.
  // Positions are in ship-local radius units (same space as shapes2d.turrets)
  svgMounts?: Record<string, [number, number][]>;
  // Defaults for turret kinds (turn rate, sprite override, etc.)
  turretDefaults?: Record<string, TurretDefaultConfig>;
  animations?: Record<string, any>;
  damageStates?: Record<string, { opacity?: number; accentColor?: string }>;
  visualStateDefaults?: Record<string, { engine?: string; shield?: string; damageParticles?: string }>;
};

export const AssetsConfig: AssetsConfigType = {
  meta: {
    orientation: '+X',
    coordinateSystem: 'topdown-2d',
  },
  palette: {
    shipHull: '#b0b7c3',
    shipAccent: '#6c7380',
    bullet: '#ffd166',
    turret: '#94a3b8',
    background: '#0b1220'
  },
  // 2D vector shapes defined as polygons and circles. Points are unit-sized
  // profiles (roughly radius 1). Renderer should multiply by entity radius or
  // provided scale before drawing.
  shapes2d: {
    fighter: {
      type: 'compound',
      parts: [
        { type: 'polygon', points: [[1.2, 0], [-0.8, 0.6], [-0.5, 0], [-0.8, -0.6]] },
        { type: 'polygon', points: [[0.0, 0.35], [-0.6, 0.65], [-0.35, 0.0]] },
        { type: 'polygon', points: [[0.0, -0.35], [-0.35, 0.0], [-0.6, -0.65]] },
        { type: 'circle', r: 0.5 }
      ],
      strokeWidth: 0.08
    },
    corvette: {
      type: 'compound',
      parts: [
        { type: 'polygon', points: [[1.2, 0], [0.4, 0.7], [-1.0, 0.6], [-1.2, 0], [-1.0, -0.6], [0.4, -0.7]] },
        { type: 'polygon', points: [[1.4, 0.22], [1.2, 0.12], [1.2, -0.12], [1.4, -0.22]] },
        { type: 'circle', r: 0.6 }
      ],
      strokeWidth: 0.08
    },
    frigate: {
      type: 'compound',
      parts: [
        { type: 'polygon', points: [[1.3, 0], [0.7, 0.65], [-0.3, 1.0], [-1.3, 0.55], [-1.3, -0.55], [-0.3, -1.0], [0.7, -0.65]] },
        { type: 'circle', r: 0.7 }
      ],
      strokeWidth: 0.1
    },
    destroyer: {
      type: 'compound',
      parts: [
        { type: 'polygon', points: [[1.8, 0], [1.0, 0.7], [0.2, 1.0], [-0.8, 0.9], [-1.8, 0.6], [-1.8, -0.6], [-0.8, -0.9], [0.2, -1.0], [1.0, -0.7]] },
        { type: 'circle', r: 1.0 },
        { type: 'polygon', points: [[2.0, 0.3], [1.8, 0.2], [1.8, -0.2], [2.0, -0.3]] }
      ],
      turrets: [
        { kind: 'basic', position: [1.2, 0.8] },
        { kind: 'basic', position: [-1.2, 0.8] },
        { kind: 'basic', position: [1.2, -0.8] },
        { kind: 'basic', position: [-1.2, -0.8] },
        { kind: 'basic', position: [0, 1.5] },
        { kind: 'basic', position: [0, -1.5] }
      ]
    },
    carrier: {
      type: 'compound',
      parts: [
        { type: 'polygon', points: [[2.2, 0], [1.2, 1.2], [-1.0, 1.6], [-2.8, 1.2], [-3.2, 0], [-2.8, -1.2], [-1.0, -1.6], [1.2, -1.2]] },
        { type: 'circle', r: 1.2 },
        { type: 'polygon', points: [[2.6, 0.5], [2.2, 0.3], [2.2, -0.3], [2.6, -0.5]] }
      ],
      strokeWidth: 0.12,
      turrets: [
        { kind: 'basic', position: [2.0, 1.2] },
        { kind: 'basic', position: [-2.0, 1.2] },
        { kind: 'basic', position: [2.0, -1.2] },
        { kind: 'basic', position: [-2.0, -1.2] }
      ]
    },
    bulletSmall: { type: 'circle', r: 0.18 },
    bulletMedium: { type: 'circle', r: 0.25 },
    bulletLarge: { type: 'circle', r: 0.36 },
    turretBasic: {
      type: 'compound',
      parts: [
        { type: 'circle', r: 0.5 },
        { type: 'polygon', points: [[-0.2, 0.2], [0.7, 0.2], [0.7, -0.2], [-0.2, -0.2]] }
      ],
      strokeWidth: 0.08
    },
    // Small effect/particle shapes for renderer-driven effects
    particleSmall: { type: 'circle', r: 0.12 },
    particleMedium: { type: 'circle', r: 0.22 },
    explosionParticle: { type: 'circle', r: 0.32 },
    shieldRing: { type: 'circle', r: 1.2 }
  }
};

// Optional mapping to ship SVGs (relative to this file path). These are
// provided as a convenience for renderers that can load and parse the
// inline SVGs to extract mountpoints or render higher-fidelity imagery.

// For standalone builds, SVGs are inlined as strings. Use globalThis.__INLINE_SVG_ASSETS if present.
if (typeof globalThis !== 'undefined' && (globalThis as any).__INLINE_SVG_ASSETS) {
  (AssetsConfig as any).svgAssets = (globalThis as any).__INLINE_SVG_ASSETS;
} else {
  (AssetsConfig as any).svgAssets = {
    fighter: './svg/fighter.svg',
    destroyer: './svg/destroyer.svg',
    carrier: './svg/carrier.svg',
    frigate: './svg/frigate.svg',
    corvette: './svg/corvette.svg'
  };
}

// For environments where SVG mountpoint extraction isn't available yet we
// provide an explicit mapping that mirrors the turrets defined in shapes2d.
(AssetsConfig as any).svgMounts = {
  destroyer: AssetsConfig.shapes2d.destroyer.turrets ? AssetsConfig.shapes2d.destroyer.turrets.map((t: any) => t.position) : [],
  carrier: AssetsConfig.shapes2d.carrier.turrets ? AssetsConfig.shapes2d.carrier.turrets.map((t: any) => t.position) : []
};

// Turret defaults (radians per second) and optional sprite selection.
(AssetsConfig as any).turretDefaults = {
  basic: { turnRate: Math.PI * 1.5, sprite: 'turretBasic' }
};

// Animations and visual defaults (align with JS AssetsConfig)
(AssetsConfig as any).animations = {
  engineFlare: {
    type: 'polygon',
    points: [ [0, 0], [-0.3, 0.15], [-0.5, 0], [-0.3, -0.15] ],
    pulseRate: 8,
    // configurable alpha multiplier for engine overlay
    alpha: 0.4,
    // local-space X offset (negative = behind ship)
    offset: -0.9
  },
  shieldEffect: {
    type: 'circle',
    r: 1.2,
    strokeWidth: 0.1,
    color: '#88ccff',
    pulseRate: 2,
    // map shieldPct -> alpha = base + scale * shieldPct
    alphaBase: 0.25,
    alphaScale: 0.75
  },
  damageParticles: {
    type: 'particles',
    color: '#ff6b6b',
    count: 6,
    lifetime: 0.8,
    spread: 0.6
  }
  ,
  engineTrail: {
    type: 'trail',
    color: '#fff0a0', // brighter, warm highlight for good contrast
    maxLength: 120,   // longer trail (was 40)
    width: 0.9,       // thicker trail line (was 0.35)
    fade: 0.6         // older points remain more visible (was 0.35)
  }
};

(AssetsConfig as any).damageStates = {
  light: { opacity: 0.9, accentColor: '#b0b7c3' },
  moderate: { opacity: 0.75, accentColor: '#d4a06a' },
  heavy: { opacity: 0.5, accentColor: '#ff6b6b' }
};

(AssetsConfig as any).visualStateDefaults = {
  fighter:   { engine: 'engineFlare', shield: 'shieldEffect', damageParticles: 'damageParticles', engineTrail: 'engineTrail', arcWidth: Math.PI / 12 },
  corvette:  { engine: 'engineFlare', shield: 'shieldEffect', damageParticles: 'damageParticles', engineTrail: 'engineTrail', arcWidth: Math.PI / 12 },
  frigate:   { engine: 'engineFlare', shield: 'shieldEffect', damageParticles: 'damageParticles', engineTrail: 'engineTrail', arcWidth: Math.PI / 12 },
  destroyer: { engine: 'engineFlare', shield: 'shieldEffect', damageParticles: 'damageParticles', engineTrail: 'engineTrail', arcWidth: Math.PI / 12 },
  carrier:   { engine: 'engineFlare', shield: 'shieldEffect', damageParticles: 'damageParticles', engineTrail: 'engineTrail', arcWidth: Math.PI / 12 }
};

// thresholds for mapping hpPct -> damage state key
(AssetsConfig as any).damageThresholds = { moderate: 0.66, heavy: 0.33 };
(AssetsConfig as any).shieldArcWidth = Math.PI / 12;

export function getVisualConfig(type: string) {
  const shape = getShipAsset(type);
  const visuals = (AssetsConfig as any).visualStateDefaults[type] || (AssetsConfig as any).visualStateDefaults.fighter;
  return { shape, visuals, palette: AssetsConfig.palette, animations: (AssetsConfig as any).animations, damageStates: (AssetsConfig as any).damageStates } as any;
}

export function getShipAsset(type: string): Shape2D {
  return AssetsConfig.shapes2d[type] || AssetsConfig.shapes2d.fighter;
}

export function getBulletAsset(kind: 'small' | 'medium' | 'large' = 'small'): Shape2D {
  if (kind === 'large') return AssetsConfig.shapes2d.bulletLarge;
  if (kind === 'medium') return AssetsConfig.shapes2d.bulletMedium;
  return AssetsConfig.shapes2d.bulletSmall;
}

export function getTurretAsset(_kind: 'basic' = 'basic'): Shape2D {
  return AssetsConfig.shapes2d.turretBasic;
}

export default AssetsConfig;
