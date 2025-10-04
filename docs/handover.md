What I implemented

Debug (wrench) menu toggles

Added three new UI toggles (visible in the debug/wrench settings):
AI Smoothing — low-pass filters for commanded heading and thrust
AI Hysteresis — small stateful hysteresis for desired range checks
AI Vertical Damping — short-term damping of repeated vertical amplitude spikes
Files changed:
hudToggleConfig.ts — added the new toggles to the debug toggles list
uiStore.ts — added UI state fields and toggle/set functions for the three new flags
config.ts — included the new flags in getEffectiveAIConfig() so UI overrides change runtime behavior
Notes:

The toggles follow the existing pattern where a UI toggle value of null uses the default in AI_CONFIG, and explicit true/false overrides that default.
The toggle handlers were added defensively and called via optional chaining in the UI to satisfy TypeScript and ensure safe runtime behavior.
Runtime wiring of smoothing/hysteresis/damping

All checks for these features now consult getEffectiveAIConfig() (so toggles in the UI or test-time overrides affect runtime behavior immediately).
Files updated to use the runtime config:
intents.ts — heading/thrust smoothing gating
command-generators.ts — hysteresis gating
tactical-intents.ts — hysteresis gating in scoring
combat-intents.ts — hysteresis gating + opening salvo reading via runtime config
vertical-maneuvers.ts — vertical damping gating
Tests to validate smoothing behavior

Added ai-smoothing.spec.ts:
Runs writeCommand multiple times with smoothing OFF, then ON (via useUiStore overrides), and collects the commanded heading samples.
Computes the mean heading delta between successive ticks and asserts that enabling smoothing reduces that mean (i.e., smoothing reduces heading jitter).
The test uses the standard UI store override pattern (useUiStore.getState().setAiSmoothingEnabled(...)) so it exercises the same runtime override path available to the UI.
Why I used the UI store for toggles

The repository already centralizes runtime experiment toggles through the UI store and getEffectiveAIConfig(); integrating the new features the same way keeps behavior consistent and allows toggles both from the HUD and from tests.
Validation performed

Ensured TypeScript errors were addressed and imports/types updated.
Ran the full test suite: all tests pass after ensuring the toggles default to off (tests keep deterministic baseline).
Added a targeted test (ai-smoothing.spec.ts) that asserts smoothing reduces heading jitter.
Follow-ups I can take if you'd like

Add a similar test for hysteresis to assert fewer approach/retreat flip-flops near band edges (e.g., measure thrust oscillation or command.thrust sign flips).
Add a test for vertical damping to assert reduced vertical amplitude spikes when enabled.
Expose these toggles in the in-game debug UI with short tooltips or grouped under an "AI Stability" subsection for easier tuning.
Add a small HUD telemetry widget that shows current effective config (smoothing/hysteresis/damping) and live metrics (heading amplitude, vertical dispersion) for rapid tuning.
Which follow-up should I implement next?