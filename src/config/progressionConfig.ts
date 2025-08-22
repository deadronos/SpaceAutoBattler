export const progression = {
  xpPerDamage: 1,
  xpPerKill: 50,
  xpToLevel: (level: number) => 100 + level * 50,
  hpPercentPerLevel: 0.10,
  dmgPercentPerLevel: 0.08,
  shieldPercentPerLevel: 0.06,
};

export default progression;
