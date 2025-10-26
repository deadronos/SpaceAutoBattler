# AI Test Harness Patterns

## Overview

The AI scenario harness provides a deterministic, headless environment for testing AI decision behavior without requiring a full physics engine or graphics runtime. This guide shows how to write effective AI tests using the harness.

---

## Quick Start

### Import the Harness

```typescript
import { runAIScenario, collectTestMetrics } from '../support/aiScenarioHarness';
import type { AIScenarioConfig } from '../support/aiScenarioHarness';
```

### Create a Simple Scenario

```typescript
import { describe, it, expect } from 'vitest';
import { runAIScenario } from '../support/aiScenarioHarness';
import type { AIScenarioConfig } from '../support/aiScenarioHarness';

describe('AI decision behavior', () => {
  it('chooses Attack intent when enemy is in range', () => {
    const config: AIScenarioConfig = {
      name: 'simple-attack',
      ticks: 5,
      seed: 1337,  // Seeded for reproducibility
      ships: [
        {
          team: 'blue',
          hull: 'fighter',
          position: [0, 0, 0],
          profileId: 'brawler',
          hp: 60,
          maxHp: 60,
        },
        {
          team: 'red',
          hull: 'fighter',
          position: [150, 0, 0],  // Within brawler engagement range
          profileId: 'brawler',
          hp: 60,
          maxHp: 60,
        },
      ],
    };

    const log = runAIScenario(config);

    // Assert on first decision
    const firstEntry = log.entries[0];
    const blueCommand = firstEntry.commands.find((cmd) => cmd.id === 1);
    expect(blueCommand?.intent).toBe('Attack');
  });
});
```

---

## Key Concepts

### Seeded RNG for Reproducibility

The harness uses a **seeded RNG** to ensure deterministic behavior. Every scenario with the same seed and config will produce identical decision logs.

```typescript
// Same seed = same AI decisions every run
const config1: AIScenarioConfig = {
  seed: 777,
  // ...
};

const log1 = runAIScenario(config1);
const log2 = runAIScenario(config1);

// log1 and log2 are identical
```

**Why this matters:**
- Golden fixture tests compare against stored JSON snapshots.
- Tests remain deterministic regardless of platform or time-of-day.
- Reproducing bugs is straightforward: use the same seed and config.

### Configuration Knobs

The harness supports these configuration options:

```typescript
interface AIScenarioConfig {
  name: string;                   // Scenario name (for logging)
  ticks: number;                  // Number of AI decision ticks to run
  tickInterval?: number;          // Time per tick (default: 1 / 20 = 0.05s)
  seed?: number;                  // RNG seed (default: 1337)
  aiEnabled?: boolean;            // Enable/disable AI (default: true)
  ships: ShipScenarioSpec[];      // List of ships
}

interface ShipScenarioSpec {
  id?: number;                    // Auto-assigned if omitted
  team: 'blue' | 'red';
  hull: ShipHull;                 // 'fighter', 'corvette', 'frigate', etc.
  position: [number, number, number];
  profileId?: string;             // AI profile (default: from hull)
  hp?: number;                    // Current health (default: maxHp)
  maxHp?: number;                 // Max health (default: hull stat)
  velocity?: [number, number, number];  // Initial velocity
  speed?: number;                 // Max speed override
  range?: number;                 // Weapon range override
  projectileSpeed?: number;       // Projectile speed override
  traitSeed?: number;             // Trait RNG seed (auto if omitted)
}
```

### Scenario Output

Each run returns an `AIScenarioLog` containing:

```typescript
interface AIScenarioLog {
  name: string;
  ticks: number;
  tickInterval: number;
  seed: number;
  entries: AIScenarioLogEntry[];  // One per tick
  metrics: AITestMetrics;         // Aggregated KPIs
}

interface AIScenarioLogEntry {
  tick: number;
  commands: CommandSnapshot[];    // One per ship
  positions: PositionSnapshot[];  // One per ship
}

interface CommandSnapshot {
  id: number;
  intent: IntentType;             // 'Attack', 'Intercept', 'Kite', etc.
  heading: [number, number, number];
  thrust: number;
  targetId?: number;
  lod: number;
  score?: number;
}

interface PositionSnapshot {
  id: number;
  position: [number, number, number];
}
```

---

## Common Test Patterns

### 1. Golden Fixture Regression Test

Compare scenario output against a stored JSON fixture to detect regressions:

```typescript
import escortScenario from './fixtures/ai-escort-scenario.json';

describe('AI scenario harness', () => {
  it('emits deterministic command logs for escort scenario', () => {
    const config: AIScenarioConfig = { /* ... */ };
    const log = runAIScenario(config);

    // Normalize numeric precision for stable comparison
    const normalized = normalizeLog(log);
    
    // Compare entry-by-entry with fixture
    expectLogsApproximatelyEqual(normalized, escortScenario);
  });
});

function normalizeLog(log: AIScenarioLog): AIScenarioLog {
  return {
    ...log,
    entries: log.entries.map((entry) => ({
      ...entry,
      commands: entry.commands.map((cmd) => ({
        ...cmd,
        heading: [
          Number(cmd.heading[0].toFixed(3)),
          Number(cmd.heading[1].toFixed(3)),
          Number(cmd.heading[2].toFixed(3)),
        ],
        thrust: Number(cmd.thrust.toFixed(3)),
      })),
    })),
  };
}
```

### 2. Metrics Validation

Use `collectTestMetrics()` to extract KPIs and validate acceptance criteria:

```typescript
import { runAIScenario, collectTestMetrics } from '../support/aiScenarioHarness';

describe('AI metrics', () => {
  it('meets acceptance criteria for combat engagement', () => {
    const log = runAIScenario(SCENARIO_8V8);
    const metrics = collectTestMetrics(log);

    // Time-to-first-shot: p50 ≤ 20s, p90 ≤ 30s
    expect(metrics.timeToFirstShot.p50).toBeLessThanOrEqual(20);
    expect(metrics.timeToFirstShot.p90).toBeLessThanOrEqual(30);

    // Opening aggression: ≥ 50% Attack/Intercept
    expect(metrics.openingAggression.ratio).toBeGreaterThanOrEqual(0.5);

    // In-band time: ≥ 50% per hull
    expect(metrics.inBandTime.overall).toBeGreaterThanOrEqual(0.5);
  });
});
```

### 3. Intent Sequence Assertion

Verify that a ship makes expected decisions in a specific scenario:

```typescript
it('escorts maintain nearby formation', () => {
  const config: AIScenarioConfig = {
    name: 'escort-formation',
    ticks: 10,
    seed: 555,
    ships: [
      {
        team: 'blue',
        hull: 'carrier',
        position: [0, 0, 0],
        profileId: 'artillery',
      },
      {
        team: 'blue',
        hull: 'fighter',
        position: [-100, 0, 0],
        profileId: 'escort',
      },
    ],
  };

  const log = runAIScenario(config);
  const escortCommands = log.entries
    .map((e) => e.commands.find((c) => c.id === 2))
    .filter((c) => c !== undefined);

  // Escort should choose Regroup or Intercept early, then hold
  const intents = escortCommands.map((c) => c!.intent);
  expect(intents.slice(0, 3)).toContain('Regroup');
});
```

### 4. Diagnostic Output

For large scenarios, write diagnostic logs to `tmp/` for manual inspection:

```typescript
const DIAG_SEEDS = [777, 2029, 4041];

it('writes diagnostic logs for known seeds', () => {
  for (const seed of DIAG_SEEDS) {
    const config: AIScenarioConfig = {
      name: `diag-${seed}`,
      seed,
      ticks: 100,
      ships: [ /* ... */ ],
    };

    const log = runAIScenario(config);
    // Harness auto-writes to tmp/ai-initial-{seed}.log if seed is in DIAG_SEEDS
    
    expect(log.entries.length).toBe(100);
  }
});
```

The harness automatically writes diagnostic files for seeds `777`, `2029`, and `4041` to `tmp/ai-initial-{seed}.log`.

---

## Best Practices

### ✅ Do

- **Use seeded RNG**: Always set a `seed` for reproducible tests.
- **Name scenarios clearly**: Use descriptive names like `'escort-vs-artillery'`.
- **Normalize numeric precision**: Round heading/thrust/position to 3 decimals before comparing.
- **Test behavior, not values**: Assert on intents and KPIs, not exact thrust values.
- **Create small scenarios**: 5–10 ticks for unit tests, up to 900 ticks for integration tests.
- **Document why**: Add comments explaining what behavior you're testing.

### ❌ Don't

- **Rely on float equality**: Use approximate comparison with tolerance (e.g., ±0.03 for heading).
- **Hardcode large position values**: Use reasonable combat distances (±200 to ±500 world units).
- **Ignore test failures**: If a golden fixture breaks, investigate why and update if intentional.
- **Forget to save golden fixtures**: After validating output, commit the fixture JSON to `test/vitest/fixtures/`.
- **Skip metrics validation**: Use `collectTestMetrics()` to catch regressions in combat performance.

---

## Troubleshooting

### Scenario runs but output doesn't match fixture

**Cause:** Decision logic may have changed (e.g., new weighting, trait adjustment).

**Fix:**
1. Run the scenario locally and inspect the new output.
2. Understand why the decision changed (check git blame on decision system).
3. If intentional, regenerate the fixture and commit both code and fixture changes.
4. If unintended, revert the decision logic change.

### Test passes locally but fails in CI

**Cause:** Usually floating-point precision or platform differences.

**Fix:**
1. Increase tolerance in `expectLogsApproximatelyEqual()` (e.g., `HEADING_TOL = 0.05` instead of `0.03`).
2. Check if feature flags are disabled in CI (e.g., smoothing, engagement boost).
3. Verify seed and config match exactly between local and CI runs.

### Metrics values are very different from expected

**Cause:** Scenario config may have too few ticks, ships, or seeded bad initial state.

**Fix:**
1. Increase `ticks` to allow AI to settle into stable behavior (e.g., 600+ for 30s of combat).
2. Add more ships (8v8, 12v12, 15v15 scenarios show better metrics).
3. Use a different `seed` if the current one produces edge-case behavior.

---

## Related Documentation

- `test/support/aiScenarioHarness.ts` — harness implementation
- `test/vitest/ai-scenario-harness.spec.ts` — golden fixture tests
- `test/vitest/ai-metrics.spec.ts` — metrics validation tests
- `memory/core-aiScenarioHarness.md` — harness architecture
- `memory/guides/AI_DEPRECATION_GUIDE.md` — deprecated features
