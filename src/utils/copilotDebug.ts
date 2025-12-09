/**
 * Copilot debug utilities
 *
 * Shared utilities for checking debug mode and exposing diagnostics.
 */

/**
 * Check if Copilot debug mode is enabled via query parameter or window flag.
 *
 * @returns {boolean} True if debug mode is active.
 */
export function isCopilotDebugEnabled(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    const win = window as Window & { __copilotDebugForce?: boolean };
    if (win.__copilotDebugForce) {
      return true;
    }
    const search = typeof win.location?.search === 'string' ? win.location.search : '';
    return /[?&]copilot_debug=1/.test(search);
  } catch {
    return false;
  }
}
