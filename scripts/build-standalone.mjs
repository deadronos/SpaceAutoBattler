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
 // Replace the module import or existing inline bundle placeholder with an inlined script tag
 // We'll look for a <script type="module" src="./src/renderer.js"></script> and replace it with inlined bundle
 const importTag = '<script type="module" src="./src/renderer.js"></script>';
 const bundleCode = await fs.readFile(outBundle, 'utf8');
  const inlined = `<script type="module">\n${bundleCode}\n</script>`;
  let newHtml;
  if (html.includes(importTag)){
    newHtml = html.replace(importTag, inlined);
  } else if (html.includes('</body>')){
    // insert before closing body
    newHtml = html.replace('</body>', `${inlined}\n</body>`);
  } else {
    // append to end
    newHtml = html + '\n' + inlined;
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
