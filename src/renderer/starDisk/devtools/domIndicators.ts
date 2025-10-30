const INDICATOR_ID = 'copilot-star-compiled-indicator';
const INDICATOR_STYLE =
  'position:fixed; right:12px; bottom:12px; padding:6px 10px; color:white; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; font-size:12px; border-radius:6px; box-shadow:0 2px 6px rgba(0,0,0,0.35); z-index:9999999;';

const withDocument = (fn: (doc: Document) => void): void => {
  if (typeof document === 'undefined') return;
  try {
    fn(document);
  } catch {
    // ignore DOM failures in dev helpers
  }
};

const updateIndicator = (text: string, background: string): void => {
  withDocument((doc) => {
    doc.documentElement.setAttribute('data-star-compiled', '1');
    const existing = doc.getElementById(INDICATOR_ID);
    const el = existing ?? doc.createElement('div');
    el.id = INDICATOR_ID;
    el.textContent = text;
    el.style.cssText = `${INDICATOR_STYLE} background:${background};`;
    if (!existing) {
      doc.body.appendChild(el);
    }
    setTimeout(() => {
      try {
        el.remove();
      } catch {
        // ignore removal errors
      }
    }, 4000);
  });
};

export const showCompileStartIndicator = (): void => {
  updateIndicator('STAR COMPILE STARTED', 'rgba(59,130,246,0.95)');
};

export const showCompileSuccessIndicator = (): void => {
  updateIndicator('STAR COMPILED', 'rgba(16,185,129,0.95)');
};
