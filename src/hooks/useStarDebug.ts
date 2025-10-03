/**
 * Star disk debug window helpers cleanup hook
 * 
 * Manages cleanup of debug window properties and DOM overlays when debug mode
 * is disabled. The actual debug functionality is implemented inline in the
 * component's useFrame loop due to tight coupling with per-frame state.
 */

import { useEffect, useCallback } from 'react';

/**
 * Remove the debug overlay DOM element.
 */
export function useDebugOverlayCleanup(): () => void {
  return useCallback(() => {
    if (typeof document === 'undefined') {
      return;
    }
    const overlay = document.getElementById('copilot-star-screen-indicator');
    if (overlay) {
      try {
        overlay.remove();
      } catch {
        // Ignore removal errors
      }
    }
  }, []);
}

/**
 * Clean up debug window properties and overlays.
 * 
 * @param debugEnabled - Whether debug mode is currently enabled
 * @param removeDebugOverlay - Callback to remove the debug overlay
 */
export function useStarDebug(
  debugEnabled: boolean,
  removeDebugOverlay: () => void
): void {
  useEffect(() => {
    const clearDebugWindow = () => {
      if (typeof window === 'undefined') {
        return;
      }
      const win = window as unknown as Record<string, unknown>;
      const keys = [
        '__copilot_setStarLayer',
        '__copilot_resetStarLayer',
        '__copilot_setStarBasicMaterial',
        '__copilot_restoreStarMaterial',
        '__copilot_forceBasicMaterialActive',
        '__copilot_forceBasicMaterialColor',
        '__copilot_forceBasicMaterialApplied',
        '__copilot_starLayerSetAt',
        '__copilot_starLayerResetAt',
        '__copilot_forceStarOpaqueRequest',
        '__copilot_forceStarOpaque',
        '__copilot_forceStarOpaqueApplied',
        '__copilot_forceStarOnTopRequest',
        '__copilot_star_forceOnTop',
        '__copilot_forceBasicMaterialRequest',
        '__copilot_restoreOriginalStarMaterial',
        '__copilot_restoreOriginalStarMaterialApplied',
        '__copilot_starMeshStatus',
        '__copilot_rotateCameraDeltaDeg',
        '__copilot_rotateAppliedAt',
      ];
      for (const key of keys) {
        if (key in win) {
          try {
            delete win[key];
          } catch {
            win[key] = undefined;
          }
        }
      }
    };

    if (debugEnabled) {
      return () => {
        clearDebugWindow();
        removeDebugOverlay();
      };
    }

    clearDebugWindow();
    removeDebugOverlay();
    return undefined;
  }, [debugEnabled, removeDebugOverlay]);
}
