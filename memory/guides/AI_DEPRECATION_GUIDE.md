# AI Deprecation Guide

## Overview

This guide documents deprecated AI features, removed code paths, and migration instructions for developers updating code that relied on legacy behavior.

---

## Removed Features

### 1. AI v1 Fallback Path (`runLegacyShipBehavior`)

**Status:** Removed in TASK251 (2025-10-26)

**What was removed:**
- `runLegacyShipBehavior` function from `src/game/systems/shipControl.ts`
- Configuration toggle `aiV2Enabled` (now always `true`)
- Tests exercising v1-to-v2 feature parity

**Why:**
- Dual-mode AI increased maintenance surface and test complexity.
- AI v2 is production-ready and performs better than v1.
- Removing the fallback enforces consistency across all simulations.

**Migration:**
If your code checked `aiV2Enabled`:

```typescript
// OLD (no longer works)
if (state.ai.enabled && config.aiV2Enabled) {
  // use AI v2
} else {
  // fallback to v1
}

// NEW (AI v2 is always active)
if (state.ai.enabled) {
  // AI v2 is always here
}
```

**Related:**
- TASK251: Remove legacy AI fallback path
- DESIGN005: AI v2 enforcement and guard behavior

---

### 2. Legacy Motion Smoothing Configuration

**Status:** Deprecated (validation throws on use)

**What was removed:**
- `motion.smoothing` config object (previously accepted `positionLerp`, `rotationLerp`, etc.)

**Why:**
- Replaced by `motion.visual` configuration which provides more intuitive controls.
- `visual` config explicitly separates rendering concerns from physics.

**Migration:**
If your config has `motion.smoothing`:

```typescript
// OLD (throws validation error)
const motion: MotionStats = {
  mass: 10,
  maxSpeed: 100,
  // ...
  smoothing: {
    positionLerp: 0.12,
    rotationLerp: 0.18,
  },
};

// NEW (use motion.visual instead)
const motion: MotionStats = {
  mass: 10,
  maxSpeed: 100,
  // ...
  visual: {
    enabled: true,
    position: { k: 12 },      // lerp coefficient
    rotation: { k: 18 },       // lerp coefficient
    bank: { k: 18, maxDeg: 45, useCriticallyDamped: true },
    teleportDistance: 100,
  },
};
```

**Error Message:**
If you encounter:
```
motion.smoothing is no longer supported. Use motion.visual instead.
```

Update your motion config as shown above.

**Related:**
- `src/game/validation.ts` — validation logic that rejects old config
- `src/types/index.ts` — `MotionStats` type definition

---

### 3. AI Profile Name Changes

**Status:** Active (old names no longer recognized)

**Profile mappings:**
All AI profiles are defined in `src/game/aiProfiles.ts`. Current profiles:

- `brawler` — close-range aggressive tactics
- `kiter` — long-range hit-and-run tactics
- `escort` — defensive formation support
- `artillery` — support/long-range bombardment

**Old profile names (no longer valid):**
- `tank` → use `brawler`
- `hit-and-run` → use `kiter`
- `guardian` → use `escort`
- `support` → use `artillery`

**Migration:**
If you're spawning ships with old profile names:

```typescript
// OLD (profile not found)
spawnShip(state, {
  hull: 'destroyer',
  team: 'blue',
  profileId: 'tank',  // no longer exists
});

// NEW (use current profile names)
spawnShip(state, {
  hull: 'destroyer',
  team: 'blue',
  profileId: 'brawler',  // valid
});
```

**Default Mappings:**
If you don't specify a `profileId`, ships automatically use default profiles by hull type:

```typescript
// See src/game/aiProfiles.ts :: getDefaultProfileId
const hull = 'fighter';
const defaultProfile = getDefaultProfileId(hull);  // returns 'escort'
```

**Related:**
- `src/game/aiProfiles.ts` — profile definitions and mappings
- `src/game/ships.ts` — ship spawning logic

---

## Migration Checklist

When updating AI-related code:

- [ ] Remove any checks for `config.aiV2Enabled` or conditionals around v1 fallback.
- [ ] Replace `motion.smoothing` config with `motion.visual`.
- [ ] Update AI profile names to current values.
- [ ] Run `npm run typecheck` to catch type errors.
- [ ] Run `npm test` to verify behavior hasn't changed.

---

## Testing Deprecated Features

If you need to verify that deprecated features are rejected:

```bash
# Run validation tests (includes deprecated feature rejection)
npm test -- validation.spec.ts

# Type-check to catch old profile names
npm run typecheck
```

---

## Questions?

Refer to the active documentation:

- `memory/core-aiProfiles.md` — current profile system
- `memory/core-aiScenarioHarness.md` — AI scenario testing
- `memory/guides/TEST_HARNESS_PATTERNS.md` — writing AI tests

