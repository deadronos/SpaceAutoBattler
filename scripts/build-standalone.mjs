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

async function inlineBundle(){ const html = await fs.readFile(standaloneHtml, 'utf8');
  // Replace the module import or existing inline bundle placeholder with an inlined script tag.
  // To avoid repeatedly inlining and duplicating bundles, remove prior inlined bundle markers
  // and any previous inlined module script that contains the bundle signature.
  const importTag = '<script type="module" src="./src/renderer.js"></script>';
  const bundleCode = await fs.readFile(outBundle, 'utf8');
  const beginMarker = '<!-- BEGIN_INLINED_BUNDLE -->';
  const endMarker = '<!-- END_INLINED_BUNDLE -->';

  // Remove any existing block between our markers (safe, idempotent)
  let cleaned = html;
  const markerStart = cleaned.indexOf(beginMarker);
  const markerEnd = cleaned.indexOf(endMarker);
  if (markerStart !== -1 && markerEnd !== -1 && markerEnd > markerStart){
    cleaned = cleaned.slice(0, markerStart) + cleaned.slice(markerEnd + endMarker.length);
  }

  // Extra cleanup: some older standalone outputs in this repo previously inlined the bundle
  // without markers. Remove any <script type="module">...</script> blocks whose content
  // contains the bundle signature to avoid duplicate script blocks.
  const bundleSignature = 'var ut=Object.defineProperty';
  // simple regex to find module script blocks (non-greedy)
  cleaned = cleaned.replace(/<script\s+type=["']module["'][^>]*>[\s\S]*?<\/script>/gi, (match) => {
    return match.indexOf(bundleSignature) !== -1 ? '' : match;
  });

  const inlined = `${beginMarker}\n<script type="module">\n${bundleCode}\n</script>\n${endMarker}`;
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
