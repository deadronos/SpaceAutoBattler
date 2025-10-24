# Ship Progression System - Design Assumptions and Decisions

## Overview

This document outlines the design assumptions and decisions made during the implementation of the ship progression system, including XP mechanics, captain traits, damage types, and subsystem damage.

## Design Assumptions

### 1. XP and Leveling System

**Assumption**: Ships should gain XP primarily from active combat participation, not just kills.

- **Rationale**: Encourages sustained engagement rather than kill-stealing
- **Implementation**: XP awarded for damage dealt (0.1x damage) + kill bonus (0.5x target max HP)

**Assumption**: Level progression should be exponential to maintain long-term progression feel.

- **Rationale**: Prevents rapid max-level achievement while maintaining meaningful early progression
- **Implementation**: XP required = `100 * level^1.8`

**Assumption**: Stat bonuses should be meaningful but capped to prevent game-breaking scenarios.

- **Rationale**: Maintains balance while providing clear progression benefits
- **Implementation**: Most stats cap at +50% (level 10), fire rate caps at +15% (level 8) for performance

### 2. Captain System

**Assumption**: Only large ships (destroyer, carrier) should have captains.

- **Rationale**: Represents command structure where smaller ships don't need/have dedicated captains
- **Implementation**: Destroyer 80% chance, Carrier 100% chance, others 0%

**Assumption**: Captain traits should be subtle multipliers, not dramatic game changers.

- **Rationale**: Avoids creating "super ships" that dominate through captain RNG
- **Implementation**: Traits range from 0.8x to 1.2x base values

**Assumption**: Morale abilities should be tactical, time-limited advantages.

- **Rationale**: Creates dynamic moments without permanent advantages
- **Implementation**: 8-12 second durations with 60-90 second cooldowns

### 3. Damage Type System

**Assumption**: Damage types should create rock-paper-scissors relationships rather than strict superiority.

- **Rationale**: Encourages fleet composition variety and tactical thinking
- **Implementation**: Each type has strengths and weaknesses across hull/shield/armor

**Assumption**: Existing ships should have logical damage types based on their role and existing bullet types.

- **Rationale**: Maintains consistency with established ship identities
- **Implementation**:
  - Fighters: kinetic (fast, balanced)
  - Corvettes: kinetic (similar role to fighters)
  - Frigates: plasma (heavier weapons)
  - Destroyers: plasma (dedicated warships)
  - Carriers: ion (anti-shield for bomber support)

### 4. Subsystem System

**Assumption**: Subsystems should have meaningful but not crippling penalties when damaged.

- **Rationale**: Creates tactical depth without making damaged ships completely useless
- **Implementation**: Damaged = -25-30% penalty, Offline = -50-60% penalty

**Assumption**: Critical hits should be frequent enough to matter but not so common as to be expected.

- **Rationale**: Adds uncertainty and tactics without making subsystem damage the primary mechanic
- **Implementation**: 15% chance per hit, affecting random subsystem

**Assumption**: Repair system should be automatic but slow enough to matter in combat.

- **Rationale**: Reduces micromanagement while maintaining tactical importance of subsystem health
- **Implementation**: 10% of max HP per second base repair rate, modified by captain traits

## Technical Decisions

### 1. Performance Optimization

**Decision**: Use in-memory only progression with no persistence.

- **Rationale**: Maintains lightweight architecture as specified in requirements
- **Trade-off**: Progress lost between battles, but avoids database complexity

**Decision**: Cap fire rate bonuses more aggressively than other stats.

- **Rationale**: Fire rate has direct impact on projectile count and performance
- **Trade-off**: Less satisfying progression for fire rate, but prevents performance degradation

**Decision**: Only update repairs for damaged subsystems.

- **Rationale**: Avoids unnecessary calculations for healthy ships
- **Trade-off**: Slightly more complex logic, but better performance at scale

### 2. Determinism and Testing

**Decision**: Use seeded RNG for all random elements (captain generation, critical hits).

- **Rationale**: Ensures reproducible behavior for testing and debugging
- **Trade-off**: Slightly less "random" feeling, but much better for development

**Decision**: Make all progression calculations discrete and integer-friendly where possible.

- **Rationale**: Avoids floating-point precision issues and simplifies testing
- **Trade-off**: Some precision loss, but more reliable behavior

**Decision**: Integrate with existing AI interrupt system for morale abilities.

- **Rationale**: Leverages existing architecture for AI behavior modification
- **Trade-off**: More complex integration, but consistent with existing patterns

### 3. Game Balance

**Decision**: Award XP to individual ships rather than shared team pools.

- **Rationale**: Creates individual ship progression stories and more granular advancement
- **Trade-off**: Can create level disparities within teams, but more engaging progression

**Decision**: Use percentage-based stat bonuses rather than fixed amounts.

- **Rationale**: Maintains relative balance between different ship classes
- **Trade-off**: Benefits scale with base stats, potentially favoring larger ships

**Decision**: Make subsystem damage affect ship performance immediately.

- **Rationale**: Creates immediate tactical consequences for taking damage
- **Trade-off**: Can create "death spirals" where damaged ships become increasingly vulnerable

## Integration Considerations

### 1. Existing Systems

**AI System**: Morale abilities modify AI intent weights temporarily, integrating with existing decision-making.

**Combat System**: Damage type effectiveness calculated before shield/hull damage application.

**Physics System**: Subsystem engine damage affects the motion system's speed calculations.

### 2. UI and Feedback

**HUD Integration**: Progression information could be displayed in existing ship health overlays.

**Visual Effects**: Subsystem damage could be indicated through existing ship effect systems.

**Debug Information**: New stats and systems integrate with existing debug panels.

## Future Considerations

### 1. Persistence

If persistence is added later, the in-memory progression system can be extended with save/load capabilities without changing core mechanics.

### 2. Balancing

All XP curves, damage effectiveness values, and stat bonuses are configurable and can be adjusted based on gameplay feedback.

### 3. Content Expansion

The system is designed to support additional damage types, subsystem types, and captain abilities without architectural changes.

## Validation Approach

### 1. Unit Testing

Each system component has isolated unit tests to verify core mechanics work as designed.

### 2. Integration Testing

End-to-end scenarios test the interaction between all progression systems during combat.

### 3. Performance Testing

Large-scale battles validate that the new systems don't significantly impact performance.

### 4. Determinism Testing

Seeded scenarios ensure that progression mechanics behave consistently across runs.

This document will be updated as implementation progresses and new decisions are made.
