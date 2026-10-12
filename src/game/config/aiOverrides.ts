// Explicit AI-override injection point.
//
// The app UI store and the simulation worker each register a provider that
// exposes the live override slice. `getEffectiveAIConfig()` reads through this
// provider instead of the old `globalThis` backdoor, keeping `src/game` free of
// any `src/app` (React/zustand) dependency.

export interface AiOverrideSlice {
  aiVerticalEnabled: boolean | null;
  aiEngagementBoostEnabled: boolean | null;
  aiTickRateExperimentEnabled: boolean | null;
  aiRangePolicy: string | null;
  aiSmoothingEnabled?: boolean | null;
  aiHysteresisEnabled?: boolean | null;
  aiVerticalDampingEnabled?: boolean | null;
}

export type AiOverrideProvider = () => AiOverrideSlice;

let provider: AiOverrideProvider | null = null;

export function setAiOverrideProvider(next: AiOverrideProvider | null): void {
  provider = next;
}

export function getAiOverrideProvider(): AiOverrideProvider | null {
  return provider;
}
