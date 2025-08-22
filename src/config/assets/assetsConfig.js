// Basic asset templates for 2D top-down rendering with future 3D model placeholders.
// Orientation: shapes face +X (to the right). Scale is in logical units; renderer
// should scale to entity radius and rotate by entity heading if present.

export const AssetsConfig = {
  meta: {
    orientation: '+X',
    coordinateSystem: 'topdown-2d',
  },
  palette: {
    shipHull: '#b0b7c3',
    shipAccent: '#6c7380',
    bullet: '#ffd166',
    turret: '#94a3b8',
  },
  // 2D vector shapes defined as polygons and circles. Points are unit-sized
  // profiles (roughly radius 1). Renderer should multiply by entity radius or
  // provided scale before drawing.
  shapes2d: {
    // A slim arrowhead triangle with small fins
    fighter: {
      type: 'compound',
      parts: [
        { type: 'polygon', points: [ [1.2, 0], [-0.8, 0.6], [-0.5, 0], [-0.8, -0.6] ] },
        { type: 'polygon', points: [ [0.0, 0.35], [-0.6, 0.65], [-0.35, 0.0] ] },
        { type: 'polygon', points: [ [0.0, -0.35], [-0.35, 0.0], [-0.6, -0.65] ] }
      ],
      strokeWidth: 0.08,
      model3d: { url: undefined, scale: 1, type: 'gltf', mesh: undefined }
    },
    // Wider body with a single barrel nose
    corvette: {
      type: 'compound',
      parts: [
        { type: 'polygon', points: [ [1.0, 0], [0.2, 0.6], [-0.9, 0.5], [-1.1, 0], [-0.9, -0.5], [0.2, -0.6] ] },
        { type: 'polygon', points: [ [1.2, 0.18], [1.0, 0.1], [1.0, -0.1], [1.2, -0.18] ] }
      ],
      strokeWidth: 0.08,
      model3d: { url: undefined, scale: 1.4, type: 'gltf', mesh: undefined }
    },
    // Heavier hull with side facets
    frigate: {
      type: 'polygon',
      points: [ [1.1, 0], [0.6, 0.55], [-0.2, 0.8], [-1.2, 0.45], [-1.2, -0.45], [-0.2, -0.8], [0.6, -0.55] ],
      strokeWidth: 0.1,
      model3d: { url: undefined, scale: 1.8, type: 'gltf', mesh: undefined }
    },
    // Long body with multiple notches
    destroyer: {
      type: 'polygon',
      points: [ [1.4, 0], [0.8, 0.5], [0.1, 0.7], [-0.6, 0.6], [-1.4, 0.4], [-1.4, -0.4], [-0.6, -0.6], [0.1, -0.7], [0.8, -0.5] ],
      strokeWidth: 0.12,
      model3d: { url: undefined, scale: 2.2, type: 'gltf', mesh: undefined }
    },
    // Large hub with shorter nose; simple oval body
    carrier: {
      type: 'compound',
      parts: [
        { type: 'polygon', points: [ [1.1, 0], [0.6, 0.7], [-0.5, 0.9], [-1.4, 0.7], [-1.6, 0], [-1.4, -0.7], [-0.5, -0.9], [0.6, -0.7] ] },
        { type: 'polygon', points: [ [1.4, 0.25], [1.1, 0.15], [1.1, -0.15], [1.4, -0.25] ] }
      ],
      strokeWidth: 0.12,
      model3d: { url: undefined, scale: 3.0, type: 'gltf', mesh: undefined }
    },
    // Bullets as circles; renderer can glow using palette.bullet
    bulletSmall: { type: 'circle', r: 0.18 },
    bulletMedium: { type: 'circle', r: 0.25 },
    bulletLarge: { type: 'circle', r: 0.36 },
    // Simple turret: base ring + barrel rectangle facing +X
    turretBasic: {
      type: 'compound',
      parts: [
        { type: 'circle', r: 0.5 },
        { type: 'polygon', points: [ [-0.2, 0.2], [0.7, 0.2], [0.7, -0.2], [-0.2, -0.2] ] }
      ],
      strokeWidth: 0.08
    }
  }
};

export function getShipAsset(type) {
  return AssetsConfig.shapes2d[type] || AssetsConfig.shapes2d.fighter;
}

export function getBulletAsset(kind = 'small') {
  if (kind === 'large') return AssetsConfig.shapes2d.bulletLarge;
  if (kind === 'medium') return AssetsConfig.shapes2d.bulletMedium;
  return AssetsConfig.shapes2d.bulletSmall;
}

export function getTurretAsset(kind = 'basic') {
  return AssetsConfig.shapes2d.turretBasic;
}

export default AssetsConfig;
