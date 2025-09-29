# Design — Ship Progression System

## Overview

This design document outlines the implementation of a comprehensive ship progression system that adds XP-based leveling, captain traits, damage types, and subsystem mechanics to enhance combat depth while maintaining performance.

## EARS Requirements

1. **XP and Leveling**: WHEN a ship deals damage or kills an enemy, THE SYSTEM SHALL award XP to that ship and track XP in-memory only.
   - Acceptance: Unit tests simulate damage/kills and show XP increments; no disk changes.

2. **Level-up Progression**: WHEN a ship reaches XP thresholds, THE SYSTEM SHALL level the ship and apply stat increases (hull/shield/damage/repair/shieldRegen) within safe caps.
   - Acceptance: Level-up test increases intended stats and enforces caps/diminishing returns on fire rate.

3. **Captain System**: WHEN a large ship has a captain assigned, THE SYSTEM SHALL apply captain trait modifiers (accuracy, repairSpeed, moraleAbility).
   - Acceptance: Combat and repair systems consume captain modifiers; moraleAbility applies temporary buff with duration + cooldown.

4. **Damage Types**: WHEN a weapon with specific damage type hits a target, THE SYSTEM SHALL calculate effectiveness against shield/armor/hull according to type.
   - Acceptance: Tests cover plasma vs armor, ion vs shield, baseline cases for kinetic/explosive.

5. **Subsystem Damage**: WHEN a subsystem is critically damaged, THE SYSTEM SHALL apply functional penalties and allow repairs over ticks.
   - Acceptance: Subsystem status affects movement/attack; repair ticks restore subsystem HP; captain modifiers influence repair speed.

## Type System Design

### Core Extensions to ShipComponent

```typescript
export interface ShipComponent {
  // ... existing fields ...
  
  // Progression System
  xp: number;
  level: number;
  xpToNext: number;
  
  // Captain System (for large ships)
  captain?: Captain;
  
  // Subsystem Health
  subsystems: Record<SubsystemType, Subsystem>;
  
  // Defense Categories (for damage type effectiveness)
  defenses: {
    armor: number;     // Effective against kinetic/explosive
    shieldCapacity: number; // Effective against ion
    // hull stays as 'hp' field
  };
}
```

### New Type Definitions

```typescript
export type DamageType = 'kinetic' | 'plasma' | 'ion' | 'explosive';

export type SubsystemType = 'engine' | 'weapons' | 'shields';

export interface Captain {
  accuracy: number;        // Multiplier for hit chance (0.8 - 1.2)
  repairSpeed: number;     // Multiplier for repair rate (0.8 - 1.2)
  moraleAbility?: MoraleAbility;
}

export interface MoraleAbility {
  cooldownRemaining: number;  // Seconds until ability can be used
  maxCooldown: number;       // Base cooldown duration
  duration: number;          // How long the effect lasts
  effect: MoraleEffectType;  // What the ability does
  isActive: boolean;         // Whether currently active
}

export type MoraleEffectType = 'aggression_boost' | 'repair_boost' | 'accuracy_boost';

export interface Subsystem {
  hp: number;
  maxHp: number;
  status: SubsystemStatus;
  repairRate: number;        // HP per second repair rate
}

export type SubsystemStatus = 'online' | 'damaged' | 'offline';

// Damage effectiveness matrix
export interface DamageEffectiveness {
  [damageType in DamageType]: {
    hull: number;         // Effectiveness vs hull HP
    shield: number;       // Effectiveness vs shield HP  
    armor: number;        // Effectiveness vs armor defense
  };
}
```

### Weapon System Update

```typescript
export interface ProjectileComponent {
  // ... existing fields ...
  damageType: DamageType;
}

// Add to ShipStats and ShipComponent
export interface ShipStats {
  // ... existing fields ...
  damageType: DamageType;  // Default damage type for this hull
}
```

## System Implementation Details

### XP System

**XP Sources:**
- Damage dealt: `XP = damage * 0.1` (fractional XP)
- Kill bonus: `XP = target.maxHp * 0.5` (substantial bonus for kills)

**Level Progression:**
- Level 1→2: 100 XP
- Level 2→3: 250 XP  
- Level 3→4: 450 XP
- Level N→N+1: `100 * N^1.8` (exponential growth)

**Level-up Bonuses (per level):**
- Hull: +5% maxHp (capped at +50% at level 10)
- Shield: +5% maxShield (capped at +50% at level 10)
- Damage: +3% damage (capped at +30% at level 10)
- Shield Regen: +4% shieldRegen (capped at +40% at level 10)
- Repair Efficiency: +5% repairRate (capped at +50% at level 10)
- Fire Rate: +2% fireRate (capped at +15% at level 8 to prevent performance issues)

### Damage Type System

**Effectiveness Matrix:**
```typescript
const DAMAGE_EFFECTIVENESS: DamageEffectiveness = {
  kinetic: { hull: 1.0, shield: 0.8, armor: 1.2 },  // Good vs armor, poor vs shields
  plasma:  { hull: 1.1, shield: 0.9, armor: 1.3 },  // Best vs armor, decent overall
  ion:     { hull: 0.7, shield: 1.4, armor: 0.9 },  // Excellent vs shields, poor vs hull
  explosive: { hull: 1.2, shield: 0.6, armor: 1.1 } // Great vs hull, terrible vs shields
};
```

**Damage Calculation:**
1. Calculate base damage from projectile
2. Apply damage type effectiveness based on target defense type
3. Apply damage to appropriate defense layer (shields first, then armor absorption, then hull)

### Captain System

**Captain Assignment:**
- Destroyers: 80% chance to have captain
- Carriers: 100% chance to have captain
- Other hulls: No captains

**Captain Trait Generation (deterministic):**
```typescript
function generateCaptain(shipSeed: number): Captain {
  const rng = new SeededRng(shipSeed);
  return {
    accuracy: rng.range(0.85, 1.15),
    repairSpeed: rng.range(0.8, 1.2),
    moraleAbility: generateMoraleAbility(rng)
  };
}
```

**Morale Abilities:**
- **Aggression Boost**: Temporarily increases AI attack intent weights by 50% for 10 seconds (60s cooldown)
- **Repair Boost**: Doubles repair rate for all subsystems for 8 seconds (90s cooldown)  
- **Accuracy Boost**: +25% hit chance for 12 seconds (75s cooldown)

### Subsystem System

**Subsystem Initialization:**
```typescript
function createSubsystems(hull: ShipHull): Record<SubsystemType, Subsystem> {
  const baseHp = SHIP_STATS[hull].maxHp * 0.3; // 30% of ship HP
  return {
    engine: { hp: baseHp, maxHp: baseHp, status: 'online', repairRate: baseHp * 0.1 },
    weapons: { hp: baseHp, maxHp: baseHp, status: 'online', repairRate: baseHp * 0.1 },
    shields: { hp: baseHp, maxHp: baseHp, status: 'online', repairRate: baseHp * 0.1 }
  };
}
```

**Critical Hit System:**
- 15% chance for any damage to cause subsystem damage
- Random subsystem selection (weighted: weapons 40%, engine 35%, shields 25%)
- Subsystem takes 20-40% of hull damage received

**Subsystem Status Effects:**
- **Engine Damaged**: -25% speed, -50% when offline
- **Weapons Damaged**: -30% damage, -60% when offline  
- **Shields Damaged**: -30% shield regen, no regen when offline

**Repair System:**
- Runs every game tick (per `delta`)
- Repair rate modified by captain `repairSpeed` trait
- Repair priority: shields → weapons → engine
- Status updates: damaged at <50% HP, offline at <25% HP

## Performance Considerations

1. **Fire Rate Caps**: Level-up fire rate bonus capped at +15% to prevent exponential performance degradation
2. **Subsystem Updates**: Only calculate repairs for ships with damaged subsystems
3. **Captain Abilities**: Morale abilities use simple flag checks rather than complex calculations
4. **XP Calculations**: Fractional XP using simple multiplication to avoid expensive operations

## Integration Points

### Combat System (`resolveProjectiles`)
- Add damage type effectiveness calculation
- Add subsystem critical hit checks  
- Award XP for damage dealt and kills
- Apply captain accuracy modifiers

### AI System (`updateDecisionSystem`)
- Check for active morale abilities affecting intent weights
- Consider subsystem status in movement and combat decisions

### Ship Preparation (`prepareShips`)
- Run subsystem repair logic per tick
- Apply subsystem status effects to ship stats
- Update captain ability cooldowns

## Testing Strategy

### Unit Tests
- **XP System**: Award XP, level-up stat bonuses, XP curve progression
- **Damage Types**: Effectiveness calculations for all type combinations
- **Captain Traits**: Trait generation, ability cooldowns, stat modifications
- **Subsystem System**: Damage, repair rates, status effects
- **Integration**: End-to-end combat scenarios with all systems active

### Performance Tests
- Large scale battles (100+ ships) with all systems enabled
- Measure performance impact of each system component
- Validate fire rate caps prevent performance degradation

## Implementation Files

### Type Updates
- `src/types/index.ts` - Extend ShipComponent, add new types

### Core Systems  
- `src/game/systems.ts` - Update combat resolution, repair system
- `src/game/progression.ts` - New file for XP and level-up logic
- `src/game/captains.ts` - New file for captain system
- `src/game/subsystems.ts` - New file for subsystem mechanics

### Configuration
- `src/config/progression.ts` - XP curves, level bonuses, damage effectiveness
- `src/game/ships.ts` - Update ship stats with damage types

### Tests
- `test/vitest/progression-system.spec.ts` - XP, leveling, damage types
- `test/vitest/captain-system.spec.ts` - Captain traits and morale abilities  
- `test/vitest/subsystem-damage.spec.ts` - Subsystem mechanics and repairs

This design maintains the existing architecture while adding rich progression mechanics that enhance combat depth without sacrificing performance.