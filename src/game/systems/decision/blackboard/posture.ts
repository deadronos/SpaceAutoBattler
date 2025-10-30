import type { TeamPosture } from '../../../../types/index.js';

export const resolvePosture = (strengthRatio: number): TeamPosture => {
  if (strengthRatio > 1.25) return 'aggressive';
  if (strengthRatio < 0.8) return 'retreat';
  return 'hold';
};
