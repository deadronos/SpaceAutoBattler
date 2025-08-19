import { initRenderer, stopRenderer } from './renderer.js';

const leftCanvas = document.getElementById('leftCanvas');
const rightCanvas = document.getElementById('rightCanvas');

let activeSide = 'left'; // 'left' or 'right'

async function startRendererFor(side){
	try {
		stopRenderer();
	} catch (e) {}
	const canvas = side === 'left' ? leftCanvas : rightCanvas;
	const preferWebGL = side === 'left';
	await initRenderer({ canvas, preferWebGL, startLoop: true });
	activeSide = side;
}

document.getElementById('seedLeft').addEventListener('click', ()=>{ location.reload(); });
document.getElementById('seedRight').addEventListener('click', ()=>{ location.reload(); });

document.getElementById('toggleLeft').addEventListener('click', async ()=>{ await startRendererFor('left'); });
document.getElementById('toggleRight').addEventListener('click', async ()=>{ await startRendererFor('right'); });

// Start with left by default
startRendererFor('left').catch(err=>console.error(err));

export {};
