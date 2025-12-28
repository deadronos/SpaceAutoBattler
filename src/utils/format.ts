/**
 * Formatting utility functions to reduce duplication across the codebase.
 */

/**
 * Formats a nullable value as a percentage string with one decimal place.
 *
 * @param {number | null} value - The ratio value to format (0-1 range).
 * @returns {string} Formatted percentage string or '—' for null values.
 */
export function formatPercent(value: number | null): string {
  if (value == null) return '—';
  return `${(value * 100).toFixed(1)}%`;
}

/**
 * Formats a nullable value as a time string in seconds with one decimal place.
 *
 * @param {number | null} value - The time value in seconds.
 * @returns {string} Formatted time string or '—' for null values.
 */
export function formatSeconds(value: number | null): string {
  if (value == null) return '—';
  return `${value.toFixed(1)}s`;
}

/**
 * Formats a ratio as a percentage string with no decimal places.
 *
 * @param {number} value - The ratio value to format (0-1 range).
 * @returns {string} Formatted percentage string.
 */
export function formatPercentRounded(value: number): string {
  return `${Math.round(value * 100)}%`;
}
