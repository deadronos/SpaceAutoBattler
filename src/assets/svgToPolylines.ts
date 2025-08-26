// svgToPolylines.ts
// Utility to parse SVG and extract polygonal hull outlines for shield/collision use
// Lightweight implementation: depends on global DOMParser (available in jsdom/test envs)
// Supports <polygon>, <polyline>, <rect>, <circle>, <ellipse>, and basic <path> commands (M/L/H/V/Z).
// Coordinates are normalized to viewBox-centered unit space: x' = (x - vb.w/2)/(vb.w/2)
// so that multiplying by ship.radius produces pixel offsets used by the renderer.

import { polygonSimplify } from "../math/polygon";

export interface SvgPolylinesResult {
  contours: number[][][]; // Array of polylines (each: array of [x, y] pairs)
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
  convexHull?: number[][];
}

export interface SvgToPolylinesOptions {
  tolerance?: number; // Curve flattening / simplify tolerance (default: 0.5)
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
  const hw = vb.w / 2 || 1;
  const hh = vb.h / 2 || 1;
  return points.map(([x, y]) => [((x - hw) / hw) as number, ((y - hh) / hh) as number]);
}

function sampleCircle(cx: number, cy: number, r: number, segments = 48) {
  const pts: number[][] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

// Basic path parser: supports M/m, L/l, H/h, V/v, Z/z. Does not support curves.
function parsePathCommands(d: string) {
  const tokens = d.replace(/,/g, " ").replace(/\s+/g, " ").trim();
  const cmdRe = /([MmLlHhVvZz])([^MmLlHhVvZz]*)/g;
  const pts: number[][] = [];
  let curX = 0, curY = 0;
  let m: RegExpExecArray | null;
  while ((m = cmdRe.exec(tokens))) {
    const cmd = m[1];
    const args = m[2].trim().split(/[,\s]+/).filter(Boolean).map((s) => parseFloat(s));
    if (cmd === 'Z' || cmd === 'z') {
      // close path -> ignore explicit handling here
      continue;
    }
    if (cmd === 'H' || cmd === 'h') {
      for (let i = 0; i < args.length; i++) {
        const x = args[i];
        if (cmd === 'h') curX += x; else curX = x;
        pts.push([curX, curY]);
      }
      continue;
    }
    if (cmd === 'V' || cmd === 'v') {
      for (let i = 0; i < args.length; i++) {
        const y = args[i];
        if (cmd === 'v') curY += y; else curY = y;
        pts.push([curX, curY]);
      }
      continue;
    }
    // For M/m and L/l treat pairs
    if (cmd === 'M' || cmd === 'm' || cmd === 'L' || cmd === 'l') {
      for (let i = 0; i + 1 < args.length; i += 2) {
        const ax = args[i], ay = args[i + 1];
        if (cmd === 'm' || cmd === 'l') {
          curX += ax; curY += ay;
        } else {
          curX = ax; curY = ay;
        }
        pts.push([curX, curY]);
      }
      continue;
    }
  }
  return pts;
}

export function svgToPolylines(svgString: string, options: SvgToPolylinesOptions = {}): SvgPolylinesResult {
  const tolerance = typeof options.tolerance === 'number' ? options.tolerance : 0.1;
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
    pushContour(pts);
  }

  // circle
  const circles = Array.from(doc.querySelectorAll('circle')) as Element[];
  for (const c of circles) {
    const cx = parseFloat((c as Element).getAttribute('cx') || '0');
    const cy = parseFloat((c as Element).getAttribute('cy') || '0');
    const r = parseFloat((c as Element).getAttribute('r') || '0');
    if (r > 0) pushContour(sampleCircle(cx, cy, r, 24));
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
      pushContour(pts);
    }
  }

  // simple path parser (no curves)
  const paths = Array.from(doc.querySelectorAll('path')) as Element[];
  for (const p of paths) {
    const d = (p as Element).getAttribute('d') || '';
    if (!d.trim()) continue;
    try {
      const pts = parsePathCommands(d);
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

  return { contours, bbox: { minX, minY, maxX, maxY } };
}

// Note: this is intentionally a small, dependency-free implementation that
// covers the common SVG constructs we use in assets. For full support (cubic
// Beziers, arcs), replace the path parser/flattening with a robust library.
