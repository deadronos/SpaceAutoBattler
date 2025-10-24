export type SubsystemType = 'engine' | 'weapons' | 'shields';

export type SubsystemStatus = 'online' | 'damaged' | 'offline';

export type MoraleEffectType = 'aggression_boost' | 'repair_boost' | 'accuracy_boost';

export interface ProgressionEvent {
  ts: number; // epoch ms
  type: 'damage' | 'kill' | 'levelup' | 'other';
  deltaXp?: number; // positive usually
  source?: string; // attacker id or weapon
  details?: string;
}

export interface Subsystem {
  hp: number;
  maxHp: number;
  status: SubsystemStatus;
  repairRate: number;
}

export interface ShipLevelBonuses {
  hull: number;
  shield: number;
  damage: number;
  shieldRegen: number;
  repairRate: number;
  fireRate: number;
}

export interface MoraleAbility {
  cooldownRemaining: number;
  maxCooldown: number;
  duration: number;
  effect: MoraleEffectType;
  isActive: boolean;
  activeUntil: number; // Game time when effect expires
}

export interface Captain {
  accuracy: number; // Multiplier for hit chance (0.8 - 1.2)
  repairSpeed: number; // Multiplier for repair rate (0.8 - 1.2)
  moraleAbility?: MoraleAbility;
}
