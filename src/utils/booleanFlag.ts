const TRUE_VALUES = new Set(['1', 'true', 'on']);

/**
 * Parses a raw boolean configuration flag (`1`, `true`, or `on`, case-insensitive).
 *
 * @param {string} raw - Raw flag string value.
 * @returns {boolean} True when the flag value represents an enabled state.
 */
export function parseBooleanFlag(raw: string): boolean {
  return TRUE_VALUES.has(raw.toLowerCase());
}
