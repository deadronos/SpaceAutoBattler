export const SHIELD = {
  ttl: 0.4, particleCount: 6, particleTTL: 0.5, particleColor: '#88ccff', particleSize: 2,
  // arcWidth (radians) for shield hit visual/particle spread centered on hitAngle
  arcWidth: Math.PI / 6,
};

export const HEALTH = {
  ttl: 0.6, particleCount: 8, particleTTL: 0.6, particleColor: '#ffb3b3', particleSize: 2.5,
};

export const EXPLOSION = {
  particleCount: 30, particleTTL: 1.2, particleColor: '#ffaa33', particleSize: 3, minSpeed: 20, maxSpeed: 140,
};

export const FALLBACK_POSITIONS = [
  { x: 100, y: 100, team: 'red' },
  { x: 700, y: 500, team: 'blue' }
];

export const STARS = { twinkle: true, redrawInterval: 500, background: '#041018', count: 140 };

export default { SHIELD, HEALTH, EXPLOSION, STARS, FALLBACK_POSITIONS };
