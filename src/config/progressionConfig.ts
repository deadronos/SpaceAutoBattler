// Enhanced progression with diminishing returns and extra per-level scalars
export const progression = {
  xpPerDamage: 1,
  xpPerKill: 50,
  xpToLevel: (level: number) => 100 * Math.pow(1.25, level - 1),
  hpPercentPerLevel: (level: number) => Math.min(0.10, 0.05 + 0.05 / Math.sqrt(level)),
  dmgPercentPerLevel: 0.08,
  shieldPercentPerLevel: 0.06,
  speedPercentPerLevel: 0.03,
  regenPercentPerLevel: 0.04,
};

export default progression;
