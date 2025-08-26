/* eslint-disable */
// Clean authoritative svgLoader implementation (single export)

export function parseSvgForMounts(svgText: string) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, 'image/svg+xml');
    const svg = doc.querySelector('svg');
    if (!svg) return { mounts: [], engineMounts: [], viewBox: null, colorRegions: [] };
    const viewBox = svg.getAttribute('viewBox');
    const mounts = Array.from(svg.querySelectorAll('[data-mount]')).map((el) => ({
      x: el.getAttribute('x') || el.getAttribute('cx') || null,
      y: el.getAttribute('y') || el.getAttribute('cy') || null,
      slot: el.getAttribute('data-mount') || null,
    }));
    const engineMounts = Array.from(svg.querySelectorAll('[data-engine-mount]')).map((el) => ({
      x: el.getAttribute('x') || null,
      y: el.getAttribute('y') || null,
      slot: el.getAttribute('data-engine-mount') || null,
    }));
    const colorRegions = Array.from(svg.querySelectorAll('[data-team],[data-team-slot],[class*="team-fill-"]')).map((el) => ({
      tag: el.tagName,
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
    try {
      const img = new Image();
      img.onload = () => {
        try {
          const c = document.createElement('canvas');
          c.width = outW; c.height = outH;
          const ctx = c.getContext('2d');
          if (!ctx) return resolve(undefined);
          ctx.clearRect(0, 0, outW, outH);
          ctx.drawImage(img, 0, 0, outW, outH);
          resolve(c);
        } catch (e) { resolve(undefined); }
      };
      img.onerror = () => resolve(undefined);
      img.src = url;
    } catch (e) { resolve(undefined); }
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

export function getCachedHullCanvasSync(svgText: string, outW: number, outH: number, assetKey?: string): HTMLCanvasElement | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const svgRenderer = require('./svgRenderer');
    if (svgRenderer && typeof svgRenderer.getCanvas === 'function') {
      try { const c = svgRenderer.getCanvas(assetKey || '', {}, outW, outH); if (c) return c as HTMLCanvasElement; } catch (e) {}
    }
  } catch (e) {}
  try { return rasterizeHullOnlySvgToCanvasAsync(svgText, outW, outH) as unknown as HTMLCanvasElement; } catch (e) { return undefined; }
}

export async function ensureRasterizedAndCached(svgText: string, mapping: Record<string,string>, outW: number, outH: number, options?: { applyTo?: 'fill'|'stroke'|'both', assetKey?: string }): Promise<HTMLCanvasElement> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const svgRenderer = require('./svgRenderer');
    if (svgRenderer && typeof svgRenderer.rasterizeSvgWithTeamColors === 'function') {
      try { const c = await svgRenderer.rasterizeSvgWithTeamColors(svgText, mapping || {}, outW, outH, { applyTo: options && options.applyTo, assetKey: options && options.assetKey }); if (c) return c; } catch (e) {}
    }
  } catch (e) {}
  const recolored = applyTeamColorsToSvg(svgText, mapping || {}, options && { applyTo: options.applyTo });
  const canvas = await rasterizeSvgToCanvasAsync(recolored, outW, outH);
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const svgRenderer = require('./svgRenderer');
    if (svgRenderer && typeof svgRenderer.cacheCanvasForAsset === 'function') {
      try { svgRenderer.cacheCanvasForAsset(options && options.assetKey ? options.assetKey : '', mapping || {}, outW, outH, canvas); } catch (e) {}
    }
  } catch (e) {}
  return canvas;
}

export default { parseSvgForMounts, applyTeamColorsToSvg, rasterizeSvgToCanvasAsync, rasterizeHullOnlySvgToCanvasAsync, ensureRasterizedAndCached, getCachedHullCanvasSync };

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
