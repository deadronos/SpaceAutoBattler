import { build } from 'esbuild';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';

// Paths
const root = path.resolve('.');
const srcEntry = path.join(root, 'src', 'renderer.js');
const outDir = path.join(root, 'dist');
const outBundle = path.join(outDir, 'bundle.js');
const standaloneHtml = path.join(root, 'space_themed_autobattler_canvas_red_vs_blue_standalone.html');

async function ensureDir(d){ try{ await fs.mkdir(d, { recursive: true }); }catch(e){} }

async function buildBundle(){
  await ensureDir(outDir);
  await build({ entryPoints: [srcEntry], outfile: outBundle, bundle: true, minify: true, sourcemap: false, format: 'esm', target: ['es2020'] });
  return null;
}

// Shared AUTO_INIT snippet used when inlining the bundle and in tests
const AUTO_INIT_SNIPPET = `
// AUTO_INIT_SNIPPET_START
// Idempotent auto-init for standalone bundle: try common exported names safely.
// This variant awaits the initializer (if it returns a promise) and then
// retries clicking the start button until the UI toggles to "Pause" or
// a timeout is reached. This is more robust against handler-installation
// races caused by inlining/minification ordering.
if (typeof window !== "undefined" && !window.__autoRendererStarted) {
  window.__autoRendererStarted = true;
  Promise.resolve().then(() => {
    try {
      try {
        console.log('[AUTO_INIT] typeof window.initRenderer ->', typeof window.initRenderer);
        console.log('[AUTO_INIT] window.initRenderer ->', window.initRenderer && (window.initRenderer.name || '[function]'));
      } catch(_){ }

      const attemptStartWith = (fn, label) => {
        try {
          const p = fn({ preferWebGL: true, startLoop: true });
          // Ensure we handle both sync and promise returns
          return Promise.resolve(p).then(() => {
            // Retry clicking the start button until its text indicates running
            let attempts = 0;
            const maxAttempts = 12; // ~1 second with 80ms interval
            const tryClick = () => {
              attempts++;
              try {
                const b = document.getElementById('startPause');
                if (b && typeof b.click === 'function') {
                  b.click();
                  console.log('[AUTO_INIT] start button clicked (' + label + ') attempt', attempts);
                  // If the button text changed to Pause, we assume running started
                  if (b.textContent && b.textContent.toLowerCase().includes('pause')) {
                    console.log('[AUTO_INIT] start confirmed via button text (' + label + ')');
                    return;
                  }
                } else {
                  console.log('[AUTO_INIT] start button not found (' + label + '), attempt', attempts);
                }
              } catch (e) {
                console.log('[AUTO_INIT] click attempt error', e && e.message);
              }
              if (attempts < maxAttempts) {
                setTimeout(tryClick, 80);
              } else {
                console.log('[AUTO_INIT] failed to confirm start after', maxAttempts, 'attempts (', label, ')');
                try {
                  if (typeof window !== 'undefined' && typeof window.startSimulation === 'function') {
                    console.log('[AUTO_INIT] calling window.startSimulation() fallback');
                    window.startSimulation();
                  }
                } catch (_) {}
              }
            };
            // start first try slightly delayed to allow handlers to be installed
            setTimeout(tryClick, 60);

            // Proactive safety: also call startSimulation directly shortly after init
            // This ensures the internal 'ae' running flag is set even if click handlers
            // are not yet installed or click events are swallowed by race conditions.
            try {
              if (typeof window !== 'undefined' && typeof window.startSimulation === 'function') {
                setTimeout(() => {
                  try {
                    console.log('[AUTO_INIT] proactive window.startSimulation() call');
                    window.startSimulation();
                  } catch (__) {}
                }, 120);
                // A second attempt after a longer delay to cover slower setups
                setTimeout(() => {
                  try {
                    console.log('[AUTO_INIT] proactive window.startSimulation() call (retry)');
                    window.startSimulation();
                  } catch (__) {}
                }, 600);
              }
            } catch (_) {}
          });
        } catch (e) { console.log('[AUTO_INIT] initializer call threw (' + label + ')', e && e.message); return Promise.resolve(); }
      };

      if (typeof initRenderer === 'function') {
        console.log('[AUTO_INIT] calling initRenderer (local export)');
        attemptStartWith(initRenderer, 'initRenderer');
      } else if (typeof Li === 'function') {
        console.log('[AUTO_INIT] calling Li (minified alias)');
        attemptStartWith(Li, 'Li');
      } else if (typeof window.initRenderer === 'function') {
        console.log('[AUTO_INIT] calling window.initRenderer');
        attemptStartWith(window.initRenderer, 'window.initRenderer');
      } else {
        console.log('[AUTO_INIT] no initRenderer found to call');
      }
    } catch (e) {
      try { console.error('Auto init failed', e); } catch (_) {}
    }
  });
}
// AUTO_INIT_SNIPPET_END
`;

async function inlineBundle(){ const html = await fs.readFile(standaloneHtml, 'utf8');
  // Replace the module import or existing inline bundle placeholder with an inlined script tag.
  // To avoid repeatedly inlining and duplicating bundles, remove prior inlined bundle markers
  // and any previous inlined module script that contains the bundle signature.
  const importTag = '<script type="module" src="./src/renderer.js"></script>';
  const bundleCode = await fs.readFile(outBundle, 'utf8');
  // If the bundle already contains an AUTO_INIT block, replace it with the new one; otherwise append.
  let bundleWithSnippet = bundleCode.replace(/\/\/ AUTO_INIT_SNIPPET_START[\s\S]*?\/\/ AUTO_INIT_SNIPPET_END/g, AUTO_INIT_SNIPPET);
  if (bundleWithSnippet === bundleCode) bundleWithSnippet = bundleCode + AUTO_INIT_SNIPPET;
  const finalBundleCode = bundleWithSnippet;
  const beginMarker = '<!-- BEGIN_INLINED_BUNDLE -->';
  const endMarker = '<!-- END_INLINED_BUNDLE -->';

  // Remove any existing block between our markers (safe, idempotent)
  // Use a global, non-greedy regex to remove ALL previous inlined bundle blocks.
  let cleaned = html.replace(/<!-- BEGIN_INLINED_BUNDLE -->[\s\S]*?<!-- END_INLINED_BUNDLE -->/g, '');

  // Extra cleanup: some older standalone outputs in this repo previously inlined the bundle
  // without markers. Remove any <script type="module">...</script> blocks whose content
  // contains the bundle signature to avoid duplicate script blocks. Use a robust bundle signature
  // check and remove all matches globally.
  const bundleSignature = 'var ut=Object.defineProperty';
  cleaned = cleaned.replace(/<script\s+type=["']module["'][^>]*>[\s\S]*?<\/script>/gi, (match) => {
    return match.includes(bundleSignature) ? '' : match;
  });

  const inlined = `${beginMarker}\n<script type="module">\n${finalBundleCode}\n</script>\n${endMarker}`;
  let newHtml;
  if (cleaned.includes(importTag)){
    newHtml = cleaned.replace(importTag, inlined);
  } else if (cleaned.includes('</body>')){
    // insert before closing body
    newHtml = cleaned.replace('</body>', `${inlined}\n</body>`);
  } else {
    // append to end
    newHtml = cleaned + '\n' + inlined;
  }
  const outPath = path.join(outDir, path.basename(standaloneHtml));
  await fs.writeFile(outPath, newHtml, 'utf8');
  // Also overwrite the original standalone HTML at repo root so it is updated for file:// use
  await fs.writeFile(standaloneHtml, newHtml, 'utf8');
  console.log('Wrote inlined standalone to', outPath);
  console.log('Also updated', standaloneHtml);
}

// Helper that performs the same cleaning of HTML string content as inlineBundle
// but does not read/write files. Useful for unit testing the idempotent cleaning logic.
export function cleanHtmlContent(html, bundleCode){
  const beginMarker = '<!-- BEGIN_INLINED_BUNDLE -->';
  const endMarker = '<!-- END_INLINED_BUNDLE -->';
  // Remove any existing inlined bundle blocks (idempotent cleaning)
  let cleaned = html.replace(/<!-- BEGIN_INLINED_BUNDLE -->[\s\S]*?<!-- END_INLINED_BUNDLE -->/g, '');
  // Also remove any <script type="module">...</script> blocks whose content
  // contains the bundle signature so older unmarked inlines are cleaned too.
  const bundleSignature = 'var ut=Object.defineProperty';
  cleaned = cleaned.replace(/<script\s+type=["']module["'][^>]*>[\s\S]*?<\/script>/gi, (match) => {
    return match.includes(bundleSignature) ? '' : match;
  });
  const markerStart = cleaned.indexOf(beginMarker);
  const markerEnd = cleaned.indexOf(endMarker);
  // (the cleaning above already removed markers and prior inlined bundles)
  const importTag = '<script type="module" src="./src/renderer.js"></script>';
  const finalBundleCode = bundleCode.includes('AUTO_INIT_SNIPPET_START') ? bundleCode : bundleCode + AUTO_INIT_SNIPPET;
  const inlined = `${beginMarker}\n<script type="module">\n${finalBundleCode}\n</script>\n${endMarker}`;
  let newHtml;
  if (cleaned.includes(importTag)){
    newHtml = cleaned.replace(importTag, inlined);
  } else if (cleaned.includes('</body>')){
    newHtml = cleaned.replace('</body>', `${inlined}\n</body>`);
  } else {
    newHtml = cleaned + '\n' + inlined;
  }
  return newHtml;
}

// Export build utilities for tests
export { buildBundle, inlineBundle };

async function runOnce(){ console.log('Building bundle...'); await buildBundle(); console.log('Inlining bundle into standalone HTML...'); await inlineBundle(); console.log('Done. Output in ./dist'); }

async function runWatch(){
  console.log('Starting fs.watch build...');
  // initial build + inline
  try{ await buildBundle(); await inlineBundle(); console.log('Initial build + inline complete'); } catch(err){ console.error('Initial build error', err); }

  const srcDir = path.join(root, 'src');
  let timeout = null;
  try{
    fsSync.watch(srcDir, { recursive: true }, (eventType, filename) => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(async () => {
        try{
          console.log('Change detected in src, rebuilding...');
          await buildBundle();
          await inlineBundle();
          console.log('Rebuild + inline complete');
        }catch(e){ console.error('Rebuild error', e); }
      }, 150);
    });
  }catch(e){
    console.error('fs.watch failed, falling back to polling:', e);
    // polling fallback
    const bundlePath = outBundle;
    let lastMtime = 0;
    setInterval(async () => {
      try{
        const st = await fs.stat(bundlePath);
        if (st.mtimeMs > lastMtime){ lastMtime = st.mtimeMs; console.log('Detected bundle change, inlining...'); await inlineBundle(); }
      }catch(_){}
    }, 500);
  }
}

(async function main(){ try{
  const args = process.argv.slice(2);
  if (args.includes('--watch')){
    await runWatch();
    // keep process alive
    return;
  }
  await runOnce();
 }catch(err){ console.error(err); process.exit(1); } })();
