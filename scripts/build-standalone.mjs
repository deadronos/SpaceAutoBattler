import { build } from 'esbuild';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';

// Build script (robust rewrite)
// - Bundles src/renderer.js with esbuild
// - Reads space_themed_autobattler_canvas_red_vs_blue_standalone.html
// - Strips any existing <script type="module" ...> tags (both inline and src)
// - Removes old legacy click handlers that directly call toast with "+1 Red" / "+1 Blue"
//   (matches a broad set of minified/pretty-printed variants)
// - Inlines the bundled code into a single <script type="module">...</script>
// - Injects a small entry script that calls initRenderer() and initRendererUI()
// - Writes output to ./dist and overwrites the repo-root standalone HTML

const root = path.resolve('.');
const srcEntry = path.join(root, 'src', 'renderer.js');
const outDir = path.join(root, 'dist');
const outBundle = path.join(outDir, 'bundle.js');
const standaloneHtml = path.join(root, 'space_themed_autobattler_canvas_red_vs_blue_standalone.html');

async function ensureDir(d){ try{ await fs.mkdir(d, { recursive: true }); }catch(e){} }

async function buildBundle(){
  await ensureDir(outDir);
  await build({
    entryPoints: [srcEntry],
    outfile: outBundle,
    bundle: true,
    minify: true,
    sourcemap: false,
    format: 'esm',
    target: ['es2020'],
  });
}

// Remove all <script type="module" ...> blocks (inline and src), but keep other scripts
function stripModuleScripts(html){
  // Remove entire <script type="module">...</script> blocks (multiline safe)
  html = html.replace(/<script\s+type=["']module["'][\s\S]*?<\/script>/gi, '');
  // Remove <script type="module" src="..."></script> single-line tags that remained
  html = html.replace(/<script\s+type=["']module["'][^>]*>\s*<\/script>/gi, '');
  return html;
}

// Remove legacy addEventListener handlers that directly call toast("+1 Red") or toast("+1 Blue")
// We match a broad JS snippet pattern to catch minified or prettified variants.
function removeLegacyAddHandlers(html){
  // Patterns to match: any code that adds a click listener and calls toast("+1 Red") or toast('+1 Blue')
  // Example patterns to catch (minified): s.addEventListener("click",()=>{...J("+1 Red")});
  // Use a global, dotall regex that finds addEventListener\(\s*['"]click['"].*?toast\(["']\+1\s+Red["']\).*?\)\s*;?
  html = html.replace(/\w+\.addEventListener\(\s*["']click["']\s*,[\s\S]*?toast\(\s*["']\+1\s+Red["']\s*\)[\s\S]*?\)\s*;?/gi, '');
  html = html.replace(/\w+\.addEventListener\(\s*["']click["']\s*,[\s\S]*?toast\(\s*["']\+1\s+Blue["']\s*\)[\s\S]*?\)\s*;?/gi, '');

  // Also catch older builds where toast function is named 'z' or 'J' etc. Match common short names used in minification
  html = html.replace(/\w+\.addEventListener\(\s*["']click["']\s*,[\s\S]*?\b(?:z|J|j)\(\s*["']\+1\s+Red["']\s*\)[\s\S]*?\)\s*;?/gi, '');
  html = html.replace(/\w+\.addEventListener\(\s*["']click["']\s*,[\s\S]*?\b(?:z|J|j)\(\s*["']\+1\s+Blue["']\s*\)[\s\S]*?\)\s*;?/gi, '');

  return html;
}

async function inlineBundle(){
  let html = await fs.readFile(standaloneHtml, 'utf8');

  // Strip module scripts (we will inject our own inlined bundle)
  html = stripModuleScripts(html);

  // Remove legacy handlers that produce simple +1 toasts (we will rely on UI init handlers)
  html = removeLegacyAddHandlers(html);

  // Read the bundle
  const bundleCode = await fs.readFile(outBundle, 'utf8');

  // Create the inlined module script. Keep a small wrapper to avoid top-level IIFE collisions.
  const inlined = `<script type="module">\n${bundleCode}\n</script>`;

  // Entry script: call initRenderer and initRendererUI after DOMContentLoaded if they exist
  const boot = `<script type="module">\nwindow.addEventListener('DOMContentLoaded', () => {\n  try{ if (typeof initRenderer === 'function') initRenderer(); } catch(e){ console.error('initRenderer failed', e); }\n  try{ if (typeof initRendererUI === 'function') initRendererUI(); } catch(e){ console.error('initRendererUI failed', e); }\n});\n</script>`;

  // Insert before </body> if present, otherwise append
  if (html.includes('</body>')){
    html = html.replace('</body>', `${inlined}\n${boot}\n</body>`);
  } else {
    html = html + '\n' + inlined + '\n' + boot;
  }

  // Write output to dist and overwrite original (for file:// testing convenience)
  await ensureDir(outDir);
  const outPath = path.join(outDir, path.basename(standaloneHtml));
  await fs.writeFile(outPath, html, 'utf8');
  await fs.writeFile(standaloneHtml, html, 'utf8');
  console.log('Wrote inlined standalone to', outPath);
  console.log('Also updated', standaloneHtml);
}

async function runOnce(){
  console.log('Building bundle...');
  await buildBundle();
  console.log('Inlining bundle into standalone HTML...');
  await inlineBundle();
  console.log('Done. Output in ./dist');
}

async function runWatch(){
  console.log('Starting watch mode...');
  try{ await buildBundle(); await inlineBundle(); console.log('Initial build+inline complete'); }catch(e){ console.error('Initial build error', e); }
  const srcDir = path.join(root, 'src');
  try{
    fsSync.watch(srcDir, { recursive: true }, (ev, fn) => {
      console.log('Change detected in src -> rebuilding...');
      setTimeout(async () => { try{ await buildBundle(); await inlineBundle(); console.log('Rebuild complete'); }catch(e){ console.error('Rebuild error', e); } }, 150);
    });
  }catch(e){ console.error('fs.watch failed', e); }
}

(async function main(){ try{
  const args = process.argv.slice(2);
  if (args.includes('--watch')){ await runWatch(); return; }
  await runOnce();
}catch(err){ console.error(err); process.exit(1); } })();
