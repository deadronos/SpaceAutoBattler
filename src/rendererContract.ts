import type { GameState } from "./types";

export interface RendererContract {
  init(canvas: HTMLCanvasElement): boolean;
  updateSize(width: number, height: number): void;
  renderState(state: GameState, interpolation?: number): void;
  preloadAllAssets?(state?: GameState): Promise<void> | void;
  dispose(): void;
  supportsInstancing?(): boolean;
  getStats?(): any;
}

export default RendererContract;
