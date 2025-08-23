// Copied from spec/progressionConfig.js - XP and progression constants
// Enhanced progression with diminishing returns and extra per-level scalars
export const progression = {
  xpPerDamage: 1,
  xpPerKill: 50,
  // exponential XP growth by default (can be overridden)
  xpToLevel: (level) => 100 * Math.pow(1.25, level - 1),
  // Allow percent-per-level to be either a number or a function(level)
  hpPercentPerLevel: (level) => Math.min(0.10, 0.05 + 0.05 / Math.sqrt(level)),
  dmgPercentPerLevel: 0.08,
  shieldPercentPerLevel: 0.06,
  // New progression axes
  speedPercentPerLevel: 0.03,
  regenPercentPerLevel: 0.04,
};

export default progression;

// Validate progression config on module load
import { validateConfigOrThrow, validateProgressionConfig } from './validateConfig';
try {
  const errs = validateProgressionConfig(progression);
  if (errs && errs.length) {
    validateConfigOrThrow(progression);
  }
} catch (err) {
  // eslint-disable-next-line no-console
  console.error('progressionConfig validation failed:', err && err.message ? err.message : err);
  throw err;
}
