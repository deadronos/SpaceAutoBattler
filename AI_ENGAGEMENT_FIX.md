# AI Engagement Fix - Usage Guide

## Problem
Ships were preferring evasion over engagement, leading to passive combat where fighters and corvettes would back away from enemies instead of attacking.

## Solution
Added a new configuration option `evadeOnlyOnDamage` that makes ships only evade when they've recently taken damage, rather than evading based purely on enemy proximity.

## Usage

### Enable Aggressive Engagement (Recommended)
```typescript
// Set this in your game configuration
gameState.behaviorConfig.globalSettings.evadeOnlyOnDamage = true;
```

### Default Behavior (Backwards Compatible)
```typescript
// Ships evade based on proximity (original behavior)
gameState.behaviorConfig.globalSettings.evadeOnlyOnDamage = false; // default
```

### Configuration Options
```typescript
interface BehaviorConfig {
  globalSettings: {
    // Only evade when ship has recently taken damage
    evadeOnlyOnDamage: boolean; // default: false
    
    // Damage threshold to trigger evade behavior
    damageEvadeThreshold: number; // default: 25
    
    // How quickly damage tracking decays (per second)
    damageDecayRate: number; // default: 2.0
  }
}
```

## Expected Results

### With `evadeOnlyOnDamage: true`
- Fighters and corvettes engage enemies aggressively
- Ships only evade when they've taken recent damage
- More dynamic and aggressive combat
- Better for action-oriented gameplay

### With `evadeOnlyOnDamage: false` (default)
- Original behavior preserved
- Ships evade based on enemy proximity
- More cautious, defensive combat
- Backwards compatible with existing configurations

## Ship Behavior Examples

**Fighter (aggressiveness: 0.9, caution: 0.1)**
- Before: Would evade when enemies got close
- After (with flag enabled): Pursues enemies aggressively, only evades when damaged

**Corvette (aggressiveness: 0.7, caution: 0.3)**
- Before: Mixed behavior, frequent evasion
- After (with flag enabled): More consistent engagement, tactical evasion only when hurt

**Formation/Carrier behaviors**: Unchanged, respects existing group dynamics and escort logic.