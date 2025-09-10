# Performance Profiling

SpaceAutoBattler includes a lightweight hotpath performance meter that attributes frame time to key subsystems for optimization guidance.

## Enabling the Performance Meter

### Via Query Parameter (Recommended)

Add `?debugPerf=1` to the URL:

```
http://localhost:8080/dist/spaceautobattler.html?debugPerf=1
```

### Via Configuration (Programmatic)

Set the performance config in renderer configuration:

```typescript
import { perf } from './utils/perf.js';

perf.enable();
```

## Performance Overlay

To show the on-screen performance overlay, add both query parameters:

```
http://localhost:8080/dist/spaceautobattler.html?debugPerf=1&showPerf=1
```

The overlay appears in the top-right corner and shows:

- Total frame count and timing statistics
- Top subsystems ranked by time consumption
- Real-time averages and percentiles

## Console Commands

When the performance meter is enabled, the following commands are available in the browser console:

### `perf.getSummary()`

Returns detailed performance statistics:

```javascript
perf.getSummary();
// Returns: { frameCount, totalFrameMs, avgFrameMs, p95FrameMs, subsystems }
```

### `perf.printSummary()`

Prints formatted performance statistics to console:

```javascript
perf.printSummary();
// Outputs a ranked list of subsystems with percentages and timings
```

### `perf.clear()`

Clears all collected performance data:

```javascript
perf.clear();
```

## Measured Subsystems

The performance meter instruments the following key subsystems:

### Frame-level

- `frame.total` - Complete frame time including all subsystems
- `simulation.step` - Fixed-timestep simulation updates
- `renderer.total` - Complete rendering pipeline
- `ui.stats` - UI updates and DOM manipulation
- `game.respawn` - Auto-respawn logic for continuous mode

### Simulation Subsystems

- `ai.total` - Complete AI processing
- `ai.spatial` - Spatial optimization and grid updates
- `ai.batched` - Batch query processing
- `ai.teams` - Team-level coordination systems
- `ai.individual` - Per-ship AI updates
- `projectiles.update` - Bullet movement, collision, and lifetime
- `turrets.fire` - Turret firing logic
- `spatial.update` - Spatial grid maintenance
- `game.deaths` - Death processing and XP allocation
- `game.carriers` - Carrier spawning logic
- `game.cleanup` - Boundary cleanup and normalization

### Renderer Subsystems

- `renderer.camera` - Camera position updates
- `renderer.sync` - Entity synchronization with graphics
- `renderer.healthbars` - Health bar positioning and billboarding
- `renderer.skybox` - Animated background updates
- `renderer.effects` - Post-processing effects
- `renderer.culling` - Frustum culling and instancing
- `renderer.webgl` - Final WebGL rendering

## Performance Budget Guidelines

Recommended per-frame budgets for 60 FPS (16.67ms total):

- **Simulation**: 4-6ms (AI + physics + game logic)
- **Renderer**: 8-10ms (sync + effects + WebGL)
- **UI/Overhead**: 1-2ms

### Optimization Priorities

1. **AI Subsystems**: Often the heaviest load
   - Focus on `ai.individual` and `ai.spatial` first
   - Consider reducing AI update frequency for distant ships
2. **Renderer Culling**: Second-highest impact
   - `renderer.culling` should be optimized for large ship counts
   - Check instancing efficiency

3. **Effects Pipeline**: Visual quality vs performance trade-off
   - `renderer.effects` can be scaled or disabled under load

## Zero-Cost When Disabled

The performance meter has zero runtime cost when disabled:

- All `perfBegin()`/`perfEnd()` calls are no-ops
- No data collection or storage overhead
- Safe to leave instrumentation in production builds

## Implementation Details

- Uses `performance.now()` for high-resolution timestamps
- Maintains a rolling buffer of 1000 samples
- Calculates percentiles and averages over the last 300 frames
- Thread-safe and handles nested timing calls
- Integrates with existing `window.__perf` debugging infrastructure

## Example Usage

```typescript
import { perfBegin, perfEnd } from './utils/perf.js';

function expensiveOperation() {
  perfBegin('custom.operation');

  // ... expensive work ...

  perfEnd('custom.operation');
}
```

The subsystem will appear in the performance summary and overlay automatically.
