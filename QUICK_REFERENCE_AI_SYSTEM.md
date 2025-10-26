# Quick Reference: AI System & Test Harness

## AI v2 System Overview

**Status:** Mandatory (v1 fallback removed in TASK251)  
**Profiles:** `brawler`, `kiter`, `escort`, `artillery`  
**Test Harness:** Deterministic, seeded RNG, golden fixture regression tests

---

## File Locations

| Component | Location |
|-----------|----------|
| Profile definitions | `src/game/aiProfiles.ts` |
| Profile names mapping | `src/game/aiProfiles.ts` :: `getDefaultProfileId()` |
| AI state shape | `src/game/aiState.ts` |
| Decision system | `src/game/systems/decision/` |
| Test harness (main) | `test/support/aiScenarioHarness.ts` |
| Harness sub-modules | `test/support/aiScenarioHarness/` |
| Regression tests | `test/vitest/ai-scenario-harness.spec.ts` |
| Metrics tests | `test/vitest/ai-metrics.spec.ts` |
| Golden fixtures | `test/vitest/fixtures/ai-*.json` |

---

## Quick Start: Write a Test

```typescript
import { runAIScenario } from '../support/aiScenarioHarness';
import type { AIScenarioConfig } from '../support/aiScenarioHarness';

it('tests AI behavior', () => {
  const config: AIScenarioConfig = {
    name: 'test-scenario',
    ticks: 5,
    seed: 1337,  // Always seed for reproducibility!
    ships: [
      { team: 'blue', hull: 'fighter', position: [0, 0, 0], profileId: 'escort' },
      { team: 'red', hull: 'corvette', position: [200, 0, 0], profileId: 'brawler' },
    ],
  };

  const log = runAIScenario(config);
  expect(log.entries[0].commands[0].intent).toBe('Intercept');
});
```

See `guides/TEST_HARNESS_PATTERNS.md` for more examples.

---

## Deprecated Features

### AI v1 Fallback
**Status:** ❌ Removed (TASK251)  
**Migration:** Remove `aiV2Enabled` checks; AI v2 is always on  
**See:** `guides/AI_DEPRECATION_GUIDE.md`

### Legacy Smoothing Config
**Status:** ❌ Rejected (validation throws)  
**Old:** `motion.smoothing: { positionLerp: 0.12 }`  
**New:** `motion.visual: { position: { k: 12 } }`  
**See:** `guides/AI_DEPRECATION_GUIDE.md`

### Old Profile Names
**Status:** ❌ No longer recognized  
- `tank` → `brawler`
- `hit-and-run` → `kiter`
- `guardian` → `escort`
- `support` → `artillery`

**See:** `guides/AI_DEPRECATION_GUIDE.md`

---

## Documentation Index

| Document | Purpose |
|----------|---------|
| `core-aiScenarioHarness.md` | Harness architecture and guarantees |
| `core-aiProfiles.md` | Profile system and hull mappings |
| `guides/AI_DEPRECATION_GUIDE.md` | Removed features and migration paths |
| `guides/TEST_HARNESS_PATTERNS.md` | How to write AI tests (4 patterns, best practices) |
| `designs/DESIGN006-ai-harness-modernization.md` | Modernization design and rationale |

All in `memory/` folder (easily discoverable from repository root).

---

## Run Tests

```bash
# All AI tests (65 tests)
npm test -- --run ai

# Golden fixture tests only (3 tests)
npm test -- --run ai-scenario-harness

# Metrics validation (6 tests)
npm test -- --run ai-metrics

# Validation (includes deprecated feature rejection)
npm test -- --run validation.spec

# Type checking
npm run typecheck
```

---

## Profile Defaults by Hull

```typescript
// From src/game/aiProfiles.ts
const defaults = {
  'carrier': 'artillery',
  'destroyer': 'artillery',
  'frigate': 'artillery',
  'corvette': 'brawler',
  'fighter': 'escort',
};
```

---

## Harness Determinism Guarantee

Same config + same seed = identical AI decisions every run.

```typescript
// These two runs produce identical logs
const log1 = runAIScenario({ name: 'test', ticks: 5, seed: 777, ships: [...] });
const log2 = runAIScenario({ name: 'test', ticks: 5, seed: 777, ships: [...] });
// log1 === log2 (bit-for-bit identical when serialized to JSON)
```

Powered by `SeededRng` from `src/utils/rng.ts`.

---

## Common Issues

### Test Fails: "profile not found"
→ Check profile name. Valid: `brawler`, `kiter`, `escort`, `artillery`  
→ See `guides/AI_DEPRECATION_GUIDE.md` for old → new mapping

### Test Fails: "Received: motion.smoothing is no longer supported"
→ Update config: replace `motion.smoothing` with `motion.visual`  
→ See `guides/AI_DEPRECATION_GUIDE.md` for code examples

### Golden Fixture Mismatch
→ Check if decision logic changed (git blame decision system)  
→ If intentional: regenerate fixture and commit both code + fixture  
→ See `guides/TEST_HARNESS_PATTERNS.md` troubleshooting section

### Tests Pass Locally but Fail in CI
→ Verify seed and config match exactly  
→ Check if feature flags disabled (smoothing, engagement boost, tick-rate experiment)  
→ Increase tolerance if floating-point differences expected

---

## Next Steps

1. **Learn the Harness:** Read `guides/TEST_HARNESS_PATTERNS.md` (15 min)
2. **Understand Profiles:** Read `core-aiProfiles.md` (5 min)
3. **Write a Test:** Follow quick start above (10 min)
4. **Run Tests:** `npm test -- --run ai` (verify all pass)

---

## Contact & Questions

- **AI v2 Design:** DESIGN005 (AI enforcement and guards)
- **Harness Design:** DESIGN006 (modernization document)
- **Task History:** TASK251 (v1 removal), TASK252 (harness modernization)
- **Memory Bank:** All docs in `memory/` folder with cross-links

