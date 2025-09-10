# core-ai-decisionEngine.md

## Purpose

Short memory for `src/core/ai/decisionEngine.ts` describing the small set of decision-scoring helpers used to evaluate AI intents.

## Location

src/core/ai/decisionEngine.ts

## Summary

This module provides lightweight scoring functions used to evaluate candidate AI intents (pursue, evade, roam) and a `chooseBestIntent` helper to pick the highest-scoring intent. It's intentionally small and not fully wired into `AIController` by default to avoid changing behavior unexpectedly; instead it's available for experimentation and for supporting a pluggable decision step.

## Key functions

- `scorePursue(params)` - scores pursuing an enemy using distance bands, personality.aggressiveness, scout role and team alarm.
- `scoreEvade(params)` - scores evasion based on proximity to threat and recent damage within a configured window.
- `scoreRoam(params)` - scores roaming behavior based on group cohesion and presence of nearby friends.
- `chooseBestIntent(scores)` - picks the highest scoring intent from a map of scores.

## Integration Points

- Intended for use by `AIController` or a pluggable `IntentManager`/`DecisionEngine` integration.
- Uses `BehaviorConfig` and `AIPersonality` types for inputs.

## Notes

- Useful for experiments and for adding a deterministic scoring-based intent selector.
- Keep existing AIController behavior in mind if switching to automatic scoring to avoid large emergent behavior changes.

## References

- src/core/ai/intentManager.ts (potential integrator)
- src/core/ai/aiController.ts (where decision logic can be plugged in)
