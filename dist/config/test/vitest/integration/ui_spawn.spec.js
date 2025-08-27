import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import startApp from '../../../src/main';
import * as fs from 'fs';
import * as path from 'path';
describe('UI spawn buttons', () => {
    let session = null;
    beforeEach(async () => {
        // Load the UI HTML into the test document
        const uiHtml = fs.readFileSync(path.resolve(__dirname, '../../../src/ui.html'), 'utf8');
        document.body.innerHTML = uiHtml;
        // Ensure there's a canvas element for renderer
        const c = document.getElementById('world');
        if (!c) {
            const el = document.createElement('canvas');
            el.id = 'world';
            document.body.appendChild(el);
        }
        session = await startApp(document);
    });
    afterEach(() => {
        if (session && typeof session.dispose === 'function')
            session.dispose();
        session = null;
        document.body.innerHTML = '';
    });
    it('clicking #addRed spawns a red ship', async () => {
        const addRed = document.getElementById('addRed');
        expect(addRed).toBeTruthy();
        addRed.dispatchEvent(new MouseEvent('click'));
        // gm should be attached to window by startApp
        const gm = window.gm;
        expect(gm).toBeTruthy();
        // snapshot and find a red ship
        const snap = gm.snapshot ? gm.snapshot() : { ships: [] };
        const red = (snap.ships || []).find((s) => s.team === 'red');
        expect(red).toBeTruthy();
    });
    it('clicking #addBlue spawns a blue ship', async () => {
        const addBlue = document.getElementById('addBlue');
        expect(addBlue).toBeTruthy();
        addBlue.dispatchEvent(new MouseEvent('click'));
        const gm = window.gm;
        expect(gm).toBeTruthy();
        const snap = gm.snapshot ? gm.snapshot() : { ships: [] };
        const blue = (snap.ships || []).find((s) => s.team === 'blue');
        expect(blue).toBeTruthy();
    });
});
