import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Pure TypeScript build: all runtime logic is sourced from /src/*.ts files.
// No JS shims or transpilation steps are required.
import { build as runBaseBuild } from './build.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');


// No longer needed: escapeHtml (unused)

function inlineHtml({ html, css, js, workerJs }) {
		// Inject CSS inside a <style> tag
		let out = html.replace(/<link[^>]+href=["']([^"']+)["'][^>]*>/i, () => `<style>\n${css}\n</style>`);


		// Replace module script src with inline code after adding a worker loader shim.
		// Monkey-patch Worker to handle URL('./simWorker.js', import.meta.url) by serving from an inline blob.
		const workerLoader = `
			const __workerCode = ${JSON.stringify(workerJs)};
			const __workerBlob = new Blob([__workerCode], { type: 'text/javascript' });
			const __workerUrl = URL.createObjectURL(__workerBlob);
			const __OrigWorker = window.Worker;
			window.Worker = class extends __OrigWorker {
				constructor(url, opts) {
					try {
						const s = typeof url === 'string' ? url : String(url);
						if (s.endsWith('simWorker.js')) {
							super(__workerUrl, { type: 'module', ...(opts||{}) });
							return;
						}
					} catch {}
					super(url, opts);
				}
			};
		`;

		const jsInline = `${workerLoader}\n${js}`;
		out = out.replace(/<script[^>]+src=["']([^"']+)["'][^>]*><\/script>/i, () => `<script type="module">\n${jsInline}\n<\/script>`);
		return out;
}


async function buildStandalone() {
	// All logic is bundled from TypeScript sources.
	const { outDir, files } = await runBaseBuild({ outDir: path.join(repoRoot, 'dist') });
	const [html, css, js, workerJs] = await Promise.all([
		fs.readFile(files.html, 'utf8'),
		fs.readFile(files.css, 'utf8'),
		fs.readFile(files.js, 'utf8'),
		fs.readFile(files.worker, 'utf8'),
	]);
	 // Inline SVG assets
	 const svgDir = path.join(repoRoot, 'src', 'config', 'assets', 'svg');
	 const svgFiles = ['destroyer.svg', 'carrier.svg', 'frigate.svg', 'corvette.svg'];
	 const svgAssets = {};
	 for (const fname of svgFiles) {
		 const fpath = path.join(svgDir, fname);
		 try {
			 svgAssets[fname.replace('.svg', '')] = await fs.readFile(fpath, 'utf8');
		 } catch (e) {
			 console.warn(`[build-standalone] WARNING: SVG asset missing: ${fpath}`);
			 svgAssets[fname.replace('.svg', '')] = '';
		 }
	 }

	 // Prepend JS code to inject SVG assets into globalThis
	 const svgInject = `if (typeof globalThis !== 'undefined') { globalThis.__INLINE_SVG_ASSETS = ${JSON.stringify(svgAssets)}; }\n`;
	 const jsWithSvg = svgInject + js;
	 const inlined = inlineHtml({ html, css, js: jsWithSvg, workerJs });
	const standalonePath = path.join(outDir, 'spaceautobattler_standalone.html');
	await fs.writeFile(standalonePath, inlined, 'utf8');
	console.log(`Standalone written: ${standalonePath}`);
}


// Execute when run directly via `node scripts/build-standalone.mjs`
// This script now builds exclusively from TypeScript sources in /src.
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  buildStandalone().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

