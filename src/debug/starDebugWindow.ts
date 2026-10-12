/**
 * Shared dev-only star debug-window surface.
 *
 * This module is the single owner of the star `window.__copilot_*` typing, the
 * global `Window` augmentation, and the SSR-safe window accessor. It is the
 * union of the surfaces previously declared in `starSphereDebug.ts` and
 * `renderer/starDisk/devtools/debugWindow.ts`.
 */

import type { Mesh, ShaderMaterial } from 'three';

export interface StarDebugWindowProperties {
  // From `starSphereDebug.ts`.
  __copilot_forceBasicMaterialRequest?: boolean;
  __copilot_forceBasicMaterialActive?: boolean;
  __copilot_forceBasicMaterialColor?: string;
  __copilot_forceBasicMaterialApplied?: number;
  __copilot_restoreOriginalStarMaterial?: boolean;
  __copilot_restoreOriginalStarMaterialApplied?: number;
  __copilot_setStarBasicMaterial?: (opts?: { color?: string }) => {
    applied: boolean;
    reason?: string;
  };
  __copilot_restoreStarMaterial?: () => { restored: boolean; reason?: string };
  __copilot_setStarLayer?: (layerIndex?: unknown) => {
    set: boolean;
    layer?: number;
    reason?: string;
  };
  __copilot_resetStarLayer?: () => { reset: boolean; reason?: string };
  __copilot_starLayerSetAt?: number;
  __copilot_starLayerResetAt?: number;
  __copilot_rotateCameraDeltaDeg?: number | null;
  __copilot_rotateAppliedAt?: number;
  __copilot_cameraPosition?: { x: number; y: number; z: number };
  __copilot_cameraRotation?: { x: number; y: number; z: number };
  __copilot_visualMesh?: Mesh;
  __copilot_appliedMaterial?: ShaderMaterial | null;
  // From `renderer/starDisk/devtools/debugWindow.ts`.
  __copilot_forceStarOpaque?: boolean;
  __copilot_star_forcedOpaque?: boolean;
  __STAR_COMPILED?: boolean;
  __copilot_starUniforms?: Array<unknown>;
  __copilot_glLogs?: Array<unknown>;
  __copilot_star_forceOnTop?: boolean;
  __copilot_forceStarOpaqueReset?: () => void;
  __copilot_star_compile_dispose?: Array<() => void>;
}

export type StarDebugWindow = Window & StarDebugWindowProperties;

declare global {
  interface Window extends StarDebugWindowProperties {}
}

export const getStarDebugWindow = (): StarDebugWindow | undefined =>
  typeof window === 'undefined' ? undefined : (window as StarDebugWindow);
