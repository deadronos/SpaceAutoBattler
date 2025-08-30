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
  try {
    const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;
    throw new Error("Worker SVG parsing not yet implemented - using geometric fallback");
  } catch (error) {
    console.log("[svgRasterWorker] Creating geometric fallback shape");
    const centerX = width / 2;
    const centerY = height / 2;
    const size = Math.min(width, height) * 0.8;
    if (teamColor) {
      ctx.fillStyle = teamColor;
      ctx.globalAlpha = 0.3;
      ctx.fillRect(0, 0, width, height);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - size / 2);
    ctx.lineTo(centerX + size / 4, centerY);
    ctx.lineTo(centerX + size / 6, centerY + size / 3);
    ctx.lineTo(centerX - size / 6, centerY + size / 3);
    ctx.lineTo(centerX - size / 4, centerY);
    ctx.closePath();
    ctx.fill();
    if (teamColor) {
      ctx.strokeStyle = teamColor;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    return canvas.transferToImageBitmap();
  }
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
