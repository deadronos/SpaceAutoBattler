// This allows the build to treat the app as TypeScript while we incrementally port internals.
// main.ts — TypeScript entrypoint (ported from main.js). Uses TS imports so
// the module graph resolves to .ts sources during migration.
import { createGameManager } from './gamemanager';
// This allows the build to treat the app as TypeScript while we incrementally port internals.
// main.ts — TypeScript entrypoint (ported from main.js). Uses TS imports so
// the module graph resolves to .ts sources during migration.
import { CanvasRenderer } from './canvasrenderer';
import { WebGLRenderer } from './webglrenderer';
import { getDefaultBounds } from './config/displayConfig';
import { getPreferredRenderer, RendererConfig } from './config/rendererConfig';

// Allow temporary extension of window.gm used by the app during migration.
declare global {
	interface Window { gm?: any; }
}

export async function startApp(rootDocument: Document = document) {
	const canvas = rootDocument.getElementById('world') as HTMLCanvasElement;
	const ui: any = {
		startPause: rootDocument.getElementById('startPause'),
		reset: rootDocument.getElementById('reset'),
		addRed: rootDocument.getElementById('addRed'),
		addBlue: rootDocument.getElementById('addBlue'),
		toggleTrails: rootDocument.getElementById('toggleTrails'),
		speed: rootDocument.getElementById('speed'),
		redScore: rootDocument.getElementById('redScore'),
		blueScore: rootDocument.getElementById('blueScore'),
		stats: rootDocument.getElementById('stats'),
		continuousCheckbox: rootDocument.getElementById('continuousCheckbox'),
		seedBtn: rootDocument.getElementById('seedBtn'),
		formationBtn: rootDocument.getElementById('formationBtn'),
	};

	try { if (ui.stats) ui.stats.textContent = 'Ships: 0 (R:0 B:0) Bullets: 0'; } catch (e) {}

	function fitCanvasToWindow() {
		const baseDpr = window.devicePixelRatio || 1;
		const cfgScale = (RendererConfig && typeof (RendererConfig as any).rendererScale === 'number') ? (RendererConfig as any).rendererScale : 1;
		const bounds = getDefaultBounds();
		const cssW = Math.round(bounds.W * cfgScale);
		const cssH = Math.round(bounds.H * cfgScale);
		if (canvas) {
			canvas.style.width = `${cssW}px`;
			canvas.style.height = `${cssH}px`;
			canvas.width = Math.round(cssW * baseDpr);
			canvas.height = Math.round(cssH * baseDpr);
		}
	}

	fitCanvasToWindow();
	window.addEventListener('resize', fitCanvasToWindow);

	let renderer: any;
	const pref = getPreferredRenderer();
	if (pref === 'webgl') {
		try { const w = new WebGLRenderer(canvas); if (w && w.init && w.init()) renderer = w; } catch (e) {}
	}
	if (!renderer) { renderer = new CanvasRenderer(canvas); renderer.init && renderer.init(); }

	try { window.gm = window.gm || {}; } catch (e) {}
	const gm = createGameManager({ renderer, useWorker: false });
	try { if (typeof window !== 'undefined' && (window as any).gm) Object.assign((window as any).gm, gm); } catch (e) {}

	try {
		const host = (location && location.hostname) || '';
		const urlParams = (typeof URLSearchParams !== 'undefined') ? new URLSearchParams(location.search) : null;
		const autotest = (urlParams && urlParams.get('autotest') === '1') || !!((window as any).__AUTO_REINFORCE_DEV__);
		if ((host === '127.0.0.1' || host === 'localhost') && autotest) {
			try { if (gm && typeof gm.setContinuousEnabled === 'function') gm.setContinuousEnabled(true); } catch (e) {}
			try { if (gm && typeof gm.setReinforcementInterval === 'function') gm.setReinforcementInterval(0.01); } catch (e) {}
			try { if (gm && typeof gm.stepOnce === 'function') gm.stepOnce(0.02); } catch (e) {}
		}
	} catch (e) {}

	let lastReinforcementSummary = '';
	try {
		if (gm && typeof gm.on === 'function') {
			gm.on('reinforcements', (msg: any) => {
				const list = (msg && msg.spawned) || [];
				const types = list.map((s: any) => s.type).filter(Boolean);
				const summary = `Reinforcements: spawned ${list.length} ships (${types.join(', ')})`;
				lastReinforcementSummary = summary;
				try { setTimeout(() => { lastReinforcementSummary = ''; }, 3000); } catch (e) {}
				try { if (ui && ui.stats) ui.stats.textContent = `${ui.stats.textContent} | ${summary}`; } catch (e) {}
			});
		}
	} catch (e) {}

	const workerIndicator = rootDocument.getElementById('workerIndicator');
	let toastContainer = rootDocument.getElementById('toastContainer');
	if (!toastContainer) {
		try {
			toastContainer = rootDocument.createElement('div');
			toastContainer.id = 'toastContainer';
			toastContainer.style.position = 'fixed';
			toastContainer.style.right = '16px';
			toastContainer.style.top = '16px';
			toastContainer.style.zIndex = '9999';
			toastContainer.style.pointerEvents = 'none';
			rootDocument.body.appendChild(toastContainer);
		} catch (e) { toastContainer = null; }
	}

	function showToast(msg: string, opts: any = {}) {
		try {
			if (!toastContainer) return;
			const ttl = (typeof opts.ttl === 'number') ? opts.ttl : 2000;
			const el = rootDocument.createElement('div');
			el.style.background = 'rgba(20,20,30,0.9)';
			el.style.color = '#fff';
			el.style.padding = '8px 12px';
			el.style.marginTop = '6px';
			el.style.borderRadius = '6px';
			el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.5)';
			el.style.fontFamily = 'sans-serif';
			el.style.fontSize = '13px';
			el.style.pointerEvents = 'auto';
			el.textContent = msg;
			toastContainer.appendChild(el);
			setTimeout(() => { try { el.style.transition = 'opacity 300ms ease'; el.style.opacity = '0'; } catch (e) {}; setTimeout(() => { try { if (el && el.parentNode) el.parentNode.removeChild(el); } catch (err) {} }, 350); }, ttl);
		} catch (e) {}
	}

	try {
		if (gm && typeof gm.on === 'function') {
			gm.on('levelup', (m: any) => {
				try {
					const ship = (m && m.ship) || null;
					const lvl = (m && m.newLevel) || (m && m.newLevel === 0 ? 0 : undefined);
					const who = ship && ship.team ? `${ship.team} ship` : 'Ship';
					const msg = `${who} leveled up to ${lvl}`;
					showToast(msg, { ttl: 2200 });
				} catch (e) {}
			});
		}
	} catch (e) {}

	if (workerIndicator) {
		try { workerIndicator.textContent = (gm.isWorker && gm.isWorker()) ? 'Worker' : 'Main'; (function refresh() { try { workerIndicator.textContent = (gm.isWorker && gm.isWorker()) ? 'Worker' : 'Main'; requestAnimationFrame(refresh); } catch (e) {} }()); } catch (e) { workerIndicator.textContent = 'Unknown'; }
	}

	try { ui.startPause.addEventListener('click', () => { if (gm.isRunning()) { gm.pause(); ui.startPause.textContent = '▶ Start'; } else { gm.start(); ui.startPause.textContent = '⏸ Pause'; } }); } catch (e) {}
	try { ui.reset.addEventListener('click', () => gm.reset()); } catch (e) {}
	try { ui.addRed.addEventListener('click', () => gm.spawnShip('red')); } catch (e) {}
	try { ui.addBlue.addEventListener('click', () => gm.spawnShip('blue')); } catch (e) {}
	function onSeedBtnClick() {
		try {
			const raw = (typeof window !== 'undefined' && typeof window.prompt === 'function') ? window.prompt('Enter new seed (leave blank for random):', '') : null;
			if (raw == null) return;
			const trimmed = String(raw).trim();
			if (trimmed === '') { try { gm.reseed(); showToast('Reseeded with random seed'); } catch (e) {} return; }
			const asNum = Number(trimmed);
			if (!Number.isFinite(asNum) || Math.floor(asNum) !== asNum) { try { showToast('Invalid seed. Please enter an integer.'); } catch (e) {} return; }
			try { gm.reseed(asNum >>> 0); showToast(`Reseeded with ${asNum >>> 0}`); } catch (e) {}
		} catch (e) {}
	}
	try { ui.seedBtn.addEventListener('click', onSeedBtnClick); } catch (e) {}
	// try { ui.formationBtn.addEventListener('click', () => gm.formFleets()); } catch (e) {}
	try { if (ui.continuousCheckbox) { ui.continuousCheckbox.addEventListener('change', (ev: any) => { const v = !!ev.target.checked; if (gm && typeof gm.setContinuousEnabled === 'function') gm.setContinuousEnabled(v); }); } } catch (e) {}

	function uiTick() {
		try {
			const s = gm.snapshot();
			ui.redScore.textContent = `Red ${gm.score.red}`;
			ui.blueScore.textContent = `Blue ${gm.score.blue}`;
			const redCount = s.ships.filter((sh: any) => sh.team === 'red').length;
			const blueCount = s.ships.filter((sh: any) => sh.team === 'blue').length;
			ui.stats.textContent = `Ships: ${s.ships.length} (R:${redCount} B:${blueCount}) Bullets: ${s.bullets.length}` + (lastReinforcementSummary ? ` | ${lastReinforcementSummary}` : '');
		} catch (e) {}
		requestAnimationFrame(uiTick);
	}
	requestAnimationFrame(uiTick);
	return { gm, renderer };
}

if (typeof window !== 'undefined') {
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => startApp(document));
	else startApp(document);
}

export default startApp;
