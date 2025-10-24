# StarDisk Uniform Telemetry Monitoring

## Overview

The StarDisk component now exposes detailed telemetry about its shader uniform progression, specifically the `iTime` uniform that drives animation. This telemetry is particularly useful for diagnosing issues where WASM panics in Rapier physics might cause the simulation to freeze, which in turn would halt StarDisk animation.

## Accessing Telemetry

When the Copilot debug flag is enabled (`?copilot_debug=1` in the URL or `window.__copilotDebugForce = true`), the component publishes telemetry to:

```javascript
window.__copilot_starDiskTelemetry;
```

## Telemetry Structure

```typescript
interface StarDiskTelemetry {
  /** Current shader uniform time value (seconds) */
  iTime: number;

  /** Time delta since previous frame (seconds) */
  deltaTime: number;

  /** Whether iTime is progressing (deltaTime > 0) */
  isProgressing: boolean;

  /** Wall-clock timestamp when telemetry was recorded (ms) */
  timestamp: number;

  /** Cumulative frame count since component mount */
  frameCount: number;

  /** Simulation time from GameState (when available) */
  simTime?: number;

  /** Render clock time from R3F (when available) */
  renderTime?: number;

  /** Whether fallback time calculation was used */
  usedFallback: boolean;

  /** Total Rapier step panics observed since startup */
  rapierPanicCount?: number;

  /** Most recent tick index when a Rapier panic occurred */
  lastRapierPanicTick?: number;

  /** Number of simulation ticks since last Rapier panic */
  ticksSinceLastPanic?: number;
}
```

## Usage Examples

### Basic Monitoring in Console

```javascript
// Enable debug mode
window.__copilotDebugForce = true;

// Check current telemetry
window.__copilot_starDiskTelemetry;
// => { iTime: 15.234, deltaTime: 0.016, isProgressing: true, ... }

// Monitor progression over time
setInterval(() => {
  const t = window.__copilot_starDiskTelemetry;
  console.log(
    `iTime: ${t.iTime.toFixed(3)}s, delta: ${t.deltaTime.toFixed(6)}s, progressing: ${t.isProgressing}`,
  );
}, 1000);
```

### Playwright Test Monitoring

```typescript
test('verify StarDisk animation resumes after physics recovery', async ({ page }) => {
  // Enable debug mode
  await page.evaluate(() => {
    (window as any).__copilotDebugForce = true;
  });

  // Navigate and wait for initial render
  await page.goto('http://localhost:8080');
  await page.waitForTimeout(1000);

  // Sample initial telemetry
  const initial = await page.evaluate(() => (window as any).__copilot_starDiskTelemetry);

  // Wait for progression
  await page.waitForTimeout(2000);

  // Verify iTime is increasing
  const current = await page.evaluate(() => (window as any).__copilot_starDiskTelemetry);

  expect(current.iTime).toBeGreaterThan(initial.iTime);
  expect(current.isProgressing).toBe(true);
});
```

### Correlating with Rapier Panics

```javascript
// Monitor for correlation between Rapier panics and frozen animation
const telemetry = window.__copilot_starDiskTelemetry;
const rapierPanics = window.__copilot_rapierPanics;

if (!telemetry.isProgressing && telemetry.rapierPanicCount > 0) {
  console.warn('StarDisk animation frozen after Rapier panic:', {
    lastPanic: rapierPanics[rapierPanics.length - 1],
    ticksSincePanic: telemetry.ticksSinceLastPanic,
    frozenAt: telemetry.iTime,
  });
}
```

### Automated Health Checks

```typescript
async function checkStarDiskHealth(page: Page): Promise<boolean> {
  return await page.evaluate(() => {
    const telemetry = (window as any).__copilot_starDiskTelemetry;

    if (!telemetry) {
      console.warn('StarDisk telemetry not available (debug mode disabled)');
      return false;
    }

    // Check if time is progressing
    if (!telemetry.isProgressing) {
      console.error('StarDisk animation frozen:', {
        frozenAt: telemetry.iTime,
        frameCount: telemetry.frameCount,
        lastDelta: telemetry.deltaTime,
      });
      return false;
    }

    // Check if fallback is being used (indicates simulation issues)
    if (telemetry.usedFallback) {
      console.warn('StarDisk using fallback time calculation:', {
        simTime: telemetry.simTime,
        renderTime: telemetry.renderTime,
      });
    }

    // Check for recent Rapier panics
    if (telemetry.rapierPanicCount > 0 && telemetry.ticksSinceLastPanic < 10) {
      console.warn('Recent Rapier panic detected:', {
        panicCount: telemetry.rapierPanicCount,
        ticksSince: telemetry.ticksSinceLastPanic,
      });
    }

    return true;
  });
}
```

## Diagnostic Scenarios

### Scenario 1: StarDisk Frozen After WASM Panic

**Symptoms:**

- `isProgressing === false`
- `rapierPanicCount > 0`
- `ticksSinceLastPanic` is low

**Analysis:**

```javascript
const t = window.__copilot_starDiskTelemetry;
const panics = window.__copilot_rapierPanics;

console.log('Frozen Analysis:', {
  frozenAt: t.iTime,
  lastPanic: panics[panics.length - 1],
  ticksSincePanic: t.ticksSinceLastPanic,
  deltaTime: t.deltaTime, // Should be 0 if truly frozen
});
```

**Expected Resolution:**
Once the Rapier WASM fault is identified and fixed, `iTime` should resume increasing and `isProgressing` should return to `true`.

### Scenario 2: Fallback Time in Use

**Symptoms:**

- `usedFallback === true`
- `simTime` or `renderTime` are undefined

**Analysis:**

```javascript
const t = window.__copilot_starDiskTelemetry;

console.log('Time Source Analysis:', {
  usingFallback: t.usedFallback,
  simTime: t.simTime,
  renderTime: t.renderTime,
  iTime: t.iTime,
});
```

**Implications:**
The component is maintaining animation through fallback calculations rather than actual simulation/render time. This can happen when:

- Simulation is paused
- Render loop is blocked
- Initial frames before clocks are initialized

### Scenario 3: Normal Operation

**Expected Values:**

```javascript
{
  iTime: 45.678,          // Steadily increasing
  deltaTime: 0.016,       // ~60fps
  isProgressing: true,    // Time is moving forward
  usedFallback: false,    // Using real sim/render time
  rapierPanicCount: 0,    // No panics
  frameCount: 2740,       // Incrementing each frame
}
```

## Integration with Rapier Diagnostics

The telemetry system is designed to work alongside the Rapier panic diagnostics from TASK236. Together, they provide:

1. **Rapier Diagnostics** (`window.__copilot_rapierPanics`):
   - When physics step panics occur
   - Error messages and stack traces
   - Simulation state at time of panic

2. **StarDisk Telemetry** (`window.__copilot_starDiskTelemetry`):
   - Whether animation continues after panics
   - Time source health (sim vs render vs fallback)
   - Frame-by-frame progression verification

### Correlation Workflow

```javascript
// 1. Check for Rapier panics
const panics = window.__copilot_rapierPanics || [];
console.log(`Total Rapier panics: ${panics.length}`);

// 2. Check StarDisk progression
const starDisk = window.__copilot_starDiskTelemetry;
console.log(`StarDisk progressing: ${starDisk?.isProgressing}`);

// 3. Correlate the two
if (panics.length > 0 && !starDisk?.isProgressing) {
  console.error('CONFIRMED: Rapier panic caused StarDisk freeze', {
    lastPanic: panics[panics.length - 1],
    frozenAt: starDisk.iTime,
    ticksSincePanic: starDisk.ticksSinceLastPanic,
  });
}
```

## Performance Impact

- **Zero overhead when disabled**: Telemetry code is gated behind `isCopilotDebugEnabled()` check
- **Minimal overhead when enabled**: Simple property assignments, no allocations
- **Frame-by-frame updates**: Telemetry is refreshed on every render frame

## Testing

Comprehensive test coverage is provided in `test/vitest/star-disk-telemetry.spec.ts`:

- Telemetry structure validation
- Time progression tracking
- Rapier panic correlation
- Debug flag gating
- Time source exposure

Run tests with:

```bash
npm test -- star-disk-telemetry
```

## See Also

- [Rapier WASM Panic Diagnostics](../memory/designs/TASK236-rapier-wasm-panic-diagnostics.md)
- [StarDisk Component](../src/components/environment/StarDisk.tsx)
- [Simulation Queue Diagnostics](../src/game/simulationQueue.ts)
