// Vitest setup for SpaceAutoBattler
// Keep it light and DOM-safe. Happy DOM is provided by vitest.config.js.

// Polyfills or globals can be added here if needed by tests.
// For now, we only ensure TextEncoder/TextDecoder exist for environments that need them.

import { TextEncoder, TextDecoder } from 'util';

// @ts-ignore
if (typeof globalThis.TextEncoder === 'undefined') {
  // @ts-ignore
  globalThis.TextEncoder = TextEncoder as any;
}
// @ts-ignore
if (typeof globalThis.TextDecoder === 'undefined') {
  // @ts-ignore
  globalThis.TextDecoder = TextDecoder as any;
}

// Note: Vitest with the `happy-dom` environment provides `window` and `document`.
// If a test or environment doesn't expose them, you can create a Window instance
// from 'happy-dom' and assign globals here. Keep the setup minimal to avoid
// interfering with Playwright or other test runners.
