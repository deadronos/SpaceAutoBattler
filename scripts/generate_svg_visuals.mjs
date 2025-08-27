import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

async function run() {
  const outDir = path.resolve('test-output');
  try { fs.mkdirSync(outDir, { recursive: true }); } catch (e) {}

  const svgPath = path.resolve('src', 'config', 'assets', 'svg', 'destroyer.svg');
  const svgText = fs.readFileSync(svgPath, 'utf8');
  const svgBase64 = Buffer.from(svgText, 'utf8').toString('base64');

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 512, height: 512 } });

  // Put a minimal page that will create canvases and return dataURLs
  await page.setContent('<!doctype html><html><body></body></html>');

  // Pipe page console messages to node console for debugging
  page.on('console', (msg) => {
    console.log('[page]', msg.type(), msg.text());
  });

  const results = await page.evaluate(async (svgBase64) => {
    const diagnostics = [];
    // Helper: create image from SVG string
    function makeSvgDataUrlFromBase64(b64) {
      return 'data:image/svg+xml;base64,' + b64;
    }

    const turretSelectors = '[data-turret], .turret, [data-weapon], .weapon, [data-turret-slot], [data-weapon-slot]';

    // Create hull-only SVG by parsing and removing turret elements
    // svgBase64 is the base64-encoded original SVG passed from Node
    let hullSvg = null;
    try {
      const parser = new DOMParser();
      const decoded = atob(svgBase64);
      const doc = parser.parseFromString(decoded, 'image/svg+xml');
      const svg = doc.querySelector('svg');
      if (svg) {
        const turrets = Array.from(svg.querySelectorAll(turretSelectors));
        turrets.forEach(t => t.remove());
        hullSvg = new XMLSerializer().serializeToString(svg);
      }
    } catch (e) {
      hullSvg = null;
    }
    if (!hullSvg) {
      // fallback: decode original
      try { hullSvg = atob(svgBase64); } catch (e) { hullSvg = null; }
    }
    // (decoded svgBase64 already processed above)

    const size = 512;

    // Helper to safely base64-encode a UTF-8 string in the page
    function utf8ToBase64(str) {
      try {
        return btoa(unescape(encodeURIComponent(str)));
      } catch (e) {
        try {
          return btoa(str);
        } catch (ee) {
          return null;
        }
      }
    }

    // Rasterize function using Image loaded from a Blob URL (more reliable)
    async function rasterize(svgStr) {
      return new Promise((resolve) => {
        try {
          const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const img = new Image();
          img.onload = () => {
            try {
              const c = document.createElement('canvas');
              c.width = size;
              c.height = size;
              const ctx = c.getContext('2d');
              if (!ctx) {
                URL.revokeObjectURL(url);
                return resolve(null);
              }
              ctx.clearRect(0, 0, size, size);
              ctx.drawImage(img, 0, 0, size, size);
              URL.revokeObjectURL(url);
              resolve(c.toDataURL('image/png'));
            } catch (e) {
              URL.revokeObjectURL(url);
              resolve(null);
            }
          };
          img.onerror = (ev) => {
            diagnostics.push('Image load error for rasterize');
            try { URL.revokeObjectURL(url); } catch (e) {}
            resolve(null);
          };
          img.src = url;
        } catch (e) {
          diagnostics.push('rasterize outer error: ' + (e && e.message));
          resolve(null);
        }
      });
    }

    let hullDataUrl = null;
    try {
      hullDataUrl = await rasterize(hullSvg);
      if (!hullDataUrl) diagnostics.push('rasterize returned null for hull');
    } catch (e) {
      diagnostics.push('rasterize threw: ' + (e && e.message));
    }

    // Multiply tint + destination-in mask
    async function tintMultiplyMask(hullSvg, color) {
      const baseData = await rasterize(hullSvg);
      if (!baseData) return null;
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          try {
            const c = document.createElement('canvas');
            c.width = size;
            c.height = size;
            const ctx = c.getContext('2d');
            if (!ctx) return resolve(null);
            // draw original
            ctx.clearRect(0,0,size,size);
            ctx.drawImage(img,0,0);
            // multiply with color
            ctx.globalCompositeOperation = 'multiply';
            ctx.fillStyle = color;
            ctx.fillRect(0,0,size,size);
            // restore alpha by masking with original image alpha
            ctx.globalCompositeOperation = 'destination-in';
            ctx.drawImage(img,0,0);
            ctx.globalCompositeOperation = 'source-over';
            resolve(c.toDataURL('image/png'));
          } catch (e) { resolve(null); }
        };
        img.onerror = () => { diagnostics.push('multiply img.onerror'); resolve(null); };
        img.src = baseData;
      });
    }

    // Source-atop tint fallback
    async function tintSourceAtop(hullSvg, color) {
      const baseData = await rasterize(hullSvg);
      if (!baseData) return null;
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          try {
            const c = document.createElement('canvas');
            c.width = size;
            c.height = size;
            const ctx = c.getContext('2d');
            if (!ctx) return resolve(null);
            ctx.clearRect(0,0,size,size);
            ctx.drawImage(img,0,0);
            ctx.globalCompositeOperation = 'source-atop';
            ctx.fillStyle = color;
            ctx.fillRect(0,0,size,size);
            ctx.globalCompositeOperation = 'source-over';
            resolve(c.toDataURL('image/png'));
          } catch (e) { resolve(null); }
        };
        img.onerror = () => { diagnostics.push('source-atop img.onerror'); resolve(null); };
        img.src = baseData;
      });
    }

    const teamColor = '#ff5555';
    let multiplyDataUrl = null;
    let atopDataUrl = null;
    try {
      multiplyDataUrl = await tintMultiplyMask(hullSvg, teamColor);
      if (!multiplyDataUrl) diagnostics.push('multiply tint returned null');
    } catch (e) { diagnostics.push('multiply tint threw: ' + (e && e.message)); }
    try {
      atopDataUrl = await tintSourceAtop(hullSvg, teamColor);
      if (!atopDataUrl) diagnostics.push('source-atop tint returned null');
    } catch (e) { diagnostics.push('source-atop tint threw: ' + (e && e.message)); }

    return {
      hull: hullDataUrl,
      multiply: multiplyDataUrl,
      atop: atopDataUrl,
      diagnostics,
    };
  }, svgBase64);

  await browser.close();

  // Save the images
  const writeFromDataUrl = (name, dataUrl) => {
    if (!dataUrl) return false;
    const match = dataUrl.match(/^data:image\/png;base64,(.*)$/);
    if (!match) return false;
    const buf = Buffer.from(match[1], 'base64');
    fs.writeFileSync(path.join(outDir, name), buf);
    return true;
  };

  // Print diagnostics from the page to help debug failures
  try { console.log('page diagnostics:', results.diagnostics || []); } catch (e) {}
  try { console.log('result keys:', Object.keys(results || {})); } catch (e) {}

  const hullSaved = writeFromDataUrl('destroyer_hull.png', results.hull);
  const multSaved = writeFromDataUrl('destroyer_tint_multiply.png', results.multiply);
  const atopSaved = writeFromDataUrl('destroyer_tint_sourceatop.png', results.atop);

  console.log('Saved:', { hullSaved, multSaved, atopSaved, outDir });
  process.exit(0);
}

run().catch((e) => { console.error(e); process.exit(2); });
