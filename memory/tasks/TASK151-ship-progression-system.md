# [TASK151] - Ship Progression System Implementation

**Status:** In Progress  
**Added:** 2025-01-27  
**Updated:** 2025-01-27

## Original Request

Implement richer ship progression and damage systems to make battles deeper and more dynamic while keeping the runtime lightweight (no persistence for now). Focus on per-fight mechanics (in-memory only): XP per kill/damage, level-based stat scaling, captain traits on large ships, differentiated damage types, and subsystem damage + repairs.

## Thought Process

The current system has basic shield/hull damage mechanics but lacks depth. The user wants:

1. **XP System**: Ships gain XP from kills and damage, level up with stat improvements
2. **Captain System**: Large ships (destroyer, carrier) get captains with traits and morale abilities
3. **Damage Types**: Weapons have types (plasma, ion, kinetic, explosive) with effectiveness against different defenses
4. **Subsystem System**: Ships have subsystems (engine, weapons, shields) that can be damaged and repaired

All of this should be in-memory only for now, with no persistence. The design should be careful about performance (caps on fire rate increases) and use deterministic RNG.

## Implementation Plan

### Phase 1: Type Extensions and Core Systems
- [ ] 1.1 Extend ShipComponent with XP, level, captain, and subsystem fields
- [ ] 1.2 Create Captain, Subsystem, and DamageType type definitions
- [ ] 1.3 Add damage type effectiveness matrix
- [ ] 1.4 Create XP calculation and level-up logic

### Phase 2: Combat System Updates
- [ ] 2.1 Update projectile resolution to use damage types and subsystem targeting
- [ ] 2.2 Implement critical hit system for subsystem damage
- [ ] 2.3 Add XP rewards for damage dealing and kills
- [ ] 2.4 Implement repair system that runs per game tick

### Phase 3: Captain System
- [ ] 3.1 Add captain assignment logic for large ships
- [ ] 3.2 Implement captain traits (accuracy, repairSpeed, moraleAbility)
- [ ] 3.3 Create morale ability system with cooldowns and AI intent modification
- [ ] 3.4 Add captain scaling with ship XP/level

### Phase 4: Level-up and Stat Scaling
- [ ] 4.1 Implement level-up stat bonuses with caps/diminishing returns
- [ ] 4.2 Add subsystem status effects (damaged engine = reduced speed, etc.)
- [ ] 4.3 Create repair prioritization system
- [ ] 4.4 Balance XP curves and stat scaling

### Phase 5: Testing and Validation
- [ ] 5.1 Create unit tests for XP gain, level-up mechanics
- [ ] 5.2 Test damage type effectiveness calculations
- [ ] 5.3 Test captain traits and morale abilities
- [ ] 5.4 Test subsystem damage and repair mechanics
- [ ] 5.5 Performance testing with large numbers of ships

## Progress Tracking

**Overall Status:** In Progress - 0%

### Subtasks

| ID  | Description           | Status                                     | Updated    | Notes                |
| --- | --------------------- | ------------------------------------------ | ---------- | -------------------- |
| 1.1 | Extend ShipComponent types | Not Started | 2025-01-27 | Core type definitions |
| 1.2 | Create new type definitions | Not Started | 2025-01-27 | Captain, Subsystem, DamageType |
| 1.3 | Add damage effectiveness matrix | Not Started | 2025-01-27 | plasma vs armor, ion vs shields, etc. |
| 1.4 | Create XP and level-up logic | Not Started | 2025-01-27 | Level curves and stat scaling |
| 2.1 | Update projectile resolution | Not Started | 2025-01-27 | Damage types and subsystem targeting |
| 2.2 | Implement critical hit system | Not Started | 2025-01-27 | Random subsystem damage |
| 2.3 | Add XP rewards | Not Started | 2025-01-27 | XP per damage and kills |
| 2.4 | Implement repair system | Not Started | 2025-01-27 | Per-tick repairs |
| 3.1 | Captain assignment logic | Not Started | 2025-01-27 | Large ships get captains |
| 3.2 | Captain traits | Not Started | 2025-01-27 | accuracy, repairSpeed, moraleAbility |
| 3.3 | Morale ability system | Not Started | 2025-01-27 | Cooldowns and AI intent modification |
| 3.4 | Captain scaling | Not Started | 2025-01-27 | Scale with ship level |
| 4.1 | Level-up stat bonuses | Not Started | 2025-01-27 | Hull, shield, damage, repair, shieldRegen |
| 4.2 | Subsystem status effects | Not Started | 2025-01-27 | Functional penalties when damaged |
| 4.3 | Repair prioritization | Not Started | 2025-01-27 | Priority order for repairs |
| 4.4 | Balance XP and scaling | Not Started | 2025-01-27 | Tuning for gameplay |
| 5.1 | XP and level-up tests | Not Started | 2025-01-27 | Unit test coverage |
| 5.2 | Damage type tests | Not Started | 2025-01-27 | Effectiveness calculations |
| 5.3 | Captain traits tests | Not Started | 2025-01-27 | Traits and morale abilities |
| 5.4 | Subsystem tests | Not Started | 2025-01-27 | Damage and repair mechanics |
| 5.5 | Performance testing | Not Started | 2025-01-27 | Large scale performance |

## Progress Log

### 2025-01-27

- Created task file and outlined implementation plan
- Analyzed current damage system in `resolveProjectiles` function
- Identified need to extend ShipComponent types and create new supporting types
- Planned 5-phase implementation approach starting with core types