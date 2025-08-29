// src/core/svgRasterWorker.ts
var RasterCache = class {
  cache = /* @__PURE__ */ new Map();
  maxEntries = 50;
  maxAge = 3e5;
  // 5 minutes
  set(assetKey, bitmap, modTime) {
    if (this.cache.size >= this.maxEntries) {
      this.evictOldest();
    }
    this.cache.set(assetKey, {
      bitmap,
      timestamp: Date.now(),
      modTime
    });
  }
  get(assetKey, modTime) {
    const entry = this.cache.get(assetKey);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.maxAge) {
      this.cache.delete(assetKey);
      return null;
    }
    if (modTime && entry.modTime && modTime > entry.modTime) {
      this.cache.delete(assetKey);
      return null;
    }
    return entry.bitmap;
  }
  clear() {
    for (const entry of this.cache.values()) {
      entry.bitmap.close();
    }
    this.cache.clear();
  }
  setMaxEntries(max) {
    this.maxEntries = max;
    while (this.cache.size > this.maxEntries) {
      this.evictOldest();
    }
  }
  setMaxAge(maxAgeMs) {
    this.maxAge = maxAgeMs;
  }
  evictOldest() {
    let oldestKey = "";
    let oldestTime = Date.now();
    for (const [key, entry] of this.cache) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }
    if (oldestKey) {
      const entry = this.cache.get(oldestKey);
      if (entry) {
        entry.bitmap.close();
      }
      this.cache.delete(oldestKey);
    }
  }
};
var rasterCache = new RasterCache();
async function rasterizeSvgToImageBitmap(svgText, width, height, teamColor) {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, width, height);
  const svgDataUrl = `data:image/svg+xml;base64,${btoa(svgText)}`;
  try {
    const response = await fetch(svgDataUrl);
    const blob = await response.blob();
    const imageBitmap = await createImageBitmap(blob, {
      resizeWidth: width,
      resizeHeight: height,
      resizeQuality: "high"
    });
    ctx.drawImage(imageBitmap, 0, 0, width, height);
    if (teamColor) {
      applyTeamColorTint(ctx, width, height, teamColor);
    }
    const finalImageBitmap = canvas.transferToImageBitmap();
    imageBitmap.close();
    return finalImageBitmap;
  } catch (error) {
    throw new Error(`Failed to rasterize SVG: ${error.message}`);
  }
}
function applyTeamColorTint(ctx, width, height, teamColor) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const colorMatch = teamColor.match(/^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!colorMatch) return;
  const r = parseInt(colorMatch[1], 16) / 255;
  const g = parseInt(colorMatch[2], 16) / 255;
  const b = parseInt(colorMatch[3], 16) / 255;
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha > 0) {
      data[i] = Math.min(255, data[i] * r);
      data[i + 1] = Math.min(255, data[i + 1] * g);
      data[i + 2] = Math.min(255, data[i + 2] * b);
    }
  }
  ctx.putImageData(imageData, 0, 0);
}
self.addEventListener("message", async (e) => {
  const request = e.data;
  try {
    switch (request.type) {
      case "rasterize": {
        const { svgText, width, height, assetKey, teamColor, filePath, fileModTime } = request;
        const cached = rasterCache.get(assetKey, fileModTime || void 0);
        if (cached) {
          self.postMessage({
            type: "rasterized",
            assetKey,
            imageBitmap: cached,
            width,
            height
          });
          return;
        }
        const imageBitmap = await rasterizeSvgToImageBitmap(svgText, width, height, teamColor);
        rasterCache.set(assetKey, imageBitmap, fileModTime);
        self.postMessage({
          type: "rasterized",
          assetKey,
          imageBitmap,
          width,
          height
        });
        break;
      }
      case "get-canvas": {
        const { assetKey, mappingHash, outW, outH } = request;
        const cached = rasterCache.get(assetKey);
        const canvas = new OffscreenCanvas(outW, outH);
        if (cached) {
          const ctx = canvas.getContext("2d");
          ctx.drawImage(cached, 0, 0, outW, outH);
        }
        self.postMessage({
          type: "canvas-result",
          assetKey,
          canvas,
          present: !!cached
        });
        break;
      }
      case "clear-cache": {
        rasterCache.clear();
        self.postMessage({ type: "cache-cleared" });
        break;
      }
      case "set-cache-max-entries": {
        if (request.value !== void 0) {
          rasterCache.setMaxEntries(request.value);
          self.postMessage({ type: "cache-config-updated" });
        }
        break;
      }
      case "set-cache-max-age": {
        if (request.value !== void 0) {
          rasterCache.setMaxAge(request.value);
          self.postMessage({ type: "cache-config-updated" });
        }
        break;
      }
    }
  } catch (error) {
    console.error("[svgRasterWorker] Error processing request:", error);
  }
});
//# sourceMappingURL=svgRasterWorker.js.map
