// Basic asset templates for 2D top-down rendering with future 3D model placeholders.
// Orientation: shapes face +X (to the right). Scale is in logical units; renderer
// should scale to entity radius and rotate by entity heading if present.

export type PolygonShape = {
  type: 'polygon';
  points: number[][]; // [[x,y], ...]
  strokeWidth?: number;
  model3d?: Model3D | undefined;
};

export type CircleShape = {
  type: 'circle';
  r: number;
  strokeWidth?: number;
  model3d?: Model3D | undefined;
};

export type CompoundPart = PolygonShape | CircleShape;

export type CompoundShape = {
  type: 'compound';
  parts: CompoundPart[];
  strokeWidth?: number;
  model3d?: Model3D | undefined;
};

export type Shape2D = PolygonShape | CircleShape | CompoundShape;
export type TurretVisualConfig = {
  kind: string;
  position: [number, number]; // relative to ship center, in radius units
};

export type Model3D = {
  url?: string | undefined;
  scale?: number | undefined;
  type?: string | undefined;
  mesh?: string | undefined;
};

export type AssetsConfigType = {
  meta: { orientation: string; coordinateSystem: string };
  palette: Record<string, string>;
  shapes2d: Record<string, Shape2D & { turrets?: TurretVisualConfig[] }>;
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
    // Scene background color used by renderers
    background: '#0b1220',
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
      strokeWidth: 0.08,
      model3d: { url: undefined, scale: 1, type: 'gltf', mesh: undefined }
    },
    corvette: {
      type: 'compound',
      parts: [
        { type: 'polygon', points: [[1.2, 0], [0.4, 0.7], [-1.0, 0.6], [-1.2, 0], [-1.0, -0.6], [0.4, -0.7]] },
        { type: 'polygon', points: [[1.4, 0.22], [1.2, 0.12], [1.2, -0.12], [1.4, -0.22]] },
        { type: 'circle', r: 0.6 }
      ],
      strokeWidth: 0.08,
      model3d: { url: undefined, scale: 1.4, type: 'gltf', mesh: undefined }
    },
    frigate: {
      type: 'compound',
      parts: [
        { type: 'polygon', points: [[1.3, 0], [0.7, 0.65], [-0.3, 1.0], [-1.3, 0.55], [-1.3, -0.55], [-0.3, -1.0], [0.7, -0.65]] },
        { type: 'circle', r: 0.7 }
      ],
      strokeWidth: 0.1,
      model3d: { url: undefined, scale: 1.8, type: 'gltf', mesh: undefined }
    },
    destroyer: {
      type: 'compound',
      parts: [
        { type: 'polygon', points: [[1.8, 0], [1.0, 0.7], [0.2, 1.0], [-0.8, 0.9], [-1.8, 0.6], [-1.8, -0.6], [-0.8, -0.9], [0.2, -1.0], [1.0, -0.7]] },
        { type: 'circle', r: 1.0 },
        { type: 'polygon', points: [[2.0, 0.3], [1.8, 0.2], [1.8, -0.2], [2.0, -0.3]] }
      ],
      strokeWidth: 0.12,
      model3d: { url: undefined, scale: 2.2, type: 'gltf', mesh: undefined },
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
      model3d: { url: undefined, scale: 3.0, type: 'gltf', mesh: undefined },
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
    color: '#fffc00', // bright yellow for high contrast
  maxLength: 40,    // much longer trail
    width: 0.35,      // thicker trail line
    fade: 0.35        // slower fading, more persistent
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
