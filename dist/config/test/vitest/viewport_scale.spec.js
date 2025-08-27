import { describe, it, expect } from 'vitest';
// Simulate fitCanvasToWindow logic for scale/offset
function computeFitScale(winW, winH, logicalW, logicalH, rendererScale) {
    const fitScale = Math.min(winW / logicalW, winH / logicalH);
    const finalScale = fitScale * rendererScale;
    const offsetX = Math.floor((winW - logicalW * finalScale) / 2);
    const offsetY = Math.floor((winH - logicalH * finalScale) / 2);
    return { fitScale, finalScale, offsetX, offsetY };
}
describe('Viewport scaling logic', () => {
    it('fills canvas at scale=1.0, 16:9 window', () => {
        const logicalW = 1920, logicalH = 1080;
        const winW = 1920, winH = 1080;
        const rendererScale = 1.0;
        const { finalScale, offsetX, offsetY } = computeFitScale(winW, winH, logicalW, logicalH, rendererScale);
        expect(finalScale).toBeCloseTo(1.0);
        expect(offsetX).toBe(0);
        expect(offsetY).toBe(0);
    });
    it('centers logical area with aspect padding', () => {
        const logicalW = 1920, logicalH = 1080;
        const winW = 1920, winH = 1200; // taller window
        const rendererScale = 1.0;
        const { offsetX, offsetY } = computeFitScale(winW, winH, logicalW, logicalH, rendererScale);
        expect(offsetX).toBe(0);
        expect(offsetY).toBeGreaterThan(0);
    });
    it('scales up with rendererScale > 1', () => {
        const logicalW = 1920, logicalH = 1080;
        const winW = 1920, winH = 1080;
        const rendererScale = 1.5;
        const { finalScale } = computeFitScale(winW, winH, logicalW, logicalH, rendererScale);
        expect(finalScale).toBeCloseTo(1.5);
    });
});
