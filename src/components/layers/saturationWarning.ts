export interface SaturationWarningState {
  lastFrame: number;
}

export function createSaturationWarningState(): SaturationWarningState {
  return { lastFrame: -1 };
}

interface WarnOnSaturationParams {
  saturated: boolean;
  frameId: number;
  state: SaturationWarningState;
  message: string;
}

export function warnOnSaturation({
  saturated,
  frameId,
  state,
  message,
}: WarnOnSaturationParams): void {
  if (!saturated) return;
  if (state.lastFrame === frameId) return;
  console.warn(message);
  state.lastFrame = frameId;
}
