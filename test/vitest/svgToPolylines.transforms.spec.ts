import { describe, it, expect } from 'vitest';
import { svgToPolylines } from '../../src/assets/svgToPolylines';

function ptsToAttr(pts: number[][]) {
  return pts.map(([x, y]) => `${x},${y}`).join(' ');
}

function mulMat(a: number[], b: number[]) {
  const [a1,a2,a3,a4,a5,a6] = a; const [b1,b2,b3,b4,b5,b6] = b;
  return [
    a1*b1 + a3*b2,
    a2*b1 + a4*b2,
    a1*b3 + a3*b4,
    a2*b3 + a4*b4,
    a1*b5 + a3*b6 + a5,
    a2*b5 + a4*b6 + a6,
  ];
}

function applyMatToPoint(m: number[], p: number[]) {
  const [a,b,c,d,e,f] = m; const [x,y] = p;
  return [a*x + c*y + e, b*x + d*y + f];
}

function translateMat(tx: number, ty: number) { return [1,0,0,1,tx,ty]; }
function scaleMat(sx: number, sy: number) { return [sx,0,0,sy,0,0]; }
function rotateMatDeg(angleDeg: number, cx = 0, cy = 0) {
  const a = (angleDeg * Math.PI) / 180;
  const cosA = Math.cos(a), sinA = Math.sin(a);
  if (cx === 0 && cy === 0) return [cosA, sinA, -sinA, cosA, 0, 0];
  // translate(cx,cy) * rot * translate(-cx,-cy)
  const to = translateMat(cx, cy);
  const rot = [cosA, sinA, -sinA, cosA, 0, 0];
  const back = translateMat(-cx, -cy);
  return mulMat(to, mulMat(rot, back));
}

function approxEqualArrays(a: number[][], b: number[][], eps = 1e-6) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i][0] - b[i][0]) > eps) return false;
    if (Math.abs(a[i][1] - b[i][1]) > eps) return false;
  }
  return true;
}

describe('svgToPolylines transforms', () => {
  const basePts = [[10,10],[40,10],[10,40]];

  it('applies translate()', () => {
    const svgTrans = `<svg viewBox="0 0 100 100"><g transform="translate(10,0)"><polygon points="${ptsToAttr(basePts)}"/></g></svg>`;
    const baked = basePts.map(p => applyMatToPoint(translateMat(10,0), p));
    const svgBaked = `<svg viewBox="0 0 100 100"><polygon points="${ptsToAttr(baked)}"/></svg>`;

    const r1 = svgToPolylines(svgTrans, { tolerance: 0.01 });
    const r2 = svgToPolylines(svgBaked, { tolerance: 0.01 });
    expect(r1.contours.length).toBeGreaterThan(0);
    expect(r2.contours.length).toBeGreaterThan(0);
    expect(approxEqualArrays(r1.contours[0], r2.contours[0], 1e-3)).toBeTruthy();
  });

  it('applies rotate(angle cx cy)', () => {
    const cx = 50, cy = 50; const angle = 90;
    const svgTrans = `<svg viewBox="0 0 100 100"><g transform="rotate(${angle} ${cx} ${cy})"><polygon points="${ptsToAttr(basePts)}"/></g></svg>`;
    const mat = rotateMatDeg(angle, cx, cy);
    const baked = basePts.map(p => applyMatToPoint(mat, p));
    const svgBaked = `<svg viewBox="0 0 100 100"><polygon points="${ptsToAttr(baked)}"/></svg>`;
    const r1 = svgToPolylines(svgTrans, { tolerance: 0.01 });
    const r2 = svgToPolylines(svgBaked, { tolerance: 0.01 });
    expect(r1.contours.length).toBeGreaterThan(0);
    expect(r2.contours.length).toBeGreaterThan(0);
    expect(approxEqualArrays(r1.contours[0], r2.contours[0], 1e-3)).toBeTruthy();
  });

  it('applies scale()', () => {
    const svgTrans = `<svg viewBox="0 0 100 100"><g transform="scale(2,1)"><polygon points="${ptsToAttr(basePts)}"/></g></svg>`;
    const mat = scaleMat(2,1);
    const baked = basePts.map(p => applyMatToPoint(mat, p));
    const svgBaked = `<svg viewBox="0 0 100 100"><polygon points="${ptsToAttr(baked)}"/></svg>`;
    const r1 = svgToPolylines(svgTrans, { tolerance: 0.01 });
    const r2 = svgToPolylines(svgBaked, { tolerance: 0.01 });
    expect(r1.contours.length).toBeGreaterThan(0);
    expect(r2.contours.length).toBeGreaterThan(0);
    expect(approxEqualArrays(r1.contours[0], r2.contours[0], 1e-3)).toBeTruthy();
  });

  it('applies nested group transforms (parent translate + child scale)', () => {
    const svgTrans = `<svg viewBox="0 0 100 100"><g transform="translate(10,5)"><g transform="scale(2)"><polygon points="${ptsToAttr(basePts)}"/></g></g></svg>`;
    // child scale then parent translate -> combined mat = parent * child
    const mat = mulMat(translateMat(10,5), scaleMat(2,2));
    const baked = basePts.map(p => applyMatToPoint(mat, p));
    const svgBaked = `<svg viewBox="0 0 100 100"><polygon points="${ptsToAttr(baked)}"/></svg>`;
    const r1 = svgToPolylines(svgTrans, { tolerance: 0.01 });
    const r2 = svgToPolylines(svgBaked, { tolerance: 0.01 });
    expect(r1.contours.length).toBeGreaterThan(0);
    expect(r2.contours.length).toBeGreaterThan(0);
    expect(approxEqualArrays(r1.contours[0], r2.contours[0], 1e-3)).toBeTruthy();
  });
});
