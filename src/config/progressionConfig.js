// Copied from spec/progressionConfig.js - XP and progression constants
export const progression = {
  xpPerDamage: 1,
  xpPerKill: 50,
  xpToLevel: (level) => 100 + level * 50,
};

export default progression;
