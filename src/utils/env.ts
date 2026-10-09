import { reportConfigError } from './errorReporting.js';

const TRUE_VALUES = new Set(['1', 'true', 'on']);

/**
 * True when running a production build. Prefers `import.meta.env.PROD`
 * (Vite) and falls back to `process.env.NODE_ENV`.
 *
 * @returns {boolean}
 */
export function isProductionEnv(): boolean {
  try {
    const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
      ?.env;
    if (env?.NODE_ENV === 'production') return true;
  } catch {
    // ignore env resolution errors
  }

  if (typeof import.meta !== 'undefined') {
    const meta = import.meta as { env?: { PROD?: boolean; NODE_ENV?: string } };
    if (typeof meta.env?.PROD === 'boolean') return meta.env.PROD;
    if (typeof meta.env?.NODE_ENV === 'string') return meta.env.NODE_ENV === 'production';
  }
  return false;
}

/**
 * Reads a string/boolean environment variable from `process.env`, returning
 * `defaultValue` when unset. Boolean defaults use `1`/`true`/`on`.
 *
 * @template T
 * @param {string} name - Environment variable name.
 * @param {T} defaultValue - Value when the variable is unset.
 * @param {(raw: string) => T} [parser] - Optional custom parser.
 * @returns {T}
 */
export function readEnv<T extends string | boolean>(
  name: string,
  defaultValue: T,
  parser?: (raw: string) => T,
): T {
  try {
    const source = globalThis as unknown as {
      process?: { env?: Record<string, string | undefined> };
    };
    const raw = source.process?.env?.[name];
    if (!raw) return defaultValue;

    if (parser) return parser(raw);

    if (typeof defaultValue === 'boolean') {
      return TRUE_VALUES.has(raw.toLowerCase()) as T;
    }

    return raw as T;
  } catch (error) {
    reportConfigError(name, error);
    return defaultValue;
  }
}

/**
 * Reads a boolean environment variable.
 *
 * @param {string} name - Environment variable name.
 * @param {boolean} [defaultValue=false] - Value when unset.
 * @returns {boolean}
 */
export function readBooleanEnv(name: string, defaultValue = false): boolean {
  return readEnv(name, defaultValue);
}

/**
 * Reads a string environment variable.
 *
 * @param {string} name - Environment variable name.
 * @param {string} defaultValue - Value when unset.
 * @returns {string}
 */
export function readStringEnv(name: string, defaultValue: string): string {
  return readEnv(name, defaultValue);
}
