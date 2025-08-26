// svgToPolylines.ts
// Utility to parse SVG and extract polygonal hull outlines for shield/collision use
// Lightweight implementation: depends on global DOMParser (available in jsdom/test envs)
// Supports <polygon>, <polyline>, <rect>, <circle>, <ellipse>, and basic <path> commands (M/L/H/V/Z).
// Coordinates are normalized to viewBox-centered unit space: x' = (x - vb.w/2)/(vb.w/2)
// so that multiplying by ship.radius produces pixel offsets used by the renderer.

import { polygonSimplify } from "../math/polygon";

// Simple in-memory cache for svg->polylines results keyed by a hash of the svg string + tolerance.
// Keeps insertion order (Map) so we can evict oldest entries when over capacity.
const SVG_POLY_CACHE = new Map<string, { ts: number; value: SvgPolylinesResult }>();
const CACHE_MAX_ENTRIES = 200; // evict oldest when exceeded
const CACHE_MAX_AGE_MS = 1000 * 60 * 60; // 1 hour
let CACHE_HITS = 0;
let CACHE_MISSES = 0;

export function getSvgPolylinesCacheStats() {
  return { hits: CACHE_HITS, misses: CACHE_MISSES, entries: SVG_POLY_CACHE.size };
}

export function resetSvgPolylinesCacheStats() {
  CACHE_HITS = 0;
  CACHE_MISSES = 0;
}

export function clearSvgPolylinesCache() {
  SVG_POLY_CACHE.clear();
}

function hashStringToKey(s: string) {
  // FNV-1a 32-bit
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(36);
}


export interface SvgPolylinesResult {
  contours: number[][][]; // Array of polylines (each: array of [x, y] pairs)
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
  convexHull?: number[][];
}

export interface SvgToPolylinesOptions {
  tolerance?: number; // Curve flattening / simplify tolerance (default: 0.5)
  assetId?: string; // optional asset identifier to key cache
}

function parseViewBox(svgEl: SVGSVGElement | Element | null) {
  const vbAttr = svgEl && (svgEl.getAttribute && svgEl.getAttribute("viewBox"));
  if (vbAttr) {
    const parts = vbAttr.trim().split(/[,\s]+/).map((s) => parseFloat(s));
    if (parts.length >= 4 && parts.every((n) => !Number.isNaN(n))) {
      return { x: parts[0], y: parts[1], w: parts[2], h: parts[3] };
    }
  }
  // fallback to width/height attributes or default 128x128
  if (svgEl && svgEl.getAttribute) {
    const wAttr = svgEl.getAttribute("width");
    const hAttr = svgEl.getAttribute("height");
    const w = wAttr ? parseFloat(wAttr) || 128 : 128;
    const h = hAttr ? parseFloat(hAttr) || 128 : 128;
    return { x: 0, y: 0, w, h };
  }
  return { x: 0, y: 0, w: 128, h: 128 };
}

// Matrix helpers: SVG matrix [a b c d e f] maps (x,y) -> (a*x + c*y + e, b*x + d*y + f)
type Matrix = [number, number, number, number, number, number];
const IDENTITY_MATRIX: Matrix = [1, 0, 0, 1, 0, 0];
function multiplyMatrix(a: Matrix, b: Matrix): Matrix {
  // a * b
  const [a1, a2, a3, a4, a5, a6] = a;
  const [b1, b2, b3, b4, b5, b6] = b;
  return [
    a1 * b1 + a3 * b2,
    a2 * b1 + a4 * b2,
    a1 * b3 + a3 * b4,
    a2 * b3 + a4 * b4,
    a1 * b5 + a3 * b6 + a5,
    a2 * b5 + a4 * b6 + a6,
  ];
}
function applyMatrixToPoint(m: Matrix, x: number, y: number): [number, number] {
  const [a, b, c, d, e, f] = m;
  return [a * x + c * y + e, b * x + d * y + f];
}
function applyMatrixToPoints(m: Matrix, pts: number[][]) {
  for (let i = 0; i < pts.length; i++) {
    const [x, y] = pts[i];
    const p = applyMatrixToPoint(m, x, y);
    pts[i][0] = p[0]; pts[i][1] = p[1];
  }
}

function isIdentityMatrix(m: Matrix) {
  return m[0] === 1 && m[1] === 0 && m[2] === 0 && m[3] === 1 && m[4] === 0 && m[5] === 0;
}

function parseTransform(transformStr: string | null): Matrix {
  if (!transformStr) return IDENTITY_MATRIX;
  let m: Matrix = IDENTITY_MATRIX;
  // e.g. translate(10,20) rotate(30) scale(2) matrix(a b c d e f)
  const re = /([a-zA-Z]+)\s*\(([^)]+)\)/g;
  let mm: RegExpExecArray | null;
  while ((mm = re.exec(transformStr))) {
    const cmd = mm[1].trim();
    const raw = mm[2].trim();
    const nums = raw.split(/[\s,]+/).filter(Boolean).map((s) => parseFloat(s));
    let t: Matrix = IDENTITY_MATRIX;
    try {
      if (cmd === 'matrix' && nums.length >= 6) {
        t = [nums[0], nums[1], nums[2], nums[3], nums[4], nums[5]] as Matrix;
      } else if (cmd === 'translate') {
        const tx = nums[0] || 0; const ty = nums[1] || 0; t = [1,0,0,1,tx,ty] as Matrix;
      } else if (cmd === 'scale') {
        const sx = nums[0] || 1; const sy = typeof nums[1] === 'number' ? nums[1] : sx; t = [sx,0,0,sy,0,0] as Matrix;
      } else if (cmd === 'rotate') {
        const a = (nums[0] || 0) * Math.PI / 180;
        const cosA = Math.cos(a), sinA = Math.sin(a);
        if (nums.length >= 3) {
          const cx = nums[1], cy = nums[2];
          // translate(cx,cy) * rotate * translate(-cx,-cy)
          const to = [1,0,0,1,cx,cy] as Matrix;
          const rot = [cosA, sinA, -sinA, cosA, 0, 0] as Matrix;
          const back = [1,0,0,1,-cx,-cy] as Matrix;
          t = multiplyMatrix(to, multiplyMatrix(rot, back));
        } else {
          t = [cosA, sinA, -sinA, cosA, 0, 0] as Matrix;
        }
      } else if (cmd === 'skewX') {
        const a = (nums[0] || 0) * Math.PI / 180; t = [1,0,Math.tan(a),1,0,0] as Matrix;
      } else if (cmd === 'skewY') {
        const a = (nums[0] || 0) * Math.PI / 180; t = [1,Math.tan(a),0,1,0,0] as Matrix;
      }
    } catch (e) { t = IDENTITY_MATRIX; }
    // concatenation: new total = m * t (apply t after existing)
    m = multiplyMatrix(m, t);
  }
  return m;
}

function computeCumulativeTransform(el: Element | null, svgEl: Element | null): Matrix {
  let m: Matrix = IDENTITY_MATRIX;
  const chain: Element[] = [];
  let cur: Element | null = el as Element | null;
  while (cur && cur !== svgEl && cur.nodeType === 1) {
    chain.push(cur);
    cur = cur.parentElement;
  }
  // include svgEl transform if present
  if (svgEl && svgEl !== el) chain.push(svgEl as Element);
  // accumulate from root down to element
  for (let i = chain.length - 1; i >= 0; i--) {
    const e = chain[i];
    try {
      const t = parseTransform(e.getAttribute && e.getAttribute('transform'));
      m = multiplyMatrix(m, t);
    } catch (e) {}
  }
  return m;
}

function parsePointsAttr(val: string) {
  const parts = val.trim().split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
  const pts: number[][] = [];
  for (let i = 0; i + 1 < parts.length; i += 2) {
    const x = parseFloat(parts[i]);
    const y = parseFloat(parts[i + 1]);
    if (!Number.isNaN(x) && !Number.isNaN(y)) pts.push([x, y]);
  }
  return pts;
}

function applyViewBoxNormalization(points: number[][], vb: { x: number; y: number; w: number; h: number }) {
  // Normalize coordinates into renderer-local unit space centered at viewBox center.
  // Correctly account for viewBox minX/minY (vb.x, vb.y). Previous logic incorrectly
  // subtracted half-width/height instead of viewBox origin + half-size which broke
  // assets with non-zero viewBox origins.
  const hw = (vb.w || 1) / 2;
  const hh = (vb.h || 1) / 2;
  const cx = (vb.x || 0) + hw;
  const cy = (vb.y || 0) + hh;
  return points.map(([x, y]) => [((x - cx) / hw) as number, ((y - cy) / hh) as number]);
}

function sampleCircle(cx: number, cy: number, r: number, segments = 48) {
  const pts: number[][] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

// Path parser: supports M/m, L/l, H/h, V/v, Z/z, C/c, S/s, Q/q, T/t, A/a with curve flattening.
function parsePathCommands(d: string, tolerance: number) {
  // Enhanced path parser supporting M/m, L/l, H/h, V/v, Z/z, C/c, S/s, Q/q, T/t, A/a
  const tokens = d.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
  const cmdRe = /([MmLlHhVvZzCcSsQqTtAa])([^MmLlHhVvZzCcSsQqTtAa]*)/g;
  const pts: number[][] = [];
  let curX = 0,
    curY = 0;
  let lastCpx: number | null = null,
    lastCpy: number | null = null; // for S/T shorthand
  let m: RegExpExecArray | null;
  while ((m = cmdRe.exec(tokens))) {
    const cmd = m[1];
    const rawArgs = m[2].trim();
    const args = rawArgs ? rawArgs.split(/[\s,]+/).filter(Boolean).map((s) => parseFloat(s)) : [];
    let ai = 0;
    if (cmd === 'Z' || cmd === 'z') {
      // close path -> no-op for now
      continue;
    }
    if (cmd === 'H' || cmd === 'h') {
      while (ai < args.length) {
        const x = args[ai++];
        curX = cmd === 'h' ? curX + x : x;
        pts.push([curX, curY]);
      }
      lastCpx = lastCpy = null;
      continue;
    }
    if (cmd === 'V' || cmd === 'v') {
      while (ai < args.length) {
        const y = args[ai++];
        curY = cmd === 'v' ? curY + y : y;
        pts.push([curX, curY]);
      }
      lastCpx = lastCpy = null;
      continue;
    }
    // M/m and L/l
    if (cmd === 'M' || cmd === 'm' || cmd === 'L' || cmd === 'l') {
      while (ai + 1 < args.length) {
        const ax = args[ai++], ay = args[ai++];
        if (cmd === 'm' || cmd === 'l') {
          curX += ax; curY += ay;
        } else {
          curX = ax; curY = ay;
        }
        pts.push([curX, curY]);
      }
      lastCpx = lastCpy = null;
      continue;
    }
    // Cubic commands C/c: (x1 y1 x2 y2 x y)+
    if (cmd === 'C' || cmd === 'c') {
      while (ai + 5 < args.length) {
        const x1 = args[ai++], y1 = args[ai++], x2 = args[ai++], y2 = args[ai++], x = args[ai++], y = args[ai++];
        const cp1x = cmd === 'c' ? curX + x1 : x1;
        const cp1y = cmd === 'c' ? curY + y1 : y1;
        const cp2x = cmd === 'c' ? curX + x2 : x2;
        const cp2y = cmd === 'c' ? curY + y2 : y2;
        const ex = cmd === 'c' ? curX + x : x;
        const ey = cmd === 'c' ? curY + y : y;
  // flatten cubic from (curX,curY) -> (ex,ey)
  const cubicPts = flattenCubicBezier([curX, curY], [cp1x, cp1y], [cp2x, cp2y], [ex, ey], tolerance);
  // append (skip initial duplicate if present)
  for (let i = 1; i < cubicPts.length; i++) pts.push(cubicPts[i]);
        curX = ex; curY = ey;
        lastCpx = cp2x; lastCpy = cp2y;
      }
      continue;
    }
    // Smooth cubic S/s: (x2 y2 x y)+ (reflect previous control)
    if (cmd === 'S' || cmd === 's') {
      while (ai + 3 < args.length) {
        const x2 = args[ai++], y2 = args[ai++], x = args[ai++], y = args[ai++];
        let cp1x = curX, cp1y = curY;
        if (lastCpx != null && lastCpy != null) {
          cp1x = curX + (curX - lastCpx);
          cp1y = curY + (curY - lastCpy);
        }
        const cp2x = cmd === 's' ? curX + x2 : x2;
        const cp2y = cmd === 's' ? curY + y2 : y2;
        const ex = cmd === 's' ? curX + x : x;
        const ey = cmd === 's' ? curY + y : y;
  const cubicPts2 = flattenCubicBezier([curX, curY], [cp1x, cp1y], [cp2x, cp2y], [ex, ey], tolerance);
  for (let i = 1; i < cubicPts2.length; i++) pts.push(cubicPts2[i]);
        lastCpx = cp2x; lastCpy = cp2y;
        curX = ex; curY = ey;
      }
      continue;
    }
    // Quadratic Q/q: (x1 y1 x y)+
    if (cmd === 'Q' || cmd === 'q') {
      while (ai + 3 < args.length) {
        const x1 = args[ai++], y1 = args[ai++], x = args[ai++], y = args[ai++];
        const qx1 = cmd === 'q' ? curX + x1 : x1;
        const qy1 = cmd === 'q' ? curY + y1 : y1;
        const ex = cmd === 'q' ? curX + x : x;
        const ey = cmd === 'q' ? curY + y : y;
  const qpts = flattenQuadraticBezier([curX, curY], [qx1, qy1], [ex, ey], tolerance);
  for (let i = 1; i < qpts.length; i++) pts.push(qpts[i]);
        lastCpx = qx1; lastCpy = qy1;
        curX = ex; curY = ey;
      }
      continue;
    }
    // Smooth quadratic T/t: (x y)+, reflect previous control point
    if (cmd === 'T' || cmd === 't') {
      while (ai + 1 < args.length) {
        const x = args[ai++], y = args[ai++];
        let qx1 = curX, qy1 = curY;
        if (lastCpx != null && lastCpy != null) {
          qx1 = curX + (curX - lastCpx);
          qy1 = curY + (curY - lastCpy);
        }
        const ex = cmd === 't' ? curX + x : x;
        const ey = cmd === 't' ? curY + y : y;
  const qpts2 = flattenQuadraticBezier([curX, curY], [qx1, qy1], [ex, ey], tolerance);
  for (let i = 1; i < qpts2.length; i++) pts.push(qpts2[i]);
        lastCpx = qx1; lastCpy = qy1;
        curX = ex; curY = ey;
      }
      continue;
    }
    // Arc A/a: (rx ry xAxisRotation large-arc-flag sweep-flag x y)+
    if (cmd === 'A' || cmd === 'a') {
      while (ai + 6 < args.length) {
        const rx = args[ai++], ry = args[ai++], xrot = args[ai++], laf = args[ai++], sf = args[ai++], x = args[ai++], y = args[ai++];
        const ex = cmd === 'a' ? curX + x : x;
        const ey = cmd === 'a' ? curY + y : y;
  const arcPts = arcToPoints(curX, curY, ex, ey, rx, ry, xrot, laf ? 1 : 0, sf ? 1 : 0, Math.max(0.1, tolerance));
        // arcPts includes start..end; skip first since it's cur point
        for (let i = 1; i < arcPts.length; i++) pts.push(arcPts[i]);
        curX = ex; curY = ey;
        lastCpx = lastCpy = null;
      }
      continue;
    }
    // Unknown command -> ignore
  }
  return pts;
}

// Helpers: flatten cubic/quadratic Beziers and approximate arcs
function distToSegmentSq(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1, dy = y2 - y1;
  if (dx === 0 && dy === 0) return (px - x1) * (px - x1) + (py - y1) * (py - y1);
  const t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
  if (t <= 0) return (px - x1) * (px - x1) + (py - y1) * (py - y1);
  if (t >= 1) return (px - x2) * (px - x2) + (py - y2) * (py - y2);
  const projx = x1 + t * dx, projy = y1 + t * dy;
  return (px - projx) * (px - projx) + (py - projy) * (py - projy);
}

function flattenCubicBezier(p0: number[], p1: number[], p2: number[], p3: number[], tolerance: number): number[][] {
  // recursive subdivision producing a sequence of points from p0..p3
  const tolSq = tolerance * tolerance;
  const out: number[][] = [];
  function recurse(a: number[], b: number[], c: number[], d: number[]) {
    const d1 = distToSegmentSq(b[0], b[1], a[0], a[1], d[0], d[1]);
    const d2 = distToSegmentSq(c[0], c[1], a[0], a[1], d[0], d[1]);
    if (Math.max(d1, d2) <= tolSq) {
      out.push([d[0], d[1]]);
      return;
    }
    // subdivide via de Casteljau
    const ab = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const bc = [(b[0] + c[0]) / 2, (b[1] + c[1]) / 2];
    const cd = [(c[0] + d[0]) / 2, (c[1] + d[1]) / 2];
    const abc = [(ab[0] + bc[0]) / 2, (ab[1] + bc[1]) / 2];
    const bcd = [(bc[0] + cd[0]) / 2, (bc[1] + cd[1]) / 2];
    const abcd = [(abc[0] + bcd[0]) / 2, (abc[1] + bcd[1]) / 2];
    recurse(a, ab, abc, abcd);
    recurse(abcd, bcd, cd, d);
  }
  // Start with the initial point
  out.push([p0[0], p0[1]]);
  recurse(p0, p1, p2, p3);
  return out;
}

function flattenQuadraticBezier(p0: number[], p1: number[], p2: number[], tolerance: number): number[][] {
  // convert to cubic and reuse cubic flattener
  const cp1 = [p0[0] + (2 / 3) * (p1[0] - p0[0]), p0[1] + (2 / 3) * (p1[1] - p0[1])];
  const cp2 = [p2[0] + (2 / 3) * (p1[0] - p2[0]), p2[1] + (2 / 3) * (p1[1] - p2[1])];
  const pts = flattenCubicBezier(p0, cp1, cp2, p2, tolerance);
  if (pts.length >= 4) return pts;
  // fallback: uniform sampling of quadratic if subdivision produced too few points
  const samples = 4;
  const out: number[][] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const mt = 1 - t;
    const x = mt * mt * p0[0] + 2 * mt * t * p1[0] + t * t * p2[0];
    const y = mt * mt * p0[1] + 2 * mt * t * p1[1] + t * t * p2[1];
    out.push([x, y]);
  }
  return out;
}

function arcToPoints(x1: number, y1: number, x2: number, y2: number, rx: number, ry: number, angle: number, largeArcFlag: number, sweepFlag: number, tolerance: number) {
  // Implementation based on SVG spec (convert endpoint to center parameterization)
  // angle in degrees
  const rad = (angle * Math.PI) / 180;
  const cosA = Math.cos(rad), sinA = Math.sin(rad);
  // Step 1: handle degenerate
  if (rx === 0 || ry === 0) return [[x1, y1], [x2, y2]];
  // Step 2: compute (x1', y1')
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
  const x1p = cosA * dx + sinA * dy;
  const y1p = -sinA * dx + cosA * dy;
  // ensure radii large enough
  let rxAbs = Math.abs(rx), ryAbs = Math.abs(ry);
  const lambda = (x1p * x1p) / (rxAbs * rxAbs) + (y1p * y1p) / (ryAbs * ryAbs);
  if (lambda > 1) {
    const s = Math.sqrt(lambda);
    rxAbs *= s; ryAbs *= s;
  }
  const rx2 = rxAbs * rxAbs, ry2 = ryAbs * ryAbs;
  const sign = largeArcFlag === sweepFlag ? -1 : 1;
  const num = rx2 * ry2 - rx2 * y1p * y1p - ry2 * x1p * x1p;
  const denom = rx2 * y1p * y1p + ry2 * x1p * x1p;
  let cc = 0;
  if (denom !== 0) cc = Math.max(0, num / denom);
  const coef = sign * Math.sqrt(cc || 0);
  const cxp = (coef * (rxAbs * y1p)) / ryAbs;
  const cyp = (coef * -(ryAbs * x1p)) / rxAbs;
  // center in original coords
  const cx = cosA * cxp - sinA * cyp + (x1 + x2) / 2;
  const cy = sinA * cxp + cosA * cyp + (y1 + y2) / 2;
  // angles
  function angleBetween(ux: number, uy: number, vx: number, vy: number) {
    const dot = ux * vx + uy * vy;
    const l = Math.hypot(ux, uy) * Math.hypot(vx, vy);
    let a = Math.acos(Math.max(-1, Math.min(1, dot / (l || 1))));
    if (ux * vy - uy * vx < 0) a = -a;
    return a;
  }
  const ux = (x1p - cxp) / rxAbs, uy = (y1p - cyp) / ryAbs;
  const vx = (-x1p - cxp) / rxAbs, vy = (-y1p - cyp) / ryAbs;
  let startAng = angleBetween(1, 0, ux, uy);
  let deltaAng = angleBetween(ux, uy, vx, vy);
  if (!sweepFlag && deltaAng > 0) deltaAng -= 2 * Math.PI;
  else if (sweepFlag && deltaAng < 0) deltaAng += 2 * Math.PI;
  // choose number of segments based on arc length and tolerance
  const r = Math.max(rxAbs, ryAbs);
  const estLen = Math.abs(deltaAng) * r;
  const segCount = Math.max(4, Math.ceil(estLen / Math.max(1, tolerance * 4)));
  const pts: number[][] = [];
  for (let i = 0; i <= segCount; i++) {
    const t = i / segCount;
    const ang = startAng + t * deltaAng;
    const cosAng = Math.cos(ang), sinAng = Math.sin(ang);
    const xp = rxAbs * cosAng;
    const yp = ryAbs * sinAng;
    const x = cosA * xp - sinA * yp + cx;
    const y = sinA * xp + cosA * yp + cy;
    pts.push([x, y]);
  }
  return pts;
}

export function svgToPolylines(svgString: string, options: SvgToPolylinesOptions = {}): SvgPolylinesResult {
  const tolerance = typeof options.tolerance === 'number' ? options.tolerance : 0.1;
  // Attempt cache lookup
  try {
    const key = options && options.assetId ? `${options.assetId}::${tolerance}` : hashStringToKey(svgString + '::' + tolerance);
    const entry = SVG_POLY_CACHE.get(key);
    if (entry) {
      // check age
      if (Date.now() - entry.ts < CACHE_MAX_AGE_MS) {
        // move to back (most recent)
        SVG_POLY_CACHE.delete(key);
        SVG_POLY_CACHE.set(key, entry);
        CACHE_HITS++;
        return entry.value;
      }
      // expired
      SVG_POLY_CACHE.delete(key);
      CACHE_MISSES++;
    } else {
      CACHE_MISSES++;
    }
  } catch (e) {}
  // Use global DOMParser when available
  const DP = (globalThis as any).DOMParser;
  if (!DP) {
    // In very restricted envs, attempt to fallback with a minimal regex-based extraction
    // but prefer envs with DOMParser (jsdom in tests)
    throw new Error('DOMParser not available in this environment');
  }
  const parser = new DP();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const svgEl = doc.querySelector('svg') || doc.documentElement;
  const vb = parseViewBox(svgEl as any);

  const contours: number[][][] = [];

  // Helper to push normalized contour (and simplify)
  function pushContour(raw: number[][]) {
    if (!raw || raw.length === 0) return;
    // close if not closed
    const first = raw[0];
    const last = raw[raw.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      // do not force duplicate closing point; many consumers expect open polygons
    }
    const norm = applyViewBoxNormalization(raw, vb);
    // simplify
    const simp = polygonSimplify(norm as any, tolerance as number) as number[][];
    if (simp && simp.length >= 2) contours.push(simp);
  }

  // polygon / polyline
  const polys = Array.from(doc.querySelectorAll('polygon, polyline')) as Element[];
  for (const el of polys) {
    const ptsAttr = (el as Element).getAttribute('points') || '';
    const pts = parsePointsAttr(ptsAttr);
    try {
      const mtx = computeCumulativeTransform(el, svgEl as Element);
      if (!isIdentityMatrix(mtx) && pts.length) applyMatrixToPoints(mtx, pts);
    } catch (e) {}
    pushContour(pts);
  }

  // rect
  const rects = Array.from(doc.querySelectorAll('rect')) as Element[];
  for (const r of rects) {
    const x = parseFloat((r as Element).getAttribute('x') || '0');
    const y = parseFloat((r as Element).getAttribute('y') || '0');
    const w = parseFloat((r as Element).getAttribute('width') || '0');
    const h = parseFloat((r as Element).getAttribute('height') || '0');
    const pts = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
    try {
      const mtx = computeCumulativeTransform(r, svgEl as Element);
      if (!isIdentityMatrix(mtx)) applyMatrixToPoints(mtx, pts);
    } catch (e) {}
    pushContour(pts);
  }

  // circle
  const circles = Array.from(doc.querySelectorAll('circle')) as Element[];
  for (const c of circles) {
    const cx = parseFloat((c as Element).getAttribute('cx') || '0');
    const cy = parseFloat((c as Element).getAttribute('cy') || '0');
    const r = parseFloat((c as Element).getAttribute('r') || '0');
    if (r > 0) {
      const pts = sampleCircle(cx, cy, r, 24);
      try {
        const mtx = computeCumulativeTransform(c, svgEl as Element);
        if (!isIdentityMatrix(mtx)) applyMatrixToPoints(mtx, pts);
      } catch (ex) {}
      pushContour(pts);
    }
  }

  // ellipse
  const ellipses = Array.from(doc.querySelectorAll('ellipse')) as Element[];
  for (const e of ellipses) {
    const cx = parseFloat((e as Element).getAttribute('cx') || '0');
    const cy = parseFloat((e as Element).getAttribute('cy') || '0');
    const rx = parseFloat((e as Element).getAttribute('rx') || '0');
    const ry = parseFloat((e as Element).getAttribute('ry') || '0');
    if (rx > 0 && ry > 0) {
      const pts: number[][] = [];
      const segs = 48;
      for (let i = 0; i < segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
      }
      try {
        const mtx = computeCumulativeTransform(e, svgEl as Element);
        if (!isIdentityMatrix(mtx)) applyMatrixToPoints(mtx, pts);
      } catch (ex) {}
      pushContour(pts);
    }
  }

  // simple path parser (no curves)
  const paths = Array.from(doc.querySelectorAll('path')) as Element[];
  for (const p of paths) {
    const d = (p as Element).getAttribute('d') || '';
    if (!d.trim()) continue;
    try {
      const pts = parsePathCommands(d, tolerance);
      try {
        const mtx = computeCumulativeTransform(p, svgEl as Element);
        if (!isIdentityMatrix(mtx) && pts.length) applyMatrixToPoints(mtx, pts);
      } catch (ex) {}
      pushContour(pts);
    } catch (e) {
      // ignore complex paths
    }
  }

  // Compute bbox in normalized units
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const c of contours) {
    for (const [x, y] of c) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (minX === Infinity) {
    minX = 0; minY = 0; maxX = 0; maxY = 0;
  }

  const result = { contours, bbox: { minX, minY, maxX, maxY } } as SvgPolylinesResult;
  // store in cache
  try {
    const key = options && options.assetId ? `${options.assetId}::${tolerance}` : hashStringToKey(svgString + '::' + tolerance);
    SVG_POLY_CACHE.set(key, { ts: Date.now(), value: result });
    // evict if over capacity (simple FIFO)
    while (SVG_POLY_CACHE.size > CACHE_MAX_ENTRIES) {
      const firstKey = SVG_POLY_CACHE.keys().next().value;
      if (!firstKey) break;
      SVG_POLY_CACHE.delete(firstKey);
    }
  } catch (e) {}

  return result;
}

// Note: this is intentionally a small, dependency-free implementation that
// covers the common SVG constructs we use in assets. For full support (cubic
// Beziers, arcs), replace the path parser/flattening with a robust library.
