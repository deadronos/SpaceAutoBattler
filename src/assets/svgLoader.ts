import { svgToPolylines, SvgPolylinesResult } from './svgToPolylines';
const path = require('path');
const fs = require('fs');
let _svgHashes: Record<string, string> | null = null;
function loadSvgHashes() {
  if (_svgHashes !== null) return _svgHashes;
  try {
    const p = path.join(__dirname, '..', 'config', 'assets', 'svg', 'svg-hashes.json');
    if (fs.existsSync(p)) {
      _svgHashes = JSON.parse(fs.readFileSync(p, 'utf8'));
    } else {
      _svgHashes = {};
    }
  } catch (e) { _svgHashes = {}; }
  return _svgHashes;
}

// Utility: extract hull outline polylines from SVG for shield/collision
// Accepts optional `assetFilename` parameter so callers can supply the source filename
// (used to form an `assetId` that keys the svgToPolylines cache). Backwards compatible
// call: `getHullOutlineFromSvg(svgText, tolerance)` still works.
export function getHullOutlineFromSvg(svgText: string, tolerance: number = 1.5, assetFilename?: string): SvgPolylinesResult {
  // Optionally strip non-hull elements for cleaner outline
  const hullSvg = stripHullOnly(svgText);
  try {
    let assetId: string | undefined = undefined;
    if (assetFilename) {
      try {
        const mapping = loadSvgHashes();
        const base = path.basename(assetFilename);
        const h = mapping && mapping[base];
        assetId = h ? `${base}::${h}` : base;
      } catch (e) { assetId = assetFilename; }
    }
    return svgToPolylines(hullSvg, assetId ? { tolerance, assetId } : { tolerance });
  } catch (e) {
    // fallback to best-effort parsing
    return svgToPolylines(hullSvg, { tolerance });
  }
}
/* eslint-disable */
// Clean authoritative svgLoader implementation (single export)

export function parseSvgForMounts(svgText: string) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, 'image/svg+xml');
    const svg = doc.querySelector('svg');
    if (!svg) return { mounts: [], engineMounts: [], viewBox: null, colorRegions: [] };
    const vbAttr = svg.getAttribute('viewBox');
    let viewBox: { w: number; h: number } | null = null;
    if (vbAttr) {
      // viewBox syntax: minX minY width height
      const parts = vbAttr.trim().split(/[\s,]+/).map((s) => parseFloat(s));
      if (parts.length >= 4 && !isNaN(parts[2]) && !isNaN(parts[3])) {
        viewBox = { w: parts[2], h: parts[3] };
      }
    }
    const toNumber = (v: string | null) => { const n = v == null ? NaN : parseFloat(v); return isNaN(n) ? null : n; };

    // Mounts: data-mount or class 'turret'
    const mountEls = Array.from(svg.querySelectorAll('[data-mount], .turret')) as Element[];
    const mounts = mountEls.map((el) => {
      const slot = el.getAttribute('data-mount') || (el.classList && (el.classList.contains('turret') ? 'turret' : null));
      // center calculation for rects: x + width/2, y + height/2. For circles/ellipses use cx/cy.
      const xAttr = el.getAttribute('cx') || el.getAttribute('x');
      const yAttr = el.getAttribute('cy') || el.getAttribute('y');
      let x = toNumber(xAttr);
      let y = toNumber(yAttr);
      if ((x == null || y == null) && el.getAttribute('width') && el.getAttribute('height')) {
        const rx = toNumber(el.getAttribute('x'));
        const ry = toNumber(el.getAttribute('y'));
        const rw = toNumber(el.getAttribute('width'));
        const rh = toNumber(el.getAttribute('height'));
        if (rx != null && rw != null) x = rx + rw / 2;
        if (ry != null && rh != null) y = ry + rh / 2;
      }
      return { x, y, slot };
    });

    // Engine mounts: data-engine-mount or class 'engine'
    const engineEls = Array.from(svg.querySelectorAll('[data-engine-mount], .engine')) as Element[];
    const engineMounts = engineEls.map((el) => {
      const slot = el.getAttribute('data-engine-mount') || (el.classList && (el.classList.contains('engine') ? 'engine' : null));
      const xAttr = el.getAttribute('cx') || el.getAttribute('x');
      const yAttr = el.getAttribute('cy') || el.getAttribute('y');
      let x = toNumber(xAttr);
      let y = toNumber(yAttr);
      if ((x == null || y == null) && el.getAttribute('width') && el.getAttribute('height')) {
        const rx = toNumber(el.getAttribute('x'));
        const ry = toNumber(el.getAttribute('y'));
        const rw = toNumber(el.getAttribute('width'));
        const rh = toNumber(el.getAttribute('height'));
        if (rx != null && rw != null) x = rx + rw / 2;
        if (ry != null && rh != null) y = ry + rh / 2;
      }
      return { x, y, slot };
    });
    const colorRegions = Array.from(svg.querySelectorAll('[data-team],[data-team-slot],[class*="team-fill-"]')).map((el) => ({
      tag: el.tagName,
      id: (el as Element).id || null,
      role: el.getAttribute('data-team') || el.getAttribute('data-team-slot') || null,
    }));
  return { mounts, engineMounts, viewBox, colorRegions };
  } catch (e) {
    return { mounts: [], engineMounts: [], viewBox: null, colorRegions: [] };
  }
}

export function applyTeamColorsToSvg(svgText: string, mapping: Record<string, string>, options?: { applyTo?: 'fill' | 'stroke' | 'both' }): string {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, 'image/svg+xml');
    const svg = doc.querySelector('svg');
    if (!svg) return svgText;
    const applyDefault = options && options.applyTo ? options.applyTo : 'both';
    const els = Array.from(svg.querySelectorAll('[data-team],[data-team-slot],[data-team-slot-fill],[data-team-slot-stroke],[class*="team-fill-"]')) as Element[];
    for (const el of els) {
      try {
        const role = (el.getAttribute('data-team') || el.getAttribute('data-team-slot') || '').trim();
        const fillRoleAttr = (el.getAttribute('data-team-slot-fill') || '').trim();
        const strokeRoleAttr = (el.getAttribute('data-team-slot-stroke') || '').trim();
        const cls = el.getAttribute('class') || '';
        let classRole: string | undefined;
        try { const m = cls.match(/team-fill-([a-z0-9_-]+)/i); if (m) classRole = m[1]; } catch (e) { classRole = undefined; }
        const resolvedFillRole = fillRoleAttr || role || classRole || 'primary';
        const resolvedStrokeRole = strokeRoleAttr || role || classRole || 'trim';
        const fillColor = mapping[resolvedFillRole];
        const strokeColor = mapping[resolvedStrokeRole] || fillColor;
        if (!fillColor && !strokeColor) continue;
        const applyAttr = (el.getAttribute('data-team-apply') || '').trim().toLowerCase();
        const apply = applyAttr === 'fill' || applyAttr === 'stroke' ? (applyAttr as 'fill' | 'stroke') : applyDefault;
        const setStyleProp = (prop: 'fill' | 'stroke', value: string) => {
          try {
            el.setAttribute(prop, value);
            const cur = el.getAttribute('style') || '';
            const re = new RegExp('(^|;)\\s*' + prop + '\\s*:\\s*[^;]+', 'i');
            if (re.test(cur)) {
              const replaced = cur.replace(re, `$1 ${prop}: ${value}`);
              el.setAttribute('style', replaced);
            } else {
              const next = cur ? (cur + `; ${prop}: ${value}`) : `${prop}: ${value}`;
              el.setAttribute('style', next);
            }
          } catch (e) {}
        };
        if ((apply === 'fill' || apply === 'both') && fillColor) setStyleProp('fill', fillColor);
        if ((apply === 'stroke' || apply === 'both') && strokeColor) setStyleProp('stroke', strokeColor);
      } catch (e) { continue; }
    }
    return new XMLSerializer().serializeToString(svg);
  } catch (e) { return svgText; }
}

function encodeSvgDataUrl(svgText: string) {
  try { return 'data:image/svg+xml;utf8,' + encodeURIComponent(svgText); } catch (e) { return 'data:image/svg+xml;utf8,' + svgText; }
}

async function tryLoadUrlToCanvas(url: string, outW: number, outH: number): Promise<HTMLCanvasElement | undefined> {
  return new Promise((resolve) => {
    let settled = false;
    const to = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(undefined);
      }
    }, 500);
    const safeResolve = (v?: HTMLCanvasElement | undefined) => {
      if (!settled) {
        settled = true;
        try { clearTimeout(to); } catch (e) {}
        resolve(v);
      }
    };
    try {
      const img = new Image();
      img.onload = () => {
        try {
          const c = document.createElement('canvas');
          c.width = outW; c.height = outH;
          const ctx = c.getContext('2d');
          if (!ctx) return safeResolve(undefined);
          ctx.clearRect(0, 0, outW, outH);
          ctx.drawImage(img, 0, 0, outW, outH);
          safeResolve(c);
        } catch (e) { safeResolve(undefined); }
      };
      img.onerror = () => safeResolve(undefined);
      img.src = url;
    } catch (e) { safeResolve(undefined); }
  });
}

function canvasHasOpaquePixels(c: HTMLCanvasElement, thresholdAlpha = 8): boolean {
  try {
    const ctx = c.getContext('2d'); if (!ctx) return false;
    const w = Math.max(1, Math.min(16, c.width)); const h = Math.max(1, Math.min(16, c.height));
    const data = ctx.getImageData(0, 0, w, h).data;
    for (let i = 3; i < data.length; i += 4) if (data[i] > thresholdAlpha) return true;
  } catch (e) { return true; }
  return false;
}

export async function rasterizeSvgToCanvasAsync(svgText: string, outW: number, outH: number): Promise<HTMLCanvasElement> {
  const dataUrl = encodeSvgDataUrl(svgText);
  let canvas = await tryLoadUrlToCanvas(dataUrl, outW, outH);
  if (canvas && canvasHasOpaquePixels(canvas)) return canvas;
  try {
    const blob = new Blob([svgText], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    try {
      const c2 = await tryLoadUrlToCanvas(url, outW, outH);
      if (c2 && canvasHasOpaquePixels(c2)) return c2;
      if (c2) return c2;
    } finally { URL.revokeObjectURL(url); }
  } catch (e) {}
  if (canvas) return canvas;
  throw new Error('Failed to rasterize SVG to canvas');
}

export function rasterizeSvgToCanvas(svgText: string, outW: number, outH: number): HTMLCanvasElement | undefined {
  try {
    const dataUrl = encodeSvgDataUrl(svgText);
    const img = new Image(); img.src = dataUrl; if (!img.complete) return undefined;
    const c = document.createElement('canvas'); c.width = outW; c.height = outH;
    const ctx = c.getContext('2d'); if (!ctx) return undefined; ctx.drawImage(img, 0, 0, outW, outH); return c;
  } catch (e) { return undefined; }
}

function stripHullOnly(svgText: string) {
  try {
    const parser = new DOMParser(); const doc = parser.parseFromString(svgText, 'image/svg+xml'); const svg = doc.querySelector('svg'); if (!svg) return svgText;
    const rects = Array.from(svg.querySelectorAll('rect')) as Element[];
    for (const r of rects) {
      try {
        const cls = (r.getAttribute('class') || '').toLowerCase(); if (cls.includes('backdrop') || cls.includes('bg')) r.remove();
        const w = parseFloat(r.getAttribute('width') || '0'); const h = parseFloat(r.getAttribute('height') || '0'); if (!isNaN(w) && !isNaN(h) && (w > 1000 || h > 1000)) r.remove();
      } catch (e) {}
    }
    const turrets = Array.from(svg.querySelectorAll('[data-turret]')) as Element[]; for (const t of turrets) try { t.remove(); } catch (e) {}
    return new XMLSerializer().serializeToString(svg);
  } catch (e) { return svgText; }
}

export async function rasterizeHullOnlySvgToCanvasAsync(svgText: string, outW: number, outH: number) {
  const hull = stripHullOnly(svgText); return await rasterizeSvgToCanvasAsync(hull, outW, outH);
}

// Backwards-compatible sync wrapper: best-effort synchronous rasterization for callers that expect it.
export function rasterizeHullOnlySvgToCanvas(svgText: string, outW: number, outH: number): HTMLCanvasElement {
  try {
    // Try to use renderer cached canvas first
    const c = getCachedHullCanvasSync(svgText, outW, outH);
    if (c) return c;
    // Try synchronous rasterize path
    const hull = stripHullOnly(svgText);
    const rc = rasterizeSvgToCanvas(hull, outW, outH);
    if (rc) return rc;
  } catch (e) {}
  // Fallback: return an empty transparent canvas to preserve caller expectations
  const empty = document.createElement('canvas'); empty.width = outW; empty.height = outH; return empty;
}

export function getCachedHullCanvasSync(svgText: string, outW: number, outH: number, assetKey?: string): HTMLCanvasElement | undefined {
  try {
    // Prefer require (synchronous) so this function stays sync and Vitest mocks are visible
    // Try multiple candidate module specifiers to match how tests may mock the module
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    let svgRenderer: any = undefined;
    const candidates = ['./svgRenderer', '../assets/svgRenderer', '../../src/assets/svgRenderer', 'src/assets/svgRenderer'];
    for (const cpath of candidates) {
      try {
        svgRenderer = require(cpath);
        if (svgRenderer) break;
      } catch (e) {
        svgRenderer = svgRenderer || undefined;
      }
    }
    const getCanvasFn = (svgRenderer && svgRenderer.getCanvas) || (svgRenderer && svgRenderer.default && svgRenderer.default.getCanvas);
    if (getCanvasFn && typeof getCanvasFn === 'function') {
      try {
        const c = getCanvasFn(assetKey || '', {}, outW, outH);
        if (c) return c as HTMLCanvasElement;
      } catch (e) {}
    }
  } catch (e) {}
  try {
    const hull = stripHullOnly(svgText);
    try {
      const rc = rasterizeSvgToCanvas(hull, outW, outH) as HTMLCanvasElement | undefined;
      if (rc) return rc;
    } catch (e) {}
    // Synchronous rasterization may not be available in headless test envs.
    // Return an empty placeholder canvas sized to the requested output so callers
    // that expect a synchronous canvas receive a usable element.
    const ph = document.createElement('canvas'); ph.width = outW; ph.height = outH; return ph;
  } catch (e) { return undefined; }
}

export async function ensureRasterizedAndCached(svgText: string, mapping: Record<string,string>, outW: number, outH: number, options?: { applyTo?: 'fill'|'stroke'|'both', assetKey?: string }): Promise<HTMLCanvasElement> {
  try {
    // Dynamic import so Vitest mocks/spies on the module object are respected
    let svgRenderer: any = undefined;
    try {
      const mod = await import('./svgRenderer');
      svgRenderer = (mod && (mod as any).default) || mod;
    } catch (e) {
      try { svgRenderer = require('./svgRenderer'); } catch (e2) { svgRenderer = undefined; }
    }
    const getCanvasFn = (svgRenderer && svgRenderer.getCanvas) || (svgRenderer && svgRenderer.default && svgRenderer.default.getCanvas) || (svgRenderer && svgRenderer.default && svgRenderer.default.default && svgRenderer.default.default.getCanvas);
    // If renderer provides a synchronous cached canvas for this asset/mapping, prefer it
    try {
      if (typeof getCanvasFn === 'function') {
        try {
          const c = getCanvasFn(options && options.assetKey ? options.assetKey : '', mapping || {}, outW, outH);
          if (c) return c as HTMLCanvasElement;
        } catch (e) {}
      }
    } catch (e) {}

    const rasterizeFn = (svgRenderer && svgRenderer.rasterizeSvgWithTeamColors) || (svgRenderer && svgRenderer.default && svgRenderer.default.rasterizeSvgWithTeamColors) || (svgRenderer && svgRenderer.default && svgRenderer.default.default && svgRenderer.default.default.rasterizeSvgWithTeamColors);
    if (typeof rasterizeFn === 'function') {
      try {
        const c = await rasterizeFn(svgText, mapping || {}, outW, outH, { applyTo: options && options.applyTo, assetKey: options && options.assetKey });
        if (c) return c;
      } catch (e) {}
    }
  } catch (e) {}
  const recolored = applyTeamColorsToSvg(svgText, mapping || {}, options && { applyTo: options.applyTo });
  // Call via dynamic import so tests can spy/mock rasterizeSvgToCanvasAsync on the module
  let canvas: HTMLCanvasElement | undefined = undefined;
  try {
    const mod = await import('./svgLoader');
    if (mod && typeof mod.rasterizeSvgToCanvasAsync === 'function') {
      try { canvas = await mod.rasterizeSvgToCanvasAsync(recolored, outW, outH); } catch (e) { canvas = undefined; }
    }
  } catch (e) { canvas = undefined; }
  if (!canvas) {
    try { canvas = await rasterizeSvgToCanvasAsync(recolored, outW, outH); } catch (e) { canvas = undefined; }
  }
  if (!canvas) throw new Error('Failed to rasterize SVG to canvas');
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    let svgRenderer: any;
    try { svgRenderer = require('./svgRenderer'); } catch (e) { svgRenderer = undefined; }
    if (!svgRenderer || !svgRenderer.cacheCanvasForAsset) {
      try { const mod = await import('./svgRenderer'); svgRenderer = (mod && (mod as any).default) || mod || svgRenderer; } catch (e) {}
    }
    const cacheFn = (svgRenderer && svgRenderer.cacheCanvasForAsset) || (svgRenderer && svgRenderer.default && svgRenderer.default.cacheCanvasForAsset) || (svgRenderer && svgRenderer.default && svgRenderer.default.default && svgRenderer.default.default.cacheCanvasForAsset);
    if (typeof cacheFn === 'function') {
      try { cacheFn(options && options.assetKey ? options.assetKey : '', mapping || {}, outW, outH, canvas); } catch (e) {}
    }
  } catch (e) {}
  return canvas;
}

export default { parseSvgForMounts, applyTeamColorsToSvg, rasterizeSvgToCanvasAsync, rasterizeHullOnlySvgToCanvasAsync, ensureRasterizedAndCached, getCachedHullCanvasSync };
