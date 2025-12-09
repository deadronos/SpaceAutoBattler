import type { TeamPosture } from '../../../../types/index.js';

/**
 * Resolves the team posture based on the ratio of allied to enemy strength.
 *
 * @param {number} strengthRatio - Ratio of allied HP to enemy HP.
 * @returns {TeamPosture} The calculated posture ('aggressive', 'hold', 'retreat').
 */
export const resolvePosture = (strengthRatio: number): TeamPosture => {
  if (strengthRatio > 1.25) return 'aggressive';
  if (strengthRatio < 0.8) return 'retreat';
  return 'hold';
};
