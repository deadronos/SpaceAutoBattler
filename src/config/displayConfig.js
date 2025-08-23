export function getDefaultBounds() {
  return { W: Math.max(800, window.innerWidth), H: Math.max(600, window.innerHeight) };
}

export default { getDefaultBounds };

// Validate display config
import { validateConfigOrThrow, validateDisplayConfig } from './validateConfig';
try {
  const errs = validateDisplayConfig({ getDefaultBounds });
  if (errs && errs.length) validateConfigOrThrow({ getDefaultBounds });
} catch (err) {
  // eslint-disable-next-line no-console
  console.error('displayConfig validation failed:', err && err.message ? err.message : err);
  throw err;
}
