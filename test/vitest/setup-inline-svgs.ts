// Provide small inline SVG strings for tests so code paths that preload SVGs
// prefer inline content instead of attempting network fetches.

declare global {
  interface GlobalThis {
    __INLINE_SVG_ASSETS?: Record<string, string>;
  }
}

if (typeof globalThis !== 'undefined') {
  (globalThis as any).__INLINE_SVG_ASSETS = (globalThis as any).__INLINE_SVG_ASSETS || {
    destroyer: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" fill="#222"/></svg>',
    carrier: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" fill="#333"/></svg>',
    frigate: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" fill="#444"/></svg>',
    corvette: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" fill="#555"/></svg>',
  };
}

export {};
