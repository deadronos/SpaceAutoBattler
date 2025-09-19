// Barrel file for renderer exports. Keep this minimal to avoid circular imports.
// Re-export types and selective APIs used across the codebase.
export type { CameraBasis } from './cameraManager.js';
export { addParticleExplosion, type ParticleExplosionOptions } from './particleSystem.js';
