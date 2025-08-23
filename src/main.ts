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

	// Always use fixed logical bounds for simulation/game loop
	const LOGICAL_BOUNDS = getDefaultBounds();
	// Only update backing store when renderScale changes
	function updateCanvasBackingStore() {
		const dpr = window.devicePixelRatio || 1;
		const renderScale = (RendererConfig && typeof (RendererConfig as any).renderScale === 'number') ? (RendererConfig as any).renderScale : 1;
		const logicalW = LOGICAL_BOUNDS.W;
		const logicalH = LOGICAL_BOUNDS.H;
		if (canvas) {
			canvas.width = Math.round(logicalW * renderScale / dpr);
			canvas.height = Math.round(logicalH * renderScale / dpr);
			const dimsEl = document.getElementById('rendererDims');
			if (dimsEl) {
				dimsEl.textContent = `${canvas.width} x ${canvas.height} px @ ${dpr}x`;
			}
		}
		(RendererConfig as any)._renderScale = renderScale;
		(RendererConfig as any)._offsetX = 0;
		(RendererConfig as any)._offsetY = 0;
		const scaleVal = rootDocument.getElementById('rendererScaleValue');
		if (scaleVal) scaleVal.textContent = renderScale.toFixed(2);
	}

	// Only update CSS size on window resize
	function fitCanvasToWindow() {
		const winW = window.innerWidth;
		const winH = window.innerHeight;
		const logicalW = LOGICAL_BOUNDS.W;
		const logicalH = LOGICAL_BOUNDS.H;
		const fitScale = Math.min(winW / logicalW, winH / logicalH);
		const visibleW = Math.round(logicalW * fitScale);
		const visibleH = Math.round(logicalH * fitScale);
		if (canvas) {
			canvas.style.width = `${visibleW}px`;
			canvas.style.height = `${visibleH}px`;
			canvas.style.position = 'absolute';
			canvas.style.left = '0px';
			canvas.style.top = '0px';
		}
	}
	// Renderer scale slider and dynamic scaling wiring
	const scaleSlider = rootDocument.getElementById('rendererScaleRange');
	const dynamicCheckbox = rootDocument.getElementById('dynamicScaleCheckbox');
	let internalScaleUpdate = false;
	if (scaleSlider) {
		scaleSlider.addEventListener('input', (ev: any) => {
			if (internalScaleUpdate) return; // ignore internal updates
			const val = parseFloat(ev.target.value);
			if (!isNaN(val)) {
				(RendererConfig as any).renderScale = val;
				(RendererConfig as any).dynamicScaleEnabled = false;
				if (dynamicCheckbox) (dynamicCheckbox as HTMLInputElement).checked = false;
				updateCanvasBackingStore();
			}
		});
		// Set initial value display
		const scaleVal = rootDocument.getElementById('rendererScaleValue');
		if (scaleVal) scaleVal.textContent = (scaleSlider as HTMLInputElement).value;
		// Ensure initial fit-to-window calculation uses current scale
		updateCanvasBackingStore();
		fitCanvasToWindow();
	}
	if (dynamicCheckbox) {
		dynamicCheckbox.addEventListener('change', (ev: any) => {
			const enabled = !!ev.target.checked;
			(RendererConfig as any).dynamicScaleEnabled = enabled;
		});
	(dynamicCheckbox as HTMLInputElement).checked = !!(RendererConfig as any).dynamicScaleEnabled;
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
	// Pass fixed logical bounds to game manager
	const gm = createGameManager({ renderer, useWorker: false, seed: 12345 });
	if (gm && gm._internal) gm._internal.bounds = LOGICAL_BOUNDS;
	try { if (typeof window !== 'undefined' && (window as any).gm) Object.assign((window as any).gm, gm); } catch (e) {}

	// Speed multiplier logic
	let simSpeedMultiplier = 1;
	if (ui.speed) {
		ui.speed.addEventListener('click', () => {
			simSpeedMultiplier = simSpeedMultiplier >= 4 ? 0.25 : simSpeedMultiplier * 2;
			ui.speed.textContent = `Speed: ${simSpeedMultiplier}×`;
		});
		ui.speed.textContent = `Speed: ${simSpeedMultiplier}×`;
	}

	// Patch stepOnce to use multiplier
	if (gm && typeof gm.stepOnce === 'function') {
		const origStepOnce = gm.stepOnce.bind(gm);
		gm.stepOnce = (dt = 0.016) => origStepOnce(dt * simSpeedMultiplier);
	}

	// Fleet formation logic
	if (ui.formationBtn) {
		ui.formationBtn.addEventListener('click', () => {
			if (gm && typeof gm.formFleets === 'function') {
				gm.formFleets();
			}
		});
	}

	// Engine trail UI toggle state
	let engineTrailsEnabled = true;
	if (gm && gm._internal && gm._internal.state) {
		gm._internal.state.engineTrailsEnabled = engineTrailsEnabled;
	}
	if (ui.toggleTrails) {
		ui.toggleTrails.addEventListener('click', () => {
			engineTrailsEnabled = !engineTrailsEnabled;
			if (gm && gm._internal && gm._internal.state) {
				gm._internal.state.engineTrailsEnabled = engineTrailsEnabled;
			}
			ui.toggleTrails.textContent = engineTrailsEnabled ? '☄ Trails: On' : '☄ Trails: Off';
		});
		ui.toggleTrails.textContent = engineTrailsEnabled ? '☄ Trails: On' : '☄ Trails: Off';
	}

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
		// --- Dynamic buffer scaling logic ---
		const dynamicEnabled = !!(RendererConfig as any).dynamicScaleEnabled;
		const scaleSliderEl = rootDocument.getElementById('rendererScaleRange') as HTMLInputElement;
		const scaleValEl = rootDocument.getElementById('rendererScaleValue');
		// Track frame time
		const now = performance.now();
		(RendererConfig as any)._lastUiTick = (RendererConfig as any)._lastUiTick || now;
		const dt = now - (RendererConfig as any)._lastUiTick;
		(RendererConfig as any)._lastUiTick = now;
		(RendererConfig as any).lastFrameTime = dt;
		// Score frame time
		let frameScore = 'green';
		if (dt > 33) frameScore = 'red';
		else if (dt > 20) frameScore = 'yellow';
		(RendererConfig as any).frameScore = frameScore;
		// Color slider value for feedback
		if (scaleValEl) {
			scaleValEl.style.color = frameScore === 'green' ? '#4caf50' : frameScore === 'yellow' ? '#ffd600' : '#ff1744';
		}
		// Dynamic scaling logic
		if (dynamicEnabled && scaleSliderEl) {
			let scale = (RendererConfig as any).renderScale;
			// If frame is slow, reduce scale; if fast, increase scale
			if (frameScore === 'red' && scale > 0.25) scale = Math.max(0.25, scale - 0.05);
			else if (frameScore === 'green' && scale < 2.0) scale = Math.min(2.0, scale + 0.01);
			// Only update if changed
			if (scale !== (RendererConfig as any).renderScale) {
				(RendererConfig as any).renderScale = scale;
				internalScaleUpdate = true;
				scaleSliderEl.value = scale.toFixed(2);
				if (scaleValEl) scaleValEl.textContent = scale.toFixed(2);
				fitCanvasToWindow();
				internalScaleUpdate = false;
			}
		}
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
