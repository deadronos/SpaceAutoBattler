export const SIM = {
  DT_MS: 16,
  MAX_ACC_MS: 250,
};

export const progression = {
  xpPerDamage: 1,
  xpPerKill: 50,
  xpToLevel: (level) => 100 + level * 50,
};

export default { SIM, progression };
