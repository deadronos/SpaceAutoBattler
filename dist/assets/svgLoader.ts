// Lightweight SVG loader utilities for extracting mountpoints and rasterizing SVGs
// into canvas elements. This is intentionally small and dependency-free so it
// works in browser and headless DOM test environments.

export type MountPoint = { x: number; y: number };

export type ColorRegion = { role: string; id?: string; class?: string; bbox?: { x: number; y: number; w: number; h: number } };

export function parseSvgForMounts(svgText: string): {
  mounts: MountPoint[];
  engineMounts: MountPoint[];
  viewBox: { w: number; h: number } | null;
  colorRegions?: ColorRegion[];
} {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, 'image/svg+xml');
    const svg = doc.querySelector('svg');
    if (!svg) return { mounts: [], engineMounts: [], viewBox: null };
    // get viewBox or width/height
    const vb = svg.getAttribute('viewBox');
    let vbw = 0, vbh = 0;
    if (vb) {
      const parts = vb.split(/\s+|,/).map(p => parseFloat(p));
      if (parts.length >= 4) { vbw = parts[2]; vbh = parts[3]; }
    } else {
      vbw = parseFloat(svg.getAttribute('width') || '0') || 0;
      vbh = parseFloat(svg.getAttribute('height') || '0') || 0;
    }
  const mounts: MountPoint[] = [];
  const engineMounts: MountPoint[] = [];
  const colorRegions: ColorRegion[] = [];
    // Search for elements that might indicate turret or engine mountpoints by id/class
  // Candidates for mounts / mounts detection
  const candidates = Array.from(svg.querySelectorAll('[id],[class]'));
  for (const el of candidates) {
      try {
        const id = el.getAttribute('id') || '';
        const cls = el.getAttribute('class') || '';
        if (/mount|turret|gun/i.test(id + ' ' + cls)) {
          // Turret mountpoint
          const bbox = (el as SVGGraphicsElement).getBBox ? (el as SVGGraphicsElement).getBBox() : null;
          if (bbox) {
            mounts.push({ x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height / 2 });
          } else {
            const cx = parseFloat((el as any).getAttribute && (el as any).getAttribute('cx')) || parseFloat((el as any).getAttribute && (el as any).getAttribute('x')) || 0;
            const cy = parseFloat((el as any).getAttribute && (el as any).getAttribute('cy')) || parseFloat((el as any).getAttribute && (el as any).getAttribute('y')) || 0;
            mounts.push({ x: cx, y: cy });
          }
        }
        if (/engine/i.test(id + ' ' + cls)) {
          // Engine mountpoint
          const bbox = (el as SVGGraphicsElement).getBBox ? (el as SVGGraphicsElement).getBBox() : null;
          if (bbox) {
            engineMounts.push({ x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height / 2 });
          } else {
            const cx = parseFloat((el as any).getAttribute && (el as any).getAttribute('cx')) || parseFloat((el as any).getAttribute && (el as any).getAttribute('x')) || 0;
            const cy = parseFloat((el as any).getAttribute && (el as any).getAttribute('cy')) || parseFloat((el as any).getAttribute && (el as any).getAttribute('y')) || 0;
            engineMounts.push({ x: cx, y: cy });
          }
        }
      } catch (e) { continue; }
    }
    // Detect colorable regions marked with data-team or data-team-slot
    try {
      const colorEls = Array.from(svg.querySelectorAll('[data-team],[data-team-slot]'));
      for (const el of colorEls) {
        try {
          // support both attribute names (data-team is legacy; data-team-slot is the newer semantic name)
          const role = (el.getAttribute('data-team') || el.getAttribute('data-team-slot') || '').trim();
          const id = el.getAttribute('id') || undefined;
          const cls = el.getAttribute('class') || undefined;
          // attempt to compute bbox if available
          let bboxVal: { x: number; y: number; w: number; h: number } | undefined;
          const bbox = (el as SVGGraphicsElement).getBBox ? (el as SVGGraphicsElement).getBBox() : null;
          if (bbox) bboxVal = { x: bbox.x, y: bbox.y, w: bbox.width, h: bbox.height };
          colorRegions.push({ role, id, class: cls, bbox: bboxVal });
        } catch (e) { continue; }
      }
    } catch (e) {}
    return { mounts, engineMounts, viewBox: vbw && vbh ? { w: vbw, h: vbh } : null, colorRegions };
  } catch (e) { return { mounts: [], engineMounts: [], viewBox: null }; }
}

export function rasterizeSvgToCanvas(svgText: string, outW: number, outH: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;
    const img = new Image();
    // Ensure SVG has xmlns so Image() can render it in all browsers
    let svgSource = svgText;
    try {
      if (/\<svg[\s>]/i.test(svgSource) && !/xmlns\s*=\s*"http:\/\/www\.w3\.org\/2000\/svg"/i.test(svgSource)) {
        svgSource = svgSource.replace(/<svg(\s|>)/i, '<svg xmlns="http://www.w3.org/2000/svg"$1');
      }
    } catch (e) {}
  // Use data URL encoded SVG as it can be more robust in some runtimes
  // (Blob URLs sometimes fail to load in headless contexts). Encode the
  // SVG to ensure safe transmission.
  const dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgSource);
  const url = dataUrl;
    img.onload = () => {
      try { ctx.drawImage(img, 0, 0, outW, outH); } catch (e) {}
      URL.revokeObjectURL(url);
    };
    img.onerror = () => { URL.revokeObjectURL(url); };
    img.src = url;
    // Note: in headless test environments the onload may not fire synchronously.
  } catch (e) {}
  return canvas;
}

// Promise-based rasterizer: resolves when image draw completes (or on error)
export function rasterizeSvgToCanvasAsync(svgText: string, outW: number, outH: number): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  return new Promise((resolve) => {
    try {
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(canvas);
      const img = new Image();
      // Ensure SVG has xmlns so Image() can render it in all browsers
      let svgSource = svgText;
      try {
        if (/\<svg[\s>]/i.test(svgSource) && !/xmlns\s*=\s*"http:\/\/www\.w3\.org\/2000\/svg"/i.test(svgSource)) {
          svgSource = svgSource.replace(/<svg(\s|>)/i, '<svg xmlns="http://www.w3.org/2000/svg"$1');
        }
      } catch (e) {}
        // Use data URL encoded SVG for better compatibility in headless browsers
        const dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgSource);
        const url = dataUrl;
      let settled = false;
      const done = () => {
        if (settled) return; settled = true; try { URL.revokeObjectURL(url); } catch (e) {}
        resolve(canvas);
      };
      img.onload = () => {
        try { ctx.clearRect(0, 0, outW, outH); ctx.drawImage(img, 0, 0, outW, outH); } catch (e) {}
        done();
      };
      img.onerror = () => { done(); };
      // In some environments image decoding may be synchronous (rare), guard for that
      try { img.src = url; } catch (e) { done(); }
      // Fallback: if onload doesn't fire after a short timeout, resolve anyway
      setTimeout(() => { done(); }, 2500);
    } catch (e) { try { /* ignore */ } catch {} ; resolve(canvas); }
  });
}

// Utility: rasterize hull-only SVG by removing turret <rect>s (class="turret")
export function rasterizeHullOnlySvgToCanvas(svgText: string, outW: number, outH: number): HTMLCanvasElement {
  try {
    // Parse SVG and remove turret <rect>s
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, 'image/svg+xml');
    const svg = doc.querySelector('svg');
    if (!svg) return rasterizeSvgToCanvas(svgText, outW, outH);
    // Remove all <rect> elements with class="turret"
    const turrets = svg.querySelectorAll('rect.turret');
    turrets.forEach(el => el.parentNode?.removeChild(el));
    // Also remove any full-canvas background rects (fill covering the whole viewBox)
    try {
      const vbAttr = svg.getAttribute('viewBox');
      let vbW = 0, vbH = 0;
      if (vbAttr) {
        const parts = vbAttr.split(/\s+|,/).map(p => parseFloat(p));
        if (parts.length >= 4) { vbW = parts[2]; vbH = parts[3]; }
      } else {
        vbW = parseFloat(svg.getAttribute('width') || '0') || 0;
        vbH = parseFloat(svg.getAttribute('height') || '0') || 0;
      }
      if (vbW > 0 && vbH > 0) {
        const rects = svg.querySelectorAll('rect');
        rects.forEach(r => {
          try {
            const rx = parseFloat(r.getAttribute('x') || '0') || 0;
            const ry = parseFloat(r.getAttribute('y') || '0') || 0;
            const rw = parseFloat(r.getAttribute('width') || '0') || 0;
            const rh = parseFloat(r.getAttribute('height') || '0') || 0;
            if (Math.abs(rx) < 1e-6 && Math.abs(ry) < 1e-6 && Math.abs(rw - vbW) < 1e-3 && Math.abs(rh - vbH) < 1e-3) {
              r.parentNode?.removeChild(r);
            }
          } catch (e) {}
        });
      }
    } catch (e) {}
    // Serialize back to string
    const serializer = new XMLSerializer();
    const hullOnlySvgText = serializer.serializeToString(svg);
    return rasterizeSvgToCanvas(hullOnlySvgText, outW, outH);
  } catch (e) {
    // Fallback: rasterize original SVG
    return rasterizeSvgToCanvas(svgText, outW, outH);
  }
}

export async function rasterizeHullOnlySvgToCanvasAsync(svgText: string, outW: number, outH: number): Promise<HTMLCanvasElement> {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, 'image/svg+xml');
    const svg = doc.querySelector('svg');
    if (!svg) return rasterizeSvgToCanvas(svgText, outW, outH);
    const turrets = svg.querySelectorAll('rect.turret');
    turrets.forEach(el => el.parentNode?.removeChild(el));
    const serializer = new XMLSerializer();
    const hullOnlySvgText = serializer.serializeToString(svg);
    return await rasterizeSvgToCanvasAsync(hullOnlySvgText, outW, outH);
  } catch (e) {
    return await rasterizeSvgToCanvasAsync(svgText, outW, outH);
  }
}

/**
 * Try to obtain a synchronously-available cached canvas from the higher-level
 * svgRenderer cache. If not present, fall back to rasterizing the hull-only SVG
 * synchronously via rasterizeHullOnlySvgToCanvas.
 * assetKey is optional and used to look up renderer cache entries.
 */
export function getCachedHullCanvasSync(svgText: string, outW: number, outH: number, assetKey?: string): HTMLCanvasElement | undefined {
  try {
    const svgRenderer = require('./svgRenderer');
    if (svgRenderer && typeof svgRenderer.getCanvas === 'function') {
      try {
        const canvas = svgRenderer.getCanvas(assetKey || '', {}, outW, outH);
        if (canvas) return canvas as HTMLCanvasElement;
      } catch (e) {
        // continue to fallback
      }
    }
  } catch (e) {}
  // Fallback to local synchronous rasterization
  try {
    return rasterizeHullOnlySvgToCanvas(svgText, outW, outH) as HTMLCanvasElement;
  } catch (e) {
    return undefined;
  }
}

/**
 * Ensure an asynchronously rasterized canvas for the provided SVG + mapping is
 * available and cached via svgRenderer. Returns a promise that resolves to the canvas.
 */
export async function ensureRasterizedAndCached(svgText: string, mapping: Record<string,string>, outW: number, outH: number, options?: { applyTo?: 'fill'|'stroke'|'both', assetKey?: string }): Promise<HTMLCanvasElement> {
  try {
    const svgRenderer = require('./svgRenderer');
    if (svgRenderer && typeof svgRenderer.rasterizeSvgWithTeamColors === 'function') {
      try {
        const canvas = await svgRenderer.rasterizeSvgWithTeamColors(svgText, mapping || {}, outW, outH, { applyTo: options && options.applyTo, assetKey: options && options.assetKey });
        return canvas;
      } catch (e) {
        // fallthrough
      }
    }
  } catch (e) {}
  // Fallback: apply mapping locally and rasterize
  try {
    const recolored = applyTeamColorsToSvg(svgText, mapping || {}, options && { applyTo: options.applyTo });
    const canvas = await rasterizeSvgToCanvasAsync(recolored, outW, outH);
    // If svgRenderer supports caching, store this canvas
    try {
      const svgRenderer = require('./svgRenderer');
      if (svgRenderer && typeof svgRenderer.cacheCanvasForAsset === 'function') {
        try { svgRenderer.cacheCanvasForAsset(options && options.assetKey ? options.assetKey : '', mapping || {}, outW, outH, canvas); } catch (e) {}
      }
    } catch (e) {}
    return canvas;
  } catch (e) {
    // Last-resort: rasterize original
    return await rasterizeSvgToCanvasAsync(svgText, outW, outH);
  }
}

/**
 * Apply team colors to SVG elements that are annotated with `data-team`.
 * mapping: { roleName: color }
 * options.applyTo: 'fill' | 'stroke' | 'both' (default: 'both')
 */
export function applyTeamColorsToSvg(svgText: string, mapping: Record<string, string>, options?: { applyTo?: 'fill' | 'stroke' | 'both' }): string {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, 'image/svg+xml');
    const svg = doc.querySelector('svg');
    if (!svg) return svgText;
    const applyDefault = options && options.applyTo ? options.applyTo : 'both';
    const els = Array.from(svg.querySelectorAll('[data-team],[data-team-slot], [class*="team-fill-"]')) as Element[];
    for (const el of els) {
      try {
        // Determine candidate roles:
        // - explicit data-team / data-team-slot (legacy/new)
        // - explicit per-attribute overrides: data-team-slot-fill / data-team-slot-stroke
        // - class-based marker: team-fill-<role>
        const role = (el.getAttribute('data-team') || el.getAttribute('data-team-slot') || '').trim();
        const fillRoleAttr = (el.getAttribute('data-team-slot-fill') || '').trim();
        const strokeRoleAttr = (el.getAttribute('data-team-slot-stroke') || '').trim();
        const cls = el.getAttribute('class') || '';
        // class marker like team-fill-primary or team-fill-accent
        let classRole: string | undefined;
        try {
          const m = cls.match(/team-fill-([a-z0-9_-]+)/i);
          if (m) classRole = m[1];
        } catch (e) {}

        // Resolve fill and stroke roles with fallbacks
        const resolvedFillRole = fillRoleAttr || role || classRole || 'primary';
        const resolvedStrokeRole = strokeRoleAttr || role || classRole || 'trim';

        const fillColor = mapping[resolvedFillRole];
        const strokeColor = mapping[resolvedStrokeRole] || fillColor;

        if (!fillColor && !strokeColor) continue; // nothing to apply

        const applyAttr = (el.getAttribute('data-team-apply') || '').trim().toLowerCase();
        const apply = applyAttr === 'fill' || applyAttr === 'stroke' ? (applyAttr as 'fill' | 'stroke') : applyDefault;

        const setStyleProp = (prop: 'fill' | 'stroke', value: string) => {
          try {
            // Set presentation attribute
            (el as Element).setAttribute(prop, value);
            // Merge into style attribute (so inline styles reflect it)
            const cur = el.getAttribute('style') || '';
            // replace existing prop in style or append
            const re = new RegExp('(^|;)\\s*' + prop + '\\s*:\\s*[^;]+', 'i');
            if (re.test(cur)) {
              const replaced = cur.replace(re, `$1 ${prop}: ${value}`);
              el.setAttribute('style', replaced);
            } else {
              const next = cur ? (cur + `; ${prop}: ${value}`) : `${prop}: ${value}`;
              el.setAttribute('style', next);
            }
          } catch (e) { /* ignore style merge failures */ }
        };

        if ((apply === 'fill' || apply === 'both') && fillColor) setStyleProp('fill', fillColor);
        if ((apply === 'stroke' || apply === 'both') && strokeColor) setStyleProp('stroke', strokeColor);
      } catch (e) { continue; }
    }
    const serializer = new XMLSerializer();
    return serializer.serializeToString(svg);
  } catch (e) {
    return svgText;
  }
}

export default { parseSvgForMounts, rasterizeSvgToCanvas, applyTeamColorsToSvg };
