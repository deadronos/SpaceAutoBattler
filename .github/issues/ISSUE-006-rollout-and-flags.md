# Rollout, feature flags, and monitoring

Labels: operations, ci

## Summary

Define feature flags and rollout strategy for experiments: `AI_CONFIG.verticalEnabled`, `AI_CONFIG.engagementBoostEnabled`, `AI_CONFIG.tickRateHzExperiment`, `AI_CONFIG.rangePolicy`.

## Implementation steps

1. Add flags to `src/game/config.ts` with sensible defaults (disabled or safe default where costly).
2. Expose runtime toggles via developer-only URL query params or environment variables for quick testing.
3. Add CI job to run the metrics harness for each experiment branch before merge.

## Acceptance criteria

- Flags present and documented in `src/config/` and `docs/`.
