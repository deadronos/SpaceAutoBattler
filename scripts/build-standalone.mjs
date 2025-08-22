import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build as runBaseBuild } from './build.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

function escapeHtml(str) {
	return str.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inlineHtml({ html, css, js, workerJs }) {
	// Inject CSS inside a <style> tag
	let out = html.replace(/<link[^>]+href=["']([^"']+)["'][^>]*>/i, () => `<style>\n${css}\n</style>`);

	// Replace module script src with inline code after adding a worker loader shim.
	// We monkey-patch Worker to handle URL('./simWorker.js', import.meta.url) by serving from an inline blob.
	const workerLoader = `
	const __workerCode = ${JSON.stringify(workerJs)};
	const __workerBlob = new Blob([__workerCode], { type: 'text/javascript' });
	const __workerUrl = URL.createObjectURL(__workerBlob);
	const __OrigWorker = window.Worker;
	window.Worker = class extends __OrigWorker {
		constructor(url, opts) {
			// redirect requests ending with simWorker.js to the blob URL; otherwise, pass-through
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
	out = out.replace(/<script[^>]+src=["']([^"']+)["'][^>]*><\/script>/i, () => `<script type="module">\n${jsInline}\n</script>`);
	return out;
}

async function buildStandalone() {
		const { outDir, files } = await runBaseBuild({ outDir: path.join(repoRoot, 'dist') });
	const [html, css, js, workerJs] = await Promise.all([
		fs.readFile(files.html, 'utf8'),
		fs.readFile(files.css, 'utf8'),
		fs.readFile(files.js, 'utf8'),
		fs.readFile(files.worker, 'utf8'),
	]);
	const inlined = inlineHtml({ html, css, js, workerJs });
	const standalonePath = path.join(outDir, 'spaceautobattler_standalone.html');
	await fs.writeFile(standalonePath, inlined, 'utf8');
	console.log(`Standalone written: ${standalonePath}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
	buildStandalone().catch((e) => { console.error(e); process.exit(1); });
}

