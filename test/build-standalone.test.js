import { describe, it, expect } from 'vitest';
import { cleanHtmlContent } from '../scripts/build-standalone.mjs';

describe('build-standalone cleaning', () => {
  const sampleHtml = `<!doctype html><html><head></head><body><script type="module" src="./src/renderer.js"></script></body></html>`;
  const fakeBundle = '/* bundle code */ var ut=Object.defineProperty; // signature present';

  it('inlines bundle replacing import tag', () => {
    const out = cleanHtmlContent(sampleHtml, fakeBundle);
    expect(out).toContain('BEGIN_INLINED_BUNDLE');
    expect(out).toContain(fakeBundle);
  });

  it('removes previous inline blocks and duplicate module tags', () => {
    const htmlWithInline = `...<!-- BEGIN_INLINED_BUNDLE --><script type=\"module\">${fakeBundle}</script><!-- END_INLINED_BUNDLE -->...<script type=\"module\">console.log('other')</script>`;
    const out = cleanHtmlContent(htmlWithInline, fakeBundle);
    // should have one BEGIN marker
    expect((out.match(/BEGIN_INLINED_BUNDLE/g) || []).length).toBe(1);
    // should keep non-bundle module scripts
    expect(out).toContain("console.log('other')");
  });
});
