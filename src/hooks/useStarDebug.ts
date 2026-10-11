/**
 * Star disk debug window helpers cleanup hook
 *
 * Manages cleanup of debug window properties and DOM overlays when debug mode
 * is disabled. The actual debug functionality is implemented inline in the
 * component's useFrame loop due to tight coupling with per-frame state.
 */

import { useEffect, useCallback } from 'react';
import { clearDebugHooks } from '../debug/copilotDebugRegistry.js';

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
export function useStarDebug(debugEnabled: boolean, removeDebugOverlay: () => void): void {
  useEffect(() => {
    // All star debug hooks are registered under the `star` owner by
    // StarSphere, so cleanup is derived from the registry rather than a
    // hand-maintained key list.
    const clearDebugWindow = () => {
      clearDebugHooks('star');
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
