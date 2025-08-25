// Lightweight SVG loader utilities for extracting mountpoints and rasterizing SVGs
// into canvas elements. This is intentionally small and dependency-free so it
// works in browser and headless DOM test environments.

export type MountPoint = { x: number; y: number };

export function parseSvgForMounts(svgText: string): {
  mounts: MountPoint[];
  engineMounts: MountPoint[];
  viewBox: { w: number; h: number } | null;
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
    // Search for elements that might indicate turret or engine mountpoints by id/class
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
    return { mounts, engineMounts, viewBox: vbw && vbh ? { w: vbw, h: vbh } : null };
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
    const svgBlob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
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
    // Serialize back to string
    const serializer = new XMLSerializer();
    const hullOnlySvgText = serializer.serializeToString(svg);
    return rasterizeSvgToCanvas(hullOnlySvgText, outW, outH);
  } catch (e) {
    // Fallback: rasterize original SVG
    return rasterizeSvgToCanvas(svgText, outW, outH);
  }
}

export default { parseSvgForMounts, rasterizeSvgToCanvas };
