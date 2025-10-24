# AI Feature Flags

This document describes the available feature flags for AI experiments and their configuration options.

## Overview

The AI system supports several experimental features that can be controlled via environment variables, URL query parameters, or runtime toggles. These flags enable safe rollout and rollback of experimental AI behaviors.

## Available Flags

### `AI_CONFIG.verticalEnabled`

**Purpose**: Enables 3D vertical maneuvering for AI ships.

**Default**: `true`

**Configuration**:

- Environment: `AI_VERTICAL_EXPERIMENT_ON=true/false`, `AI_VERTICAL_EXPERIMENT_OFF=true/false`
- URL Query: `?ai_vertical=true/false`
- Runtime: Available in developer HUD toggles

**Risks**: Can cause visual chaos or oscillation behavior. Monitor for excessive Y-bobbing.

### `AI_CONFIG.engagementBoostEnabled`

**Purpose**: Enables engagement boost behavior during opening salvo phases.

**Default**: `true`

**Configuration**:

- Environment: `AI_ENGAGEMENT_BOOST_ON=true/false`, `AI_ENGAGEMENT_BOOST_OFF=true/false`
- URL Query: `?ai_engagement=true/false`
- Runtime: Available in developer HUD toggles

**Risks**: Can cause over-aggression leading to early fleet wipes. Rollback immediately if observed.

### `AI_CONFIG.tickRateHzExperiment`

**Purpose**: Enables experimental higher tick rate (15Hz vs 12Hz base) for improved AI responsiveness.

**Default**: `true`

**Configuration**:

- Environment: `AI_TICKRATE_EXPERIMENT_ON=true/false`, `AI_TICKRATE_EXPERIMENT_OFF=true/false`
- URL Query: `?ai_tick_experiment=true/false` or `?ai_tick_rate=experimental/15`
- Runtime: Available in developer HUD toggles

**Risks**: Performance overhead. Monitor `ai.metrics.budgetHits` for impact.

### `AI_CONFIG.rangePolicy`

**Purpose**: Controls range calculation policy for weapons and AI decision making.

**Default**: `'v0.1.1-exp'`

**Options**:

- `'v0.1.1-exp'`: Experimental range policy with ±5% variance
- Any other value: Stable range policy without variance

**Configuration**:

- Environment: `AI_RANGE_POLICY=v0.1.1-exp` or `AI_RANGE_POLICY=stable`
- URL Query: `?ai_range_policy=v0.1.1-exp` or `?ai_range_policy=stable`
- Runtime: Available in developer HUD toggles

**Risks**: Changes weapon effective ranges and AI targeting behavior.

## Usage Examples

### Environment Variables

```bash
# Disable vertical maneuvering
AI_VERTICAL_EXPERIMENT_OFF=true npm start

# Use stable range policy
AI_RANGE_POLICY=stable npm start

# Disable engagement boost and experimental tick rate
AI_ENGAGEMENT_BOOST_OFF=true AI_TICKRATE_EXPERIMENT_OFF=true npm start
```

### URL Query Parameters

```
# Enable all experimental features
http://localhost:8080/?ai_vertical=true&ai_engagement=true&ai_tick_experiment=true&ai_range_policy=v0.1.1-exp

# Disable vertical maneuvering for testing
http://localhost:8080/?ai_vertical=false

# Use stable range policy
http://localhost:8080/?ai_range_policy=stable
```

### Runtime Toggles

Runtime toggles are available in the developer HUD overlay. Press the appropriate hotkey to open the developer panel and find the AI experiment toggles under the "Debug" section.

## Rollback Strategy

All flags are designed for immediate rollback:

1. **Environment rollback**: Set the `_OFF` environment variable to `true`
2. **Query parameter rollback**: Add or change URL parameters and refresh
3. **Runtime rollback**: Use HUD toggles to disable features immediately
4. **Emergency rollback**: Clear all environment variables and URL parameters to return to defaults

## Monitoring

Monitor the following metrics when enabling experimental features:

- `ai.metrics.budgetHits`: Performance impact
- First shot times: Engagement effectiveness
- Vertical usage metrics: 3D maneuvering activity
- Win/loss ratios: Overall balance impact

## CI Integration

The CI system runs metrics harness tests for each experiment branch. Tests automatically validate:

- Performance stays within budget limits
- Behavioral determinism is maintained
- Key metrics remain within expected ranges

## See Also

- [AI V2 Rollout Playbook](./ai-v2-rollout.md)
- [AI Tuning Guide](./ai-tuning.md)
- [Performance Report](./performance-report-v0.1.1.md)
