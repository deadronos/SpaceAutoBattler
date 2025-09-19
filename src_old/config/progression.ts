export const XP_PER_DAMAGE = 0.25; // xp per damage dealt
export const XP_PER_KILL = 20;

export function nextLevelXp(level: number): number {
  // Simple curve: base 50, grows by 1.6x
  return Math.floor(50 * Math.pow(1.6, level - 1));
}

export function applyLevelUps(level: number, baseValue: number): number {
  // Each level gives +8% to the base stat
  return baseValue * Math.pow(1.08, Math.max(0, level - 1));
}
