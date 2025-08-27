var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/config/assets/assetsConfig.ts
function getEngineTrailConfig(type) {
  const vconf = getVisualConfig(type);
  const trailName = vconf.visuals && vconf.visuals.engineTrail || "engineTrail";
  return AssetsConfig.animations && AssetsConfig.animations[trailName] || AssetsConfig.animations && AssetsConfig.animations.engineTrail;
}
function getSpriteAsset(type) {
  const inlineSvg = AssetsConfig.svgAssets && AssetsConfig.svgAssets[type];
  if (typeof inlineSvg === "string" && inlineSvg.trim().startsWith("<svg")) {
    return { svg: inlineSvg };
  }
  const shapeEntry = AssetsConfig.shapes2d[type] || AssetsConfig.shapes2d.fighter;
  if (shapeEntry.svg) {
    return { svg: shapeEntry.svg };
  }
  if (shapeEntry.model3d && shapeEntry.model3d.url) {
    return { model3d: shapeEntry.model3d };
  }
  return { shape: shapeEntry };
}
function getVisualConfig(type) {
  const shape = getShipAsset(type);
  const visuals = AssetsConfig.visualStateDefaults[type] || AssetsConfig.visualStateDefaults.fighter;
  return { shape, visuals, palette: AssetsConfig.palette, animations: AssetsConfig.animations, damageStates: AssetsConfig.damageStates };
}
function getShipAsset(type) {
  return AssetsConfig.shapes2d[type] || AssetsConfig.shapes2d.fighter;
}
function getBulletAsset(kind = "small") {
  if (kind === "large") return AssetsConfig.shapes2d.bulletLarge;
  if (kind === "medium") return AssetsConfig.shapes2d.bulletMedium;
  return AssetsConfig.shapes2d.bulletSmall;
}
function getTurretAsset(_kind = "basic") {
  return AssetsConfig.shapes2d.turretBasic;
}
var AssetsConfig, assetsConfig_default;
var init_assetsConfig = __esm({
  "src/config/assets/assetsConfig.ts"() {
    "use strict";
    AssetsConfig = {
      meta: {
        orientation: "+X",
        coordinateSystem: "topdown-2d"
      },
      palette: {
        shipHull: "#b0b7c3",
        shipAccent: "#6c7380",
        bullet: "#ffd166",
        turret: "#94a3b8",
        // Scene background color used by renderers
        background: "#0b1220"
      },
      // 2D vector shapes defined as polygons and circles. Points are unit-sized
      // profiles (roughly radius 1). Renderer should multiply by entity radius or
      // provided scale before drawing.
      shapes2d: {
        fighter: {
          type: "compound",
          parts: [
            { type: "polygon", points: [[1.2, 0], [-0.8, 0.6], [-0.5, 0], [-0.8, -0.6]] },
            { type: "polygon", points: [[0, 0.35], [-0.6, 0.65], [-0.35, 0]] },
            { type: "polygon", points: [[0, -0.35], [-0.35, 0], [-0.6, -0.65]] },
            { type: "circle", r: 0.5 }
          ],
          strokeWidth: 0.08,
          model3d: { url: void 0, scale: 1, type: "gltf", mesh: void 0 }
        },
        corvette: {
          type: "compound",
          parts: [
            { type: "polygon", points: [[1.2, 0], [0.4, 0.7], [-1, 0.6], [-1.2, 0], [-1, -0.6], [0.4, -0.7]] },
            { type: "polygon", points: [[1.4, 0.22], [1.2, 0.12], [1.2, -0.12], [1.4, -0.22]] },
            { type: "circle", r: 0.6 }
          ],
          strokeWidth: 0.08,
          model3d: { url: void 0, scale: 1.4, type: "gltf", mesh: void 0 }
        },
        frigate: {
          type: "compound",
          parts: [
            { type: "polygon", points: [[1.3, 0], [0.7, 0.65], [-0.3, 1], [-1.3, 0.55], [-1.3, -0.55], [-0.3, -1], [0.7, -0.65]] },
            { type: "circle", r: 0.7 }
          ],
          strokeWidth: 0.1,
          model3d: { url: void 0, scale: 1.8, type: "gltf", mesh: void 0 }
        },
        destroyer: {
          type: "compound",
          parts: [
            { type: "polygon", points: [[1.8, 0], [1, 0.7], [0.2, 1], [-0.8, 0.9], [-1.8, 0.6], [-1.8, -0.6], [-0.8, -0.9], [0.2, -1], [1, -0.7]] },
            { type: "circle", r: 1 },
            { type: "polygon", points: [[2, 0.3], [1.8, 0.2], [1.8, -0.2], [2, -0.3]] }
          ],
          strokeWidth: 0.12,
          model3d: { url: void 0, scale: 2.2, type: "gltf", mesh: void 0 },
          turrets: [
            { kind: "basic", position: [1.2, 0.8] },
            { kind: "basic", position: [-1.2, 0.8] },
            { kind: "basic", position: [1.2, -0.8] },
            { kind: "basic", position: [-1.2, -0.8] },
            { kind: "basic", position: [0, 1.5] },
            { kind: "basic", position: [0, -1.5] }
          ]
        },
        carrier: {
          type: "compound",
          parts: [
            { type: "polygon", points: [[2.2, 0], [1.2, 1.2], [-1, 1.6], [-2.8, 1.2], [-3.2, 0], [-2.8, -1.2], [-1, -1.6], [1.2, -1.2]] },
            { type: "circle", r: 1.2 },
            { type: "polygon", points: [[2.6, 0.5], [2.2, 0.3], [2.2, -0.3], [2.6, -0.5]] }
          ],
          strokeWidth: 0.12,
          model3d: { url: void 0, scale: 3, type: "gltf", mesh: void 0 },
          turrets: [
            { kind: "basic", position: [2, 1.2] },
            { kind: "basic", position: [-2, 1.2] },
            { kind: "basic", position: [2, -1.2] },
            { kind: "basic", position: [-2, -1.2] }
          ]
        },
        bulletSmall: { type: "circle", r: 0.18 },
        bulletMedium: { type: "circle", r: 0.25 },
        bulletLarge: { type: "circle", r: 0.36 },
        turretBasic: {
          type: "compound",
          parts: [
            { type: "circle", r: 0.5 },
            { type: "polygon", points: [[-0.2, 0.2], [0.7, 0.2], [0.7, -0.2], [-0.2, -0.2]] }
          ],
          strokeWidth: 0.08
        },
        // Small effect/particle shapes for renderer-driven effects
        particleSmall: { type: "circle", r: 0.12 },
        particleMedium: { type: "circle", r: 0.22 },
        explosionParticle: { type: "circle", r: 0.32 },
        shieldRing: { type: "circle", r: 1.2 }
      }
    };
    if (typeof globalThis !== "undefined" && globalThis.__INLINE_SVG_ASSETS) {
      AssetsConfig.svgAssets = globalThis.__INLINE_SVG_ASSETS;
    } else {
      AssetsConfig.svgAssets = {
        destroyer: "./svg/destroyer.svg",
        carrier: "./svg/carrier.svg",
        frigate: "./svg/frigate.svg",
        corvette: "./svg/corvette.svg"
      };
    }
    AssetsConfig.svgMounts = {
      destroyer: AssetsConfig.shapes2d.destroyer.turrets ? AssetsConfig.shapes2d.destroyer.turrets.map((t) => t.position) : [],
      carrier: AssetsConfig.shapes2d.carrier.turrets ? AssetsConfig.shapes2d.carrier.turrets.map((t) => t.position) : []
    };
    AssetsConfig.turretDefaults = {
      basic: { turnRate: Math.PI * 1.5, sprite: "turretBasic" }
    };
    AssetsConfig.animations = {
      engineFlare: {
        type: "polygon",
        points: [[0, 0], [-0.3, 0.15], [-0.5, 0], [-0.3, -0.15]],
        pulseRate: 8,
        // configurable alpha multiplier for engine overlay
        alpha: 0.4,
        // local-space X offset (negative = behind ship)
        offset: -0.9
      },
      shieldEffect: {
        type: "circle",
        r: 1.2,
        strokeWidth: 0.1,
        color: "#88ccff",
        pulseRate: 2,
        // map shieldPct -> alpha = base + scale * shieldPct
        alphaBase: 0.25,
        alphaScale: 0.75
      },
      damageParticles: {
        type: "particles",
        color: "#ff6b6b",
        count: 6,
        lifetime: 0.8,
        spread: 0.6
      },
      engineTrail: {
        type: "trail",
        color: "#fff0a0",
        // brighter, warm highlight for good contrast
        maxLength: 120,
        // longer trail (was 40)
        width: 0.9,
        // thicker trail line (was 0.35)
        fade: 0.6
        // older points remain more visible (was 0.35)
      }
    };
    AssetsConfig.damageStates = {
      light: { opacity: 0.9, accentColor: "#b0b7c3" },
      moderate: { opacity: 0.75, accentColor: "#d4a06a" },
      heavy: { opacity: 0.5, accentColor: "#ff6b6b" }
    };
    AssetsConfig.visualStateDefaults = {
      fighter: { engine: "engineFlare", shield: "shieldEffect", damageParticles: "damageParticles", engineTrail: "engineTrail", arcWidth: Math.PI / 12 },
      corvette: { engine: "engineFlare", shield: "shieldEffect", damageParticles: "damageParticles", engineTrail: "engineTrail", arcWidth: Math.PI / 12 },
      frigate: { engine: "engineFlare", shield: "shieldEffect", damageParticles: "damageParticles", engineTrail: "engineTrail", arcWidth: Math.PI / 12 },
      destroyer: { engine: "engineFlare", shield: "shieldEffect", damageParticles: "damageParticles", engineTrail: "engineTrail", arcWidth: Math.PI / 12 },
      carrier: { engine: "engineFlare", shield: "shieldEffect", damageParticles: "damageParticles", engineTrail: "engineTrail", arcWidth: Math.PI / 12 }
    };
    AssetsConfig.damageThresholds = { moderate: 0.66, heavy: 0.33 };
    AssetsConfig.shieldArcWidth = Math.PI / 12;
    assetsConfig_default = AssetsConfig;
  }
});

// src/config/displayConfig.ts
var DISPLAY_DEFAULTS;
var init_displayConfig = __esm({
  "src/config/displayConfig.ts"() {
    "use strict";
    DISPLAY_DEFAULTS = {
      renderScale: 1,
      displayScale: 1,
      hpBar: { bg: "#222", fill: "#4caf50", w: 20, h: 4, dx: -10, dy: -12 }
    };
  }
});

// src/config/rendererConfig.ts
var rendererConfig_exports = {};
__export(rendererConfig_exports, {
  RendererConfig: () => RendererConfig,
  default: () => rendererConfig_default,
  getPreferredRenderer: () => getPreferredRenderer
});
function getPreferredRenderer() {
  try {
    if (RendererConfig.allowUrlOverride && typeof window !== "undefined" && window.location && window.location.search) {
      const p = new URLSearchParams(window.location.search);
      const r = p.get("renderer");
      if (r === "canvas" || r === "webgl") return r;
    }
  } catch (e) {
  }
  return RendererConfig.preferred;
}
var RendererConfig, rendererConfig_default;
var init_rendererConfig = __esm({
  "src/config/rendererConfig.ts"() {
    "use strict";
    init_displayConfig();
    RendererConfig = {
      preferred: "canvas",
      allowUrlOverride: true,
      allowWebGL: true,
      renderScale: DISPLAY_DEFAULTS.renderScale,
      displayScale: DISPLAY_DEFAULTS.displayScale,
      dynamicScaleEnabled: false,
      lastFrameTime: 0,
      frameScore: "green",
      // green, yellow, red
      // UI overlays configuration
      hpBar: DISPLAY_DEFAULTS.hpBar,
      // starfield rendering tweaks
      starfield: {
        parallaxFactor: 0.01,
        // how much the starfield moves relative to camera (0 = static)
        density: 35e-5,
        // base star density multiplier (stars = size*size*density)
        bloomIntensity: 0.9
        // applied alpha when compositing bloom on canvas
      }
    };
    rendererConfig_default = RendererConfig;
  }
});

// src/math/polygon.ts
function polygonSimplify(points, tolerance) {
  if (points.length < 3) return points;
  const sqTolerance = tolerance * tolerance;
  function getSqDist(p1, p2) {
    const dx = p1[0] - p2[0], dy = p1[1] - p2[1];
    return dx * dx + dy * dy;
  }
  function getSqSegDist(p, a, b) {
    const x = a[0], y = a[1];
    const dx = b[0] - x;
    const dy = b[1] - y;
    if (dx === 0 && dy === 0) return getSqDist(p, a);
    const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
    if (t <= 0) return getSqDist(p, a);
    if (t >= 1) return getSqDist(p, b);
    const projX = x + t * dx;
    const projY = y + t * dy;
    const ddx = p[0] - projX;
    const ddy = p[1] - projY;
    return ddx * ddx + ddy * ddy;
  }
  function simplifyDP(start, end, out2) {
    let maxDist = 0, index = -1;
    for (let i = start + 1; i < end; i++) {
      const dist = getSqSegDist(points[i], points[start], points[end]);
      if (dist > maxDist) {
        maxDist = dist;
        index = i;
      }
    }
    if (maxDist > sqTolerance && index !== -1) {
      simplifyDP(start, index, out2);
      simplifyDP(index, end, out2);
    } else {
      out2.push(start);
    }
  }
  const out = [];
  simplifyDP(0, points.length - 1, out);
  out.push(points.length - 1);
  return out.map((i) => points[i]);
}
var init_polygon = __esm({
  "src/math/polygon.ts"() {
    "use strict";
  }
});

// src/assets/svgToPolylines.ts
function hashStringToKey(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(36);
}
function parseViewBox(svgEl) {
  const vbAttr = svgEl && (svgEl.getAttribute && svgEl.getAttribute("viewBox"));
  if (vbAttr) {
    const parts = vbAttr.trim().split(/[,\s]+/).map((s) => parseFloat(s));
    if (parts.length >= 4 && parts.every((n) => !Number.isNaN(n))) {
      return { x: parts[0], y: parts[1], w: parts[2], h: parts[3] };
    }
  }
  if (svgEl && svgEl.getAttribute) {
    const wAttr = svgEl.getAttribute("width");
    const hAttr = svgEl.getAttribute("height");
    const w = wAttr ? parseFloat(wAttr) || 128 : 128;
    const h = hAttr ? parseFloat(hAttr) || 128 : 128;
    return { x: 0, y: 0, w, h };
  }
  return { x: 0, y: 0, w: 128, h: 128 };
}
function multiplyMatrix(a, b) {
  const [a1, a2, a3, a4, a5, a6] = a;
  const [b1, b2, b3, b4, b5, b6] = b;
  return [
    a1 * b1 + a3 * b2,
    a2 * b1 + a4 * b2,
    a1 * b3 + a3 * b4,
    a2 * b3 + a4 * b4,
    a1 * b5 + a3 * b6 + a5,
    a2 * b5 + a4 * b6 + a6
  ];
}
function applyMatrixToPoint(m, x, y) {
  const [a, b, c, d, e, f] = m;
  return [a * x + c * y + e, b * x + d * y + f];
}
function applyMatrixToPoints(m, pts) {
  for (let i = 0; i < pts.length; i++) {
    const [x, y] = pts[i];
    const p = applyMatrixToPoint(m, x, y);
    pts[i][0] = p[0];
    pts[i][1] = p[1];
  }
}
function isIdentityMatrix(m) {
  return m[0] === 1 && m[1] === 0 && m[2] === 0 && m[3] === 1 && m[4] === 0 && m[5] === 0;
}
function parseTransform(transformStr) {
  if (!transformStr) return IDENTITY_MATRIX;
  let m = IDENTITY_MATRIX;
  const re = /([a-zA-Z]+)\s*\(([^)]+)\)/g;
  let mm;
  while (mm = re.exec(transformStr)) {
    const cmd = mm[1].trim();
    const raw = mm[2].trim();
    const nums = raw.split(/[\s,]+/).filter(Boolean).map((s) => parseFloat(s));
    let t = IDENTITY_MATRIX;
    try {
      if (cmd === "matrix" && nums.length >= 6) {
        t = [nums[0], nums[1], nums[2], nums[3], nums[4], nums[5]];
      } else if (cmd === "translate") {
        const tx = nums[0] || 0;
        const ty = nums[1] || 0;
        t = [1, 0, 0, 1, tx, ty];
      } else if (cmd === "scale") {
        const sx = nums[0] || 1;
        const sy = typeof nums[1] === "number" ? nums[1] : sx;
        t = [sx, 0, 0, sy, 0, 0];
      } else if (cmd === "rotate") {
        const a = (nums[0] || 0) * Math.PI / 180;
        const cosA = Math.cos(a), sinA = Math.sin(a);
        if (nums.length >= 3) {
          const cx = nums[1], cy = nums[2];
          const to = [1, 0, 0, 1, cx, cy];
          const rot = [cosA, sinA, -sinA, cosA, 0, 0];
          const back = [1, 0, 0, 1, -cx, -cy];
          t = multiplyMatrix(to, multiplyMatrix(rot, back));
        } else {
          t = [cosA, sinA, -sinA, cosA, 0, 0];
        }
      } else if (cmd === "skewX") {
        const a = (nums[0] || 0) * Math.PI / 180;
        t = [1, 0, Math.tan(a), 1, 0, 0];
      } else if (cmd === "skewY") {
        const a = (nums[0] || 0) * Math.PI / 180;
        t = [1, Math.tan(a), 0, 1, 0, 0];
      }
    } catch (e) {
      t = IDENTITY_MATRIX;
    }
    m = multiplyMatrix(m, t);
  }
  return m;
}
function computeCumulativeTransform(el, svgEl) {
  let m = IDENTITY_MATRIX;
  const chain = [];
  let cur = el;
  while (cur && cur !== svgEl && cur.nodeType === 1) {
    chain.push(cur);
    cur = cur.parentElement;
  }
  if (svgEl && svgEl !== el) chain.push(svgEl);
  for (let i = chain.length - 1; i >= 0; i--) {
    const e = chain[i];
    try {
      const t = parseTransform(e.getAttribute && e.getAttribute("transform"));
      m = multiplyMatrix(m, t);
    } catch (e2) {
    }
  }
  return m;
}
function parsePointsAttr(val) {
  const parts = val.trim().split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
  const pts = [];
  for (let i = 0; i + 1 < parts.length; i += 2) {
    const x = parseFloat(parts[i]);
    const y = parseFloat(parts[i + 1]);
    if (!Number.isNaN(x) && !Number.isNaN(y)) pts.push([x, y]);
  }
  return pts;
}
function applyViewBoxNormalization(points, vb) {
  const hw = (vb.w || 1) / 2;
  const hh = (vb.h || 1) / 2;
  const cx = (vb.x || 0) + hw;
  const cy = (vb.y || 0) + hh;
  return points.map(([x, y]) => [(x - cx) / hw, (y - cy) / hh]);
}
function sampleCircle(cx, cy, r, segments = 48) {
  const pts = [];
  for (let i = 0; i < segments; i++) {
    const a = i / segments * Math.PI * 2;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}
function parsePathCommands(d, tolerance) {
  const tokens = d.replace(/,/g, " ").replace(/\s+/g, " ").trim();
  const cmdRe = /([MmLlHhVvZzCcSsQqTtAa])([^MmLlHhVvZzCcSsQqTtAa]*)/g;
  const pts = [];
  let curX = 0, curY = 0;
  let lastCpx = null, lastCpy = null;
  let m;
  while (m = cmdRe.exec(tokens)) {
    const cmd = m[1];
    const rawArgs = m[2].trim();
    const args = rawArgs ? rawArgs.split(/[\s,]+/).filter(Boolean).map((s) => parseFloat(s)) : [];
    let ai = 0;
    if (cmd === "Z" || cmd === "z") {
      continue;
    }
    if (cmd === "H" || cmd === "h") {
      while (ai < args.length) {
        const x = args[ai++];
        curX = cmd === "h" ? curX + x : x;
        pts.push([curX, curY]);
      }
      lastCpx = lastCpy = null;
      continue;
    }
    if (cmd === "V" || cmd === "v") {
      while (ai < args.length) {
        const y = args[ai++];
        curY = cmd === "v" ? curY + y : y;
        pts.push([curX, curY]);
      }
      lastCpx = lastCpy = null;
      continue;
    }
    if (cmd === "M" || cmd === "m" || cmd === "L" || cmd === "l") {
      while (ai + 1 < args.length) {
        const ax = args[ai++], ay = args[ai++];
        if (cmd === "m" || cmd === "l") {
          curX += ax;
          curY += ay;
        } else {
          curX = ax;
          curY = ay;
        }
        pts.push([curX, curY]);
      }
      lastCpx = lastCpy = null;
      continue;
    }
    if (cmd === "C" || cmd === "c") {
      while (ai + 5 < args.length) {
        const x1 = args[ai++], y1 = args[ai++], x2 = args[ai++], y2 = args[ai++], x = args[ai++], y = args[ai++];
        const cp1x = cmd === "c" ? curX + x1 : x1;
        const cp1y = cmd === "c" ? curY + y1 : y1;
        const cp2x = cmd === "c" ? curX + x2 : x2;
        const cp2y = cmd === "c" ? curY + y2 : y2;
        const ex = cmd === "c" ? curX + x : x;
        const ey = cmd === "c" ? curY + y : y;
        const cubicPts = flattenCubicBezier([curX, curY], [cp1x, cp1y], [cp2x, cp2y], [ex, ey], tolerance);
        for (let i = 1; i < cubicPts.length; i++) pts.push(cubicPts[i]);
        curX = ex;
        curY = ey;
        lastCpx = cp2x;
        lastCpy = cp2y;
      }
      continue;
    }
    if (cmd === "S" || cmd === "s") {
      while (ai + 3 < args.length) {
        const x2 = args[ai++], y2 = args[ai++], x = args[ai++], y = args[ai++];
        let cp1x = curX, cp1y = curY;
        if (lastCpx != null && lastCpy != null) {
          cp1x = curX + (curX - lastCpx);
          cp1y = curY + (curY - lastCpy);
        }
        const cp2x = cmd === "s" ? curX + x2 : x2;
        const cp2y = cmd === "s" ? curY + y2 : y2;
        const ex = cmd === "s" ? curX + x : x;
        const ey = cmd === "s" ? curY + y : y;
        const cubicPts2 = flattenCubicBezier([curX, curY], [cp1x, cp1y], [cp2x, cp2y], [ex, ey], tolerance);
        for (let i = 1; i < cubicPts2.length; i++) pts.push(cubicPts2[i]);
        lastCpx = cp2x;
        lastCpy = cp2y;
        curX = ex;
        curY = ey;
      }
      continue;
    }
    if (cmd === "Q" || cmd === "q") {
      while (ai + 3 < args.length) {
        const x1 = args[ai++], y1 = args[ai++], x = args[ai++], y = args[ai++];
        const qx1 = cmd === "q" ? curX + x1 : x1;
        const qy1 = cmd === "q" ? curY + y1 : y1;
        const ex = cmd === "q" ? curX + x : x;
        const ey = cmd === "q" ? curY + y : y;
        const qpts = flattenQuadraticBezier([curX, curY], [qx1, qy1], [ex, ey], tolerance);
        for (let i = 1; i < qpts.length; i++) pts.push(qpts[i]);
        lastCpx = qx1;
        lastCpy = qy1;
        curX = ex;
        curY = ey;
      }
      continue;
    }
    if (cmd === "T" || cmd === "t") {
      while (ai + 1 < args.length) {
        const x = args[ai++], y = args[ai++];
        let qx1 = curX, qy1 = curY;
        if (lastCpx != null && lastCpy != null) {
          qx1 = curX + (curX - lastCpx);
          qy1 = curY + (curY - lastCpy);
        }
        const ex = cmd === "t" ? curX + x : x;
        const ey = cmd === "t" ? curY + y : y;
        const qpts2 = flattenQuadraticBezier([curX, curY], [qx1, qy1], [ex, ey], tolerance);
        for (let i = 1; i < qpts2.length; i++) pts.push(qpts2[i]);
        lastCpx = qx1;
        lastCpy = qy1;
        curX = ex;
        curY = ey;
      }
      continue;
    }
    if (cmd === "A" || cmd === "a") {
      while (ai + 6 < args.length) {
        const rx = args[ai++], ry = args[ai++], xrot = args[ai++], laf = args[ai++], sf = args[ai++], x = args[ai++], y = args[ai++];
        const ex = cmd === "a" ? curX + x : x;
        const ey = cmd === "a" ? curY + y : y;
        const arcPts = arcToPoints(curX, curY, ex, ey, rx, ry, xrot, laf ? 1 : 0, sf ? 1 : 0, Math.max(0.1, tolerance));
        for (let i = 1; i < arcPts.length; i++) pts.push(arcPts[i]);
        curX = ex;
        curY = ey;
        lastCpx = lastCpy = null;
      }
      continue;
    }
  }
  return pts;
}
function distToSegmentSq(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  if (dx === 0 && dy === 0) return (px - x1) * (px - x1) + (py - y1) * (py - y1);
  const t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
  if (t <= 0) return (px - x1) * (px - x1) + (py - y1) * (py - y1);
  if (t >= 1) return (px - x2) * (px - x2) + (py - y2) * (py - y2);
  const projx = x1 + t * dx, projy = y1 + t * dy;
  return (px - projx) * (px - projx) + (py - projy) * (py - projy);
}
function flattenCubicBezier(p0, p1, p2, p3, tolerance) {
  const tolSq = tolerance * tolerance;
  const out = [];
  function recurse(a, b, c, d) {
    const d1 = distToSegmentSq(b[0], b[1], a[0], a[1], d[0], d[1]);
    const d2 = distToSegmentSq(c[0], c[1], a[0], a[1], d[0], d[1]);
    if (Math.max(d1, d2) <= tolSq) {
      out.push([d[0], d[1]]);
      return;
    }
    const ab = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const bc = [(b[0] + c[0]) / 2, (b[1] + c[1]) / 2];
    const cd = [(c[0] + d[0]) / 2, (c[1] + d[1]) / 2];
    const abc = [(ab[0] + bc[0]) / 2, (ab[1] + bc[1]) / 2];
    const bcd = [(bc[0] + cd[0]) / 2, (bc[1] + cd[1]) / 2];
    const abcd = [(abc[0] + bcd[0]) / 2, (abc[1] + bcd[1]) / 2];
    recurse(a, ab, abc, abcd);
    recurse(abcd, bcd, cd, d);
  }
  out.push([p0[0], p0[1]]);
  recurse(p0, p1, p2, p3);
  return out;
}
function flattenQuadraticBezier(p0, p1, p2, tolerance) {
  const cp1 = [p0[0] + 2 / 3 * (p1[0] - p0[0]), p0[1] + 2 / 3 * (p1[1] - p0[1])];
  const cp2 = [p2[0] + 2 / 3 * (p1[0] - p2[0]), p2[1] + 2 / 3 * (p1[1] - p2[1])];
  const pts = flattenCubicBezier(p0, cp1, cp2, p2, tolerance);
  if (pts.length >= 4) return pts;
  const samples = 4;
  const out = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const mt = 1 - t;
    const x = mt * mt * p0[0] + 2 * mt * t * p1[0] + t * t * p2[0];
    const y = mt * mt * p0[1] + 2 * mt * t * p1[1] + t * t * p2[1];
    out.push([x, y]);
  }
  return out;
}
function arcToPoints(x1, y1, x2, y2, rx, ry, angle, largeArcFlag, sweepFlag, tolerance) {
  const rad = angle * Math.PI / 180;
  const cosA = Math.cos(rad), sinA = Math.sin(rad);
  if (rx === 0 || ry === 0) return [[x1, y1], [x2, y2]];
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
  const x1p = cosA * dx + sinA * dy;
  const y1p = -sinA * dx + cosA * dy;
  let rxAbs = Math.abs(rx), ryAbs = Math.abs(ry);
  const lambda = x1p * x1p / (rxAbs * rxAbs) + y1p * y1p / (ryAbs * ryAbs);
  if (lambda > 1) {
    const s = Math.sqrt(lambda);
    rxAbs *= s;
    ryAbs *= s;
  }
  const rx2 = rxAbs * rxAbs, ry2 = ryAbs * ryAbs;
  const sign = largeArcFlag === sweepFlag ? -1 : 1;
  const num = rx2 * ry2 - rx2 * y1p * y1p - ry2 * x1p * x1p;
  const denom = rx2 * y1p * y1p + ry2 * x1p * x1p;
  let cc = 0;
  if (denom !== 0) cc = Math.max(0, num / denom);
  const coef = sign * Math.sqrt(cc || 0);
  const cxp = coef * (rxAbs * y1p) / ryAbs;
  const cyp = coef * -(ryAbs * x1p) / rxAbs;
  const cx = cosA * cxp - sinA * cyp + (x1 + x2) / 2;
  const cy = sinA * cxp + cosA * cyp + (y1 + y2) / 2;
  function angleBetween(ux2, uy2, vx2, vy2) {
    const dot = ux2 * vx2 + uy2 * vy2;
    const l = Math.hypot(ux2, uy2) * Math.hypot(vx2, vy2);
    let a = Math.acos(Math.max(-1, Math.min(1, dot / (l || 1))));
    if (ux2 * vy2 - uy2 * vx2 < 0) a = -a;
    return a;
  }
  const ux = (x1p - cxp) / rxAbs, uy = (y1p - cyp) / ryAbs;
  const vx = (-x1p - cxp) / rxAbs, vy = (-y1p - cyp) / ryAbs;
  let startAng = angleBetween(1, 0, ux, uy);
  let deltaAng = angleBetween(ux, uy, vx, vy);
  if (!sweepFlag && deltaAng > 0) deltaAng -= 2 * Math.PI;
  else if (sweepFlag && deltaAng < 0) deltaAng += 2 * Math.PI;
  const r = Math.max(rxAbs, ryAbs);
  const estLen = Math.abs(deltaAng) * r;
  const segCount = Math.max(4, Math.ceil(estLen / Math.max(1, tolerance * 4)));
  const pts = [];
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
function svgToPolylines(svgString, options = {}) {
  const tolerance = typeof options.tolerance === "number" ? options.tolerance : 0.1;
  try {
    const key = options && options.assetId ? `${options.assetId}::${tolerance}` : hashStringToKey(svgString + "::" + tolerance);
    const entry = SVG_POLY_CACHE.get(key);
    if (entry) {
      if (Date.now() - entry.ts < CACHE_MAX_AGE_MS) {
        SVG_POLY_CACHE.delete(key);
        SVG_POLY_CACHE.set(key, entry);
        CACHE_HITS++;
        return entry.value;
      }
      SVG_POLY_CACHE.delete(key);
      CACHE_MISSES++;
    } else {
      CACHE_MISSES++;
    }
  } catch (e) {
  }
  const DP = globalThis.DOMParser;
  if (!DP) {
    throw new Error("DOMParser not available in this environment");
  }
  const parser = new DP();
  const doc = parser.parseFromString(svgString, "image/svg+xml");
  const svgEl = doc.querySelector("svg") || doc.documentElement;
  const vb = parseViewBox(svgEl);
  const contours = [];
  function pushContour(raw) {
    if (!raw || raw.length === 0) return;
    const first = raw[0];
    const last = raw[raw.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
    }
    const norm = applyViewBoxNormalization(raw, vb);
    const simp = polygonSimplify(norm, tolerance);
    if (simp && simp.length >= 2) contours.push(simp);
  }
  const polys = Array.from(doc.querySelectorAll("polygon, polyline"));
  for (const el of polys) {
    const ptsAttr = el.getAttribute("points") || "";
    const pts = parsePointsAttr(ptsAttr);
    try {
      const mtx = computeCumulativeTransform(el, svgEl);
      if (!isIdentityMatrix(mtx) && pts.length) applyMatrixToPoints(mtx, pts);
    } catch (e) {
    }
    pushContour(pts);
  }
  const rects = Array.from(doc.querySelectorAll("rect"));
  for (const r of rects) {
    const x = parseFloat(r.getAttribute("x") || "0");
    const y = parseFloat(r.getAttribute("y") || "0");
    const w = parseFloat(r.getAttribute("width") || "0");
    const h = parseFloat(r.getAttribute("height") || "0");
    const pts = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
    try {
      const mtx = computeCumulativeTransform(r, svgEl);
      if (!isIdentityMatrix(mtx)) applyMatrixToPoints(mtx, pts);
    } catch (e) {
    }
    pushContour(pts);
  }
  const circles = Array.from(doc.querySelectorAll("circle"));
  for (const c of circles) {
    const cx = parseFloat(c.getAttribute("cx") || "0");
    const cy = parseFloat(c.getAttribute("cy") || "0");
    const r = parseFloat(c.getAttribute("r") || "0");
    if (r > 0) {
      const pts = sampleCircle(cx, cy, r, 24);
      try {
        const mtx = computeCumulativeTransform(c, svgEl);
        if (!isIdentityMatrix(mtx)) applyMatrixToPoints(mtx, pts);
      } catch (ex) {
      }
      pushContour(pts);
    }
  }
  const ellipses = Array.from(doc.querySelectorAll("ellipse"));
  for (const e of ellipses) {
    const cx = parseFloat(e.getAttribute("cx") || "0");
    const cy = parseFloat(e.getAttribute("cy") || "0");
    const rx = parseFloat(e.getAttribute("rx") || "0");
    const ry = parseFloat(e.getAttribute("ry") || "0");
    if (rx > 0 && ry > 0) {
      const pts = [];
      const segs = 48;
      for (let i = 0; i < segs; i++) {
        const a = i / segs * Math.PI * 2;
        pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
      }
      try {
        const mtx = computeCumulativeTransform(e, svgEl);
        if (!isIdentityMatrix(mtx)) applyMatrixToPoints(mtx, pts);
      } catch (ex) {
      }
      pushContour(pts);
    }
  }
  const paths = Array.from(doc.querySelectorAll("path"));
  for (const p of paths) {
    const d = p.getAttribute("d") || "";
    if (!d.trim()) continue;
    try {
      const pts = parsePathCommands(d, tolerance);
      try {
        const mtx = computeCumulativeTransform(p, svgEl);
        if (!isIdentityMatrix(mtx) && pts.length) applyMatrixToPoints(mtx, pts);
      } catch (ex) {
      }
      pushContour(pts);
    } catch (e) {
    }
  }
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
    minX = 0;
    minY = 0;
    maxX = 0;
    maxY = 0;
  }
  const result = { contours, bbox: { minX, minY, maxX, maxY } };
  try {
    const key = options && options.assetId ? `${options.assetId}::${tolerance}` : hashStringToKey(svgString + "::" + tolerance);
    SVG_POLY_CACHE.set(key, { ts: Date.now(), value: result });
    while (SVG_POLY_CACHE.size > CACHE_MAX_ENTRIES) {
      const firstKey = SVG_POLY_CACHE.keys().next().value;
      if (!firstKey) break;
      SVG_POLY_CACHE.delete(firstKey);
    }
  } catch (e) {
  }
  return result;
}
var SVG_POLY_CACHE, CACHE_MAX_ENTRIES, CACHE_MAX_AGE_MS, CACHE_HITS, CACHE_MISSES, IDENTITY_MATRIX;
var init_svgToPolylines = __esm({
  "src/assets/svgToPolylines.ts"() {
    "use strict";
    init_polygon();
    SVG_POLY_CACHE = /* @__PURE__ */ new Map();
    CACHE_MAX_ENTRIES = 200;
    CACHE_MAX_AGE_MS = 1e3 * 60 * 60;
    CACHE_HITS = 0;
    CACHE_MISSES = 0;
    IDENTITY_MATRIX = [1, 0, 0, 1, 0, 0];
  }
});

// src/assets/svgLoader.ts
var svgLoader_exports = {};
__export(svgLoader_exports, {
  applyTeamColorsToSvg: () => applyTeamColorsToSvg,
  ensureRasterizedAndCached: () => ensureRasterizedAndCached,
  getCachedHullCanvasSync: () => getCachedHullCanvasSync,
  getHullOutlineFromSvg: () => getHullOutlineFromSvg,
  parseSvgForMounts: () => parseSvgForMounts,
  rasterizeHullOnlySvgToCanvas: () => rasterizeHullOnlySvgToCanvas,
  rasterizeHullOnlySvgToCanvasAsync: () => rasterizeHullOnlySvgToCanvasAsync,
  rasterizeSvgToCanvas: () => rasterizeSvgToCanvas,
  rasterizeSvgToCanvasAsync: () => rasterizeSvgToCanvasAsync
});
function getHullOutlineFromSvg(svgText, tolerance = 1.5, assetFilename) {
  const hullSvg = stripHullOnly(svgText);
  try {
    let assetId = void 0;
    if (assetFilename) {
      try {
        assetId = assetFilename;
      } catch (e) {
        assetId = assetFilename;
      }
    }
    return svgToPolylines(
      hullSvg,
      assetId ? { tolerance, assetId } : { tolerance }
    );
  } catch (e) {
    return svgToPolylines(hullSvg, { tolerance });
  }
}
function parseSvgForMounts(svgText) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, "image/svg+xml");
    const svg = doc.querySelector("svg");
    if (!svg)
      return { mounts: [], engineMounts: [], viewBox: null, colorRegions: [] };
    const vbAttr = svg.getAttribute("viewBox");
    let viewBox = null;
    if (vbAttr) {
      const parts = vbAttr.trim().split(/[\s,]+/).map((s) => parseFloat(s));
      if (parts.length >= 4 && !isNaN(parts[2]) && !isNaN(parts[3])) {
        viewBox = { w: parts[2], h: parts[3] };
      }
    }
    const toNumber = (v) => {
      const n = v == null ? NaN : parseFloat(v);
      return isNaN(n) ? null : n;
    };
    const mountEls = Array.from(
      svg.querySelectorAll("[data-mount], .turret")
    );
    const mounts = mountEls.map((el) => {
      const slot = el.getAttribute("data-mount") || el.classList && (el.classList.contains("turret") ? "turret" : null);
      const xAttr = el.getAttribute("cx") || el.getAttribute("x");
      const yAttr = el.getAttribute("cy") || el.getAttribute("y");
      let x = toNumber(xAttr);
      let y = toNumber(yAttr);
      if ((x == null || y == null) && el.getAttribute("width") && el.getAttribute("height")) {
        const rx = toNumber(el.getAttribute("x"));
        const ry = toNumber(el.getAttribute("y"));
        const rw = toNumber(el.getAttribute("width"));
        const rh = toNumber(el.getAttribute("height"));
        if (rx != null && rw != null) x = rx + rw / 2;
        if (ry != null && rh != null) y = ry + rh / 2;
      }
      return { x, y, slot };
    });
    const engineEls = Array.from(
      svg.querySelectorAll("[data-engine-mount], .engine")
    );
    const engineMounts = engineEls.map((el) => {
      const slot = el.getAttribute("data-engine-mount") || el.classList && (el.classList.contains("engine") ? "engine" : null);
      const xAttr = el.getAttribute("cx") || el.getAttribute("x");
      const yAttr = el.getAttribute("cy") || el.getAttribute("y");
      let x = toNumber(xAttr);
      let y = toNumber(yAttr);
      if ((x == null || y == null) && el.getAttribute("width") && el.getAttribute("height")) {
        const rx = toNumber(el.getAttribute("x"));
        const ry = toNumber(el.getAttribute("y"));
        const rw = toNumber(el.getAttribute("width"));
        const rh = toNumber(el.getAttribute("height"));
        if (rx != null && rw != null) x = rx + rw / 2;
        if (ry != null && rh != null) y = ry + rh / 2;
      }
      return { x, y, slot };
    });
    const colorRegions = Array.from(
      svg.querySelectorAll(
        '[data-team],[data-team-slot],[class*="team-fill-"]'
      )
    ).map((el) => ({
      tag: el.tagName,
      id: el.id || null,
      role: el.getAttribute("data-team") || el.getAttribute("data-team-slot") || null
    }));
    return { mounts, engineMounts, viewBox, colorRegions };
  } catch (e) {
    return { mounts: [], engineMounts: [], viewBox: null, colorRegions: [] };
  }
}
function applyTeamColorsToSvg(svgText, mapping, options) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, "image/svg+xml");
    const svg = doc.querySelector("svg");
    if (!svg) return svgText;
    const applyDefault = options && options.applyTo ? options.applyTo : "both";
    const els = Array.from(
      svg.querySelectorAll(
        '[data-team],[data-team-slot],[data-team-slot-fill],[data-team-slot-stroke],[class*="team-fill-"]'
      )
    );
    for (const el of els) {
      try {
        const role = (el.getAttribute("data-team") || el.getAttribute("data-team-slot") || "").trim();
        const fillRoleAttr = (el.getAttribute("data-team-slot-fill") || "").trim();
        const strokeRoleAttr = (el.getAttribute("data-team-slot-stroke") || "").trim();
        const cls = el.getAttribute("class") || "";
        let classRole;
        try {
          const m = cls.match(/team-fill-([a-z0-9_-]+)/i);
          if (m) classRole = m[1];
        } catch (e) {
          classRole = void 0;
        }
        const resolvedFillRole = fillRoleAttr || role || classRole || "primary";
        const resolvedStrokeRole = strokeRoleAttr || role || classRole || "trim";
        const fillColor = mapping[resolvedFillRole];
        const strokeColor = mapping[resolvedStrokeRole] || fillColor;
        if (!fillColor && !strokeColor) continue;
        const applyAttr = (el.getAttribute("data-team-apply") || "").trim().toLowerCase();
        const apply = applyAttr === "fill" || applyAttr === "stroke" ? applyAttr : applyDefault;
        const setStyleProp = (prop, value) => {
          try {
            el.setAttribute(prop, value);
            const cur = el.getAttribute("style") || "";
            const re = new RegExp("(^|;)\\s*" + prop + "\\s*:\\s*[^;]+", "i");
            if (re.test(cur)) {
              const replaced = cur.replace(re, `$1 ${prop}: ${value}`);
              el.setAttribute("style", replaced);
            } else {
              const next = cur ? cur + `; ${prop}: ${value}` : `${prop}: ${value}`;
              el.setAttribute("style", next);
            }
          } catch (e) {
          }
        };
        if ((apply === "fill" || apply === "both") && fillColor)
          setStyleProp("fill", fillColor);
        if ((apply === "stroke" || apply === "both") && strokeColor)
          setStyleProp("stroke", strokeColor);
      } catch (e) {
        continue;
      }
    }
    return new XMLSerializer().serializeToString(svg);
  } catch (e) {
    return svgText;
  }
}
function encodeSvgDataUrl(svgText) {
  try {
    return "data:image/svg+xml;utf8," + encodeURIComponent(svgText);
  } catch (e) {
    return "data:image/svg+xml;utf8," + svgText;
  }
}
async function tryLoadUrlToCanvas(url, outW, outH) {
  return new Promise((resolve) => {
    let settled = false;
    const to = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(void 0);
      }
    }, 500);
    const safeResolve = (v) => {
      if (!settled) {
        settled = true;
        try {
          clearTimeout(to);
        } catch (e) {
        }
        resolve(v);
      }
    };
    try {
      const img = new Image();
      img.onload = () => {
        try {
          const c = document.createElement("canvas");
          c.width = outW;
          c.height = outH;
          const ctx = c.getContext("2d");
          if (!ctx) return safeResolve(void 0);
          ctx.clearRect(0, 0, outW, outH);
          ctx.drawImage(img, 0, 0, outW, outH);
          safeResolve(c);
        } catch (e) {
          safeResolve(void 0);
        }
      };
      img.onerror = () => safeResolve(void 0);
      img.src = url;
    } catch (e) {
      safeResolve(void 0);
    }
  });
}
function canvasHasOpaquePixels(c, thresholdAlpha = 8) {
  try {
    const ctx = c.getContext("2d");
    if (!ctx) return false;
    const w = Math.max(1, Math.min(16, c.width));
    const h = Math.max(1, Math.min(16, c.height));
    const data = ctx.getImageData(0, 0, w, h).data;
    for (let i = 3; i < data.length; i += 4)
      if (data[i] > thresholdAlpha) return true;
  } catch (e) {
    return true;
  }
  return false;
}
async function rasterizeSvgToCanvasAsync(svgText, outW, outH) {
  const dataUrl = encodeSvgDataUrl(svgText);
  let canvas = await tryLoadUrlToCanvas(dataUrl, outW, outH);
  if (canvas && canvasHasOpaquePixels(canvas)) return canvas;
  try {
    const blob = new Blob([svgText], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    try {
      const c2 = await tryLoadUrlToCanvas(url, outW, outH);
      if (c2 && canvasHasOpaquePixels(c2)) return c2;
      if (c2) return c2;
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch (e) {
  }
  if (canvas) return canvas;
  throw new Error("Failed to rasterize SVG to canvas");
}
function rasterizeSvgToCanvas(svgText, outW, outH) {
  try {
    const dataUrl = encodeSvgDataUrl(svgText);
    const img = new Image();
    img.src = dataUrl;
    if (!img.complete) return void 0;
    const c = document.createElement("canvas");
    c.width = outW;
    c.height = outH;
    const ctx = c.getContext("2d");
    if (!ctx) return void 0;
    ctx.drawImage(img, 0, 0, outW, outH);
    return c;
  } catch (e) {
    return void 0;
  }
}
function stripHullOnly(svgText) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, "image/svg+xml");
    const svg = doc.querySelector("svg");
    if (!svg) return svgText;
    const rects = Array.from(svg.querySelectorAll("rect"));
    for (const r of rects) {
      try {
        const cls = (r.getAttribute("class") || "").toLowerCase();
        if (cls.includes("backdrop") || cls.includes("bg")) r.remove();
        const w = parseFloat(r.getAttribute("width") || "0");
        const h = parseFloat(r.getAttribute("height") || "0");
        if (!isNaN(w) && !isNaN(h) && (w > 1e3 || h > 1e3)) r.remove();
      } catch (e) {
      }
    }
    const turretSelectors = "[data-turret], .turret, [data-weapon], .weapon, [data-turret-slot], [data-weapon-slot]";
    const turrets = Array.from(svg.querySelectorAll(turretSelectors));
    for (const t of turrets) {
      try {
        t.remove();
      } catch (e) {
      }
    }
    return new XMLSerializer().serializeToString(svg);
  } catch (e) {
    return svgText;
  }
}
async function rasterizeHullOnlySvgToCanvasAsync(svgText, outW, outH) {
  const hull = stripHullOnly(svgText);
  return await rasterizeSvgToCanvasAsync(hull, outW, outH);
}
function rasterizeHullOnlySvgToCanvas(svgText, outW, outH) {
  try {
    const c = getCachedHullCanvasSync(svgText, outW, outH);
    if (c) return c;
    const hull = stripHullOnly(svgText);
    const rc = rasterizeSvgToCanvas(hull, outW, outH);
    if (rc) return rc;
  } catch (e) {
  }
  const empty = document.createElement("canvas");
  empty.width = outW;
  empty.height = outH;
  return empty;
}
function getCachedHullCanvasSync(svgText, outW, outH, assetKey) {
  try {
    let svgRenderer = void 0;
    const candidates = [
      "./svgRenderer",
      "../assets/svgRenderer",
      "../../src/assets/svgRenderer",
      "src/assets/svgRenderer"
    ];
    for (const cpath of candidates) {
      try {
        svgRenderer = typeof __require === "function" ? (function() {
          try {
            return __require(cpath);
          } catch (e) {
            return void 0;
          }
        })() : void 0;
        if (svgRenderer) break;
      } catch (e) {
        svgRenderer = svgRenderer || void 0;
      }
    }
    const getCanvasFn = svgRenderer && svgRenderer.getCanvas || svgRenderer && svgRenderer.default && svgRenderer.default.getCanvas;
    try {
      if (!getCanvasFn && typeof globalThis !== "undefined") {
        const g = globalThis.__SpaceAutoBattler_svgRenderer;
        if (g && typeof g.getCanvas === "function") {
          try {
            const c = g.getCanvas(assetKey || "", {}, outW, outH);
            try {
              if (c && typeof globalThis.window !== "undefined" && globalThis.window.__SAB_DEBUG_SVG) {
                console.debug("[svgLoader] global bridge provided canvas", { assetKey, outW, outH });
              }
            } catch (e) {
            }
            if (c) return c;
          } catch (e) {
          }
        }
      }
    } catch (e) {
    }
    if (getCanvasFn && typeof getCanvasFn === "function") {
      try {
        const c = getCanvasFn(assetKey || "", {}, outW, outH);
        if (c) return c;
      } catch (e) {
      }
    }
  } catch (e) {
  }
  try {
    const hull = stripHullOnly(svgText);
    try {
      const rc = rasterizeSvgToCanvas(hull, outW, outH);
      if (rc) return rc;
    } catch (e) {
    }
    const ph = document.createElement("canvas");
    ph.width = outW;
    ph.height = outH;
    return ph;
  } catch (e) {
    return void 0;
  }
  return void 0;
}
async function ensureRasterizedAndCached(svgText, mapping, outW, outH, options) {
  const assetKey = options?.assetKey;
  try {
    const cached = getCachedHullCanvasSync(svgText, outW, outH, assetKey);
    if (cached) return cached;
  } catch (e) {
  }
  try {
    const blob = new Blob([svgText], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    try {
      const c2 = await tryLoadUrlToCanvas(url, outW, outH);
      if (c2) return c2;
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch (e) {
  }
  throw new Error("Failed to ensure rasterized canvas");
}
var init_svgLoader = __esm({
  "src/assets/svgLoader.ts"() {
    "use strict";
    init_svgToPolylines();
  }
});

// src/assets/svgRenderer.ts
var svgRenderer_exports = {};
__export(svgRenderer_exports, {
  _clearRasterCache: () => _clearRasterCache,
  _getRasterCacheKeysForTest: () => _getRasterCacheKeysForTest,
  cacheCanvasForAsset: () => cacheCanvasForAsset,
  default: () => svgRenderer_default,
  getCanvas: () => getCanvas,
  getCanvasFromCache: () => getCanvasFromCache,
  rasterizeSvgWithTeamColors: () => rasterizeSvgWithTeamColors,
  setRasterCacheMaxAge: () => setRasterCacheMaxAge,
  setRasterCacheMaxEntries: () => setRasterCacheMaxEntries
});
function stableStringify(obj) {
  if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) return "[" + obj.map(stableStringify).join(",") + "]";
  const keys = Object.keys(obj).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + stableStringify(obj[k])).join(",") + "}";
}
function djb2Hash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) + h + str.charCodeAt(i);
    h = h & 4294967295;
  }
  return (h >>> 0).toString(16);
}
function ensureCacheLimit() {
  try {
    const now = Date.now();
    if (rasterCacheMaxAgeMS > 0) {
      for (const [k, v] of Array.from(rasterCache.entries())) {
        if (now - v.lastAccess > rasterCacheMaxAgeMS || now - v.createdAt > rasterCacheMaxAgeMS) {
          rasterCache.delete(k);
        }
      }
    }
    while (rasterCache.size > rasterCacheMaxEntries) {
      const it = rasterCache.keys().next();
      if (it.done) break;
      rasterCache.delete(it.value);
    }
  } catch (e) {
  }
}
async function rasterizeSvgWithTeamColors(svgText, mapping, outW, outH, options) {
  let headlessNoCtx = false;
  try {
    if (typeof document !== "undefined" && typeof document.createElement === "function") {
      const probe = document.createElement("canvas");
      const ctx = probe.getContext && probe.getContext("2d");
      if (!ctx) headlessNoCtx = true;
    }
  } catch (e) {
    headlessNoCtx = true;
  }
  const mappingStable = stableStringify(mapping || {});
  const mappingHash = djb2Hash(mappingStable);
  const assetId = options && options.assetKey ? options.assetKey : djb2Hash(stableStringify(svgText || ""));
  const cacheKey = `${assetId}:${mappingHash}:${outW}x${outH}`;
  if (rasterCache.has(cacheKey)) {
    const entry2 = rasterCache.get(cacheKey);
    try {
      entry2.lastAccess = Date.now();
      rasterCache.delete(cacheKey);
      rasterCache.set(cacheKey, entry2);
    } catch (e) {
    }
    if (entry2.canvas) return Promise.resolve(entry2.canvas);
    if (entry2.promise) return entry2.promise;
  }
  const entry = {
    promise: null,
    canvas: void 0,
    createdAt: Date.now(),
    lastAccess: Date.now()
  };
  const p = (async () => {
    try {
      let sourceSvg = svgText || "";
      try {
        if (!/<svg[\s>]/i.test(sourceSvg) && typeof fetch === "function") {
          try {
            const resp = await fetch(sourceSvg);
            if (resp && resp.ok) {
              const txt = await resp.text();
              if (txt && /<svg[\s>]/i.test(txt)) sourceSvg = txt;
            } else {
              try {
                const isProd = typeof process !== "undefined" && process.env && true;
                const isTest = typeof process !== "undefined" && process.env && (process.env.VITEST || process.env.VITEST_WORKER_ID) || typeof globalThis.vitest !== "undefined";
                if (!isProd && !isTest) {
                  console.warn(`[svgRenderer] fetch failed for SVG url '${sourceSvg}'. Status: ${resp && resp.status}`);
                }
              } catch (e) {
              }
            }
          } catch (e) {
            try {
              const isProd = typeof process !== "undefined" && process.env && true;
              const isTest = typeof process !== "undefined" && process.env && (process.env.VITEST || process.env.VITEST_WORKER_ID) || typeof globalThis.vitest !== "undefined";
              if (!isProd && !isTest) {
                console.warn(`[svgRenderer] fetch threw for '${sourceSvg}', continuing with original string`, e);
              }
            } catch (ee) {
            }
          }
        }
      } catch (e) {
      }
      const recolored = applyTeamColorsToSvg(sourceSvg, mapping, options && { applyTo: options?.applyTo });
      if (headlessNoCtx) {
        const ph = (() => {
          try {
            const c = document.createElement("canvas");
            c.width = outW || 1;
            c.height = outH || 1;
            return c;
          } catch (e) {
            const obj = { width: outW || 1, height: outH || 1 };
            return obj;
          }
        })();
        entry.canvas = ph;
        entry.promise = Promise.resolve(ph);
        entry.lastAccess = Date.now();
        rasterCache.set(cacheKey, entry);
        ensureCacheLimit();
        return ph;
      }
      const canvas = await rasterizeSvgToCanvasAsync(recolored, outW, outH);
      entry.canvas = canvas;
      entry.promise = Promise.resolve(canvas);
      entry.lastAccess = Date.now();
      return canvas;
    } catch (e) {
      const canvas = await rasterizeSvgToCanvasAsync(svgText, outW, outH);
      entry.canvas = canvas;
      entry.promise = Promise.resolve(canvas);
      entry.lastAccess = Date.now();
      return canvas;
    }
  })();
  entry.promise = p;
  rasterCache.set(cacheKey, entry);
  ensureCacheLimit();
  try {
    const res = await p;
    return res;
  } catch (e) {
    rasterCache.delete(cacheKey);
    throw e;
  }
}
function _clearRasterCache() {
  rasterCache.clear();
}
function cacheCanvasForAsset(assetKey, mapping, outW, outH, canvas) {
  const mappingStable = stableStringify(mapping || {});
  const mappingHash = djb2Hash(mappingStable);
  const assetId = assetKey || djb2Hash(stableStringify(""));
  const cacheKey = `${assetId}:${mappingHash}:${outW}x${outH}`;
  try {
    if (rasterCache.has(cacheKey)) rasterCache.delete(cacheKey);
  } catch (e) {
  }
  const entry = {
    promise: Promise.resolve(canvas),
    canvas,
    createdAt: Date.now(),
    lastAccess: Date.now()
  };
  rasterCache.set(cacheKey, entry);
  ensureCacheLimit();
  try {
    if (typeof globalThis.window !== "undefined" && globalThis.window.__SAB_DEBUG_SVG) {
      console.debug("[svgRenderer] cacheCanvasForAsset set", { assetKey, mappingHash, outW, outH });
    }
  } catch (e) {
  }
}
function _getRasterCacheKeysForTest() {
  return Array.from(rasterCache.keys());
}
function setRasterCacheMaxEntries(n) {
  rasterCacheMaxEntries = Math.max(1, Math.floor(n) || 256);
  ensureCacheLimit();
}
function setRasterCacheMaxAge(ms) {
  rasterCacheMaxAgeMS = Math.max(0, Math.floor(ms) || 0);
  ensureCacheLimit();
}
function getCanvasFromCache(assetKey, mapping, outW, outH) {
  const mappingStable = stableStringify(mapping || {});
  const mappingHash = djb2Hash(mappingStable);
  const assetId = assetKey || djb2Hash(stableStringify(""));
  const cacheKey = `${assetId}:${mappingHash}:${outW}x${outH}`;
  const entry = rasterCache.get(cacheKey);
  try {
    if (typeof globalThis.window !== "undefined" && globalThis.window.__SAB_DEBUG_SVG) {
      console.debug("[svgRenderer] getCanvasFromCache lookup", { assetKey, mappingHash, outW, outH, present: !!entry });
    }
  } catch (e) {
  }
  if (!entry) return void 0;
  if (rasterCacheMaxAgeMS > 0) {
    const now = Date.now();
    if (now - entry.lastAccess > rasterCacheMaxAgeMS || now - entry.createdAt > rasterCacheMaxAgeMS) {
      rasterCache.delete(cacheKey);
      return void 0;
    }
  }
  entry.lastAccess = Date.now();
  try {
    rasterCache.delete(cacheKey);
    rasterCache.set(cacheKey, entry);
  } catch (e) {
  }
  return entry.canvas;
}
function getCanvas(assetKey, mapping, outW, outH) {
  return getCanvasFromCache(assetKey, mapping, outW, outH);
}
var rasterCache, rasterCacheMaxEntries, rasterCacheMaxAgeMS, svgRendererAPI, svgRenderer_default;
var init_svgRenderer = __esm({
  "src/assets/svgRenderer.ts"() {
    "use strict";
    init_svgLoader();
    rasterCache = /* @__PURE__ */ new Map();
    rasterCacheMaxEntries = 256;
    rasterCacheMaxAgeMS = 0;
    svgRendererAPI = {
      rasterizeSvgWithTeamColors,
      _clearRasterCache,
      cacheCanvasForAsset,
      setRasterCacheMaxEntries,
      setRasterCacheMaxAge,
      getCanvasFromCache,
      getCanvas(assetKey, mapping, outW, outH) {
        return getCanvasFromCache(assetKey, mapping, outW, outH);
      },
      /**
       * Pre-warm a small set of assets into the raster cache. assetKeys are keys
       * from AssetsConfig.svgAssets (or direct SVG/URL strings). teamColors is an
       * array of color hex strings to generate tinted variants for. This helper
       * kicks off async rasterization and awaits completion so subsequent
       * synchronous getCanvas calls can find entries.
       */
      async prewarmAssets(assetKeys, teamColors = [], outW = 128, outH = 128) {
        try {
          const assetsConfig = typeof globalThis !== "undefined" && globalThis.AssetsConfig ? globalThis.AssetsConfig : void 0;
          for (const key of assetKeys) {
            try {
              const rel = assetsConfig && assetsConfig.svgAssets && assetsConfig.svgAssets[key] ? assetsConfig.svgAssets[key] : key;
              try {
                const ph = (() => {
                  try {
                    const c = document.createElement("canvas");
                    c.width = outW || 1;
                    c.height = outH || 1;
                    return c;
                  } catch (e) {
                    const obj = { width: outW || 1, height: outH || 1 };
                    return obj;
                  }
                })();
                try {
                  cacheCanvasForAsset(key, {}, outW, outH, ph);
                } catch (e) {
                }
              } catch (e) {
              }
              (async () => {
                try {
                  const canvas = await rasterizeSvgWithTeamColors(rel, {}, outW, outH, { applyTo: "both", assetKey: key });
                  try {
                    cacheCanvasForAsset(key, {}, outW, outH, canvas);
                  } catch (e) {
                  }
                } catch (e) {
                }
              })();
              for (const col of teamColors || []) {
                try {
                  const mapping = { primary: col, hull: col };
                  try {
                    const ph2 = (() => {
                      try {
                        const c = document.createElement("canvas");
                        c.width = outW || 1;
                        c.height = outH || 1;
                        return c;
                      } catch (e) {
                        const obj = { width: outW || 1, height: outH || 1 };
                        return obj;
                      }
                    })();
                    try {
                      cacheCanvasForAsset(key, mapping, outW, outH, ph2);
                    } catch (e) {
                    }
                  } catch (e) {
                  }
                  (async () => {
                    try {
                      const canvas = await rasterizeSvgWithTeamColors(rel, mapping, outW, outH, { applyTo: "both", assetKey: key });
                      try {
                        cacheCanvasForAsset(key, mapping, outW, outH, canvas);
                      } catch (e) {
                      }
                    } catch (e) {
                    }
                  })();
                } catch (e) {
                }
              }
            } catch (e) {
            }
          }
        } catch (e) {
        }
      }
    };
    try {
      if (typeof globalThis !== "undefined") {
        globalThis.__SpaceAutoBattler_svgRenderer = globalThis.__SpaceAutoBattler_svgRenderer || {};
        Object.assign(globalThis.__SpaceAutoBattler_svgRenderer, svgRendererAPI);
      }
    } catch (e) {
    }
    svgRenderer_default = svgRendererAPI;
  }
});

// src/dev/shipPipelineOverlay.ts
var shipPipelineOverlay_exports = {};
__export(shipPipelineOverlay_exports, {
  default: () => initShipPipelineOverlay
});
function detectPipeline(type) {
  const sprite = getSpriteAsset(type);
  if (sprite.svg) return { pipeline: "svg", source: sprite.svg };
  if (sprite.model3d && sprite.model3d.url)
    return { pipeline: "mesh3d", source: sprite.model3d.url };
  if (sprite.shape) return { pipeline: "shape2d", source: "shapes2d" };
  return { pipeline: "unknown", source: "-" };
}
function createOverlay() {
  if (typeof document === "undefined") return null;
  const host = location && location.hostname || "";
  const urlParams = typeof URLSearchParams !== "undefined" ? new URLSearchParams(location.search) : null;
  const enabled = urlParams?.get("devShipTable") === "1" || host === "127.0.0.1" || host === "localhost";
  if (!enabled) return null;
  const container = document.createElement("div");
  container.id = "ship-pipeline-overlay";
  container.style.position = "fixed";
  container.style.top = "8px";
  container.style.right = "8px";
  container.style.zIndex = "99999";
  container.style.fontFamily = "sans-serif";
  container.style.fontSize = "12px";
  container.style.color = "#fff";
  const badge = document.createElement("div");
  badge.id = "ship-pipeline-badge";
  badge.style.background = "rgba(20,20,30,0.9)";
  badge.style.padding = "6px 10px";
  badge.style.borderRadius = "6px";
  badge.style.cursor = "pointer";
  badge.style.userSelect = "none";
  badge.style.boxShadow = "0 2px 8px rgba(0,0,0,0.6)";
  badge.textContent = "Pipelines";
  badge.setAttribute("role", "button");
  badge.tabIndex = 0;
  const panel = document.createElement("div");
  panel.id = "ship-pipeline-panel";
  panel.style.marginTop = "8px";
  panel.style.background = "rgba(8,10,16,0.95)";
  panel.style.border = "1px solid rgba(255,255,255,0.06)";
  panel.style.padding = "8px";
  panel.style.borderRadius = "6px";
  panel.style.maxHeight = "320px";
  panel.style.overflowY = "auto";
  panel.style.minWidth = "220px";
  panel.style.display = "none";
  const table = document.createElement("table");
  table.style.width = "100%";
  table.style.borderCollapse = "collapse";
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  ["Ship", "Pipeline", "Source"].forEach((h) => {
    const th = document.createElement("th");
    th.textContent = h;
    th.style.textAlign = "left";
    th.style.padding = "4px 6px";
    th.style.fontSize = "11px";
    th.style.opacity = "0.9";
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);
  const tbody = document.createElement("tbody");
  const types = /* @__PURE__ */ new Set([
    ...Object.keys(AssetsConfig.shapes2d || {}),
    ...Object.keys(AssetsConfig.svgAssets || {})
  ]);
  for (const t of Array.from(types).sort()) {
    const res = detectPipeline(t);
    const tr = document.createElement("tr");
    const nameTd = document.createElement("td");
    nameTd.textContent = t;
    nameTd.style.padding = "4px 6px";
    const pTd = document.createElement("td");
    pTd.textContent = res.pipeline;
    pTd.style.padding = "4px 6px";
    pTd.style.opacity = "0.95";
    const sTd = document.createElement("td");
    sTd.textContent = String(res.source).replace(/^\s+|\s+$/g, "");
    sTd.style.padding = "4px 6px";
    sTd.style.opacity = "0.8";
    tr.appendChild(nameTd);
    tr.appendChild(pTd);
    tr.appendChild(sTd);
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  panel.appendChild(table);
  let open = false;
  function setOpen(v) {
    open = !!v;
    panel.style.display = open ? "block" : "none";
    badge.style.background = open ? "rgba(60,60,70,0.95)" : "rgba(20,20,30,0.9)";
    try {
      localStorage.setItem("shipPipelineOpen", open ? "1" : "0");
    } catch (e) {
    }
  }
  badge.addEventListener("click", () => setOpen(!open));
  badge.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      setOpen(!open);
    }
  });
  try {
    if (localStorage.getItem("shipPipelineOpen") === "1") setOpen(true);
  } catch (e) {
  }
  container.appendChild(badge);
  container.appendChild(panel);
  document.body.appendChild(container);
  return { container, badge, panel };
}
function initShipPipelineOverlay() {
  try {
    createOverlay();
  } catch (e) {
    console.warn("shipPipelineOverlay init failed", e);
  }
}
var init_shipPipelineOverlay = __esm({
  "src/dev/shipPipelineOverlay.ts"() {
    "use strict";
    init_assetsConfig();
  }
});

// src/config/entitiesConfig.ts
var entitiesConfig_exports = {};
__export(entitiesConfig_exports, {
  BULLET_DEFAULTS: () => BULLET_DEFAULTS,
  PARTICLE_DEFAULTS: () => PARTICLE_DEFAULTS,
  SIZE_DEFAULTS: () => SIZE_DEFAULTS,
  ShipConfig: () => ShipConfig,
  bulletKindForRadius: () => bulletKindForRadius,
  default: () => entitiesConfig_default,
  getDefaultShipType: () => getDefaultShipType,
  getShipConfig: () => getShipConfig,
  getSizeDefaults: () => getSizeDefaults,
  setAllSizeDefaults: () => setAllSizeDefaults,
  setSizeDefaults: () => setSizeDefaults
});
var ShipConfig = {
  fighter: {
    maxHp: 15,
    // size classification used for armor/shield tuning
    size: "small",
    armor: 0,
    maxShield: 8,
    shieldRegen: 1,
    dmg: 3,
    damage: 3,
    radius: 12,
    cannons: [
      {
        damage: 3,
        rate: 3,
        spread: 0.1,
        muzzleSpeed: 260,
        // reduced back (/10)
        bulletRadius: 1.5,
        bulletTTL: 1.1,
        // was 1.2
        // effective range (muzzleSpeed * bulletTTL) scaled to engine units
        range: Math.round(260 * 1.1)
      }
    ],
    // Refined tuning: slightly higher accel and a moderate maxSpeed for clearer motion
    accel: 100,
    // ~10x accel
    turnRate: 6,
    maxSpeed: 2200
    // ~10x maxSpeed
  },
  corvette: {
    maxHp: 50,
    size: "medium",
    armor: 0,
    maxShield: Math.round(50 * 0.6),
    shieldRegen: 0.5,
    dmg: 5,
    damage: 5,
    radius: 20,
    accel: 80,
    turnRate: 3.5,
    // was 3
    maxSpeed: 1800,
    // ~10x increased
    cannons: [
      {
        damage: 6,
        rate: 1.2,
        spread: 0.05,
        muzzleSpeed: 180,
        // reduced back (/10)
        bulletRadius: 2,
        bulletTTL: 1.8,
        // was 2.0
        range: Math.round(180 * 1.8)
      }
    ]
  },
  frigate: {
    maxHp: 80,
    size: "medium",
    armor: 1,
    maxShield: Math.round(80 * 0.6),
    shieldRegen: 0.4,
    dmg: 8,
    damage: 8,
    radius: 24,
    cannons: [
      {
        damage: 8,
        rate: 1,
        spread: 0.06,
        muzzleSpeed: 180,
        // reduced back (/10)
        bulletRadius: 2.5,
        bulletTTL: 2,
        // was 2.2
        range: Math.round(180 * 2)
      }
    ],
    accel: 70,
    turnRate: 2.5,
    // was 2.2
    maxSpeed: 1500
    // ~10x increased
  },
  destroyer: {
    maxHp: 120,
    size: "large",
    armor: 2,
    maxShield: Math.round(120 * 0.6),
    shieldRegen: 0.3,
    dmg: 12,
    damage: 12,
    radius: 40,
    cannons: new Array(6).fill(0).map(() => ({
      damage: 6,
      rate: 0.8,
      spread: 0.08,
      muzzleSpeed: 160,
      // reduced back (/10)
      bulletRadius: 2.5,
      bulletTTL: 1.8,
      // was 2.4
      range: Math.round(160 * 1.8)
    })),
    accel: 60,
    turnRate: 2,
    // was 1.6
    maxSpeed: 1300,
    // ~10x increased
    turrets: [
      {
        position: [1.2, 0.8],
        kind: "basic",
        targeting: "nearest",
        cooldown: 0.8,
        // turret effective range (units)
        range: 300
      },
      {
        position: [-1.2, 0.8],
        kind: "basic",
        targeting: "nearest",
        cooldown: 0.8
      },
      {
        position: [1.2, -0.8],
        kind: "basic",
        targeting: "nearest",
        cooldown: 0.8
      },
      {
        position: [-1.2, -0.8],
        kind: "basic",
        targeting: "nearest",
        cooldown: 0.8
      },
      {
        position: [0, 1.5],
        kind: "basic",
        targeting: "nearest",
        cooldown: 0.8
      },
      {
        position: [0, -1.5],
        kind: "basic",
        targeting: "nearest",
        cooldown: 0.8
      }
    ]
  },
  carrier: {
    maxHp: 200,
    size: "large",
    armor: 3,
    maxShield: Math.round(200 * 0.6),
    shieldRegen: 0.2,
    dmg: 2,
    damage: 2,
    radius: 40,
    cannons: new Array(4).fill(0).map(() => ({
      damage: 4,
      rate: 0.6,
      spread: 0.12,
      muzzleSpeed: 140,
      // reduced back (/10)
      bulletRadius: 3,
      bulletTTL: 2.2,
      // was 2.8
      range: Math.round(140 * 2.2)
    })),
    accel: 55,
    turnRate: 1.2,
    // was 0.8
    maxSpeed: 1100,
    // ~10x increased
    carrier: { fighterCooldown: 1.5, maxFighters: 6, spawnPerCooldown: 2 },
    turrets: [
      {
        position: [2, 1.2],
        kind: "basic",
        targeting: "nearest",
        cooldown: 1,
        range: 300
      },
      {
        position: [-2, 1.2],
        kind: "basic",
        targeting: "nearest",
        cooldown: 1
      },
      {
        position: [2, -1.2],
        kind: "basic",
        targeting: "nearest",
        cooldown: 1
      },
      {
        position: [-2, -1.2],
        kind: "basic",
        targeting: "nearest",
        cooldown: 1
      }
    ]
  }
};
var SIZE_DEFAULTS = {
  small: {
    armor: 0,
    maxShield: 8,
    shieldRegen: 1,
    radius: 12,
    turnRate: 6,
    accel: 100,
    maxSpeed: 2200
  },
  medium: {
    armor: 1,
    maxShield: 40,
    shieldRegen: 0.5,
    radius: 24,
    turnRate: 3.5,
    accel: 80,
    maxSpeed: 1800
  },
  large: {
    armor: 2,
    maxShield: 120,
    shieldRegen: 0.25,
    radius: 40,
    turnRate: 2,
    accel: 60,
    maxSpeed: 1300
  }
};
function getSizeDefaults(size) {
  return SIZE_DEFAULTS[size] || SIZE_DEFAULTS.small;
}
function setSizeDefaults(size, patch) {
  SIZE_DEFAULTS[size] = Object.assign({}, SIZE_DEFAULTS[size], patch);
}
function setAllSizeDefaults(patch) {
  SIZE_DEFAULTS.small = Object.assign({}, SIZE_DEFAULTS.small, patch);
  SIZE_DEFAULTS.medium = Object.assign({}, SIZE_DEFAULTS.medium, patch);
  SIZE_DEFAULTS.large = Object.assign({}, SIZE_DEFAULTS.large, patch);
}
function getShipConfig() {
  Object.keys(ShipConfig).forEach((key) => {
    const cfg = ShipConfig[key];
    if (cfg.cannons) {
      cfg.cannons.forEach((c) => {
        if (c.range == null) {
          const ms = c.muzzleSpeed ?? BULLET_DEFAULTS.muzzleSpeed;
          const ttl = c.bulletTTL ?? BULLET_DEFAULTS.ttl;
          const computed = Number.isFinite(ms) && Number.isFinite(ttl) ? Math.round(ms * ttl) : BULLET_DEFAULTS.range;
          c.range = computed || BULLET_DEFAULTS.range;
        }
      });
    }
    if (cfg.turrets) {
      const firstCannonRange = cfg.cannons && cfg.cannons.length ? cfg.cannons[0].range || BULLET_DEFAULTS.range : BULLET_DEFAULTS.range;
      cfg.turrets.forEach((t) => {
        if (t.range == null) {
          t.range = firstCannonRange;
        }
      });
    }
  });
  return ShipConfig;
}
var BULLET_DEFAULTS = {
  damage: 1,
  ttl: 2,
  radius: 1.5,
  muzzleSpeed: 24,
  // default effective range (units)
  range: 300
};
var PARTICLE_DEFAULTS = {
  ttl: 1,
  color: "#fff",
  size: 2
};
function bulletKindForRadius(r) {
  if (r < 2) return "small";
  if (r < 2.5) return "medium";
  if (r < 3.5) return "large";
  return "heavy";
}
function getDefaultShipType() {
  return Object.keys(ShipConfig)[0] || "fighter";
}
var entitiesConfig_default = ShipConfig;
if (typeof module !== "undefined" && module.exports) {
  try {
    const existing = module.exports || {};
    Object.defineProperty(existing, "ShipConfig", {
      value: ShipConfig,
      enumerable: true
    });
    Object.defineProperty(existing, "getShipConfig", {
      value: getShipConfig,
      enumerable: true
    });
    Object.defineProperty(existing, "SIZE_DEFAULTS", {
      value: SIZE_DEFAULTS,
      enumerable: true
    });
    Object.defineProperty(existing, "getSizeDefaults", {
      value: getSizeDefaults,
      enumerable: true
    });
    Object.defineProperty(existing, "setSizeDefaults", {
      value: setSizeDefaults,
      enumerable: true
    });
    Object.defineProperty(existing, "setAllSizeDefaults", {
      value: setAllSizeDefaults,
      enumerable: true
    });
    Object.defineProperty(existing, "BULLET_DEFAULTS", {
      value: BULLET_DEFAULTS,
      enumerable: true
    });
    Object.defineProperty(existing, "PARTICLE_DEFAULTS", {
      value: PARTICLE_DEFAULTS,
      enumerable: true
    });
    Object.defineProperty(existing, "bulletKindForRadius", {
      value: bulletKindForRadius,
      enumerable: true
    });
    Object.defineProperty(existing, "getDefaultShipType", {
      value: getDefaultShipType,
      enumerable: true
    });
    try {
      Object.defineProperty(existing, "default", {
        value: ShipConfig,
        enumerable: true
      });
    } catch (e) {
    }
    try {
      module.exports = existing;
    } catch (e) {
    }
  } catch (e) {
  }
}

// src/config/runtimeConfigResolver.ts
var __nodeRequire;
try {
  const { createRequire } = __require("module");
  __nodeRequire = createRequire(typeof import.meta !== "undefined" ? import.meta.url : __filename);
} catch (e) {
  try {
    const { createRequire } = __require("module");
    __nodeRequire = createRequire(__filename);
  } catch (e2) {
  }
}
function getRuntimeEntitiesModule() {
  const cacheKey = "__cachedModule";
  try {
    try {
      const esmMod = entitiesConfig_exports || {};
      if (esmMod && Object.keys(esmMod).length) {
        getRuntimeEntitiesModule[cacheKey] = esmMod;
        return esmMod;
      }
    } catch {
    }
    if (getRuntimeEntitiesModule[cacheKey])
      return getRuntimeEntitiesModule[cacheKey];
  } catch {
  }
  try {
    if (__nodeRequire) {
      try {
        const mod = __nodeRequire("./entitiesConfig");
        getRuntimeEntitiesModule[cacheKey] = mod;
        return mod;
      } catch {
      }
    }
  } catch {
  }
  try {
    const mod = __nodeRequire ? __nodeRequire("./entitiesConfig.ts") : void 0;
    if (mod) {
      getRuntimeEntitiesModule[cacheKey] = mod;
      return mod;
    }
  } catch {
  }
  try {
    const mod = __nodeRequire ? __nodeRequire("./entitiesConfig.js") : void 0;
    if (mod) {
      getRuntimeEntitiesModule[cacheKey] = mod;
      return mod;
    }
  } catch {
  }
  return void 0;
}
function getRuntimeShipConfigSafe() {
  const cfgKey = "__cachedShipConfig";
  try {
    if (getRuntimeShipConfigSafe[cfgKey])
      return getRuntimeShipConfigSafe[cfgKey];
  } catch {
  }
  try {
    const mod = getRuntimeEntitiesModule() || {};
    if (typeof mod.getShipConfig === "function") {
      const cfg = mod.getShipConfig();
      if (cfg && Object.keys(cfg).length) {
        getRuntimeShipConfigSafe[cfgKey] = cfg;
        return cfg;
      }
    }
    if (mod.ShipConfig && Object.keys(mod.ShipConfig).length) {
      getRuntimeShipConfigSafe[cfgKey] = mod.ShipConfig;
      return mod.ShipConfig;
    }
    if (mod.default && Object.keys(mod.default).length) {
      getRuntimeShipConfigSafe[cfgKey] = mod.default;
      return mod.default;
    }
    if (mod && Object.keys(mod).length) {
      getRuntimeShipConfigSafe[cfgKey] = mod;
      return mod;
    }
  } catch {
  }
  const fallback = {
    fighter: {
      size: "small",
      maxHp: 10,
      maxShield: 8,
      shieldRegen: 1,
      accel: 100,
      turnRate: 6,
      radius: 12,
      maxSpeed: 2200,
      cannons: [{ damage: 3, rate: 3, muzzleSpeed: 260, bulletTTL: 1.1 }]
    },
    carrier: {
      size: "large",
      maxHp: 50,
      armor: 2,
      maxShield: 30,
      shieldRegen: 0.3,
      radius: 40,
      accel: 60,
      turnRate: 1.5,
      maxSpeed: 1200,
      cannons: [{ damage: 2, rate: 0.8, muzzleSpeed: 140, bulletTTL: 2 }],
      carrier: { fighterCooldown: 1.5, maxFighters: 6, spawnPerCooldown: 2 },
      turrets: [{ position: [2, 1.2], kind: "basic" }]
    }
  };
  return fallback;
}
function getRuntimeSizeDefaultsSafe(size) {
  const sizeCacheKey = "__cachedSizeDefaults";
  try {
    const cache = getRuntimeSizeDefaultsSafe[sizeCacheKey] || /* @__PURE__ */ new Map();
    getRuntimeSizeDefaultsSafe[sizeCacheKey] = cache;
    if (cache.has(size)) return cache.get(size);
  } catch {
  }
  try {
    const mod = getRuntimeEntitiesModule() || {};
    let val = {};
    if (typeof mod.getSizeDefaults === "function") val = mod.getSizeDefaults(size);
    else if (mod.default && typeof mod.default.getSizeDefaults === "function") val = mod.default.getSizeDefaults(size);
    const cache = getRuntimeSizeDefaultsSafe[sizeCacheKey] || /* @__PURE__ */ new Map();
    cache.set(size, val || {});
    getRuntimeSizeDefaultsSafe[sizeCacheKey] = cache;
    return val || {};
  } catch {
  }
  return {};
}
function getDefaultShipTypeSafe() {
  try {
    const cfg = getRuntimeShipConfigSafe();
    const keys = Object.keys(cfg || {});
    return keys.length ? keys[0] : "fighter";
  } catch (e) {
    return "fighter";
  }
}

// src/config/simConfig.ts
var SIM = {
  DT_MS: 16,
  MAX_ACC_MS: 250,
  bounds: { W: 1920, H: 1080 },
  // Use LOGICAL_MAP for default bounds
  friction: 0.99,
  gridCellSize: 64
};
var boundaryBehavior = {
  ships: "wrap",
  bullets: "remove"
};
var LOGICAL_MAP = { W: 1920, H: 1080 };
function getDefaultBounds() {
  return { W: LOGICAL_MAP.W, H: LOGICAL_MAP.H };
}

// src/rng.ts
var _seed = 1;
function srand(seed = 1) {
  _seed = seed >>> 0;
}
function mulberry32(a) {
  return function() {
    let t = (a += 1831565813) >>> 0;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function srandom() {
  const f = mulberry32(_seed);
  _seed = _seed + 2654435761 >>> 0;
  return f();
}
function srange(min, max) {
  return min + (max - min) * srandom();
}

// src/config/teamsConfig.ts
var TeamsConfig = {
  teams: {
    red: { id: "red", color: "#ff4d4d", label: "Red" },
    blue: { id: "blue", color: "#4da6ff", label: "Blue" }
  },
  defaultFleet: {
    counts: (() => {
      const shipCfg = typeof getShipConfig === "function" && getShipConfig() || // if imported as default-only: try default export object/function
      typeof getShipConfig?.default === "function" && getShipConfig.default() || typeof getShipConfig?.default === "object" && getShipConfig.default || // some bundlers may bind getShipConfig to the config object itself
      typeof getShipConfig === "object" && getShipConfig || {};
      let types = Object.keys(shipCfg || {});
      if (types.length === 0) {
        types = ["fighter", "corvette", "frigate", "destroyer", "carrier"];
      }
      const defaultCounts = {};
      for (const t of types) {
        if (t === "fighter") defaultCounts[t] = 8;
        else if (t === "corvette") defaultCounts[t] = 3;
        else if (t === "frigate") defaultCounts[t] = 2;
        else if (t === "destroyer") defaultCounts[t] = 1;
        else if (t === "carrier") defaultCounts[t] = 1;
        else defaultCounts[t] = 1;
      }
      return defaultCounts;
    })(),
    spacing: 28,
    jitter: { x: 80, y: 120 }
  },
  // continuousReinforcement controls: enable/disable, scoreMargin is the
  // imbalance fraction (e.g. 0.12 means reinforce when weakest ratio < 0.38),
  // perTick is the maximum ships considered per reinforcement tick, and
  // shipTypes is an optional array of types to choose from randomly. If
  // omitted, keys from defaultFleet.counts are used.
  continuousReinforcement: {
    enabled: false,
    scoreMargin: 0.12,
    perTick: 1,
    interval: 5,
    shipTypes: void 0
  }
};
function mulberry322(seed) {
  let t = seed >>> 0;
  return function() {
    t += 1831565813;
    let r = Math.imul(t ^ t >>> 15, 1 | t);
    r ^= r + Math.imul(r ^ r >>> 7, 61 | r);
    return ((r ^ r >>> 14) >>> 0) / 4294967296;
  };
}
function hashStringToInt(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
function generateFleetForTeam(seed = 0, teamId = "red", bounds, shipFactory, options = {}) {
  const b = bounds || getDefaultBounds();
  const cfg = Object.assign({}, TeamsConfig.defaultFleet, options.fleet || {});
  const spacing = options.spacing ?? cfg.spacing;
  const jitter = Object.assign({}, cfg.jitter, options.jitter || {});
  const centerY = b.H / 2;
  const baseX = teamId === "red" ? b.W * 0.22 : b.W * 0.78;
  const rng = mulberry322((seed >>> 0) + hashStringToInt(teamId));
  const out = [];
  for (const [type, count] of Object.entries(cfg.counts)) {
    for (let i = 0; i < count; i++) {
      const r = spacing * Math.sqrt(rng());
      const angle = rng() * Math.PI * 2;
      const dx = Math.cos(angle) * r + (rng() - 0.5) * (jitter.x ?? 0);
      const dy = Math.sin(angle) * r + (rng() - 0.5) * (jitter.y ?? 0);
      const x = Math.max(0, Math.min(b.W - 1e-6, baseX + dx));
      const y = Math.max(0, Math.min(b.H - 1e-6, centerY + dy));
      if (typeof shipFactory === "function")
        out.push(shipFactory(type, x, y, teamId));
      else out.push({ type, x, y, team: teamId });
    }
  }
  return out;
}
function makeInitialFleets(seed = 0, bounds, shipFactory, options = {}) {
  const b = bounds || getDefaultBounds();
  const red = generateFleetForTeam(seed, "red", b, shipFactory, options);
  const blue = generateFleetForTeam(seed + 1, "blue", b, shipFactory, options);
  return red.concat(blue);
}
function chooseReinforcements(seed = 0, state = {}, options = {}) {
  const cfg = Object.assign({}, TeamsConfig.continuousReinforcement, options);
  if (!cfg.enabled) return [];
  const teamStrength = {};
  if (Array.isArray(state.ships)) {
    for (const s of state.ships) {
      if (!s || !s.team) continue;
      const hp = typeof s.hp === "number" ? s.hp : 1;
      teamStrength[s.team] = (teamStrength[s.team] || 0) + hp;
    }
  }
  const teams = Object.keys(TeamsConfig.teams);
  if (teams.length === 0) return [];
  for (const t of teams) {
    if (!teamStrength[t]) {
      const cnt = (state.ships || []).filter(
        (s) => s && s.team === t
      ).length;
      teamStrength[t] = cnt > 0 ? cnt : 0;
    }
  }
  let weakest = teams[0];
  let strongest = teams[0];
  for (const t of teams) {
    if (teamStrength[t] < teamStrength[weakest]) weakest = t;
    if (teamStrength[t] > teamStrength[strongest]) strongest = t;
  }
  const total = teams.reduce((s, t) => s + (teamStrength[t] || 0), 0) || 1;
  const weakestRatio = (teamStrength[weakest] || 0) / total;
  if (weakestRatio < 0.5 - cfg.scoreMargin) {
    const orders = [];
    const rng = mulberry322((seed >>> 0) + hashStringToInt(weakest));
    const candidateTypes = Array.isArray(cfg.shipTypes) && cfg.shipTypes.length ? cfg.shipTypes : Object.keys(TeamsConfig.defaultFleet.counts || { fighter: 1 });
    const countsMap = TeamsConfig && TeamsConfig.defaultFleet && TeamsConfig.defaultFleet.counts ? TeamsConfig.defaultFleet.counts : {};
    const weights = candidateTypes.map(
      (t) => Math.max(0, Number(countsMap[t]) || 1)
    );
    const totalWeight = weights.reduce((s, w) => s + w, 0) || candidateTypes.length || 1;
    const weightedPick = () => {
      const r = rng() * totalWeight;
      let acc = 0;
      for (let i = 0; i < candidateTypes.length; i++) {
        acc += weights[i];
        if (r < acc) return candidateTypes[i];
      }
      return candidateTypes[candidateTypes.length - 1];
    };
    const maxPerTick = Math.max(1, Math.floor(Number(cfg.perTick) || 1));
    const spawnCount = Math.max(1, Math.floor(rng() * maxPerTick) + 1);
    const b = options.bounds || getDefaultBounds();
    const centerY = b.H / 2;
    const baseX = weakest === "red" ? b.W * 0.18 : b.W * 0.82;
    for (let i = 0; i < spawnCount; i++) {
      const x = Math.max(0, Math.min(b.W - 1e-6, baseX + (rng() - 0.5) * 120));
      const y = Math.max(
        0,
        Math.min(b.H - 1e-6, centerY + (rng() - 0.5) * 160)
      );
      const type = Array.isArray(cfg.shipTypes) && cfg.shipTypes.length ? candidateTypes[Math.floor(rng() * candidateTypes.length)] || getDefaultShipType() : weightedPick();
      orders.push({ type, team: weakest, x, y });
    }
    return orders;
  }
  return [];
}
var TEAM_DEFAULT = "red";
var teamsConfig_default = TeamsConfig;
function chooseReinforcementsWithManagerSeed(state = {}, options = {}) {
  const seed = Math.floor(srandom() * 4294967295) >>> 0;
  return chooseReinforcements(seed, state, options);
}

// src/pools/pool.ts
var Pool = class {
  stack = [];
  factory;
  reset;
  created = 0;
  constructor(factory, reset, initialSize = 0) {
    this.factory = factory;
    this.reset = reset;
    for (let i = 0; i < initialSize; i++) this.stack.push(this.factory());
    this.created = this.stack.length;
  }
  acquire() {
    const obj = this.stack.pop();
    if (typeof obj !== "undefined") return obj;
    const newObj = this.factory();
    this.created++;
    return newObj;
  }
  release(obj) {
    if (this.reset) this.reset(obj);
    if (!this.stack.includes(obj)) this.stack.push(obj);
  }
  size() {
    return this.stack.length;
  }
  clear() {
    this.stack.length = 0;
  }
};

// src/entities.ts
var __nodeRequire2;
try {
  const { createRequire } = __require("module");
  __nodeRequire2 = createRequire(
    typeof import.meta !== "undefined" ? import.meta.url : __filename
  );
} catch (e) {
  try {
    const { createRequire } = __require("module");
    __nodeRequire2 = createRequire(__filename);
  } catch (e2) {
  }
}
var getShipConfigSafe = () => getRuntimeShipConfigSafe();
var getSizeDefaultsSafe = (size) => getRuntimeSizeDefaultsSafe(size);
var nextId = 1;
function genId() {
  return nextId++;
}
function createShip(type = void 0, x = 0, y = 0, team = TEAM_DEFAULT) {
  const shipCfg = getShipConfigSafe();
  const availableTypes = Object.keys(shipCfg || {});
  const resolvedType = type && shipCfg[type] ? type : availableTypes.length ? availableTypes[0] : getDefaultShipTypeSafe();
  const rawCfg = shipCfg[resolvedType] || shipCfg[getDefaultShipTypeSafe()];
  const sizeVal = rawCfg.size || (rawCfg.radius && rawCfg.radius >= 36 ? "large" : rawCfg.radius && rawCfg.radius >= 20 ? "medium" : "small");
  const sizeDefaults = getSizeDefaultsSafe(
    sizeVal
  );
  const cfg = Object.assign({}, sizeDefaults, rawCfg);
  const ship = {
    id: genId(),
    type: resolvedType,
    x,
    y,
    vx: 0,
    vy: 0,
    hp: cfg.maxHp ?? 0,
    maxHp: cfg.maxHp ?? 0,
    shield: cfg.maxShield ?? 0,
    maxShield: cfg.maxShield ?? 0,
    shieldRegen: cfg.shieldRegen ?? 0,
    armor: cfg.armor ?? 0,
    size: cfg.size || sizeVal,
    team,
    xp: 0,
    level: 1,
    // Shallow-clone cannons to avoid mutating config and avoid expensive JSON roundtrip
    cannons: Array.isArray(cfg.cannons) ? cfg.cannons.map((c) => c && typeof c === "object" ? { ...c } : c) : [],
    // Keep raw turret defs here for now; we'll normalize below via helper so
    // normalization logic is centralized and reusable by snapshot handlers.
    turrets: cfg.turrets || [],
    accel: cfg.accel || 0,
    currentAccel: 0,
    throttle: 0,
    steering: 0,
    turnRate: cfg.turnRate || 0,
    radius: cfg.radius || 6,
    // Ensure maxSpeed is always a sensible positive number. Some saved state
    // or malformed configs may have maxSpeed omitted or set to 0 which causes
    // ships to never translate (they can still rotate/fire). Prefer the
    // configured value but fall back to a safe default > 0.
    maxSpeed: typeof cfg.maxSpeed === "number" && cfg.maxSpeed > 0 ? cfg.maxSpeed : 120,
    angle: 0,
    trail: void 0,
    shieldPercent: 1,
    hpPercent: 1
  };
  try {
    normalizeTurrets(ship);
  } catch (e) {
  }
  return ship;
}
function normalizeTurrets(ship) {
  try {
    if (!ship) return;
    const tarr = ship.turrets;
    if (!Array.isArray(tarr)) return;
    ship.turrets = tarr.map((t) => {
      if (Array.isArray(t) && t.length === 2) {
        return {
          position: t,
          angle: 0,
          targetAngle: 0,
          kind: "basic",
          spread: 0,
          barrel: 0,
          cooldown: 1
        };
      }
      if (t && typeof t === "object") {
        const copy = Object.assign({}, t);
        if (typeof copy.angle !== "number") copy.angle = 0;
        if (typeof copy.targetAngle !== "number") copy.targetAngle = 0;
        if (typeof copy.spread !== "number") copy.spread = 0;
        if (typeof copy.barrel !== "number") copy.barrel = 0;
        if (typeof copy.cooldown !== "number")
          copy.cooldown = copy.cooldown || 1;
        return copy;
      }
      return t;
    });
  } catch (e) {
  }
}
function normalizeStateShips(state) {
  if (!state || typeof state !== "object") return;
  try {
    const ships = Array.isArray(state.ships) ? state.ships : [];
    for (const s of ships) {
      try {
        normalizeTurrets(s);
      } catch (e) {
      }
    }
    try {
      state.shipMap = /* @__PURE__ */ new Map();
      for (const s of ships)
        if (s && typeof s.id !== "undefined")
          state.shipMap.set(s.id, s);
    } catch (e) {
    }
    try {
      const counts = { red: 0, blue: 0 };
      for (const s of ships) {
        try {
          const t = String(s && s.team || "");
          if (t) counts[t] = (counts[t] || 0) + 1;
        } catch (e) {
        }
      }
      state.teamCounts = counts;
    } catch (e) {
    }
  } catch (e) {
  }
}
var bulletPool = new Pool(
  () => ({
    id: 0,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    team: TEAM_DEFAULT,
    ownerId: null,
    damage: 0,
    ttl: 0,
    prevX: 0,
    prevY: 0,
    _prevX: 0,
    _prevY: 0
  }),
  (b) => {
    b.id = 0;
    b.x = 0;
    b.y = 0;
    b.vx = 0;
    b.vy = 0;
    b.team = TEAM_DEFAULT;
    b.ownerId = null;
    b.damage = 0;
    b.ttl = 0;
    b.prevX = 0;
    b.prevY = 0;
    b._prevX = 0;
    b._prevY = 0;
  }
);
function createExplosionEffect(init) {
  return {
    x: init?.x ?? 0,
    y: init?.y ?? 0,
    r: init?.r,
    alive: true,
    _pooled: false,
    ...init
  };
}
function resetExplosionEffect(obj, init) {
  obj.x = init?.x ?? 0;
  obj.y = init?.y ?? 0;
  obj.r = init?.r;
  obj.alive = true;
  obj._pooled = false;
  Object.assign(obj, init);
}
function createShieldHitEffect(init) {
  return {
    x: init?.x ?? 0,
    y: init?.y ?? 0,
    magnitude: init?.magnitude,
    alive: true,
    _pooled: false,
    ...init
  };
}
function resetShieldHitEffect(obj, init) {
  obj.x = init?.x ?? 0;
  obj.y = init?.y ?? 0;
  obj.magnitude = init?.magnitude;
  obj.alive = true;
  obj._pooled = false;
  Object.assign(obj, init);
}
function createHealthHitEffect(init) {
  return {
    x: init?.x ?? 0,
    y: init?.y ?? 0,
    amount: init?.amount,
    alive: true,
    _pooled: false,
    ...init
  };
}
function resetHealthHitEffect(obj, init) {
  obj.x = init?.x ?? 0;
  obj.y = init?.y ?? 0;
  obj.amount = init?.amount;
  obj.alive = true;
  obj._pooled = false;
  Object.assign(obj, init);
}
function makeInitialState() {
  return {
    t: 0,
    ships: [],
    // fast lookup map kept in sync with ships[] where possible
    shipMap: /* @__PURE__ */ new Map(),
    // Cached counts per team to avoid per-frame filter allocations
    teamCounts: { red: 0, blue: 0 },
    bullets: [],
    explosions: [],
    shieldHits: [],
    healthHits: [],
    // optional event arrays used by GameState contract
    particles: [],
    flashes: [],
    shieldFlashes: [],
    healthFlashes: [],
    engineTrailsEnabled: true,
    assetPool: {
      textures: /* @__PURE__ */ new Map(),
      sprites: /* @__PURE__ */ new Map(),
      effects: /* @__PURE__ */ new Map(),
      counts: {
        textures: /* @__PURE__ */ new Map(),
        sprites: /* @__PURE__ */ new Map(),
        effects: /* @__PURE__ */ new Map()
      },
      config: {
        texturePoolSize: 128,
        spritePoolSize: 256,
        effectPoolSize: 128,
        textureOverflowStrategy: "discard-oldest",
        spriteOverflowStrategy: "discard-oldest",
        effectOverflowStrategy: "discard-oldest"
      }
    }
  };
}
function updateTeamCount(state, oldTeam, newTeam) {
  try {
    if (oldTeam) {
      state.teamCounts[oldTeam] = Math.max(
        0,
        (state.teamCounts[oldTeam] || 0) - 1
      );
    }
    if (newTeam) {
      state.teamCounts[newTeam] = (state.teamCounts[newTeam] || 0) + 1;
    }
  } catch (e) {
  }
}

// src/config/behaviorConfig.ts
var AI_THRESHOLDS = {
  decisionTimerMin: 0.5,
  decisionTimerMax: 2,
  hpEvadeThreshold: 0.35,
  randomLow: 0.15,
  randomHigh: 0.85
};

// src/behavior.ts
function len2(vx, vy) {
  return vx * vx + vy * vy;
}
var DEFAULT_BULLET_RANGE = (
  // Guard against undefined export in certain CJS/ESM interop paths
  typeof BULLET_DEFAULTS?.range === "number" ? BULLET_DEFAULTS.range : 300
);
function getBulletDefaultsSafe() {
  const fallback = { damage: 1, ttl: 2, radius: 1.5, muzzleSpeed: 24, range: 300 };
  const src = BULLET_DEFAULTS;
  return src && typeof src === "object" ? src : fallback;
}
function withinRange(sx, sy, tx, ty, range) {
  const dx = tx - sx;
  const dy = ty - sy;
  return dx * dx + dy * dy <= range * range;
}
function clampSpeed(s, max) {
  const v2 = len2(s.vx || 0, s.vy || 0);
  const max2 = max * max;
  if (v2 > max2 && v2 > 0) {
    const inv = max / Math.sqrt(v2);
    s.vx = (s.vx || 0) * inv;
    s.vy = (s.vy || 0) * inv;
  }
}
function aimWithSpread(from, to, spread = 0) {
  let dx = (to.x || 0) - (from.x || 0);
  let dy = (to.y || 0) - (from.y || 0);
  const d = Math.hypot(dx, dy) || 1;
  dx /= d;
  dy /= d;
  if (spread > 0) {
    const ang = Math.atan2(dy, dx);
    const jitter = srange(-spread, spread);
    const na = ang + jitter;
    return { x: Math.cos(na), y: Math.sin(na) };
  }
  return { x: dx, y: dy };
}
function tryFire(state, ship, target, dt) {
  if (Array.isArray(ship.cannons) && ship.cannons.length > 0) {
    for (const c of ship.cannons) {
      if (typeof c.__cd !== "number") c.__cd = 0;
      c.__cd -= dt;
      if (c.__cd > 0) continue;
      const range = typeof c.range === "number" ? c.range : DEFAULT_BULLET_RANGE;
      if (!withinRange(
        ship.x || 0,
        ship.y || 0,
        target.x || 0,
        target.y || 0,
        range
      ))
        continue;
      const spread = typeof c.spread === "number" ? c.spread : 0;
      const dir = aimWithSpread(ship, target, spread);
      const speed = typeof c.muzzleSpeed === "number" ? c.muzzleSpeed : getBulletDefaultsSafe().muzzleSpeed;
      const dmg = typeof c.damage === "number" ? c.damage : typeof ship.damage === "number" ? ship.damage : typeof ship.dmg === "number" ? ship.dmg : getBulletDefaultsSafe().damage;
      const ttl = typeof c.bulletTTL === "number" ? c.bulletTTL : getBulletDefaultsSafe().ttl;
      const radius = typeof c.bulletRadius === "number" ? c.bulletRadius : getBulletDefaultsSafe().radius;
      const vx = dir.x * speed;
      const vy = dir.y * speed;
      const b = Object.assign(
        acquireBullet(state, {
          x: ship.x || 0,
          y: ship.y || 0,
          vx,
          vy,
          team: ship.team || TEAM_DEFAULT,
          ownerId: ship.id || null,
          damage: dmg,
          ttl
        }),
        { radius }
      );
      const rate = typeof c.rate === "number" && c.rate > 0 ? c.rate : 1;
      c.__cd = 1 / rate;
    }
  }
  if (Array.isArray(ship.turrets) && ship.turrets.length > 0) {
    for (const [i, turret] of ship.turrets.entries()) {
      if (!turret) continue;
      if (typeof turret.__cd !== "number") turret.__cd = 0;
      turret.__cd -= dt;
      if (turret.__cd > 0) continue;
      let turretTarget = null;
      if (turret.targeting === "nearest") {
        const enemies = (state.ships || []).filter(
          (sh) => sh && sh.team !== ship.team
        );
        let minDist = Infinity;
        for (const enemy of enemies) {
          const dx = (enemy.x || 0) - (ship.x || 0);
          const dy = (enemy.y || 0) - (ship.y || 0);
          const d2 = dx * dx + dy * dy;
          if (d2 < minDist) {
            minDist = d2;
            turretTarget = enemy;
          }
        }
      } else if (turret.targeting === "random") {
        const enemies = (state.ships || []).filter(
          (sh) => sh && sh.team !== ship.team
        );
        if (enemies.length)
          turretTarget = enemies[Math.floor(srandom() * enemies.length)];
      } else if (turret.targeting === "focus") {
        if (ship.__ai && ship.__ai.targetId != null) {
          const tId = ship.__ai.targetId;
          turretTarget = state.shipMap && typeof tId !== "undefined" && tId !== null ? state.shipMap.get(Number(tId)) || null : (state.ships || []).find((sh) => sh && sh.id === tId) || null;
        }
      } else {
        const enemies = (state.ships || []).filter(
          (sh) => sh && sh.team !== ship.team
        );
        let minDist = Infinity;
        for (const enemy of enemies) {
          const dx = (enemy.x || 0) - (ship.x || 0);
          const dy = (enemy.y || 0) - (ship.y || 0);
          const d2 = dx * dx + dy * dy;
          if (d2 < minDist) {
            minDist = d2;
            turretTarget = enemy;
          }
        }
      }
      if (!turretTarget) continue;
      const spread = typeof turret.spread === "number" ? turret.spread : 0.05;
      const mountPos = Array.isArray(turret) && turret.length === 2 ? turret : turret && Array.isArray(turret.position) ? turret.position : [0, 0];
      const [mTx, mTy] = mountPos;
      const shipAngle = ship.angle || 0;
      const configRadiusLocal = typeof ship.radius === "number" && ship.radius > 0 ? ship.radius : 12;
      const mountX = (ship.x || 0) + Math.cos(shipAngle) * mTx * configRadiusLocal - Math.sin(shipAngle) * mTy * configRadiusLocal;
      const mountY = (ship.y || 0) + Math.sin(shipAngle) * mTx * configRadiusLocal + Math.cos(shipAngle) * mTy * configRadiusLocal;
      const dir = aimWithSpread({ x: mountX, y: mountY }, turretTarget, spread);
      const speed = typeof turret.muzzleSpeed === "number" ? turret.muzzleSpeed : getBulletDefaultsSafe().muzzleSpeed;
      const dmg = typeof turret.damage === "number" ? turret.damage : typeof ship.damage === "number" ? ship.damage : getBulletDefaultsSafe().damage;
      const ttl = typeof turret.bulletTTL === "number" ? turret.bulletTTL : getBulletDefaultsSafe().ttl;
      const radius = typeof turret.bulletRadius === "number" ? turret.bulletRadius : getBulletDefaultsSafe().radius;
      const range = typeof turret.range === "number" ? turret.range : DEFAULT_BULLET_RANGE;
      const dxT = (turretTarget.x || 0) - mountX;
      const dyT = (turretTarget.y || 0) - mountY;
      if (dxT * dxT + dyT * dyT > range * range) continue;
      const vx = dir.x * speed;
      const vy = dir.y * speed;
      let spawnX = mountX;
      let spawnY = mountY;
      const barrelLen = turret && typeof turret.barrel === "number" ? turret.barrel : turret && turret.barrel && turret.barrel.length ? turret.barrel[0] : 0;
      if (barrelLen && barrelLen > 0) {
        const turretLocalAngle = turret && typeof turret.angle === "number" ? turret.angle : 0;
        const turretWorldAngle = shipAngle + turretLocalAngle;
        spawnX = mountX + Math.cos(turretWorldAngle) * barrelLen;
        spawnY = mountY + Math.sin(turretWorldAngle) * barrelLen;
      }
      const b = Object.assign(
        acquireBullet(state, {
          x: spawnX,
          y: spawnY,
          vx,
          vy,
          team: ship.team || TEAM_DEFAULT,
          ownerId: ship.id || null,
          damage: dmg,
          ttl
        }),
        { radius }
      );
      turret.__cd = typeof turret.cooldown === "number" && turret.cooldown > 0 ? turret.cooldown : 1;
    }
  }
}
function ensureShipAiState(s) {
  if (!s.__ai) {
    s.__ai = { state: "idle", decisionTimer: 0, targetId: null };
  }
  return s.__ai;
}
function chooseNewTarget(state, ship) {
  const enemies = (state.ships || []).filter(
    (sh) => sh && sh.team !== ship.team
  );
  if (!enemies.length) return null;
  const idx = Math.floor(srandom() * enemies.length);
  return enemies[idx];
}
function applySimpleAI(state, dt, bounds = getDefaultBounds()) {
  if (!state || !Array.isArray(state.ships)) return;
  for (const s of state.ships) {
    const ai = ensureShipAiState(s);
    ai.decisionTimer = Math.max(0, (ai.decisionTimer || 0) - dt);
    let target = null;
    if (ai.targetId != null)
      target = state.shipMap && typeof ai.targetId !== "undefined" && ai.targetId !== null ? state.shipMap.get(Number(ai.targetId)) || null : (state.ships || []).find((sh) => sh && sh.id === ai.targetId) || null;
    if (!target) target = chooseNewTarget(state, s);
    if (target) ai.targetId = target.id;
    const maxAccel = typeof s.accel === "number" ? s.accel : 100;
    const maxSpeed = typeof s.maxSpeed === "number" ? s.maxSpeed : 160;
    s.steering = typeof s.steering === "number" ? s.steering : 0;
    s.throttle = typeof s.throttle === "number" ? s.throttle : 0;
    if (!target) {
      s.throttle = 0;
      s.steering = 0;
      ai.state = "idle";
    } else {
      if (ai.decisionTimer <= 0) {
        const hpFrac = (s.hp || 0) / Math.max(1, s.maxHp || 1);
        const rnd = srandom();
        if (hpFrac < AI_THRESHOLDS.hpEvadeThreshold || rnd < AI_THRESHOLDS.randomLow)
          ai.state = "evade";
        else if (rnd < AI_THRESHOLDS.randomHigh) ai.state = "engage";
        else ai.state = "idle";
        ai.decisionTimer = AI_THRESHOLDS.decisionTimerMin + srandom() * (AI_THRESHOLDS.decisionTimerMax - AI_THRESHOLDS.decisionTimerMin);
        try {
          if (ai.state !== "engage" && Array.isArray(s.cannons) && s.cannons.length > 0) {
            for (const c of s.cannons) {
              const ready = typeof c.__cd !== "number" || c.__cd <= 0;
              const range = typeof c.range === "number" ? c.range : DEFAULT_BULLET_RANGE;
              if (ready && target && withinRange(
                s.x || 0,
                s.y || 0,
                target.x || 0,
                target.y || 0,
                range
              )) {
                ai.state = "engage";
                break;
              }
            }
          }
        } catch (e) {
        }
      }
      const dx = (target.x || 0) - (s.x || 0);
      const dy = (target.y || 0) - (s.y || 0);
      const desiredAngle = Math.atan2(dy, dx);
      const currentAngle = typeof s.angle === "number" ? s.angle : 0;
      let da = desiredAngle - currentAngle;
      while (da < -Math.PI) da += Math.PI * 2;
      while (da > Math.PI) da -= Math.PI * 2;
      const steeringNorm = Math.PI / 2;
      const steering = Math.max(-1, Math.min(1, da / steeringNorm));
      if (ai.state === "engage") {
        s.throttle = 1;
        s.steering = steering;
        tryFire(state, s, target, dt);
      } else if (ai.state === "evade") {
        s.throttle = 0.8;
        const awayAngle = Math.atan2(
          (s.y || 0) - (target.y || 0),
          (s.x || 0) - (target.x || 0)
        );
        let daAway = awayAngle - currentAngle;
        while (daAway < -Math.PI) daAway += Math.PI * 2;
        while (daAway > Math.PI) daAway -= Math.PI * 2;
        s.steering = Math.max(-1, Math.min(1, daAway / steeringNorm));
      } else {
        s.throttle = 0;
        s.steering = 0;
      }
    }
    clampSpeed(s, maxSpeed);
  }
}

// src/simulate.ts
init_assetsConfig();

// src/config/progressionConfig.ts
var progression = {
  xpPerDamage: 1,
  xpPerKill: 50,
  xpToLevel: (level) => 100 * Math.pow(1.25, level - 1),
  hpPercentPerLevel: (level) => Math.min(0.1, 0.05 + 0.05 / Math.sqrt(level)),
  dmgPercentPerLevel: 0.08,
  shieldPercentPerLevel: 0.06,
  speedPercentPerLevel: 0.03,
  regenPercentPerLevel: 0.04
};

// src/spatialGrid.ts
var spatialGrid_exports = {};
__export(spatialGrid_exports, {
  default: () => SpatialGrid,
  segmentIntersectsCircle: () => segmentIntersectsCircle
});
var SpatialGrid = class _SpatialGrid {
  cellSize;
  grid;
  // simple pooled instances to avoid per-frame allocations
  // pool keyed by cellSize to avoid reuse mismatch; cap instances per key
  static _pools = /* @__PURE__ */ new Map();
  static _perKeyCap = 4;
  static acquire(cellSize = 64) {
    const key = cellSize | 0;
    const pool = this._pools.get(key) || [];
    const inst = pool.pop();
    if (inst) {
      inst.cellSize = cellSize;
      return inst;
    }
    return new _SpatialGrid(cellSize);
  }
  static release(inst) {
    const key = (inst.cellSize || 64) | 0;
    inst.clear();
    let pool = this._pools.get(key);
    if (!pool) {
      pool = [];
      this._pools.set(key, pool);
    }
    if (pool.length < this._perKeyCap) pool.push(inst);
  }
  constructor(cellSize = 64) {
    this.cellSize = cellSize;
    this.grid = /* @__PURE__ */ new Map();
  }
  key(cx, cy) {
    return cx + "," + cy;
  }
  insert(entity) {
    const cx = Math.floor((entity.x || 0) / this.cellSize);
    const cy = Math.floor((entity.y || 0) / this.cellSize);
    const k = this.key(cx, cy);
    let bucket = this.grid.get(k);
    if (!bucket) {
      bucket = [];
      this.grid.set(k, bucket);
    }
    bucket.push(entity);
  }
  queryRadius(x, y, radius) {
    const minCx = Math.floor((x - radius) / this.cellSize);
    const maxCx = Math.floor((x + radius) / this.cellSize);
    const minCy = Math.floor((y - radius) / this.cellSize);
    const maxCy = Math.floor((y + radius) / this.cellSize);
    const results = [];
    const seen = /* @__PURE__ */ new Set();
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const bucket = this.grid.get(this.key(cx, cy));
        if (!bucket) continue;
        for (const e of bucket) {
          if (!seen.has(e)) {
            seen.add(e);
            results.push(e);
          }
        }
      }
    }
    return results;
  }
  // clear internal storage for reuse
  clear() {
    this.grid.clear();
  }
};
function segmentIntersectsCircle(x1, y1, x2, y2, cx, cy, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const fx = x1 - cx;
  const fy = y1 - cy;
  const a = dx * dx + dy * dy;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - r * r;
  let discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return false;
  discriminant = Math.sqrt(discriminant);
  const t1 = (-b - discriminant) / (2 * a);
  const t2 = (-b + discriminant) / (2 * a);
  if (t1 >= 0 && t1 <= 1 || t2 >= 0 && t2 <= 1) return true;
  return false;
}

// src/simulate.ts
var SpatialGrid2 = SpatialGrid || spatialGrid_exports;
var segmentIntersectsCircle2 = segmentIntersectsCircle;
function dist2(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}
function simulateStep(state, dtSeconds, bounds) {
  pruneAll(state, dtSeconds, bounds);
  state.t = (state.t || 0) + dtSeconds;
  for (let i = (state.bullets || []).length - 1; i >= 0; i--) {
    const b = state.bullets[i];
    const prevXVal = typeof b.x === "number" ? b.x : 0;
    const prevYVal = typeof b.y === "number" ? b.y : 0;
    b.prevX = prevXVal;
    b.prevY = prevYVal;
    b._prevX = prevXVal;
    b._prevY = prevYVal;
    b.x += (b.vx || 0) * dtSeconds;
    b.y += (b.vy || 0) * dtSeconds;
    b.ttl = (b.ttl || 0) - dtSeconds;
    let outX = b.x < 0 || b.x >= bounds.W;
    let outY = b.y < 0 || b.y >= bounds.H;
    let outOfBounds = outX || outY;
    let remove = false;
    if (b.ttl <= 0) remove = true;
    else if (outOfBounds) {
      switch (boundaryBehavior.bullets) {
        case "remove":
          remove = true;
          break;
        case "wrap":
          if (b.x < 0) b.x += bounds.W;
          if (b.x >= bounds.W) b.x -= bounds.W;
          if (b.y < 0) b.y += bounds.H;
          if (b.y >= bounds.H) b.y -= bounds.H;
          break;
        case "bounce":
          if (outX) {
            b.vx = -(b.vx || 0);
            b.x = Math.max(0, Math.min(bounds.W, b.x));
          }
          if (outY) {
            b.vy = -(b.vy || 0);
            b.y = Math.max(0, Math.min(bounds.H, b.y));
          }
          break;
      }
    }
    if (remove) {
      try {
        releaseBullet(state, b);
      } catch (e) {
      }
    }
  }
  function pruneAll(state2, dtSeconds2, bounds2) {
    state2.particles = state2.particles || [];
    state2.explosions = state2.explosions || [];
    state2.shieldHits = state2.shieldHits || [];
    state2.healthHits = state2.healthHits || [];
    state2.flashes = state2.flashes || [];
    state2.shieldFlashes = state2.shieldFlashes || [];
    state2.healthFlashes = state2.healthFlashes || [];
    let writeBullet = 0;
    for (let read = 0; read < state2.bullets.length; read++) {
      const b = state2.bullets[read];
      const prevXVal = typeof b.x === "number" ? b.x : 0;
      const prevYVal = typeof b.y === "number" ? b.y : 0;
      b.prevX = prevXVal;
      b.prevY = prevYVal;
      b._prevX = prevXVal;
      b._prevY = prevYVal;
      b.x += (b.vx || 0) * dtSeconds2;
      b.y += (b.vy || 0) * dtSeconds2;
      b.ttl = (b.ttl || 0) - dtSeconds2;
      let outX = b.x < 0 || b.x >= bounds2.W;
      let outY = b.y < 0 || b.y >= bounds2.H;
      let outOfBounds = outX || outY;
      let remove = false;
      if (b.ttl <= 0) remove = true;
      else if (outOfBounds) {
        switch (boundaryBehavior.bullets) {
          case "remove":
            remove = true;
            break;
          case "wrap":
            if (b.x < 0) b.x += bounds2.W;
            if (b.x >= bounds2.W) b.x -= bounds2.W;
            if (b.y < 0) b.y += bounds2.H;
            if (b.y >= bounds2.H) b.y -= bounds2.H;
            break;
          case "bounce":
            if (outX) {
              b.vx = -(b.vx || 0);
              b.x = Math.max(0, Math.min(bounds2.W, b.x));
            }
            if (outY) {
              b.vy = -(b.vy || 0);
              b.y = Math.max(0, Math.min(bounds2.H, b.y));
            }
            break;
        }
      }
      if (!remove) {
        state2.bullets[writeBullet++] = b;
      } else {
        releaseBullet(state2, b);
      }
    }
    state2.bullets.length = writeBullet;
    let writeParticle = 0;
    for (let read = 0; read < state2.particles.length; read++) {
      const p = state2.particles[read];
      p.life = (p.life || p.ttl || 0) - dtSeconds2;
      if (p.life > 0) {
        state2.particles[writeParticle++] = p;
      } else {
        releaseParticle(p);
      }
    }
    state2.particles.length = writeParticle;
    let writeExplosion = 0;
    for (let read = 0; read < state2.explosions.length; read++) {
      const e = state2.explosions[read];
      e.life = (e.life || e.ttl || 0) - dtSeconds2;
      if (e.life > 0) {
        state2.explosions[writeExplosion++] = e;
      } else {
        releaseExplosion(e);
      }
    }
    state2.explosions.length = writeExplosion;
    let writeShield = 0;
    for (let read = 0; read < state2.shieldHits.length; read++) {
      const sh = state2.shieldHits[read];
      if (typeof sh.x === "number" && typeof sh.y === "number" && sh.x >= 0 && sh.x < bounds2.W && sh.y >= 0 && sh.y < bounds2.H) {
        state2.shieldHits[writeShield++] = sh;
      } else {
        releaseShieldHit(sh);
      }
    }
    state2.shieldHits.length = writeShield;
    let writeHealth = 0;
    for (let read = 0; read < state2.healthHits.length; read++) {
      const hh = state2.healthHits[read];
      if (typeof hh.x === "number" && typeof hh.y === "number" && hh.x >= 0 && hh.x < bounds2.W && hh.y >= 0 && hh.y < bounds2.H) {
        state2.healthHits[writeHealth++] = hh;
      } else {
        releaseHealthHit(hh);
      }
    }
    state2.healthHits.length = writeHealth;
  }
  const fighterCountsByParent = /* @__PURE__ */ new Map();
  try {
    for (const sh of state.ships || []) {
      if (sh && sh.parentId && sh.type === "fighter") {
        const pid = Number(sh.parentId);
        fighterCountsByParent.set(pid, (fighterCountsByParent.get(pid) || 0) + 1);
      }
    }
  } catch (e) {
  }
  for (let si = (state.ships || []).length - 1; si >= 0; si--) {
    const s = state.ships[si];
    const throttle = typeof s.throttle === "number" ? s.throttle : 0;
    const steering = typeof s.steering === "number" ? s.steering : 0;
    const accel = typeof s.accel === "number" ? s.accel : 0;
    const turnRate = typeof s.turnRate === "number" ? s.turnRate : 3;
    const maxSpeed = typeof s.maxSpeed === "number" ? s.maxSpeed : 160;
    const angle = typeof s.angle === "number" ? s.angle : 0;
    const maxTurn = turnRate * Math.abs(steering) * dtSeconds;
    if (steering !== 0) {
      let a = angle + Math.sign(steering) * maxTurn;
      while (a < -Math.PI) a += Math.PI * 2;
      while (a > Math.PI) a -= Math.PI * 2;
      s.angle = a;
    }
    const actualAccel = accel * throttle;
    if (actualAccel > 0) {
      s.vx = (s.vx || 0) + Math.cos(s.angle || 0) * actualAccel * dtSeconds;
      s.vy = (s.vy || 0) + Math.sin(s.angle || 0) * actualAccel * dtSeconds;
    }
    const friction = typeof SIM.friction === "number" ? SIM.friction : 0.98;
    s.vx = (s.vx || 0) * friction;
    s.vy = (s.vy || 0) * friction;
    clampSpeed(s, maxSpeed);
    s.x += (s.vx || 0) * dtSeconds;
    s.y += (s.vy || 0) * dtSeconds;
    const r = typeof s.radius === "number" ? s.radius : 12;
    let outX = s.x < -r || s.x > bounds.W + r;
    let outY = s.y < -r || s.y > bounds.H + r;
    let outOfBounds = outX || outY;
    let remove = false;
    if (outOfBounds) {
      switch (boundaryBehavior.ships) {
        case "remove":
          remove = true;
          break;
        case "wrap":
          if (s.x < -r) s.x += bounds.W + r * 2;
          if (s.x > bounds.W + r) s.x -= bounds.W + r * 2;
          if (s.y < -r) s.y += bounds.H + r * 2;
          if (s.y > bounds.H + r) s.y -= bounds.H + r * 2;
          break;
        case "bounce":
          if (outX) {
            s.vx = -(s.vx || 0);
            s.x = Math.max(-r, Math.min(bounds.W + r, s.x));
          }
          if (outY) {
            s.vy = -(s.vy || 0);
            s.y = Math.max(-r, Math.min(bounds.H + r, s.y));
          }
          break;
      }
    }
    if (remove) {
      const rem = state.ships.splice(si, 1);
      if (rem && rem.length) {
        try {
          state.shipMap && state.shipMap.delete(rem[0].id);
        } catch (e) {
        }
        try {
          if (rem[0] && rem[0].team)
            state.teamCounts[rem[0].team] = Math.max(
              0,
              (state.teamCounts[rem[0].team] || 0) - 1
            );
        } catch (e) {
        }
      }
    }
    try {
      try {
        normalizeTurrets(s);
      } catch (e) {
      }
      try {
        if (Array.isArray(state.ships) && Array.isArray(s.turrets) && s.turrets.length) {
          for (let ti = 0; ti < s.turrets.length; ti++) {
            try {
              const t = s.turrets[ti];
              if (!t || Array.isArray(t)) continue;
              if (typeof t.targetAngle === "number") continue;
              let best = null;
              let bestDist = Infinity;
              for (const other of state.ships || []) {
                if (!other || other.id === s.id) continue;
                if (other.team === s.team) continue;
                const dx = (other.x || 0) - (s.x || 0);
                const dy = (other.y || 0) - (s.y || 0);
                const d2 = dx * dx + dy * dy;
                if (d2 < bestDist) {
                  bestDist = d2;
                  best = other;
                }
              }
              if (best) {
                const mount = Array.isArray(t.position) ? {
                  x: (Math.cos(s.angle || 0) * t.position[0] - Math.sin(s.angle || 0) * t.position[1]) * (s.radius || 12) + (s.x || 0),
                  y: (Math.sin(s.angle || 0) * t.position[0] + Math.cos(s.angle || 0) * t.position[1]) * (s.radius || 12) + (s.y || 0)
                } : { x: s.x || 0, y: s.y || 0 };
                const desiredWorld = Math.atan2(
                  (best.y || 0) - mount.y,
                  (best.x || 0) - mount.x
                );
                let local = desiredWorld - (s.angle || 0);
                while (local < -Math.PI) local += Math.PI * 2;
                while (local > Math.PI) local -= Math.PI * 2;
                t.targetAngle = local;
              }
            } catch (e) {
            }
          }
        }
      } catch (e) {
      }
      try {
        normalizeTurrets(s);
      } catch (e) {
      }
      if (Array.isArray(s.turrets) && s.turrets.length) {
        const turretDefs = s.turrets;
        for (let ti = 0; ti < turretDefs.length; ti++) {
          try {
            const t = turretDefs[ti];
            if (!t) continue;
            t.angle = typeof t.angle === "number" ? t.angle : typeof s.turretAngle === "number" ? s.turretAngle : s.angle || 0;
            t.targetAngle = typeof t.targetAngle === "number" ? t.targetAngle : typeof t.desiredAngle === "number" ? t.desiredAngle : t.angle;
            let defaultTurn = Math.PI * 1.5;
            try {
              const td = assetsConfig_default.turretDefaults && assetsConfig_default.turretDefaults[t.kind || "basic"];
              if (td && typeof td.turnRate === "number")
                defaultTurn = td.turnRate;
            } catch (e) {
            }
            const maxTurn2 = (typeof t.turnRate === "number" ? t.turnRate : defaultTurn) * dtSeconds;
            let diff = t.targetAngle - t.angle;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            const step = Math.sign(diff) * Math.min(Math.abs(diff), maxTurn2);
            t.angle = t.angle + step;
            while (t.angle < -Math.PI) t.angle += Math.PI * 2;
            while (t.angle > Math.PI) t.angle -= Math.PI * 2;
            turretDefs[ti] = t;
          } catch (e) {
          }
        }
      }
    } catch (e) {
    }
    try {
      const shipCfg = getRuntimeShipConfigSafe();
      const typeCfg = shipCfg && s.type ? shipCfg[s.type] : void 0;
      if (s.type === "carrier" || typeCfg && typeCfg.carrier) {
        const carrierCfg = typeCfg && typeCfg.carrier || {
          fighterCooldown: 1.5,
          maxFighters: 6,
          spawnPerCooldown: 2
        };
        s._carrierTimer = s._carrierTimer || 0;
        s._carrierTimer += dtSeconds;
        const cooldown = Number(carrierCfg.fighterCooldown) || 1.5;
        if (s._carrierTimer >= cooldown) {
          s._carrierTimer = 0;
          const existing = fighterCountsByParent.get(s.id) || 0;
          const maxF = Number(carrierCfg.maxFighters) || 0;
          const spawnPer = Number(carrierCfg.spawnPerCooldown) || 1;
          const canSpawn = Math.max(0, maxF - existing);
          let toSpawn = Math.min(canSpawn, spawnPer);
          while (toSpawn > 0) {
            const angle2 = srandom() * Math.PI * 2;
            const dist = (s.radius || 20) + 8 + srandom() * 8;
            const nx = (s.x || 0) + Math.cos(angle2) * dist;
            const ny = (s.y || 0) + Math.sin(angle2) * dist;
            try {
              const f = createShip("fighter", nx, ny, s.team);
              f.parentId = s.id;
              f.angle = s.angle;
              (state.ships ||= []).push(f);
              fighterCountsByParent.set(s.id, (fighterCountsByParent.get(s.id) || 0) + 1);
              try {
                state.shipMap && state.shipMap.set(f.id, f);
              } catch (e) {
              }
              try {
                updateTeamCount(state, void 0, String(f.team));
              } catch (e) {
              }
            } catch (e) {
            }
            toSpawn--;
          }
        }
      }
    } catch (e) {
    }
  }
  const cellSize = SIM && SIM.gridCellSize || 64;
  const grid = SpatialGrid2.acquire(cellSize);
  const ships = state.ships || [];
  for (let i = 0; i < ships.length; i++) grid.insert(ships[i]);
  const removedShipIds = /* @__PURE__ */ new Set();
  for (let bi = (state.bullets || []).length - 1; bi >= 0; bi--) {
    const b = state.bullets[bi];
    const searchRadius = (b.radius || 1) + 64;
    const candidates = grid.queryRadius(b.x || 0, b.y || 0, searchRadius);
    let collided = false;
    for (let ci = 0; ci < candidates.length; ci++) {
      const s = candidates[ci];
      if (!s || removedShipIds.has(s.id)) continue;
      if (s.team === b.team) continue;
      const r = (s.radius || 6) + (b.radius || 1);
      const bxPrev = typeof b._prevX === "number" ? b._prevX : b.x - (b.vx || 0) * dtSeconds;
      const byPrev = typeof b._prevY === "number" ? b._prevY : b.y - (b.vy || 0) * dtSeconds;
      const didHit = dist2(b, s) <= r * r || segmentIntersectsCircle2(
        bxPrev,
        byPrev,
        b.x || 0,
        b.y || 0,
        s.x || 0,
        s.y || 0,
        r
      );
      if (didHit) {
        const attacker = typeof b.ownerId === "number" || typeof b.ownerId === "string" ? state.shipMap && state.shipMap.get(Number(b.ownerId)) : void 0;
        let dealtToShield = 0;
        let dealtToHealth = 0;
        const shield = s.shield || 0;
        if (shield > 0) {
          const absorbed = Math.min(shield, b.damage || 0);
          s.shield = shield - absorbed;
          const hitAngle = Math.atan2(
            (b.y || 0) - (s.y || 0),
            (b.x || 0) - (s.x || 0)
          );
          (state.shieldHits ||= []).push(
            acquireShieldHit(state, {
              id: s.id,
              x: b.x,
              y: b.y,
              team: s.team,
              amount: absorbed,
              hitAngle
            })
          );
          (state.damageEvents ||= []).push({
            id: s.id,
            type: "shield",
            amount: absorbed,
            x: b.x,
            y: b.y,
            team: s.team,
            attackerId: attacker && attacker.id
          });
          const remaining = (b.damage || 0) - absorbed;
          if (remaining > 0) {
            const armor = s.armor || 0;
            const dmgMul = Math.max(0, 1 - 0.1 * armor);
            const dealt = Math.max(0, remaining * dmgMul);
            s.hp -= dealt;
            (state.healthHits ||= []).push(
              acquireHealthHit(state, {
                id: s.id,
                x: b.x,
                y: b.y,
                team: s.team,
                amount: dealt
              })
            );
            (state.damageEvents ||= []).push({
              id: s.id,
              type: "hp",
              amount: dealt,
              x: b.x,
              y: b.y,
              team: s.team,
              attackerId: attacker && attacker.id
            });
          }
          dealtToShield = absorbed;
          const remainingAfterShield = Math.max(0, (b.damage || 0) - absorbed);
          const armorAfterShield = s.armor || 0;
          dealtToHealth = Math.max(
            0,
            remainingAfterShield * Math.max(0, 1 - 0.1 * armorAfterShield)
          );
        } else {
          const armor = s.armor || 0;
          const dmgMulNoShield = Math.max(0, 1 - 0.1 * armor);
          const dealtNoShield = Math.max(0, (b.damage || 0) * dmgMulNoShield);
          s.hp -= dealtNoShield;
          (state.healthHits ||= []).push(
            acquireHealthHit(state, {
              id: s.id,
              x: b.x,
              y: b.y,
              team: s.team,
              amount: dealtNoShield
            })
          );
          (state.damageEvents ||= []).push({
            id: s.id,
            type: "hp",
            amount: dealtNoShield,
            x: b.x,
            y: b.y,
            team: s.team,
            attackerId: attacker && attacker.id
          });
          dealtToHealth = dealtNoShield;
        }
        s.hpPercent = Math.max(0, Math.min(1, (s.hp || 0) / (s.maxHp || 1)));
        s.shieldPercent = typeof s.maxShield === "number" && s.maxShield > 0 ? Math.max(0, Math.min(1, (s.shield || 0) / s.maxShield)) : 0;
        if (attacker) {
          attacker.xp = (attacker.xp || 0) + (dealtToShield + dealtToHealth) * (progression.xpPerDamage || 0);
          while ((attacker.xp || 0) >= progression.xpToLevel(attacker.level || 1)) {
            attacker.xp -= progression.xpToLevel(attacker.level || 1);
            attacker.level = (attacker.level || 1) + 1;
            const resolveScalar = (s2, lvl2) => typeof s2 === "function" ? s2(lvl2) : s2 || 0;
            const lvl = attacker.level || 1;
            const hpScalar = resolveScalar(
              progression.hpPercentPerLevel,
              lvl
            );
            const shScalar = resolveScalar(
              progression.shieldPercentPerLevel,
              lvl
            );
            const dmgScalar = resolveScalar(
              progression.dmgPercentPerLevel,
              lvl
            );
            const speedScalar = resolveScalar(
              progression.speedPercentPerLevel,
              lvl
            );
            const regenScalar = resolveScalar(
              progression.regenPercentPerLevel,
              lvl
            );
            const hpMul = 1 + hpScalar;
            const shMul = 1 + shScalar;
            const dmgMul = 1 + dmgScalar;
            attacker.maxHp = (attacker.maxHp || 0) * hpMul;
            attacker.hp = Math.min(attacker.maxHp, (attacker.hp || 0) * hpMul);
            if (typeof attacker.maxShield === "number") {
              attacker.maxShield = (attacker.maxShield || 0) * shMul;
              attacker.shield = Math.min(
                attacker.maxShield,
                (attacker.shield || 0) * shMul
              );
            }
            if (Array.isArray(attacker.cannons)) {
              for (const c of attacker.cannons) {
                if (typeof c.damage === "number") c.damage *= dmgMul;
              }
            }
            if (typeof speedScalar === "number" && typeof attacker.accel === "number")
              attacker.accel = attacker.accel * (1 + speedScalar);
            if (typeof regenScalar === "number" && typeof attacker.shieldRegen === "number")
              attacker.shieldRegen = attacker.shieldRegen * (1 + regenScalar);
          }
        }
        try {
          releaseBullet(state, b);
        } catch (e) {
          try {
            state.bullets.splice(bi, 1);
          } catch (e2) {
          }
        }
        collided = true;
        if (s.hp <= 0) {
          if (attacker) {
            attacker.xp = (attacker.xp || 0) + (progression.xpPerKill || 0);
            while ((attacker.xp || 0) >= progression.xpToLevel(attacker.level || 1)) {
              attacker.xp -= progression.xpToLevel(attacker.level || 1);
              attacker.level = (attacker.level || 1) + 1;
              const resolveScalar = (s2, lvl2) => typeof s2 === "function" ? s2(lvl2) : s2 || 0;
              const lvl = attacker.level || 1;
              const hpScalar = resolveScalar(
                progression.hpPercentPerLevel,
                lvl
              );
              const shScalar = resolveScalar(
                progression.shieldPercentPerLevel,
                lvl
              );
              const dmgScalar = resolveScalar(
                progression.dmgPercentPerLevel,
                lvl
              );
              const speedScalar = resolveScalar(
                progression.speedPercentPerLevel,
                lvl
              );
              const regenScalar = resolveScalar(
                progression.regenPercentPerLevel,
                lvl
              );
              const hpMul = 1 + hpScalar;
              const shMul = 1 + shScalar;
              const dmgMul = 1 + dmgScalar;
              attacker.maxHp = (attacker.maxHp || 0) * hpMul;
              attacker.hp = Math.min(
                attacker.maxHp,
                (attacker.hp || 0) * hpMul
              );
              if (typeof attacker.maxShield === "number") {
                attacker.maxShield = (attacker.maxShield || 0) * shMul;
                attacker.shield = Math.min(
                  attacker.maxShield,
                  (attacker.shield || 0) * shMul
                );
              }
              if (Array.isArray(attacker.cannons)) {
                for (const c of attacker.cannons) {
                  if (typeof c.damage === "number") c.damage *= dmgMul;
                }
              }
              if (typeof speedScalar === "number" && typeof attacker.accel === "number")
                attacker.accel = attacker.accel * (1 + speedScalar);
              if (typeof regenScalar === "number" && typeof attacker.shieldRegen === "number")
                attacker.shieldRegen = attacker.shieldRegen * (1 + regenScalar);
            }
          }
          (state.explosions ||= []).push(
            acquireExplosion(state, {
              x: s.x,
              y: s.y,
              team: s.team,
              life: 0.5,
              ttl: 0.5
            })
          );
          const idx = (state.ships || []).findIndex(
            (sh) => sh && sh.id === s.id
          );
          if (idx >= 0) {
            state.ships.splice(idx, 1);
            try {
              state.shipMap && state.shipMap.delete(s.id);
            } catch (e) {
            }
            try {
              if (s && s.team)
                state.teamCounts[s.team] = Math.max(
                  0,
                  (state.teamCounts[s.team] || 0) - 1
                );
            } catch (e) {
            }
          }
          removedShipIds.add(s.id);
        }
        break;
      }
    }
  }
  SpatialGrid2.release(grid);
  for (const s of state.ships || []) {
    if (s.maxShield)
      s.shield = Math.min(
        s.maxShield,
        (s.shield || 0) + (s.shieldRegen || 0) * dtSeconds
      );
  }
  for (const s of state.ships || []) {
    s.hpPercent = Math.max(0, Math.min(1, (s.hp || 0) / (s.maxHp || 1)));
    s.shieldPercent = typeof s.maxShield === "number" && s.maxShield > 0 ? Math.max(0, Math.min(1, (s.shield || 0) / s.maxShield)) : 0;
  }
  return state;
}

// src/createSimWorker.ts
function createSimWorker(url = "./simWorker.js") {
  const worker = new Worker(url, { type: "module" });
  const listeners = /* @__PURE__ */ new Map();
  worker.onmessage = (ev) => {
    const msg = ev.data;
    const cb = listeners.get(msg && msg.type);
    if (cb) cb(msg);
  };
  return {
    post(msg) {
      worker.postMessage(msg);
    },
    on(type, cb) {
      listeners.set(type, cb);
    },
    terminate() {
      worker.terminate();
    }
  };
}

// src/pools/PoolManager.ts
var DEFAULT_CONFIG = {
  max: void 0,
  strategy: "discard-oldest",
  min: 0
};
function _incCount(map, key, delta) {
  if (!map) return;
  const cur = map.get(key) || 0;
  const next = cur + delta;
  if (next <= 0) map.delete(key);
  else map.set(key, next);
}
function makePoolEntry(opts) {
  return {
    freeList: [],
    allocated: 0,
    config: Object.assign({}, DEFAULT_CONFIG, opts?.config || {}),
    disposer: opts?.disposer
  };
}
function acquireItem(params) {
  const { map, counts, key, createFn, globalMax, globalStrategy, initFn, initArgs } = params;
  let entry = map.get(key);
  if (!entry) {
    entry = makePoolEntry({ config: { max: globalMax, strategy: globalStrategy } });
    map.set(key, entry);
  }
  const free = entry.freeList;
  if (free.length) {
    const obj = free.pop();
    try {
      if (initFn) initFn(obj, initArgs);
      else if (initArgs && typeof obj === "object") Object.assign(obj, initArgs);
    } catch {
    }
    return obj;
  }
  const max = entry.config && typeof entry.config.max === "number" ? entry.config.max : globalMax ?? Infinity;
  const strategy = entry.config?.strategy ?? globalStrategy ?? "discard-oldest";
  const total = entry.allocated || (counts ? counts.get(key) || 0 : 0);
  if (total < (max || Infinity) || strategy === "grow") {
    const e2 = createFn();
    try {
      if (initFn) initFn(e2, initArgs);
      else if (initArgs && typeof e2 === "object") Object.assign(e2, initArgs);
    } catch {
    }
    entry.allocated = (entry.allocated || 0) + 1;
    if (counts) _incCount(counts, key, 1);
    return e2;
  }
  if (strategy === "error") throw new Error(`Pool exhausted for key "${key}" (max=${max})`);
  const e = createFn();
  entry.allocated = (entry.allocated || 0) + 1;
  if (counts) _incCount(counts, key, 1);
  return e;
}
function releaseItem(params) {
  const { map, counts, key, item, disposeFn, globalMax, globalStrategy } = params;
  let entry = map.get(key);
  if (!entry) {
    entry = makePoolEntry({ config: { max: globalMax, strategy: globalStrategy } });
    map.set(key, entry);
  }
  const free = entry.freeList;
  if (!free.includes(item)) free.push(item);
  const max = entry.config && typeof entry.config.max === "number" ? entry.config.max : globalMax ?? Infinity;
  const strategy = entry.config?.strategy ?? globalStrategy ?? "discard-oldest";
  if (strategy === "grow") return;
  const countsMap = counts || void 0;
  while (free.length > (max || Infinity)) {
    const victim = strategy === "discard-oldest" ? free.shift() : free.pop();
    try {
      if (entry.disposer) entry.disposer(victim);
      else if (disposeFn) disposeFn(victim);
    } catch {
    }
    if (countsMap) _incCount(countsMap, key, -1);
    entry.allocated = Math.max(0, (entry.allocated || 0) - 1);
  }
  if (strategy === "error" && free.length > (max || Infinity)) {
    const victim = free.pop();
    try {
      if (entry.disposer) entry.disposer(victim);
      else if (disposeFn) disposeFn(victim);
    } catch {
    }
    if (countsMap) _incCount(countsMap, key, -1);
    entry.allocated = Math.max(0, (entry.allocated || 0) - 1);
  }
}

// src/pools/assetPool.ts
function _getStrategy(v, def) {
  return v === "grow" || v === "error" || v === "discard-oldest" ? v : def;
}
function entryConfigOr(state, key, globalName) {
  const poolMap = globalName === "texturePoolSize" ? state.assetPool.textures : globalName === "spritePoolSize" ? state.assetPool.sprites : state.assetPool.effects;
  const entry = poolMap && poolMap.get ? poolMap.get(key) : void 0;
  if (entry && entry.config && typeof entry.config.max === "number") return entry.config.max;
  return state.assetPool.config ? state.assetPool.config[globalName] : void 0;
}
function entryStrategyOr(state, key, globalName) {
  const poolMap = globalName === "textureOverflowStrategy" ? state.assetPool.textures : globalName === "spriteOverflowStrategy" ? state.assetPool.sprites : state.assetPool.effects;
  const entry = poolMap && poolMap.get ? poolMap.get(key) : void 0;
  if (entry && entry.config && entry.config.strategy) return entry.config.strategy;
  return state.assetPool.config ? state.assetPool.config[globalName] : void 0;
}
function makePooled(obj, resetFn) {
  const o = obj;
  if (typeof o.reset !== "function") {
    if (typeof resetFn === "function") {
      o.reset = function(initArgs) {
        try {
          resetFn(o, initArgs);
        } catch {
        }
      };
    } else {
      o.reset = function(initArgs) {
        if (initArgs && typeof initArgs === "object") Object.assign(o, initArgs);
      };
    }
  }
  return o;
}
function ensureAssetPool(state) {
  if (!state) return;
  if (!state.assetPool || typeof state.assetPool !== "object") {
    state.assetPool = {
      textures: /* @__PURE__ */ new Map(),
      sprites: /* @__PURE__ */ new Map(),
      effects: /* @__PURE__ */ new Map(),
      counts: {
        textures: /* @__PURE__ */ new Map(),
        sprites: /* @__PURE__ */ new Map(),
        effects: /* @__PURE__ */ new Map()
      },
      config: {
        texturePoolSize: 128,
        spritePoolSize: 256,
        effectPoolSize: 128,
        textureOverflowStrategy: "discard-oldest",
        spriteOverflowStrategy: "discard-oldest",
        effectOverflowStrategy: "discard-oldest"
      }
    };
  } else {
    state.assetPool.textures = state.assetPool.textures || /* @__PURE__ */ new Map();
    state.assetPool.sprites = state.assetPool.sprites || /* @__PURE__ */ new Map();
    state.assetPool.effects = state.assetPool.effects || /* @__PURE__ */ new Map();
    state.assetPool.counts = state.assetPool.counts || {
      textures: /* @__PURE__ */ new Map(),
      sprites: /* @__PURE__ */ new Map(),
      effects: /* @__PURE__ */ new Map()
    };
    state.assetPool.config = state.assetPool.config || {
      texturePoolSize: 128,
      spritePoolSize: 256,
      effectPoolSize: 128,
      textureOverflowStrategy: "discard-oldest",
      spriteOverflowStrategy: "discard-oldest",
      effectOverflowStrategy: "discard-oldest"
    };
  }
}
function acquireEffect(state, key, createFn, initArgs) {
  ensureAssetPool(state);
  const poolMap = state.assetPool.effects;
  state.assetPool.counts = state.assetPool.counts || { textures: /* @__PURE__ */ new Map(), sprites: /* @__PURE__ */ new Map(), effects: /* @__PURE__ */ new Map() };
  const counts = state.assetPool.counts.effects;
  return acquireItem({
    map: poolMap,
    counts,
    key,
    createFn,
    globalMax: state.assetPool.config.effectPoolSize,
    globalStrategy: _getStrategy(state.assetPool.config.effectOverflowStrategy, "discard-oldest"),
    initFn: (obj, args) => {
      try {
        if (typeof obj.reset === "function") obj.reset(args);
        else if (args && typeof args === "object") Object.assign(obj, args);
      } catch {
      }
    },
    initArgs
  });
}
function releaseEffect(state, key, effect, disposeFn) {
  ensureAssetPool(state);
  const poolMap = state.assetPool.effects;
  state.assetPool.counts = state.assetPool.counts || { textures: /* @__PURE__ */ new Map(), sprites: /* @__PURE__ */ new Map(), effects: /* @__PURE__ */ new Map() };
  const counts = state.assetPool.counts.effects;
  return releaseItem({
    map: poolMap,
    counts,
    key,
    item: effect,
    disposeFn,
    globalMax: state.assetPool.config.effectPoolSize,
    globalStrategy: _getStrategy(state.assetPool.config.effectOverflowStrategy, "discard-oldest")
  });
}
function acquireTexture(state, key, createFn) {
  ensureAssetPool(state);
  const poolMap = state.assetPool.textures;
  state.assetPool.counts = state.assetPool.counts || { textures: /* @__PURE__ */ new Map(), sprites: /* @__PURE__ */ new Map(), effects: /* @__PURE__ */ new Map() };
  const counts = state.assetPool.counts.textures;
  return acquireItem({
    map: poolMap,
    counts,
    key,
    createFn,
    globalMax: entryConfigOr(state, key, "texturePoolSize"),
    globalStrategy: entryStrategyOr(state, key, "textureOverflowStrategy")
  });
}
function releaseTexture(state, key, tex, disposeFn) {
  ensureAssetPool(state);
  const poolMap = state.assetPool.textures;
  state.assetPool.counts = state.assetPool.counts || { textures: /* @__PURE__ */ new Map(), sprites: /* @__PURE__ */ new Map(), effects: /* @__PURE__ */ new Map() };
  const counts = state.assetPool.counts.textures;
  return releaseItem({
    map: poolMap,
    counts,
    key,
    item: tex,
    disposeFn,
    globalMax: entryConfigOr(state, key, "texturePoolSize"),
    globalStrategy: entryStrategyOr(state, key, "textureOverflowStrategy")
  });
}
function acquireSprite(state, key, createFn, initArgs) {
  ensureAssetPool(state);
  state.assetPool.counts = state.assetPool.counts || { textures: /* @__PURE__ */ new Map(), sprites: /* @__PURE__ */ new Map(), effects: /* @__PURE__ */ new Map() };
  const poolMap = state.assetPool.sprites;
  const counts = state.assetPool.counts.sprites;
  return acquireItem({
    map: poolMap,
    counts,
    key,
    createFn,
    globalMax: state.assetPool.config.spritePoolSize,
    globalStrategy: _getStrategy(state.assetPool.config.spriteOverflowStrategy, "discard-oldest"),
    initFn: (obj, args) => {
      try {
        if (typeof obj.reset === "function") obj.reset(args);
        else if (args && typeof args === "object") Object.assign(obj, args);
      } catch {
      }
    },
    initArgs
  });
}
function releaseSprite(state, key, sprite, disposeFn) {
  ensureAssetPool(state);
  state.assetPool.counts = state.assetPool.counts || { textures: /* @__PURE__ */ new Map(), sprites: /* @__PURE__ */ new Map(), effects: /* @__PURE__ */ new Map() };
  const poolMap = state.assetPool.sprites;
  const counts = state.assetPool.counts.sprites;
  return releaseItem({
    map: poolMap,
    counts,
    key,
    item: sprite,
    disposeFn,
    globalMax: state.assetPool.config.spritePoolSize,
    globalStrategy: _getStrategy(state.assetPool.config.spriteOverflowStrategy, "discard-oldest")
  });
}

// src/config/gamemanagerConfig.ts
var SHIELD = {
  ttl: 0.4,
  particleCount: 6,
  particleTTL: 0.5,
  particleColor: "#88ccff",
  particleSize: 2,
  // arcWidth (radians) for shield hit visual/particle spread centered on hitAngle
  // NOTE: Used in assetsConfig.ts visualStateDefaults and renderer logic. If not consumed, consider removing.
  arcWidth: Math.PI / 6
  // TODO: Ensure renderer/particle logic uses this or remove if redundant
};
var HEALTH = {
  ttl: 0.6,
  particleCount: 8,
  particleTTL: 0.6,
  particleColor: "#ffb3b3",
  particleSize: 2.5
};
var EXPLOSION = {
  particleCount: 30,
  particleTTL: 1.2,
  particleColor: "#ffaa33",
  particleSize: 3,
  minSpeed: 20,
  maxSpeed: 140
  // TODO: Unify particle effect configs with assetsConfig.ts animations for maintainability
};
var FALLBACK_POSITIONS = [
  { x: 100, y: 100, team: "red" },
  { x: 700, y: 500, team: "blue" }
];
var STARS = { twinkle: true, redrawInterval: 500, count: 140 };

// src/gamemanager.ts
function createGameManager({
  useWorker = false,
  renderer = null,
  seed = 12345,
  createSimWorker: createSimWorkerFactory
} = {}) {
  function _evaluateAndEmit(dt) {
    const result = evaluateReinforcement(dt, state, continuousOptions);
    if (result && Array.isArray(result.spawned) && result.spawned.length) {
      lastReinforcement = {
        spawned: result.spawned,
        timestamp: Date.now(),
        options: { ...continuousOptions }
      };
      emit("reinforcements", { spawned: result.spawned });
    }
  }
  let state = makeInitialState();
  let running = false;
  const listeners = /* @__PURE__ */ new Map();
  const workerReadyCbs = [];
  let simWorker = null;
  let _workerReadyHandler = null;
  let _workerSnapshotHandler = null;
  let _pendingRender = false;
  let _workerReinforcementsHandler = null;
  let workerReady = false;
  let lastReinforcement = {
    spawned: [],
    timestamp: 0,
    options: {}
  };
  let continuous = false;
  let continuousOptions = {};
  let last = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
  let acc = 0;
  const score = { red: 0, blue: 0 };
  const internal = { state, bounds: SIM.bounds };
  function emit(type, msg) {
    emitManagerEvent(listeners, type, msg);
  }
  function on(evt, cb) {
    const arr = listeners.get(evt) || [];
    arr.push(cb);
    listeners.set(evt, arr);
  }
  function off(evt, cb) {
    const arr = listeners.get(evt) || [];
    const i = arr.indexOf(cb);
    if (i !== -1) arr.splice(i, 1);
  }
  function destroy() {
    running = false;
    try {
      if (simWorker) {
        try {
          if (typeof simWorker.off === "function") {
            try {
              if (_workerReadyHandler)
                simWorker.off("ready", _workerReadyHandler);
            } catch (e) {
            }
            try {
              if (_workerSnapshotHandler)
                simWorker.off("snapshot", _workerSnapshotHandler);
            } catch (e) {
            }
            try {
              if (_workerReinforcementsHandler)
                simWorker.off("reinforcements", _workerReinforcementsHandler);
            } catch (e) {
            }
          }
        } catch (e) {
        }
        try {
          if (typeof simWorker.terminate === "function") simWorker.terminate();
          else if (typeof simWorker.close === "function") simWorker.close();
          else if (typeof simWorker.post === "function")
            simWorker.post({ type: "stop" });
        } catch (e) {
        }
        simWorker = null;
      }
    } catch (e) {
    }
    workerReady = false;
    workerReadyCbs.length = 0;
  }
  function start() {
    if (!running) {
      running = true;
      last = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
      runLoop();
    }
  }
  function pause() {
    running = false;
  }
  function resetManager() {
    state = makeInitialState();
    if (simWorker)
      try {
        simWorker.post({ type: "command", cmd: "setState", args: { state } });
      } catch (e) {
      }
  }
  function stepOnce(dt = SIM.DT_MS / 1e3) {
    const n = Number(dt) || SIM.DT_MS / 1e3;
    step(n);
  }
  function step(dtSeconds) {
    const clampedDt = Math.min(dtSeconds, 0.05);
    if (!simWorker) {
      try {
        applySimpleAI(state, clampedDt, SIM.bounds);
      } catch (e) {
      }
      try {
        simulateStep(state, clampedDt, SIM.bounds);
      } catch (e) {
      }
    } else {
      try {
        simWorker.post && simWorker.post({ type: "snapshotRequest" });
      } catch (e) {
      }
    }
    _evaluateAndEmit(clampedDt);
    if (renderer && typeof renderer.renderState === "function") {
      try {
        if (!_pendingRender) {
          _pendingRender = true;
          try {
            requestAnimationFrame(() => {
              try {
                renderer.renderState({
                  ships: state.ships,
                  bullets: state.bullets,
                  flashes: state.flashes,
                  shieldFlashes: state.shieldFlashes,
                  healthFlashes: state.healthFlashes,
                  t: state.t
                });
              } catch (e) {
              }
              _pendingRender = false;
            });
          } catch (e) {
            setTimeout(() => {
              try {
                renderer.renderState({
                  ships: state.ships,
                  bullets: state.bullets,
                  flashes: state.flashes,
                  shieldFlashes: state.shieldFlashes,
                  healthFlashes: state.healthFlashes,
                  t: state.t
                });
              } catch (e2) {
              }
              _pendingRender = false;
            }, 0);
          }
        }
      } catch (e) {
      }
    }
  }
  function runLoop() {
    if (!running) return;
    const now = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
    acc += now - last;
    last = now;
    if (acc > 250) acc = 250;
    while (acc >= SIM.DT_MS) {
      step(SIM.DT_MS / 1e3);
      acc -= SIM.DT_MS;
    }
    try {
      requestAnimationFrame(runLoop);
    } catch (e) {
      setTimeout(runLoop, SIM.DT_MS);
    }
  }
  function setContinuousEnabled(v = false) {
    continuous = !!v;
    if (simWorker) {
      try {
        simWorker.post({ type: "setContinuous", value: !!v });
      } catch (e) {
      }
    } else {
      if (continuous) {
        const result = evaluateReinforcement(
          SIM.DT_MS / 1e3,
          state,
          continuousOptions
        );
        if (result && Array.isArray(result.spawned) && result.spawned.length) {
          lastReinforcement = {
            spawned: result.spawned,
            timestamp: Date.now(),
            options: { ...continuousOptions }
          };
          emit("reinforcements", { spawned: result.spawned });
        }
      }
    }
  }
  function isContinuousEnabled() {
    return !!continuous;
  }
  function setContinuousOptions(opts = {}) {
    continuousOptions = { ...continuousOptions, ...opts };
    if (simWorker)
      try {
        simWorker.post({
          type: "setContinuousOptions",
          opts: continuousOptions
        });
      } catch (e) {
      }
  }
  function getContinuousOptions() {
    return { ...continuousOptions };
  }
  function setReinforcementIntervalManager(seconds) {
    setReinforcementInterval(seconds);
    if (simWorker)
      try {
        simWorker.post({ type: "setReinforcementInterval", seconds });
      } catch (e) {
      }
  }
  function getReinforcementIntervalManager() {
    return getReinforcementInterval();
  }
  function isRunning() {
    return running;
  }
  function isWorker() {
    return !!simWorker && !!workerReady;
  }
  function onWorkerReady(cb) {
    if (typeof cb === "function") workerReadyCbs.push(cb);
  }
  function offWorkerReady(cb) {
    const i = workerReadyCbs.indexOf(cb);
    if (i !== -1) workerReadyCbs.splice(i, 1);
  }
  function spawnShip(team = "red", type) {
    try {
      const shipType = type || getDefaultShipTypeSafe();
      const b = SIM.bounds;
      const x = Math.max(0, Math.min(b.W - 1e-6, srandom() * b.W));
      const y = Math.max(0, Math.min(b.H - 1e-6, srandom() * b.H));
      const ship = createShip(shipType, x, y, team);
      state.ships.push(ship);
      try {
        state.shipMap && state.shipMap.set(ship.id, ship);
      } catch (e) {
      }
      try {
        updateTeamCount(state, void 0, String(ship.team));
      } catch (e) {
      }
      return ship;
    } catch (e) {
      return null;
    }
  }
  function formFleets() {
    try {
      state.ships.length = 0;
      const bounds = SIM.bounds;
      const seedVal = Math.floor(srandom() * 4294967295) >>> 0;
      const ships = makeInitialFleets(seedVal, bounds, createShip);
      for (const ship of ships) {
        state.ships.push(ship);
      }
      try {
        normalizeStateShips(state);
      } catch (e) {
      }
    } catch (e) {
    }
  }
  function reseedManager(newSeed = Math.floor(srandom() * 4294967295)) {
    _seed2 = newSeed >>> 0;
    srand(_seed2);
    if (simWorker)
      try {
        simWorker.post({ type: "setSeed", seed: _seed2 });
      } catch (e) {
      }
  }
  function getLastReinforcement() {
    return { ...lastReinforcement };
  }
  function snapshot() {
    return {
      ships: state.ships.slice(),
      bullets: state.bullets.slice(),
      t: state.t,
      teamCounts: state.teamCounts ? { ...state.teamCounts } : {},
      flashes: state.flashes ? state.flashes.slice() : [],
      shieldFlashes: state.shieldFlashes ? state.shieldFlashes.slice() : [],
      healthFlashes: state.healthFlashes ? state.healthFlashes.slice() : []
    };
  }
  try {
    if (useWorker) {
      const factory = createSimWorkerFactory || createSimWorker;
      let simWorkerUrl;
      try {
        simWorkerUrl = typeof import.meta !== "undefined" && import.meta.url ? new URL("./simWorker.js", import.meta.url).href : "./simWorker.js";
      } catch (e) {
        simWorkerUrl = "./simWorker.js";
      }
      simWorker = factory(simWorkerUrl);
      _workerReadyHandler = () => {
        workerReady = true;
        for (const cb of workerReadyCbs.slice()) {
          try {
            cb();
          } catch (e) {
          }
        }
      };
      simWorker.on && simWorker.on("ready", _workerReadyHandler);
      _workerSnapshotHandler = (m) => {
        try {
          if (m && m.state) {
            state = m.state;
            try {
              normalizeStateShips(state);
            } catch (e) {
            }
            try {
              internal.state = state;
            } catch (e) {
            }
            try {
              if (renderer && typeof renderer.renderState === "function") {
                if (!_pendingRender) {
                  _pendingRender = true;
                  try {
                    requestAnimationFrame(() => {
                      try {
                        renderer.renderState({
                          ships: state.ships,
                          bullets: state.bullets,
                          flashes: state.flashes,
                          shieldFlashes: state.shieldFlashes,
                          healthFlashes: state.healthFlashes,
                          t: state.t
                        });
                      } catch (e) {
                      }
                      _pendingRender = false;
                    });
                  } catch (e) {
                    setTimeout(() => {
                      try {
                        renderer.renderState({
                          ships: state.ships,
                          bullets: state.bullets,
                          flashes: state.flashes,
                          shieldFlashes: state.shieldFlashes,
                          healthFlashes: state.healthFlashes,
                          t: state.t
                        });
                      } catch (e2) {
                      }
                      _pendingRender = false;
                    }, 0);
                  }
                }
              }
            } catch (e) {
            }
          }
        } catch (e) {
        }
      };
      simWorker.on && simWorker.on("snapshot", _workerSnapshotHandler);
      _workerReinforcementsHandler = (m) => {
        emit("reinforcements", m);
      };
      simWorker.on && simWorker.on("reinforcements", _workerReinforcementsHandler);
      try {
        simWorker.post({
          type: "init",
          seed,
          bounds: SIM.bounds,
          simDtMs: SIM.DT_MS,
          state
        });
        simWorker.post({ type: "start" });
      } catch (e) {
      }
    }
  } catch (e) {
    simWorker = null;
  }
  return {
    // Allow external callers (tests) to push snapshots into the manager
    onSnapshot: (m) => {
      try {
        if (m && m.state) {
          state = m.state;
          try {
            normalizeStateShips(state);
          } catch (e) {
          }
          try {
            internal.state = state;
          } catch (e) {
          }
          if (renderer && typeof renderer.renderState === "function") {
            try {
              if (!_pendingRender) {
                _pendingRender = true;
                try {
                  requestAnimationFrame(() => {
                    try {
                      renderer.renderState({
                        ships: state.ships,
                        bullets: state.bullets,
                        flashes: state.flashes,
                        shieldFlashes: state.shieldFlashes,
                        healthFlashes: state.healthFlashes,
                        t: state.t
                      });
                    } catch (e) {
                    }
                    _pendingRender = false;
                  });
                } catch (e) {
                  setTimeout(() => {
                    try {
                      renderer.renderState({
                        ships: state.ships,
                        bullets: state.bullets,
                        flashes: state.flashes,
                        shieldFlashes: state.shieldFlashes,
                        healthFlashes: state.healthFlashes,
                        t: state.t
                      });
                    } catch (e2) {
                    }
                    _pendingRender = false;
                  }, 0);
                }
              }
            } catch (e) {
            }
          }
        }
      } catch (e) {
      }
    },
    on,
    off,
    start,
    pause,
    reset: resetManager,
    stepOnce,
    setContinuousEnabled,
    isContinuousEnabled,
    setContinuousOptions,
    getContinuousOptions,
    setReinforcementInterval: setReinforcementIntervalManager,
    getReinforcementInterval: getReinforcementIntervalManager,
    isRunning,
    isWorker,
    onWorkerReady,
    offWorkerReady,
    spawnShip,
    reseed: reseedManager,
    getLastReinforcement,
    snapshot,
    score,
    formFleets,
    destroy,
    _internal: internal
  };
}
function releaseParticle(state, p) {
  if (!p) return;
  const key = "particle";
  try {
    releaseEffect(state, key, p, (x) => {
    });
  } catch {
  }
  const idx = (state.particles || []).indexOf(p);
  if (idx !== -1) (state.particles || []).splice(idx, 1);
}
function acquireBullet(state, opts = {}) {
  if (!state) state = makeInitialState();
  state.bullets = state.bullets || [];
  state.assetPool = state.assetPool || {
    textures: /* @__PURE__ */ new Map(),
    sprites: /* @__PURE__ */ new Map(),
    effects: /* @__PURE__ */ new Map(),
    counts: {
      textures: /* @__PURE__ */ new Map(),
      sprites: /* @__PURE__ */ new Map(),
      effects: /* @__PURE__ */ new Map()
    },
    config: {
      texturePoolSize: 128,
      spritePoolSize: 256,
      effectPoolSize: 128,
      textureOverflowStrategy: "discard-oldest",
      spriteOverflowStrategy: "discard-oldest",
      effectOverflowStrategy: "discard-oldest"
    }
  };
  const key = "bullet";
  const b = acquireSprite(
    state,
    key,
    () => makePooled(
      { ...opts, id: genId(), alive: true },
      (o, initArgs) => Object.assign(o, initArgs)
    ),
    opts
  );
  (state.bullets ||= []).push(b);
  return b;
}
function releaseBullet(state, b) {
  if (!b) return;
  if (!b.alive) return;
  b.alive = false;
  const arr = state.bullets || [];
  const idx = arr.indexOf(b);
  if (idx !== -1) arr.splice(idx, 1);
  releaseSprite(state, "bullet", b, void 0);
}
function acquireExplosion(state, opts = {}) {
  const key = "explosion";
  const e = acquireEffect(
    state,
    key,
    () => makePooled(createExplosionEffect(opts), resetExplosionEffect),
    opts
  );
  (state.explosions ||= []).push(e);
  return e;
}
function releaseExplosion(state, e) {
  if (!e) return;
  if (e._pooled) return;
  if (!e.alive) return;
  e.alive = false;
  e._pooled = true;
  const arr = state.explosions || [];
  const idx = arr.indexOf(e);
  if (idx !== -1) arr.splice(idx, 1);
  releaseEffect(state, "explosion", e, void 0);
}
function acquireShieldHit(state, opts = {}) {
  const key = "shieldHit";
  const sh = acquireEffect(
    state,
    key,
    () => makePooled(createShieldHitEffect(opts), resetShieldHitEffect),
    opts
  );
  (state.shieldHits ||= []).push(sh);
  return sh;
}
function releaseShieldHit(state, sh) {
  if (!sh) return;
  if (sh._pooled) return;
  const arr = state.shieldHits || [];
  const i = arr.indexOf(sh);
  if (i !== -1) arr.splice(i, 1);
  sh.alive = false;
  sh._pooled = true;
  releaseEffect(state, "shieldHit", sh, void 0);
}
function acquireHealthHit(state, opts = {}) {
  const key = "healthHit";
  const hh = acquireEffect(
    state,
    key,
    () => makePooled(createHealthHitEffect(opts), resetHealthHitEffect),
    opts
  );
  (state.healthHits ||= []).push(hh);
  return hh;
}
function releaseHealthHit(state, hh) {
  if (!hh) return;
  if (hh._pooled) return;
  const arr = state.healthHits || [];
  const i = arr.indexOf(hh);
  if (i !== -1) arr.splice(i, 1);
  hh.alive = false;
  hh._pooled = true;
  releaseEffect(state, "healthHit", hh, void 0);
}
var config = {
  shield: { ...SHIELD },
  health: { ...HEALTH },
  explosion: { ...EXPLOSION },
  stars: { ...STARS }
};
var _seed2 = null;
var _reinforcementInterval = TeamsConfig.continuousReinforcement?.interval ?? 5;
var _reinforcementAccumulator = 0;
function setReinforcementInterval(seconds) {
  _reinforcementInterval = Number(seconds) || (TeamsConfig.continuousReinforcement?.interval ?? 5);
}
function getReinforcementInterval() {
  return _reinforcementInterval;
}
function emitManagerEvent(map, type, data) {
  const arr = map.get(type) || [];
  for (const cb of arr.slice()) {
    try {
      if (typeof cb === "function") cb(data);
    } catch (e) {
    }
  }
}
function evaluateReinforcement(dt, state, continuousOptions = {}) {
  _reinforcementAccumulator += dt;
  if (_reinforcementAccumulator >= _reinforcementInterval) {
    _reinforcementAccumulator = 0;
    try {
      if (typeof chooseReinforcementsWithManagerSeed === "function") {
        const orders = chooseReinforcementsWithManagerSeed(state, {
          ...continuousOptions,
          bounds: SIM.bounds,
          enabled: true
        });
        if (Array.isArray(orders) && orders.length) {
          const spawned = [];
          for (const o of orders) {
            try {
              const ship = createShip(
                o.type || getDefaultShipTypeSafe(),
                o.x || 100,
                o.y || 100,
                o.team || "red"
              );
              state.ships.push(ship);
              try {
                state.shipMap && state.shipMap.set(ship.id, ship);
              } catch (e) {
              }
              try {
                updateTeamCount(state, void 0, ship.team);
              } catch (e) {
              }
              spawned.push(ship);
            } catch (e) {
            }
          }
          return { spawned };
        }
      }
      const fallback = getDefaultShipTypeSafe();
      const r = createShip(
        fallback,
        FALLBACK_POSITIONS[0].x,
        FALLBACK_POSITIONS[0].y,
        FALLBACK_POSITIONS[0].team
      );
      const b = createShip(
        fallback,
        FALLBACK_POSITIONS[1].x,
        FALLBACK_POSITIONS[1].y,
        FALLBACK_POSITIONS[1].team
      );
      state.ships.push(r);
      try {
        state.shipMap && state.shipMap.set(r.id, r);
      } catch (e) {
      }
      try {
        updateTeamCount(state, void 0, String(r.team));
      } catch (e) {
      }
      state.ships.push(b);
      try {
        state.shipMap && state.shipMap.set(b.id, b);
      } catch (e) {
      }
      try {
        updateTeamCount(state, void 0, String(b.team));
      } catch (e) {
      }
      return { spawned: [r, b] };
    } catch (e) {
      return null;
    }
  }
  return null;
}

// src/canvasrenderer.ts
init_rendererConfig();
init_assetsConfig();
init_svgLoader();

// src/pools/tintedHullPool.ts
var TintedHullPool = class {
  map = /* @__PURE__ */ new Map();
  teamMap = /* @__PURE__ */ new Map();
  // teamColor -> array of keys (in insertion order)
  // expose caps so callers/tests can read/update them if needed
  globalCap;
  perTeamCap;
  constructor(opts) {
    this.globalCap = opts?.globalCap ?? 256;
    this.perTeamCap = opts?.perTeamCap ?? 64;
  }
  get size() {
    return this.map.size;
  }
  has(key) {
    return this.map.has(key);
  }
  get(key) {
    return this.map.get(key);
  }
  // set a canvas and enforce caps
  set(key, canvas) {
    if (this.map.has(key)) {
      this._removeKeyFromTeam(key);
      this.map.delete(key);
    }
    const nodeEnv = typeof process !== "undefined" && (process.env && "production") ? "production" : typeof globalThis.NODE_ENV !== "undefined" ? globalThis.NODE_ENV : "development";
    const throwFlag = typeof process !== "undefined" && process.env && process.env.THROW_ON_SHARED_TINT ? process.env.THROW_ON_SHARED_TINT : typeof globalThis.THROW_ON_SHARED_TINT !== "undefined" ? globalThis.THROW_ON_SHARED_TINT : void 0;
    const shouldCheck = nodeEnv !== "production";
    if (shouldCheck) {
      for (const [k, v] of this.map.entries()) {
        if (v === canvas && k !== key) {
          const msg = `[TintedHullPool] Detected shared canvas instance across keys: existing='${k}' new='${key}'. Avoid reusing the same HTMLCanvasElement for different tinted keys.`;
          if (throwFlag === "1" || String(throwFlag).toLowerCase() === "true") {
            throw new Error(msg);
          } else {
            console.warn(msg);
          }
          break;
        }
      }
    }
    this.map.set(key, canvas);
    const team = this._teamForKey(key);
    if (!this.teamMap.has(team)) this.teamMap.set(team, []);
    this.teamMap.get(team).push(key);
    const arr = this.teamMap.get(team);
    while (arr.length > this.perTeamCap) {
      const oldestKey = arr.shift();
      if (oldestKey) this.map.delete(oldestKey);
    }
    while (this.map.size > this.globalCap) {
      const it = this.map.keys();
      const oldest = it.next().value;
      if (!oldest) break;
      this._removeKeyFromTeam(oldest);
      this.map.delete(oldest);
    }
    return this;
  }
  delete(key) {
    this._removeKeyFromTeam(key);
    return this.map.delete(key);
  }
  clear() {
    this.map.clear();
    this.teamMap.clear();
  }
  keys() {
    return this.map.keys();
  }
  // Helper: extract team color from key formatted as "<shipType>::<teamColor>"
  _teamForKey(key) {
    const parts = key.split("::");
    return parts.length >= 2 ? parts.slice(1).join("::") : "";
  }
  _removeKeyFromTeam(key) {
    const team = this._teamForKey(key);
    const arr = this.teamMap.get(team);
    if (!arr) return;
    const idx = arr.indexOf(key);
    if (idx >= 0) arr.splice(idx, 1);
    if (arr.length === 0) this.teamMap.delete(team);
  }
};

// src/canvasrenderer.ts
function getShipConfigSafe2() {
  return getRuntimeShipConfigSafe() || {};
}
function teamMapping(color) {
  return {
    primary: color,
    hull: color,
    trim: color,
    hangar: color,
    launch: color,
    engine: color,
    glow: color,
    turret: color,
    panel: color,
    secondary: color,
    accent: color,
    weapon: color,
    detail: color
  };
}
var CanvasRenderer = class _CanvasRenderer {
  canvas;
  ctx = null;
  bufferCanvas;
  bufferCtx = null;
  providesOwnLoop = false;
  type = "canvas";
  // ratio between backing store pixels and CSS (logical) pixels
  pixelRatio = 1;
  // cache for svg-extracted turret mountpoints in ship-local radius units
  _svgMountCache = null;
  // cache for svg-extracted engine mountpoints in ship-local radius units
  _svgEngineMountCache = null;
  // rasterized turret sprite cache: kind -> offscreen canvas
  _turretSpriteCache = null;
  // rasterized hull-only SVG cache: shipType -> offscreen canvas
  _svgHullCache = {};
  // tinted hull cache implemented as a per-team capped pool for canvases
  _tintedHullPool = null;
  // Backwards-compatible Map-like facade for tests that expect _tintedHullCache
  get _tintedHullCache() {
    const self = this;
    class MapWrapper {
      [Symbol.toStringTag] = "Map";
      constructor() {
      }
      get size() {
        try {
          return self._tintedHullPool ? self._tintedHullPool.size || 0 : 0;
        } catch (e) {
          return 0;
        }
      }
      clear() {
        if (self._tintedHullPool) self._tintedHullPool.clear();
      }
      delete(key) {
        if (!self._tintedHullPool) return false;
        return !!(self._tintedHullPool.has(key) && (self._tintedHullPool.delete(key), true));
      }
      forEach(cb, thisArg) {
        if (!self._tintedHullPool) return;
        for (const k of self._tintedHullPool.keys()) {
          const v = self._tintedHullPool.get(k);
          cb.call(thisArg, v, k, this);
        }
      }
      get(key) {
        return self._tintedHullPool ? self._tintedHullPool.get(key) : void 0;
      }
      has(key) {
        return !!(self._tintedHullPool && self._tintedHullPool.has(key));
      }
      set(key, value) {
        self._setTintedCanvas(key, value);
        return this;
      }
      *entries() {
        if (!self._tintedHullPool) return;
        for (const k of self._tintedHullPool.keys()) {
          yield [
            k,
            self._tintedHullPool.get(k)
          ];
        }
      }
      *keys() {
        if (!self._tintedHullPool) return;
        for (const k of self._tintedHullPool.keys()) yield k;
      }
      *values() {
        if (!self._tintedHullPool) return;
        for (const k of self._tintedHullPool.keys())
          yield self._tintedHullPool.get(k);
      }
      [Symbol.iterator]() {
        return this.entries();
      }
    }
    return new MapWrapper();
  }
  // Clear the tinted hull cache (useful when palette/team colors change)
  clearTintedHullCache() {
    try {
      if (this._tintedHullPool) this._tintedHullPool.clear();
    } catch (e) {
    }
  }
  // Internal helper: set a tinted canvas in the Map and enforce LRU cap.
  _setTintedCanvas(key, canvas) {
    if (!this._tintedHullPool)
      this._tintedHullPool = new TintedHullPool({
        globalCap: 256,
        perTeamCap: 64
      });
    this._tintedHullPool.set(key, canvas);
  }
  // Test helper: allow tests to inject entries deterministically without TS private access errors.
  // Kept separate so production code still uses private _setTintedCanvas.
  _testSetTintedCanvas(key, canvas) {
    this._setTintedCanvas(key, canvas);
  }
  constructor(canvas) {
    this.canvas = canvas;
    this.bufferCanvas = document.createElement("canvas");
    this.bufferCtx = this.bufferCanvas.getContext("2d");
  }
  // Dev-only: warn once per asset key when an SVG fetch fails.
  static _warnedSvgKeys = /* @__PURE__ */ new Set();
  _devWarnSvgFetchFail(assetKey, rel, err) {
    try {
      const isProd = typeof process !== "undefined" && process.env && true || typeof globalThis.NODE_ENV !== "undefined" && globalThis.NODE_ENV === "production";
      const isTest = typeof process !== "undefined" && process.env && (process.env.VITEST || process.env.VITEST_WORKER_ID) || typeof globalThis.vitest !== "undefined";
      if (isProd || isTest) return;
      if (!assetKey) assetKey = "<unknown>";
      const key = `${assetKey}::${rel}`;
      if (_CanvasRenderer._warnedSvgKeys.has(key)) return;
      _CanvasRenderer._warnedSvgKeys.add(key);
      console.warn(
        `[CanvasRenderer] Failed to load SVG for '${assetKey}' from '${rel}'. Falling back to vector shape.`,
        err ? err : ""
      );
    } catch (e) {
    }
  }
  init() {
    this.ctx = this.canvas.getContext("2d");
    if (!this.ctx) {
      const noop = () => {
      };
      const noOpCtx = {
        setTransform: noop,
        imageSmoothingEnabled: true,
        clearRect: noop,
        save: noop,
        restore: noop,
        fillRect: noop,
        beginPath: noop,
        moveTo: noop,
        lineTo: noop,
        closePath: noop,
        fill: noop,
        stroke: noop,
        arc: noop,
        translate: noop,
        rotate: noop,
        drawImage: noop,
        globalAlpha: 1,
        strokeStyle: "#000",
        fillStyle: "#000",
        lineWidth: 1,
        globalCompositeOperation: "source-over"
      };
      this.ctx = noOpCtx;
    }
    this.bufferCtx = this.bufferCanvas.getContext("2d") || this.ctx;
    if (!this.bufferCtx) return false;
    try {
      const renderScale = rendererConfig_default && typeof rendererConfig_default.renderScale === "number" ? rendererConfig_default.renderScale : 1;
      this.pixelRatio = renderScale;
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.imageSmoothingEnabled = true;
    } catch (e) {
      this.pixelRatio = 1;
    }
    try {
      this.preloadAllAssets && this.preloadAllAssets().catch(() => {
      });
    } catch (e) {
    }
    return true;
  }
  // Preload SVG assets listed in AssetsConfig.svgAssets, extract mountpoints
  // and normalize them into radius-unit coordinates compatible with shapes2d
  async preloadAllAssets() {
    try {
      const svgAssets = assetsConfig_default.svgAssets || {};
      const teams = teamsConfig_default && teamsConfig_default.teams ? teamsConfig_default.teams : {};
      const teamColors = [];
      for (const tName of Object.keys(teams)) {
        const t = teams[tName];
        if (t && t.color) teamColors.push(t.color);
      }
      if (teamColors.length === 0) {
        const p = assetsConfig_default.palette || {};
        if (p.shipHull) teamColors.push(p.shipHull);
        if (p.shipAccent) teamColors.push(p.shipAccent);
      }
      try {
        if (!this._tintedHullPool)
          this._tintedHullPool = new TintedHullPool({
            globalCap: 256,
            perTeamCap: 64
          });
        for (const shipType of Object.keys(svgAssets)) {
          try {
            for (const col of teamColors) {
              const k = `${shipType}::${col}`;
              if (!this._tintedHullPool.has(k)) {
                const pc = document.createElement("canvas");
                pc.width = 16;
                pc.height = 16;
                try {
                  this._setTintedCanvas(k, pc);
                } catch (e) {
                  if (this._tintedHullPool) this._tintedHullPool.set(k, pc);
                }
              }
            }
          } catch (e) {
          }
        }
      } catch (e) {
      }
      try {
        this._svgHullCache = this._svgHullCache || {};
        for (const k of Object.keys(svgAssets)) {
          if (!this._svgHullCache[k] && typeof svgAssets[k] === "string") {
            const ph = document.createElement("canvas");
            ph.width = 128;
            ph.height = 128;
            const pctx = ph.getContext("2d");
            if (pctx) {
              pctx.fillStyle = "#fff";
              pctx.fillRect(0, 0, ph.width, ph.height);
            }
            try {
              ph._placeholder = true;
            } catch (e) {
            }
            this._svgHullCache[k] = ph;
          }
        }
      } catch (e) {
      }
      this._svgMountCache = this._svgMountCache || {};
      for (const key of Object.keys(svgAssets)) {
        try {
          const rel = svgAssets[key];
          let svgText = "";
          try {
            if (typeof rel === "string" && rel.trim().startsWith("<svg")) {
              svgText = rel;
            } else {
              if (typeof fetch === "function") {
                const resp = await fetch(rel);
                if (resp && resp.ok) {
                  svgText = await resp.text();
                } else {
                  this._devWarnSvgFetchFail(
                    key,
                    String(rel),
                    resp && !resp.ok ? resp.status : void 0
                  );
                }
              }
            }
          } catch (e) {
            this._devWarnSvgFetchFail(key, String(rel), e);
            svgText = "";
          }
          if (!svgText) continue;
          const parsed = parseSvgForMounts(svgText);
          const mounts = parsed.mounts || [];
          const engineMounts = parsed.engineMounts || [];
          const vb = parsed.viewBox || { w: 128, h: 128 };
          const shapeEntry = assetsConfig_default.shapes2d && assetsConfig_default.shapes2d[key];
          let extent = 1;
          if (shapeEntry) {
            let maxv = 0;
            if (shapeEntry.type === "compound" && Array.isArray(shapeEntry.parts)) {
              for (const p of shapeEntry.parts) {
                if (p.type === "circle")
                  maxv = Math.max(maxv, Math.abs(p.r || 0));
                else if (p.type === "polygon")
                  for (const pt of p.points || []) {
                    maxv = Math.max(
                      maxv,
                      Math.abs(pt[0] || 0),
                      Math.abs(pt[1] || 0)
                    );
                  }
              }
            } else if (shapeEntry.type === "polygon") {
              for (const pt of shapeEntry.points || []) {
                maxv = Math.max(
                  maxv,
                  Math.abs(pt[0] || 0),
                  Math.abs(pt[1] || 0)
                );
              }
            } else if (shapeEntry.type === "circle")
              maxv = Math.max(maxv, Math.abs(shapeEntry.r || 0));
            extent = maxv || 1;
          }
          const norm = mounts.map((m) => {
            const nx = ((m.x || 0) - vb.w / 2) / (vb.w / 2 || 1);
            const ny = ((m.y || 0) - vb.h / 2) / (vb.h / 2 || 1);
            return [nx * extent, ny * extent];
          });
          this._svgMountCache[key] = norm;
          const engineNorm = engineMounts.map((m) => {
            const nx = ((m.x || 0) - vb.w / 2) / (vb.w / 2 || 1);
            const ny = ((m.y || 0) - vb.h / 2) / (vb.h / 2 || 1);
            return [nx * extent, ny * extent];
          });
          this._svgEngineMountCache = this._svgEngineMountCache || {};
          this._svgEngineMountCache[key] = engineNorm;
          try {
            let svgRenderer = void 0;
            try {
              svgRenderer = void 0;
              try {
                Promise.resolve().then(() => (init_svgRenderer(), svgRenderer_exports)).then(
                  (m) => svgRenderer = m.default || m
                );
              } catch (e) {
                svgRenderer = void 0;
              }
            } catch (e) {
              try {
                svgRenderer = await Promise.resolve().then(() => (init_svgRenderer(), svgRenderer_exports));
              } catch (e2) {
                svgRenderer = void 0;
              }
            }
            try {
              if (!svgRenderer && globalThis.__SpaceAutoBattler_svgRenderer) {
                svgRenderer = globalThis.__SpaceAutoBattler_svgRenderer;
              }
            } catch (e) {
            }
            if (svgRenderer && typeof svgRenderer.rasterizeSvgWithTeamColors === "function") {
              const outW = vb && vb.w || 128;
              const outH = vb && vb.h || 128;
              (async () => {
                try {
                  const canvas = await svgRenderer.rasterizeSvgWithTeamColors(
                    svgText,
                    {},
                    outW,
                    outH,
                    { applyTo: "both", assetKey: key }
                  );
                  try {
                    this._svgHullCache = this._svgHullCache || {};
                    this._svgHullCache[key] = canvas;
                  } catch (e) {
                  }
                } catch (e) {
                }
              })();
            }
          } catch (e) {
          }
          try {
            const outW = vb.w || 128;
            const outH = vb.h || 128;
            try {
              if (!this._svgHullCache || !this._svgHullCache[key]) {
                const outW2 = vb.w || 128;
                const outH2 = vb.h || 128;
                (async () => {
                  try {
                    let hullCanvas = void 0;
                    try {
                      if (typeof rasterizeHullOnlySvgToCanvasAsync === "function") {
                        hullCanvas = await rasterizeHullOnlySvgToCanvasAsync(
                          svgText,
                          outW2,
                          outH2
                        );
                      } else {
                        hullCanvas = rasterizeHullOnlySvgToCanvas(
                          svgText,
                          outW2,
                          outH2
                        );
                      }
                    } catch (e) {
                      hullCanvas = void 0;
                    }
                    if (hullCanvas) {
                      try {
                        this._svgHullCache = this._svgHullCache || {};
                        this._svgHullCache[key] = hullCanvas;
                      } catch (e) {
                      }
                      try {
                        let svgRenderer = void 0;
                        try {
                          Promise.resolve().then(() => (init_svgRenderer(), svgRenderer_exports)).then(
                            (m) => svgRenderer = m.default || m
                          );
                        } catch (e) {
                          svgRenderer = void 0;
                        }
                        try {
                          if (!svgRenderer && globalThis.__SpaceAutoBattler_svgRenderer) {
                            svgRenderer = globalThis.__SpaceAutoBattler_svgRenderer;
                          }
                        } catch (e) {
                        }
                        if (svgRenderer && typeof svgRenderer.cacheCanvasForAsset === "function") {
                          svgRenderer.cacheCanvasForAsset(
                            key,
                            {},
                            hullCanvas.width,
                            hullCanvas.height,
                            hullCanvas
                          );
                        }
                      } catch (e) {
                      }
                    }
                  } catch (e) {
                  }
                })();
              }
            } catch (e) {
            }
          } catch (e) {
          }
          try {
            assetsConfig_default.svgEngineMounts = assetsConfig_default.svgEngineMounts || {};
            assetsConfig_default.svgEngineMounts[key] = engineNorm;
          } catch (e) {
          }
        } catch (e) {
        }
      }
      try {
        if (!this._tintedHullPool)
          this._tintedHullPool = new TintedHullPool({
            globalCap: 256,
            perTeamCap: 64
          });
        const teams2 = teamsConfig_default && teamsConfig_default.teams ? teamsConfig_default.teams : {};
        const teamColors2 = [];
        for (const tName of Object.keys(teams2)) {
          const t = teams2[tName];
          if (t && t.color) teamColors2.push(t.color);
        }
        if (teamColors2.length === 0) {
          const p = assetsConfig_default.palette || {};
          if (p.shipHull) teamColors2.push(p.shipHull);
          if (p.shipAccent) teamColors2.push(p.shipAccent);
        }
        const declaredSvgAssets = assetsConfig_default.svgAssets || {};
        for (const shipType of Object.keys(declaredSvgAssets)) {
          try {
            let hullCanvas = this._svgHullCache[shipType];
            if (!hullCanvas) {
              try {
                const rel = declaredSvgAssets[shipType];
                if (typeof rel === "string" && rel.trim().startsWith("<svg")) {
                  const vbMatch = /viewBox\s*=\s*"(\d+)[^\d]+(\d+)[^\d]+(\d+)[^\d]+(\d+)"/.exec(
                    rel
                  );
                  let outW = 128, outH = 128;
                  if (vbMatch) {
                    outW = parseInt(vbMatch[3]) || 128;
                    outH = parseInt(vbMatch[4]) || 128;
                  }
                  try {
                    if (typeof rasterizeHullOnlySvgToCanvasAsync === "function") {
                      try {
                        hullCanvas = await rasterizeHullOnlySvgToCanvasAsync(rel, outW, outH);
                      } catch (e) {
                        hullCanvas = void 0;
                      }
                    } else {
                      hullCanvas = rasterizeHullOnlySvgToCanvas(
                        rel,
                        outW,
                        outH
                      );
                    }
                  } catch (e) {
                    hullCanvas = void 0;
                  }
                  if (!hullCanvas) {
                    const ph = document.createElement("canvas");
                    ph.width = outW;
                    ph.height = outH;
                    const pctx = ph.getContext("2d");
                    if (pctx) {
                      pctx.fillStyle = "#fff";
                      pctx.fillRect(0, 0, outW, outH);
                    }
                    try {
                      ph._placeholder = true;
                    } catch (e) {
                    }
                    hullCanvas = ph;
                  }
                  this._svgHullCache = this._svgHullCache || {};
                  this._svgHullCache[shipType] = hullCanvas;
                }
              } catch (e) {
              }
            }
            if (!hullCanvas) continue;
            for (const col of teamColors2) {
              const k = `${shipType}::${col}`;
              if (this._tintedHullPool && this._tintedHullPool.has(k)) continue;
              try {
                const tc = document.createElement("canvas");
                tc.width = hullCanvas.width;
                tc.height = hullCanvas.height;
                const tctx = tc.getContext("2d");
                if (tctx) {
                  tctx.clearRect(0, 0, tc.width, tc.height);
                  tctx.drawImage(hullCanvas, 0, 0);
                  tctx.globalCompositeOperation = "source-atop";
                  tctx.fillStyle = col;
                  tctx.fillRect(0, 0, tc.width, tc.height);
                  tctx.globalCompositeOperation = "source-over";
                  this._setTintedCanvas(k, tc);
                  try {
                    let svgRenderer = void 0;
                    try {
                      svgRenderer = await Promise.resolve().then(() => (init_svgRenderer(), svgRenderer_exports)).then((m) => m.default || m);
                    } catch (e) {
                      svgRenderer = void 0;
                    }
                    try {
                      if (!svgRenderer && globalThis.__SpaceAutoBattler_svgRenderer) {
                        svgRenderer = globalThis.__SpaceAutoBattler_svgRenderer;
                      }
                    } catch (e) {
                    }
                    if (svgRenderer && typeof svgRenderer.cacheCanvasForAsset === "function") {
                      svgRenderer.cacheCanvasForAsset(
                        shipType,
                        teamMapping(col),
                        tc.width,
                        tc.height,
                        tc
                      );
                    }
                  } catch (e) {
                  }
                }
              } catch (e) {
              }
            }
          } catch (e) {
          }
        }
        try {
          const declaredSvgAssets2 = assetsConfig_default.svgAssets || {};
          for (const shipType of Object.keys(declaredSvgAssets2)) {
            if (!this._svgHullCache || !this._svgHullCache[shipType]) {
              const ph = document.createElement("canvas");
              ph.width = 128;
              ph.height = 128;
              const pctx = ph.getContext("2d");
              if (pctx) {
                pctx.fillStyle = "#fff";
                pctx.fillRect(0, 0, ph.width, ph.height);
              }
              try {
                ph._placeholder = true;
              } catch (e) {
              }
              this._svgHullCache = this._svgHullCache || {};
              this._svgHullCache[shipType] = ph;
              for (const col of teamColors2) {
                const k = `${shipType}::${col}`;
                if (this._tintedHullPool && this._tintedHullPool.has(k))
                  continue;
                try {
                  const tc = document.createElement("canvas");
                  tc.width = ph.width;
                  tc.height = ph.height;
                  const tctx = tc.getContext("2d");
                  if (tctx) {
                    tctx.clearRect(0, 0, tc.width, tc.height);
                    try {
                      tctx.drawImage(ph, 0, 0);
                    } catch (e) {
                    }
                    try {
                      tctx.globalCompositeOperation = "source-atop";
                      tctx.fillStyle = col;
                      tctx.fillRect(0, 0, tc.width, tc.height);
                      tctx.globalCompositeOperation = "source-over";
                    } catch (e) {
                    }
                  }
                  this._setTintedCanvas(k, tc);
                  try {
                    const svgRenderer = await Promise.resolve().then(() => (init_svgRenderer(), svgRenderer_exports)).then((m) => m.default || m);
                    if (svgRenderer && typeof svgRenderer.cacheCanvasForAsset === "function") {
                      svgRenderer.cacheCanvasForAsset(
                        shipType,
                        teamMapping(col),
                        tc.width,
                        tc.height,
                        tc
                      );
                    }
                  } catch (e) {
                  }
                } catch (e) {
                }
              }
            }
          }
        } catch (e) {
        }
      } catch (e) {
      }
      try {
        this._turretSpriteCache = this._turretSpriteCache || {};
        const turretDefs = assetsConfig_default.turretDefaults || {
          basic: { sprite: "turretBasic" }
        };
        const kinds = Object.keys(turretDefs);
        for (const k of kinds) {
          try {
            const spriteKey = turretDefs[k].sprite || "turretBasic";
            const tshape = assetsConfig_default.shapes2d && assetsConfig_default.shapes2d[spriteKey];
            if (!tshape) continue;
            const basePx = Math.max(
              24,
              Math.round(24 * rendererConfig_default.renderScale || 1)
            );
            const canvas = document.createElement("canvas");
            const size = Math.max(16, basePx * 2);
            canvas.width = size;
            canvas.height = size;
            const ctx2 = canvas.getContext("2d");
            if (!ctx2) continue;
            ctx2.clearRect(0, 0, canvas.width, canvas.height);
            ctx2.translate(size / 2, size / 2);
            ctx2.fillStyle = assetsConfig_default.palette?.turret || "#94a3b8";
            const scale = size / 2 / 2;
            if (tshape.type === "circle") {
              ctx2.beginPath();
              ctx2.arc(0, 0, (tshape.r || 1) * scale, 0, Math.PI * 2);
              ctx2.fill();
            } else if (tshape.type === "polygon") {
              ctx2.beginPath();
              const pts = tshape.points || [];
              if (pts.length) {
                ctx2.moveTo((pts[0][0] || 0) * scale, (pts[0][1] || 0) * scale);
                for (let i = 1; i < pts.length; i++)
                  ctx2.lineTo(
                    (pts[i][0] || 0) * scale,
                    (pts[i][1] || 0) * scale
                  );
                ctx2.closePath();
                ctx2.fill();
              }
            } else if (tshape.type === "compound") {
              for (const part of tshape.parts || []) {
                if (part.type === "circle") {
                  ctx2.beginPath();
                  ctx2.arc(0, 0, (part.r || 1) * scale, 0, Math.PI * 2);
                  ctx2.fill();
                } else if (part.type === "polygon") {
                  ctx2.beginPath();
                  const pts = part.points || [];
                  if (pts.length) {
                    ctx2.moveTo(
                      (pts[0][0] || 0) * scale,
                      (pts[0][1] || 0) * scale
                    );
                    for (let i = 1; i < pts.length; i++)
                      ctx2.lineTo(
                        (pts[i][0] || 0) * scale,
                        (pts[i][1] || 0) * scale
                      );
                    ctx2.closePath();
                    ctx2.fill();
                  }
                }
              }
            }
            this._turretSpriteCache[k] = canvas;
          } catch (e) {
          }
        }
      } catch (e) {
      }
    } catch (e) {
    }
  }
  isRunning() {
    return false;
  }
  renderState(state, interpolation = 0) {
    function drawRing(x, y, R, color, alpha = 1, thickness = 2) {
      try {
        withContext(() => {
          activeBufferCtx.globalAlpha = Math.max(0, Math.min(1, alpha));
          activeBufferCtx.strokeStyle = color;
          activeBufferCtx.lineWidth = thickness * renderScale;
          activeBufferCtx.beginPath();
          activeBufferCtx.arc(
            x * renderScale,
            y * renderScale,
            Math.max(1, R * renderScale),
            0,
            Math.PI * 2
          );
          activeBufferCtx.stroke();
        });
      } catch (e) {
      }
    }
    const ctx = this.ctx;
    const bufferCtx = this.bufferCtx;
    if (!ctx || !bufferCtx) return;
    const defaultBounds = typeof getDefaultBounds === "function" ? getDefaultBounds() : { W: 1920, H: 1080 };
    const LOGICAL_W = defaultBounds && typeof defaultBounds.W === "number" ? defaultBounds.W : 1920;
    const LOGICAL_H = defaultBounds && typeof defaultBounds.H === "number" ? defaultBounds.H : 1080;
    const renderScale = rendererConfig_default && typeof rendererConfig_default.renderScale === "number" ? rendererConfig_default.renderScale : 1;
    const fitScale = rendererConfig_default._fitScale || 1;
    const bufferW = Math.round(LOGICAL_W * renderScale);
    const bufferH = Math.round(LOGICAL_H * renderScale);
    if (this.bufferCanvas.width !== bufferW || this.bufferCanvas.height !== bufferH) {
      this.bufferCanvas.width = bufferW;
      this.bufferCanvas.height = bufferH;
      this.bufferCtx = this.bufferCanvas.getContext("2d");
      if (!this.bufferCtx) return;
    }
    const activeBufferCtx = this.bufferCtx;
    activeBufferCtx.setTransform(1, 0, 0, 1, 0, 0);
    activeBufferCtx.clearRect(0, 0, bufferW, bufferH);
    withContext(() => {
      activeBufferCtx.fillStyle = assetsConfig_default.palette?.background || "#0b1220";
      activeBufferCtx.fillRect(0, 0, bufferW, bufferH);
    });
    try {
      const STAR_COOLDOWN_DEFAULT = 300;
      if (this._starCanvas === void 0)
        this._starCanvas = null;
      if (this._starBloomCanvas === void 0)
        this._starBloomCanvas = null;
      if (this._starCooldownMs === void 0)
        this._starCooldownMs = 0;
      if (this._starCooldownMs > 0) {
        const rawDt = typeof state.dt === "number" ? state.dt : typeof state.simDt === "number" ? state.simDt : 1 / 60;
        const dtMs = rawDt > 1 ? rawDt : rawDt * 1e3;
        const before = this._starCooldownMs;
        this._starCooldownMs = Math.max(
          0,
          this._starCooldownMs - dtMs
        );
        try {
          const isTest = typeof process !== "undefined" && process.env && (process.env.VITEST || process.env.VITEST_WORKER_ID) || typeof globalThis.vitest !== "undefined";
          if (!isTest) {
            console.log("canvasrenderer: starCooldown (renderer)", {
              before,
              after: this._starCooldownMs,
              rawDt,
              dtMs,
              t: state && state.t
            });
          }
        } catch (e) {
        }
      }
      if (!this._starCanvas && this._starCooldownMs <= 0) {
        const size = Math.max(1024, Math.max(bufferW, bufferH));
        const sc = document.createElement("canvas");
        sc.width = size;
        sc.height = size;
        const sctx = sc.getContext("2d");
        const g = sctx.createLinearGradient(0, 0, 0, size);
        g.addColorStop(0, "#001020");
        g.addColorStop(1, "#000010");
        sctx.fillStyle = g;
        sctx.fillRect(0, 0, size, size);
        const stars = Math.floor(size * size * 35e-5);
        for (let i = 0; i < stars; i++) {
          const x = Math.random() * size;
          const y = Math.random() * size;
          const r = Math.random() * 1.2;
          const bright = 0.5 + Math.random() * 0.5;
          sctx.fillStyle = `rgba(255,255,255,${bright})`;
          sctx.beginPath();
          sctx.arc(x, y, r, 0, Math.PI * 2);
          sctx.fill();
        }
        const bc = document.createElement("canvas");
        bc.width = size;
        bc.height = size;
        const bctx = bc.getContext("2d");
        bctx.fillStyle = "transparent";
        bctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 120; i++) {
          const x = Math.random() * size;
          const y = Math.random() * size;
          const r = 1.6 + Math.random() * 2.4;
          bctx.fillStyle = "rgba(255,244,200,0.95)";
          bctx.beginPath();
          bctx.arc(x, y, r, 0, Math.PI * 2);
          bctx.fill();
        }
        const tmp = document.createElement("canvas");
        tmp.width = Math.max(64, Math.floor(size / 8));
        tmp.height = Math.max(64, Math.floor(size / 8));
        const tctx = tmp.getContext("2d");
        tctx.drawImage(bc, 0, 0, tmp.width, tmp.height);
        bctx.clearRect(0, 0, size, size);
        bctx.globalAlpha = 0.85;
        bctx.drawImage(tmp, 0, 0, tmp.width, tmp.height, 0, 0, size, size);
        bctx.globalAlpha = 1;
        this._starCanvas = sc;
        this._starBloomCanvas = bc;
        try {
          console.log("canvasrenderer: regenerated starfield (renderer)", {
            width: this._starCanvas?.width,
            height: this._starCanvas?.height,
            time: typeof performance !== "undefined" && performance.now ? performance.now() : Date.now()
          });
        } catch (e) {
        }
        this._starCooldownMs = STAR_COOLDOWN_DEFAULT;
      }
    } catch (e) {
    }
    function drawPolygon(points) {
      if (!points || points.length === 0) return;
      activeBufferCtx.beginPath();
      activeBufferCtx.moveTo(
        points[0][0] * renderScale,
        points[0][1] * renderScale
      );
      for (let i = 1; i < points.length; i++)
        activeBufferCtx.lineTo(
          points[i][0] * renderScale,
          points[i][1] * renderScale
        );
      activeBufferCtx.closePath();
      activeBufferCtx.fill();
    }
    if (state && state.starCanvas) {
      if (state.starCanvas) {
        withContext(() => {
          activeBufferCtx.globalAlpha = 0.5;
          activeBufferCtx.drawImage(
            state.starCanvas,
            0,
            0,
            bufferW,
            bufferH
          );
        });
      }
      if (state.starBloomCanvas) {
        try {
          withContext(() => {
            activeBufferCtx.globalCompositeOperation = "lighter";
            try {
              const bloom = rendererConfig_default && rendererConfig_default.starfield && typeof rendererConfig_default.starfield.bloomIntensity === "number" ? rendererConfig_default.starfield.bloomIntensity : 0.9;
              activeBufferCtx.globalAlpha = Math.max(0, Math.min(1, bloom));
            } catch (e) {
              activeBufferCtx.globalAlpha = 0.9;
            }
            activeBufferCtx.drawImage(
              state.starBloomCanvas,
              0,
              0,
              bufferW,
              bufferH
            );
            activeBufferCtx.globalCompositeOperation = "source-over";
            activeBufferCtx.globalAlpha = 1;
          });
        } catch (e) {
        }
      }
    }
    const now = state && state.t || 0;
    try {
      const dmgAnim = assetsConfig_default.animations && assetsConfig_default.animations.damageParticles;
      if (Array.isArray(state.damageEvents) && dmgAnim) {
        state.particles = state.particles || [];
        for (const ev of state.damageEvents) {
          const count = dmgAnim.count || 6;
          for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * (dmgAnim.spread || 0.6);
            state.particles.push({
              x: ev.x || 0,
              y: ev.y || 0,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              r: 0.6 + Math.random() * 0.8,
              color: dmgAnim.color || assetsConfig_default.palette?.shipAccent || "#ff6b6b",
              lifetime: dmgAnim.lifetime || 0.8,
              age: 0,
              shape: "circle"
            });
          }
        }
        state.damageEvents = [];
      }
    } catch (e) {
    }
    function withShipContext(s, fn) {
      activeBufferCtx.save();
      try {
        activeBufferCtx.translate(
          (s.x || 0) * renderScale,
          (s.y || 0) * renderScale
        );
        activeBufferCtx.rotate(s.angle || 0);
        fn();
      } finally {
        try {
          activeBufferCtx.restore();
        } catch (e) {
        }
      }
    }
    function withContext(fn) {
      activeBufferCtx.save();
      try {
        fn();
      } finally {
        try {
          activeBufferCtx.restore();
        } catch (e) {
        }
      }
    }
    for (const s of state.ships || []) {
      const sx = (s.x || 0) * renderScale;
      const sy = (s.y || 0) * renderScale;
      if (sx < 0 || sx >= bufferW || sy < 0 || sy >= bufferH) continue;
      if (state.engineTrailsEnabled) {
        s.trail = s.trail || [];
        const last = s.trail.length ? s.trail[s.trail.length - 1] : null;
        if (!last || last.x !== s.x || last.y !== s.y) {
          s.trail.push({ x: s.x, y: s.y });
        }
        const trailConfig = getEngineTrailConfig(
          s.type || getDefaultShipTypeSafe()
        );
        const maxTrail = trailConfig?.maxLength || 40;
        while (s.trail.length > maxTrail) s.trail.shift();
      }
      if (Array.isArray(s.trail)) {
        const trailConfig = getEngineTrailConfig(
          s.type || getDefaultShipTypeSafe()
        );
        const color = trailConfig?.color || assetsConfig_default.palette?.bullet || "#aee1ff";
        const width = (trailConfig?.width || 0.35) * (s.radius || 12) * renderScale;
        const fade = trailConfig?.fade || 0.35;
        const engineMounts = this._svgEngineMountCache && this._svgEngineMountCache[s.type || getDefaultShipTypeSafe()];
        if (Array.isArray(engineMounts) && engineMounts.length > 0) {
          for (const [emx, emy] of engineMounts) {
            for (let i = 0; i < s.trail.length; i++) {
              const angle = s.angle || 0;
              const tx = s.x + (Math.cos(angle) * emx - Math.sin(angle) * emy) * (s.radius || 12);
              const ty = s.y + (Math.sin(angle) * emx + Math.cos(angle) * emy) * (s.radius || 12);
              const tAlpha = fade + (1 - fade) * (i / s.trail.length);
              const txx = tx * renderScale;
              const tyy = ty * renderScale;
              if (txx < 0 || txx >= bufferW || tyy < 0 || tyy >= bufferH)
                continue;
              withContext(() => {
                activeBufferCtx.globalAlpha = tAlpha;
                activeBufferCtx.fillStyle = color;
                activeBufferCtx.beginPath();
                activeBufferCtx.arc(txx, tyy, width, 0, Math.PI * 2);
                activeBufferCtx.fill();
              });
            }
          }
        } else {
          for (let i = 0; i < s.trail.length; i++) {
            const tx = s.trail[i].x || 0;
            const ty = s.trail[i].y || 0;
            const tAlpha = fade + (1 - fade) * (i / s.trail.length);
            const txx = tx * renderScale;
            const tyy = ty * renderScale;
            if (txx < 0 || txx >= bufferW || tyy < 0 || tyy >= bufferH)
              continue;
            withContext(() => {
              activeBufferCtx.globalAlpha = tAlpha;
              activeBufferCtx.fillStyle = color;
              activeBufferCtx.beginPath();
              activeBufferCtx.arc(txx, tyy, width, 0, Math.PI * 2);
              activeBufferCtx.fill();
            });
          }
        }
      }
      const sprite = getSpriteAsset(s.type || getDefaultShipTypeSafe());
      withShipContext(s, () => {
        let teamColor = assetsConfig_default.palette?.shipHull || "#888";
        try {
          if (s && s.team && teamsConfig_default && teamsConfig_default.teams) {
            const teamEntry = teamsConfig_default.teams[s.team];
            if (teamEntry && teamEntry.color) teamColor = teamEntry.color;
          }
        } catch {
        }
        activeBufferCtx.fillStyle = teamColor;
        let hullDrawn = false;
        this._svgHullCache = this._svgHullCache || {};
        const cacheKey = s.type || getDefaultShipTypeSafe();
        let hullCanvas = this._svgHullCache[cacheKey];
        if (hullCanvas && hullCanvas._placeholder) {
          hullCanvas = void 0;
        }
        if (sprite.svg || hullCanvas) {
          if (!hullCanvas && sprite.svg) {
            try {
              const svgText = sprite.svg;
              let outW = 128, outH = 128;
              const vbMatch = /viewBox\s*=\s*"(\d+)[^\d]+(\d+)[^\d]+(\d+)[^\d]+(\d+)"/.exec(
                svgText
              );
              if (vbMatch) {
                outW = parseInt(vbMatch[3]) || 128;
                outH = parseInt(vbMatch[4]) || 128;
              }
              hullCanvas = getCachedHullCanvasSync ? getCachedHullCanvasSync(
                svgText,
                outW,
                outH,
                cacheKey
              ) : void 0;
              if (!hullCanvas) {
                try {
                  hullCanvas = rasterizeHullOnlySvgToCanvas(
                    svgText,
                    outW,
                    outH
                  );
                } catch (e) {
                  hullCanvas = void 0;
                }
              }
              this._svgHullCache[cacheKey] = hullCanvas;
            } catch (e) {
              hullCanvas = void 0;
            }
          }
          if (hullCanvas) {
            const hc = hullCanvas;
            const scale = (s.radius || 12) * renderScale / (hc.width / 2);
            if (!this._tintedHullPool)
              this._tintedHullPool = new TintedHullPool({
                globalCap: 256,
                perTeamCap: 64
              });
            const tintedKey = `${cacheKey}::${teamColor}`;
            let tintedCanvas = void 0;
            if (this._tintedHullPool.has(tintedKey)) {
              const existing = this._tintedHullPool.get(tintedKey);
              if (existing) {
                try {
                  if (existing.width === hullCanvas.width && existing.height === hullCanvas.height) {
                    this._tintedHullPool.delete(tintedKey);
                    this._tintedHullPool.set(tintedKey, existing);
                    tintedCanvas = existing;
                  } else {
                    try {
                      this._tintedHullPool.delete(tintedKey);
                    } catch (ee) {
                    }
                  }
                } catch (e) {
                  try {
                    this._tintedHullPool.delete(tintedKey);
                  } catch (ee) {
                  }
                }
              }
            }
            if (!tintedCanvas) {
              try {
                let svgRenderer = void 0;
                try {
                  Promise.resolve().then(() => (init_svgRenderer(), svgRenderer_exports)).then(
                    (m) => svgRenderer = m.default || m
                  );
                } catch (e) {
                  svgRenderer = void 0;
                }
                if (svgRenderer && typeof svgRenderer.getCanvas === "function") {
                  const assetKey = cacheKey;
                  const mapping = teamMapping(teamColor);
                  try {
                    const c = svgRenderer.getCanvas(
                      assetKey,
                      mapping,
                      hullCanvas.width,
                      hullCanvas.height
                    );
                    if (c && (c.width === hullCanvas.width && c.height === hullCanvas.height)) {
                      try {
                        this._setTintedCanvas(tintedKey, c);
                        tintedCanvas = c;
                      } catch (e) {
                        tintedCanvas = c;
                      }
                      try {
                        ensureRasterizedAndCached && ensureRasterizedAndCached(
                          sprite.svg,
                          mapping,
                          hullCanvas.width,
                          hullCanvas.height,
                          { assetKey, applyTo: "both" }
                        );
                      } catch (e) {
                      }
                    } else {
                      try {
                        const tc = document.createElement("canvas");
                        tc.width = hullCanvas.width;
                        tc.height = hullCanvas.height;
                        const tctx = tc.getContext("2d");
                        const col = teamColor;
                        const k = tintedKey;
                        if (tctx) {
                          try {
                            tctx.clearRect(0, 0, tc.width, tc.height);
                            tctx.drawImage(hullCanvas, 0, 0);
                            const hexToRgb = (hex) => {
                              if (!hex) return null;
                              let h = hex.replace(/^#/, "");
                              if (h.length === 3)
                                h = h.split("").map((c2) => c2 + c2).join("");
                              if (h.length !== 6) return null;
                              const r = parseInt(h.substring(0, 2), 16);
                              const g = parseInt(h.substring(2, 4), 16);
                              const b = parseInt(h.substring(4, 6), 16);
                              return { r, g, b };
                            };
                            const rgbToHsl = (r, g, b) => {
                              r /= 255;
                              g /= 255;
                              b /= 255;
                              const max = Math.max(r, g, b);
                              const min = Math.min(r, g, b);
                              let h = 0;
                              let s2 = 0;
                              const l = (max + min) / 2;
                              if (max !== min) {
                                const d = max - min;
                                s2 = l > 0.5 ? d / (2 - max - min) : d / (max + min);
                                switch (max) {
                                  case r:
                                    h = (g - b) / d + (g < b ? 6 : 0);
                                    break;
                                  case g:
                                    h = (b - r) / d + 2;
                                    break;
                                  case b:
                                    h = (r - g) / d + 4;
                                    break;
                                }
                                h = h * 60;
                              }
                              return [h, s2, l];
                            };
                            const hslToRgb = (h, s2, l) => {
                              h = (h % 360 + 360) % 360;
                              const c2 = (1 - Math.abs(2 * l - 1)) * s2;
                              const x = c2 * (1 - Math.abs(h / 60 % 2 - 1));
                              const m = l - c2 / 2;
                              let r1 = 0, g1 = 0, b1 = 0;
                              if (h < 60) {
                                r1 = c2;
                                g1 = x;
                                b1 = 0;
                              } else if (h < 120) {
                                r1 = x;
                                g1 = c2;
                                b1 = 0;
                              } else if (h < 180) {
                                r1 = 0;
                                g1 = c2;
                                b1 = x;
                              } else if (h < 240) {
                                r1 = 0;
                                g1 = x;
                                b1 = c2;
                              } else if (h < 300) {
                                r1 = x;
                                g1 = 0;
                                b1 = c2;
                              } else {
                                r1 = c2;
                                g1 = 0;
                                b1 = x;
                              }
                              const r = Math.round((r1 + m) * 255);
                              const g = Math.round((g1 + m) * 255);
                              const b = Math.round((b1 + m) * 255);
                              return [r, g, b];
                            };
                            const teamRgb = hexToRgb(col);
                            let teamHue = 0;
                            if (teamRgb) {
                              teamHue = rgbToHsl(teamRgb.r, teamRgb.g, teamRgb.b)[0];
                            }
                            try {
                              const img = tctx.getImageData(0, 0, tc.width, tc.height);
                              const data = img.data;
                              for (let i = 0; i < data.length; i += 4) {
                                const alpha = data[i + 3];
                                if (alpha < 8) continue;
                                const r = data[i];
                                const g = data[i + 1];
                                const b = data[i + 2];
                                const [h, s2, l] = rgbToHsl(r, g, b);
                                const [nr, ng, nb] = hslToRgb(teamHue, s2, l);
                                data[i] = nr;
                                data[i + 1] = ng;
                                data[i + 2] = nb;
                              }
                              tctx.putImageData(img, 0, 0);
                              this._setTintedCanvas(k, tc);
                              tintedCanvas = tc;
                            } catch (e) {
                              tctx.clearRect(0, 0, tc.width, tc.height);
                              tctx.drawImage(hullCanvas, 0, 0);
                              tctx.globalCompositeOperation = "source-atop";
                              tctx.fillStyle = col;
                              tctx.fillRect(0, 0, tc.width, tc.height);
                              tctx.globalCompositeOperation = "source-over";
                              this._setTintedCanvas(k, tc);
                              tintedCanvas = tc;
                            }
                          } catch (e) {
                          }
                        }
                      } catch (e) {
                      }
                    }
                  } catch (e) {
                  }
                }
              } catch (e) {
              }
              if (!tintedCanvas) {
                try {
                  const tc = document.createElement("canvas");
                  tc.width = hullCanvas.width;
                  tc.height = hullCanvas.height;
                  const tctx = tc.getContext("2d");
                  if (tctx) {
                    tctx.clearRect(0, 0, tc.width, tc.height);
                    tctx.drawImage(hullCanvas, 0, 0);
                    tctx.globalCompositeOperation = "source-in";
                    tctx.fillStyle = teamColor;
                    tctx.fillRect(0, 0, tc.width, tc.height);
                    tctx.globalCompositeOperation = "source-over";
                    tintedCanvas = tc;
                    this._setTintedCanvas(tintedKey, tc);
                  }
                } catch (e) {
                }
              }
            }
            withContext(() => {
              activeBufferCtx.save();
              activeBufferCtx.scale(scale, scale);
              try {
                activeBufferCtx.drawImage(
                  tintedCanvas || hc,
                  -hc.width / 2,
                  -hc.height / 2
                );
              } catch (e) {
                try {
                  activeBufferCtx.drawImage(hc, -hc.width / 2, -hc.height / 2);
                } catch (e2) {
                }
              }
              activeBufferCtx.restore();
            });
            hullDrawn = true;
          }
        }
        if (!hullDrawn) {
          const shape = sprite.shape;
          if (shape) {
            if (shape.type === "circle") {
              activeBufferCtx.beginPath();
              activeBufferCtx.arc(
                0,
                0,
                (s.radius || 12) * renderScale,
                0,
                Math.PI * 2
              );
              activeBufferCtx.fill();
            } else if (shape.type === "polygon") {
              drawPolygon(shape.points);
            } else if (shape.type === "compound") {
              for (const part of shape.parts) {
                if (part.type === "circle") {
                  activeBufferCtx.beginPath();
                  activeBufferCtx.arc(
                    0,
                    0,
                    (part.r || 1) * (s.radius || 12) * renderScale,
                    0,
                    Math.PI * 2
                  );
                  activeBufferCtx.fill();
                } else if (part.type === "polygon") {
                  drawPolygon(part.points);
                }
              }
            }
          }
        }
        try {
          const vconf = getVisualConfig(s.type || getDefaultShipTypeSafe());
          const engineName = vconf && vconf.visuals && vconf.visuals.engine ? vconf.visuals.engine : "engineFlare";
          const engAnim = assetsConfig_default.animations && assetsConfig_default.animations[engineName];
          if (engAnim && Array.isArray(engAnim.points)) {
            const radius = s.radius || 12;
            const offsetLocal = typeof engAnim.offset === "number" ? engAnim.offset * radius * renderScale : 0;
            withContext(() => {
              activeBufferCtx.translate(offsetLocal, 0);
              activeBufferCtx.globalAlpha = typeof engAnim.alpha === "number" ? engAnim.alpha : 1;
              activeBufferCtx.fillStyle = engAnim.color || assetsConfig_default.palette?.shipAccent || "#ffffff";
              activeBufferCtx.beginPath();
              const pts = engAnim.points || [];
              if (pts.length) {
                activeBufferCtx.moveTo(
                  (pts[0][0] || 0) * radius * renderScale,
                  (pts[0][1] || 0) * radius * renderScale
                );
                for (let pi = 1; pi < pts.length; pi++)
                  activeBufferCtx.lineTo(
                    (pts[pi][0] || 0) * radius * renderScale,
                    (pts[pi][1] || 0) * radius * renderScale
                  );
                activeBufferCtx.closePath();
                activeBufferCtx.fill();
              }
            });
          }
        } catch (e) {
        }
        const shipType = s.type || "fighter";
        const shipCfg = getShipConfigSafe2()[shipType];
        const configRadius = shipCfg && typeof shipCfg.radius === "number" ? shipCfg.radius : s.radius || 12;
        const shapeEntry = assetsConfig_default.shapes2d && assetsConfig_default.shapes2d[shipType];
        const svgMounts = assetsConfig_default.svgMounts && assetsConfig_default.svgMounts[shipType];
        const instanceTurrets = Array.isArray(s.turrets) ? s.turrets : shapeEntry && shapeEntry.turrets || [];
        for (let ti = 0; ti < instanceTurrets.length; ti++) {
          try {
            const turret = instanceTurrets[ti];
            let turretObj = turret;
            if (!turretObj) continue;
            if (!turretObj.position && Array.isArray(turret) && turret.length === 2) {
              turretObj = { kind: "basic", position: turret };
            }
            if ((!turretObj.position || turretObj.position.length !== 2) && Array.isArray(svgMounts) && svgMounts[ti]) {
              turretObj.position = svgMounts[ti];
            }
            if (!turretObj.position) continue;
            const turretKind = turretObj.kind || "basic";
            const turretShape = getTurretAsset(turretKind);
            const turretLocalAngle = typeof turretObj.angle === "number" ? turretObj.angle : typeof s.turretAngle === "number" ? s.turretAngle : 0;
            const turretTurnRate = typeof turretObj.turnRate === "number" ? turretObj.turnRate : assetsConfig_default.turretDefaults && assetsConfig_default.turretDefaults[turretKind] && assetsConfig_default.turretDefaults[turretKind].turnRate || Math.PI * 1.5;
            const [tx, ty] = turretObj.position;
            const angle = s.angle || 0;
            const turretX = (Math.cos(angle) * tx - Math.sin(angle) * ty) * configRadius * renderScale;
            const turretY = (Math.sin(angle) * tx + Math.cos(angle) * ty) * configRadius * renderScale;
            const turretScale = configRadius * renderScale * 0.5;
            withContext(() => {
              activeBufferCtx.translate(turretX, turretY);
              activeBufferCtx.rotate(turretLocalAngle - (s.angle || 0));
              const spriteCanvas = this._turretSpriteCache && this._turretSpriteCache[turretKind];
              if (spriteCanvas) {
                try {
                  const pw = spriteCanvas.width;
                  const ph = spriteCanvas.height;
                  activeBufferCtx.drawImage(
                    spriteCanvas,
                    -pw / 2,
                    -ph / 2,
                    pw,
                    ph
                  );
                  return;
                } catch (e) {
                }
              }
              activeBufferCtx.fillStyle = assetsConfig_default.palette?.turret || "#94a3b8";
              if (turretShape.type === "circle") {
                activeBufferCtx.beginPath();
                activeBufferCtx.arc(
                  0,
                  0,
                  (turretShape.r || 1) * turretScale,
                  0,
                  Math.PI * 2
                );
                activeBufferCtx.fill();
              } else if (turretShape.type === "polygon") {
                withContext(() => {
                  activeBufferCtx.scale(turretScale, turretScale);
                  drawPolygon(turretShape.points);
                });
              } else if (turretShape.type === "compound") {
                for (const part of turretShape.parts) {
                  if (part.type === "circle") {
                    activeBufferCtx.beginPath();
                    activeBufferCtx.arc(
                      0,
                      0,
                      (part.r || 1) * turretScale,
                      0,
                      Math.PI * 2
                    );
                    activeBufferCtx.fill();
                  } else if (part.type === "polygon") {
                    withContext(() => {
                      activeBufferCtx.scale(turretScale, turretScale);
                      drawPolygon(part.points);
                    });
                  }
                }
              }
            });
          } catch (e) {
          }
        }
        if ((s.shield ?? 0) > 0) {
          const shAnim = assetsConfig_default.animations && assetsConfig_default.animations.shieldEffect;
          try {
            const pulse = shAnim && typeof shAnim.pulseRate === "number" ? 0.5 + 0.5 * Math.sin(now * shAnim.pulseRate) : 1;
            const shieldNorm = Math.max(
              0,
              Math.min(1, (s.shield || 0) / (s.maxShield || s.shield || 1))
            );
            const alphaBase = shAnim && typeof shAnim.alphaBase === "number" ? shAnim.alphaBase : shAnim && shAnim.alpha || 0.25;
            const alphaScale = shAnim && typeof shAnim.alphaScale === "number" ? shAnim.alphaScale : 0.75;
            const alpha = Math.max(
              0,
              Math.min(1, alphaBase + alphaScale * pulse * shieldNorm)
            );
            const strokeColor = shAnim && shAnim.color || assetsConfig_default.palette?.shipAccent || "#3ab6ff";
            const strokeWidth = shAnim && (shAnim.strokeWidth || 0.08) * (s.radius || 12) * renderScale || 3 * renderScale;
            let stroked = false;
            try {
              const getHullOutlineFromSvg2 = svgLoader_exports && getHullOutlineFromSvg ? getHullOutlineFromSvg : (svgText2, tol) => {
                try {
                  return getHullOutlineFromSvg(
                    svgText2,
                    tol
                  );
                } catch (e) {
                  return { contours: [] };
                }
              };
              const svgText = getShipAsset(s.type);
              if (svgText) {
                const outline = getHullOutlineFromSvg2(svgText, 1.5);
                if (outline && outline.contours && outline.contours.length) {
                  withContext(() => {
                    activeBufferCtx.globalAlpha = alpha;
                    activeBufferCtx.strokeStyle = strokeColor;
                    activeBufferCtx.lineWidth = strokeWidth;
                    for (const contour of outline.contours) {
                      if (contour.length) {
                        activeBufferCtx.beginPath();
                        activeBufferCtx.moveTo(
                          (contour[0][0] || 0) * (s.radius || 12) * renderScale,
                          (contour[0][1] || 0) * (s.radius || 12) * renderScale
                        );
                        for (let i = 1; i < contour.length; i++)
                          activeBufferCtx.lineTo(
                            (contour[i][0] || 0) * (s.radius || 12) * renderScale,
                            (contour[i][1] || 0) * (s.radius || 12) * renderScale
                          );
                        activeBufferCtx.closePath();
                        activeBufferCtx.stroke();
                      }
                    }
                  });
                  stroked = true;
                }
              }
            } catch (e) {
            }
            if (!stroked) {
              withContext(() => {
                activeBufferCtx.globalAlpha = alpha;
                activeBufferCtx.strokeStyle = strokeColor;
                activeBufferCtx.lineWidth = strokeWidth;
                activeBufferCtx.beginPath();
                activeBufferCtx.arc(
                  0,
                  0,
                  (s.radius || 12) * renderScale,
                  0,
                  Math.PI * 2
                );
                activeBufferCtx.stroke();
              });
            }
            const baseW = Math.max(20, (s.radius || 12) * 1.6);
            const baseH = Math.max(4, Math.round((s.radius || 12) * 0.25));
            const dx = -Math.round(baseW / 2);
            const dy = -(s.radius || 12) - baseH - 6;
            const hbBg = assetsConfig_default.palette?.background || "#222";
            const hbFill = assetsConfig_default.palette?.shipHull || "#4caf50";
            const hpPct = typeof s.hpPercent === "number" ? s.hpPercent : Math.max(0, Math.min(1, (s.hp || 0) / (s.maxHp || 1)));
            const shPct = typeof s.shieldPercent === "number" ? s.shieldPercent : typeof s.maxShield === "number" && s.maxShield > 0 ? Math.max(0, Math.min(1, (s.shield || 0) / s.maxShield)) : 0;
            const w = Math.max(1, Math.round(baseW * renderScale));
            const h = Math.max(1, Math.round(baseH * renderScale));
            const ox = Math.round(dx * renderScale);
            const oy = Math.round(dy * renderScale);
            const sx2 = Math.round((s.x || 0) * renderScale);
            const sy2 = Math.round((s.y || 0) * renderScale);
            withContext(() => {
              try {
                activeBufferCtx.setTransform(1, 0, 0, 1, 0, 0);
              } catch (e) {
              }
              activeBufferCtx.fillStyle = hbBg;
              activeBufferCtx.fillRect(sx2 + ox, sy2 + oy, w, h);
              activeBufferCtx.fillStyle = hbFill;
              activeBufferCtx.fillRect(
                sx2 + ox,
                sy2 + oy,
                Math.max(1, Math.round(w * hpPct)),
                h
              );
              if (shPct > 0) {
                const shH = Math.max(1, Math.round(h * 0.5));
                activeBufferCtx.fillStyle = assetsConfig_default.palette?.shipAccent || "#3ab6ff";
                activeBufferCtx.fillRect(
                  sx2 + ox,
                  sy2 + oy - shH - 2,
                  Math.max(1, Math.round(w * shPct)),
                  shH
                );
              }
            });
          } catch (e) {
          }
        }
      });
      try {
        const nowT = state.t || 0;
        for (const s2 of state.ships || []) {
          try {
            let flash = null;
            const arr = Array.isArray(state.healthFlashes) ? state.healthFlashes.filter((f) => f.id === s2.id) : [];
            let bestTs = -Infinity;
            for (const f of arr) {
              if (!f) continue;
              const fTs = typeof f._ts === "number" ? f._ts : 0;
              const fTtl = typeof f.ttl === "number" ? f.ttl : 0.4;
              if (fTs + fTtl >= nowT - 1e-6 && fTs > bestTs) {
                bestTs = fTs;
                flash = f;
              }
            }
            if (flash) {
              const pooledFlash = acquireEffect(
                state,
                "healthFlash",
                () => makePooled(
                  // Use typed factory to create base health effect and attach render fields via reset
                  createHealthHitEffect({
                    x: flash.x || s2.x || 0,
                    y: flash.y || s2.y || 0
                  }),
                  (obj, initArgs) => {
                    resetHealthHitEffect(obj, initArgs);
                    obj.ttl = initArgs?.ttl ?? 0.4;
                    obj.life = initArgs?.life ?? obj.ttl;
                    obj.color = "#ff7766";
                    obj.radius = 6;
                  }
                ),
                flash
              );
              const pf = pooledFlash;
              const t = Math.max(0, Math.min(1, pf.life / pf.ttl));
              const R = pf.radius + (1 - t) * 18;
              const alpha = 0.9 * t;
              const fx = pf.x * renderScale;
              const fy = pf.y * renderScale;
              if (fx >= 0 && fx < bufferW && fy >= 0 && fy < bufferH) {
                withContext(() => {
                  activeBufferCtx.globalAlpha = Math.max(0, Math.min(1, alpha));
                  activeBufferCtx.strokeStyle = pf.color;
                  activeBufferCtx.lineWidth = 2 * renderScale;
                  activeBufferCtx.beginPath();
                  activeBufferCtx.arc(
                    fx,
                    fy,
                    Math.max(1, R * renderScale),
                    0,
                    Math.PI * 2
                  );
                  activeBufferCtx.stroke();
                });
              }
              releaseEffect(state, "healthFlash", pooledFlash);
            }
          } catch (e) {
          }
        }
      } catch (e) {
      }
      for (const b of state.bullets || []) {
        try {
          const bx = (b.x || 0) * renderScale;
          const by = (b.y || 0) * renderScale;
          if (bx < 0 || bx >= bufferW || by < 0 || by >= bufferH) continue;
          const r = b.radius || b.bulletRadius || 1.5;
          const kind = typeof b.bulletRadius === "number" ? b.bulletRadius < 2 ? "small" : b.bulletRadius < 3 ? "medium" : "large" : "small";
          const shape = getBulletAsset(kind);
          withContext(() => {
            activeBufferCtx.translate(bx, by);
            const px = Math.max(1, r * renderScale);
            activeBufferCtx.fillStyle = assetsConfig_default.palette.bullet;
            if (shape.type === "circle") {
              activeBufferCtx.beginPath();
              activeBufferCtx.arc(0, 0, px, 0, Math.PI * 2);
              activeBufferCtx.fill();
            } else if (shape.type === "polygon") {
              drawPolygon(shape.points);
            } else if (shape.type === "compound") {
              for (const part of shape.parts) {
                if (part.type === "circle") {
                  activeBufferCtx.beginPath();
                  activeBufferCtx.arc(0, 0, (part.r || 1) * px, 0, Math.PI * 2);
                  activeBufferCtx.fill();
                } else if (part.type === "polygon") {
                  drawPolygon(part.points);
                }
              }
            }
          });
        } catch (e) {
        }
      }
      try {
        const shapes = assetsConfig_default.shapes2d || {};
        for (const p of state.particles || []) {
          try {
            const particle = acquireSprite(
              state,
              "particle",
              () => makePooled(
                {
                  x: p.x || 0,
                  y: p.y || 0,
                  r: p.r || 1,
                  color: p.color || assetsConfig_default.palette?.bullet || "#ffdca8",
                  age: p.age || 0,
                  lifetime: p.lifetime || 1,
                  assetShape: p.assetShape
                },
                (obj, initArgs) => {
                  obj.x = initArgs?.x ?? 0;
                  obj.y = initArgs?.y ?? 0;
                  obj.r = initArgs?.r ?? 1;
                  obj.color = initArgs?.color ?? "#ffdca8";
                  obj.age = initArgs?.age ?? 0;
                  obj.lifetime = initArgs?.lifetime ?? 1;
                  obj.assetShape = initArgs?.assetShape;
                }
              ),
              p
            );
            const px = particle.x * renderScale;
            const py = particle.y * renderScale;
            if (px < 0 || px >= bufferW || py < 0 || py >= bufferH) continue;
            withContext(() => {
              const shapeName = particle.assetShape || (particle.r > 0.5 ? "particleMedium" : "particleSmall");
              const shape = shapes[shapeName];
              activeBufferCtx.fillStyle = particle.color;
              activeBufferCtx.globalAlpha = Math.max(
                0,
                Math.min(1, 1 - particle.age / particle.lifetime)
              );
              activeBufferCtx.translate(px, py);
              if (shape) {
                if (shape.type === "circle") {
                  const rr = (shape.r || 0.12) * particle.r * renderScale * 6;
                  activeBufferCtx.beginPath();
                  activeBufferCtx.arc(0, 0, rr, 0, Math.PI * 2);
                  activeBufferCtx.fill();
                } else if (shape.type === "polygon") {
                  activeBufferCtx.beginPath();
                  const pts = shape.points || [];
                  if (pts.length) {
                    activeBufferCtx.moveTo(
                      (pts[0][0] || 0) * renderScale,
                      (pts[0][1] || 0) * renderScale
                    );
                    for (let i = 1; i < pts.length; i++)
                      activeBufferCtx.lineTo(
                        (pts[i][0] || 0) * renderScale,
                        (pts[i][1] || 0) * renderScale
                      );
                    activeBufferCtx.closePath();
                    activeBufferCtx.fill();
                  }
                } else if (shape.type === "compound") {
                  for (const part of shape.parts || []) {
                    if (part.type === "circle") {
                      const rr = (part.r || 0.12) * particle.r * renderScale * 6;
                      activeBufferCtx.beginPath();
                      activeBufferCtx.arc(0, 0, rr, 0, Math.PI * 2);
                      activeBufferCtx.fill();
                    } else if (part.type === "polygon") {
                      activeBufferCtx.beginPath();
                      const pts = part.points || [];
                      if (pts.length) {
                        activeBufferCtx.moveTo(
                          (pts[0][0] || 0) * renderScale,
                          (pts[0][1] || 0) * renderScale
                        );
                        for (let i = 1; i < pts.length; i++)
                          activeBufferCtx.lineTo(
                            (pts[i][0] || 0) * renderScale,
                            (pts[i][1] || 0) * renderScale
                          );
                        activeBufferCtx.closePath();
                        activeBufferCtx.fill();
                      }
                    }
                  }
                } else {
                  activeBufferCtx.beginPath();
                  activeBufferCtx.arc(
                    0,
                    0,
                    (particle.r || 2) * renderScale,
                    0,
                    Math.PI * 2
                  );
                  activeBufferCtx.fill();
                }
              } else {
                activeBufferCtx.beginPath();
                activeBufferCtx.arc(
                  0,
                  0,
                  (particle.r || 2) * renderScale,
                  0,
                  Math.PI * 2
                );
                activeBufferCtx.fill();
              }
            });
            releaseSprite(state, "particle", particle);
          } catch (e) {
          }
        }
      } catch (e) {
      }
      try {
        const expShape = assetsConfig_default.shapes2d && assetsConfig_default.shapes2d.explosionParticle;
        for (const ex of state.explosions || []) {
          try {
            const effect = acquireEffect(
              state,
              "explosion",
              () => makePooled(
                createExplosionEffect({
                  x: ex.x || 0,
                  y: ex.y || 0,
                  r: expShape && expShape.r || 0.32
                }),
                (obj, initArgs) => {
                  resetExplosionEffect(obj, initArgs);
                  obj.scale = initArgs?.scale ?? 1;
                  obj.color = initArgs?.color ?? "#ffd089";
                  obj.alpha = initArgs?.alpha ?? (1 - (ex.life || 0.5) / (ex.ttl || 0.5)) * 0.9;
                }
              ),
              ex
            );
            const ef = effect;
            withContext(() => {
              activeBufferCtx.globalAlpha = ef.alpha || 0;
              activeBufferCtx.translate(
                ef.x * renderScale,
                ef.y * renderScale
              );
              activeBufferCtx.fillStyle = ef.color || assetsConfig_default.palette?.bullet || "#ffd089";
              if (expShape && expShape.type === "circle") {
                const rr = (ef.r || 0.32) * (ef.scale || 1) * renderScale * 6;
                activeBufferCtx.beginPath();
                activeBufferCtx.arc(
                  0,
                  0,
                  rr * (1 + (1 - (ex.life || 0.5) / (ex.ttl || 0.5))),
                  0,
                  Math.PI * 2
                );
                activeBufferCtx.fill();
              } else {
                activeBufferCtx.beginPath();
                activeBufferCtx.arc(
                  0,
                  0,
                  Math.max(
                    2,
                    (ef.scale || 1) * 12 * (1 - (ex.life || 0.5) / (ex.ttl || 0.5))
                  ),
                  0,
                  Math.PI * 2
                );
                activeBufferCtx.fill();
              }
            });
            releaseEffect(state, "explosion", effect);
          } catch (e) {
          }
        }
      } catch (e) {
      }
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        this.bufferCanvas,
        0,
        0,
        this.bufferCanvas.width,
        this.bufferCanvas.height,
        0,
        0,
        this.canvas.width,
        this.canvas.height
      );
      ctx.restore();
    }
  }
};

// src/webglrenderer.ts
init_assetsConfig();
init_rendererConfig();
var WebGLRenderer = class {
  canvas;
  gl = null;
  // Renderer may run its own loop in advanced impls (not used here)
  providesOwnLoop = false;
  // Cache of baked textures keyed by asset key
  shapeTextures = {};
  // Last-seen GameState (to support release to pool during dispose)
  gameState = null;
  // Optional textured-quad resources (not required by tests)
  quadVBO = null;
  quadProg = null;
  // Optional FBO resources for render-to-texture
  fbo = null;
  fboTex = null;
  constructor(canvas) {
    this.canvas = canvas;
  }
  // Initialize GL context and basic state
  init() {
    try {
      const gl = this.canvas.getContext("webgl2") || this.canvas.getContext("webgl");
      if (!gl) return false;
      this.gl = gl;
      gl.clearColor(0.02, 0.03, 0.06, 1);
      this._starfield = this._starfield || null;
      this._starfieldSize = this._starfieldSize || 1024;
      return true;
    } catch {
      return false;
    }
    try {
      this.quadVBO = this.gl.createBuffer();
      const glr = this.gl;
      const verts = new Float32Array([
        -1,
        -1,
        0,
        0,
        1,
        -1,
        1,
        0,
        -1,
        1,
        0,
        1,
        1,
        1,
        1,
        1
      ]);
      glr.bindBuffer(glr.ARRAY_BUFFER, this.quadVBO);
      glr.bufferData(glr.ARRAY_BUFFER, verts, glr.STATIC_DRAW);
      const vsSrc = "attribute vec2 aPos; attribute vec2 aUV; varying vec2 vUV; void main(){ vUV = aUV; gl_Position = vec4(aPos,0.0,1.0); }";
      const fsSrc = "precision mediump float; varying vec2 vUV; uniform sampler2D uTex; uniform vec2 uUVOffset; void main(){ vec2 uv = vUV + uUVOffset; gl_FragColor = texture2D(uTex, uv); }";
      const vs = glr.createShader(glr.VERTEX_SHADER);
      const fs = glr.createShader(glr.FRAGMENT_SHADER);
      glr.shaderSource(vs, vsSrc);
      glr.shaderSource(fs, fsSrc);
      glr.compileShader(vs);
      glr.compileShader(fs);
      const prog = glr.createProgram();
      glr.attachShader(prog, vs);
      glr.attachShader(prog, fs);
      glr.linkProgram(prog);
      this.quadProg = prog;
    } catch {
    }
    return true;
  }
  // Called when canvas backing store size changes
  updateScale() {
    if (!this.gl) return;
    try {
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    } catch {
    }
  }
  isRunning() {
    return false;
  }
  // Render a state frame. This stub clears the screen and ensures
  // textures for present ship types are baked and cached.
  renderState(state, _interpolation = 0) {
    if (!this.gl) return;
    this.gameState = state;
    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);
    try {
      if (!this._starfield) {
        const size = this._starfieldSize || 1024;
        const cvs = document.createElement("canvas");
        cvs.width = size;
        cvs.height = size;
        const ctx = cvs.getContext("2d");
        const g = ctx.createLinearGradient(0, 0, 0, size);
        g.addColorStop(0, "#001020");
        g.addColorStop(1, "#000010");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, size, size);
        let density = 4e-4;
        try {
          const rc = rendererConfig_default;
          if (rc && rc.starfield && typeof rc.starfield.density === "number")
            density = rc.starfield.density;
        } catch {
        }
        const stars = Math.floor(size * size * density);
        for (let i = 0; i < stars; i++) {
          const x = Math.random() * size;
          const y = Math.random() * size;
          const r = Math.random() * 1.2;
          const bright = 0.6 + Math.random() * 0.4;
          ctx.fillStyle = `rgba(255,255,255,${bright})`;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
        for (let i = 0; i < 80; i++) {
          const x = Math.random() * size;
          const y = Math.random() * size;
          ctx.fillStyle = "rgba(255,244,200,1)";
          ctx.beginPath();
          ctx.arc(x, y, 1.6 + Math.random() * 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL ?? 32867, 0);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          cvs
        );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        this._starfield = tex;
      }
      if (this.quadProg && this.quadVBO) {
        try {
          gl.useProgram(this.quadProg);
          gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVBO);
          const aPos = gl.getAttribLocation(this.quadProg, "aPos");
          const aUV = gl.getAttribLocation(this.quadProg, "aUV");
          gl.enableVertexAttribArray(aPos);
          gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);
          gl.enableVertexAttribArray(aUV);
          gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 16, 8);
          let ox = 0, oy = 0;
          try {
            const cam = state?.camera;
            if (cam && typeof cam.x === "number" && typeof cam.y === "number") {
              const pf = (typeof (init_rendererConfig(), __toCommonJS(rendererConfig_exports)).default !== "undefined" ? (init_rendererConfig(), __toCommonJS(rendererConfig_exports)).default.starfield.parallaxFactor : 0.1) || 0.1;
              ox = (cam.x || 0) * pf / (this.canvas.width || 1);
              oy = (cam.y || 0) * pf / (this.canvas.height || 1);
            }
          } catch {
          }
          const uvOffLoc = gl.getUniformLocation(this.quadProg, "uUVOffset");
          if (uvOffLoc) gl.uniform2f(uvOffLoc, ox, oy);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, this._starfield);
          const loc = gl.getUniformLocation(this.quadProg, "uTex");
          gl.uniform1i(loc, 0);
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
          if (this._starBloom) {
            try {
              gl.enable(gl.BLEND);
              gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
              gl.activeTexture(gl.TEXTURE0);
              gl.bindTexture(gl.TEXTURE_2D, this._starBloom);
              gl.uniform1i(loc, 0);
              gl.uniform2f(uvOffLoc, ox * 0.6, oy * 0.6);
              gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
              gl.disable(gl.BLEND);
            } catch {
            }
          }
        } catch {
        }
      }
    } catch {
    }
    try {
      const ships = state && state.ships || [];
      for (const s of ships) {
        const type = s && s.type || "fighter";
        let teamColor = AssetsConfig.palette?.shipHull || "#b0b7c3";
        try {
          if (s && s.team && teamsConfig_default && teamsConfig_default.teams) {
            const t = teamsConfig_default.teams[s.team];
            if (t && t.color) teamColor = t.color;
          }
        } catch {
        }
        this.bakeShapeToTexture(state, type, teamColor);
        try {
          const key = `ship:${type}`;
          const sprite = acquireSprite(
            this.gameState || state,
            key,
            () => ({ type })
          );
          const sp = sprite;
          try {
            sp.x = s.x || 0;
            sp.y = s.y || 0;
            sp.angle = s.angle || 0;
          } catch {
          }
          try {
            releaseSprite(this.gameState || state, key, sprite);
          } catch {
          }
        } catch {
        }
      }
      try {
        const flashes = state.flashes || [];
        for (const f of flashes) {
          try {
            const key = `flash`;
            const pooled = acquireEffect(
              this.gameState || state,
              key,
              () => makePooled(
                createExplosionEffect({ x: f.x || 0, y: f.y || 0 }),
                (obj, initArgs) => {
                  resetExplosionEffect(obj, initArgs);
                  obj.ttl = initArgs?.ttl ?? 0.5;
                }
              ),
              f
            );
            const ef = pooled;
            try {
              if (ef) {
                ef.x = ef.x || 0;
                ef.y = ef.y || 0;
                ef.ttl = ef.ttl ?? 0.5;
              }
            } catch {
            }
            try {
              releaseEffect(this.gameState || state, key, pooled);
            } catch {
            }
          } catch {
          }
        }
      } catch {
      }
    } catch {
    }
  }
  // Pre-bake textures for all known shapes
  preloadAllAssets() {
    if (!this.gl) return;
    try {
      const shapes = AssetsConfig.shapes2d || {};
      for (const key of Object.keys(shapes))
        this.bakeShapeToTexture(this.gameState, key);
    } catch {
    }
  }
  // Testing helper: check if we have a cached texture for a key
  hasCachedTexture(key) {
    return !!this.shapeTextures[key];
  }
  // Dispose all GL resources and clear caches
  dispose() {
    if (this.gl) {
      try {
        for (const key of Object.keys(this.shapeTextures)) {
          const tex = this.shapeTextures[key];
          if (!tex) continue;
          if (this.gameState) {
            try {
              const gl = this.gl;
              releaseTexture(this.gameState, key, tex, (t) => {
                try {
                  gl.deleteTexture(t);
                } catch {
                }
              });
            } catch {
            }
          } else {
            try {
              this.gl.deleteTexture(tex);
            } catch {
            }
          }
        }
        try {
          if (this.quadVBO)
            this.gl.deleteBuffer(this.quadVBO);
        } catch {
        }
        try {
          if (this.quadProg)
            this.gl.deleteProgram(this.quadProg);
        } catch {
        }
        try {
          if (this.fboTex)
            this.gl.deleteTexture(this.fboTex);
        } catch {
        }
        try {
          if (this.fbo)
            this.gl.deleteFramebuffer(this.fbo);
        } catch {
        }
        try {
          if (this._starfield)
            this.gl.deleteTexture(
              this._starfield
            );
        } catch {
        }
      } catch {
      }
    }
    this.shapeTextures = {};
    this.quadVBO = null;
    this.quadProg = null;
    this.fbo = null;
    this.fboTex = null;
    this._starfield = null;
    this.gl = null;
  }
  // Internal: bake a simple 2D shape into a texture and cache it
  bakeShapeToTexture(state, key, teamColor) {
    if (!this.gl) return null;
    const cacheKey = teamColor ? `${key}::${teamColor}` : key;
    if (this.shapeTextures[cacheKey]) return this.shapeTextures[cacheKey];
    try {
      const gl = this.gl;
      const shapes = AssetsConfig.shapes2d || {};
      const shape = shapes[key];
      const size = 128;
      const cvs = document.createElement("canvas");
      cvs.width = size;
      cvs.height = size;
      const ctx = cvs.getContext("2d");
      if (!ctx) return null;
      ctx.clearRect(0, 0, size, size);
      ctx.save();
      ctx.translate(size / 2, size / 2);
      const scale = size / 4;
      ctx.fillStyle = teamColor || AssetsConfig.palette && AssetsConfig.palette.shipHull || "#b0b7c3";
      if (!shape) {
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(4, size * 0.12), 0, Math.PI * 2);
        ctx.fill();
      } else if (shape.type === "circle") {
        const r = (shape.r ?? 0.5) * scale;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
      } else if (shape.type === "polygon") {
        const pts = shape.points || [];
        if (pts.length) {
          ctx.beginPath();
          ctx.moveTo((pts[0][0] || 0) * scale, (pts[0][1] || 0) * scale);
          for (let i = 1; i < pts.length; i++)
            ctx.lineTo((pts[i][0] || 0) * scale, (pts[i][1] || 0) * scale);
          ctx.closePath();
          ctx.fill();
        }
      } else if (shape.type === "compound") {
        const parts = shape.parts || [];
        for (const part of parts) {
          if (part.type === "circle") {
            const r = (part.r ?? 0.5) * scale;
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fill();
          } else if (part.type === "polygon") {
            const pts = part.points || [];
            if (pts.length) {
              ctx.beginPath();
              ctx.moveTo((pts[0][0] || 0) * scale, (pts[0][1] || 0) * scale);
              for (let i = 1; i < pts.length; i++)
                ctx.lineTo((pts[i][0] || 0) * scale, (pts[i][1] || 0) * scale);
              ctx.closePath();
              ctx.fill();
            }
          }
        }
      }
      ctx.restore();
      const createTex = () => {
        const t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL ?? 32867, 0);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          cvs
        );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        return t;
      };
      let tex = null;
      if (state) {
        try {
          tex = acquireTexture(state, cacheKey, createTex);
        } catch {
          tex = createTex();
        }
      } else {
        tex = createTex();
      }
      if (!tex) return null;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      this.shapeTextures[cacheKey] = tex;
      return tex;
    } catch {
      return null;
    }
  }
  // Optional future path: draw a textured quad (not used in tests yet)
  // Keeping a stub to document intent and ease future extension.
  // private drawTexturedQuad(_tex: WebGLTexture, _x: number, _y: number, _w: number, _h: number): void {
  //   // Intentionally empty in minimal stub
  // }
};

// src/main.ts
init_rendererConfig();
init_svgRenderer();
init_svgRenderer();
init_assetsConfig();
async function startApp(rootDocument = document) {
  const gameState = makeInitialState();
  let canvas = rootDocument.getElementById("world");
  if (!canvas) {
    try {
      const el = rootDocument.createElement("canvas");
      el.id = "world";
      rootDocument.body.appendChild(el);
      canvas = el;
    } catch (e) {
      canvas = null;
    }
  }
  const ui = {
    startPause: rootDocument.getElementById("startPause"),
    reset: rootDocument.getElementById("reset"),
    addRed: rootDocument.getElementById("addRed"),
    addBlue: rootDocument.getElementById("addBlue"),
    toggleTrails: rootDocument.getElementById("toggleTrails"),
    speed: rootDocument.getElementById("speed"),
    redScore: rootDocument.getElementById("redScore"),
    blueScore: rootDocument.getElementById("blueScore"),
    stats: rootDocument.getElementById("stats"),
    continuousCheckbox: rootDocument.getElementById("continuousCheckbox"),
    seedBtn: rootDocument.getElementById("seedBtn"),
    formationBtn: rootDocument.getElementById("formationBtn")
  };
  try {
    if (ui.stats) ui.stats.textContent = "Ships: 0 (R:0 B:0) Bullets: 0";
  } catch (e) {
  }
  const LOGICAL_BOUNDS = getDefaultBounds();
  const disposables = [];
  let uiRaf = null;
  let workerIndicatorRaf = null;
  const pendingTimers = /* @__PURE__ */ new Set();
  let isUiTickRunning = false;
  function addListener(target, type, handler) {
    if (!target) return;
    try {
      target.addEventListener(type, handler);
      disposables.push(() => {
        try {
          target.removeEventListener(type, handler);
        } catch (e) {
        }
      });
    } catch (e) {
    }
  }
  function clearAllTimers() {
    for (const id of Array.from(pendingTimers)) {
      try {
        clearTimeout(id);
      } catch (e) {
      }
      pendingTimers.delete(id);
    }
  }
  function updateCanvasBackingStore() {
    const dpr = window.devicePixelRatio || 1;
    const renderScale = RendererConfig && typeof RendererConfig.renderScale === "number" ? RendererConfig.renderScale : 1;
    const logicalW = LOGICAL_BOUNDS.W;
    const logicalH = LOGICAL_BOUNDS.H;
    if (canvas) {
      const bufferW = Math.round(logicalW * renderScale / dpr);
      const bufferH = Math.round(logicalH * renderScale / dpr);
      canvas.width = bufferW;
      canvas.height = bufferH;
      canvas.style.width = bufferW + "px";
      canvas.style.height = bufferH + "px";
      const dimsEl = document.getElementById("rendererDims");
      if (dimsEl) {
        dimsEl.textContent = `${canvas.width} x ${canvas.height} px @ ${dpr}x`;
      }
    }
    RendererConfig._renderScale = renderScale;
    RendererConfig._offsetX = 0;
    RendererConfig._offsetY = 0;
    const scaleVal = rootDocument.getElementById("rendererScaleValue");
    if (scaleVal) scaleVal.textContent = renderScale.toFixed(2);
  }
  function fitCanvasToWindow() {
    const winW = window.innerWidth;
    const winH = window.innerHeight;
    const bufferW = canvas ? canvas.width : LOGICAL_BOUNDS.W;
    const bufferH = canvas ? canvas.height : LOGICAL_BOUNDS.H;
    const scale = Math.min(winW / bufferW, winH / bufferH);
    const scaledW = bufferW * scale;
    const scaledH = bufferH * scale;
    const offsetX = Math.round((winW - scaledW) / 2);
    const offsetY = Math.round((winH - scaledH) / 2);
    if (canvas) {
      canvas.style.width = `${bufferW}px`;
      canvas.style.height = `${bufferH}px`;
      canvas.style.position = "absolute";
      canvas.style.left = `${offsetX}px`;
      canvas.style.top = `${offsetY}px`;
      canvas.style.transformOrigin = "top left";
      canvas.style.transform = `scale(${scale})`;
    }
    document.body.style.overflow = "hidden";
  }
  const scaleSlider = rootDocument.getElementById("rendererScaleRange");
  const dynamicCheckbox = rootDocument.getElementById("dynamicScaleCheckbox");
  let internalScaleUpdate = false;
  if (scaleSlider) {
    const onScaleInput = (ev) => {
      if (internalScaleUpdate) return;
      const val = parseFloat(ev.target.value);
      if (!isNaN(val)) {
        RendererConfig.renderScale = val;
        RendererConfig.dynamicScaleEnabled = false;
        if (dynamicCheckbox)
          dynamicCheckbox.checked = false;
        updateCanvasBackingStore();
        fitCanvasToWindow();
      }
    };
    addListener(scaleSlider, "input", onScaleInput);
    const scaleVal = rootDocument.getElementById("rendererScaleValue");
    if (scaleVal)
      scaleVal.textContent = scaleSlider.value;
    updateCanvasBackingStore();
    fitCanvasToWindow();
  }
  if (dynamicCheckbox) {
    const onDynamicChange = (ev) => {
      const enabled = !!ev.target.checked;
      RendererConfig.dynamicScaleEnabled = enabled;
    };
    addListener(dynamicCheckbox, "change", onDynamicChange);
    dynamicCheckbox.checked = !!RendererConfig.dynamicScaleEnabled;
  }
  fitCanvasToWindow();
  addListener(window, "resize", fitCanvasToWindow);
  let renderer = null;
  const pref = getPreferredRenderer();
  if (canvas) {
    if (pref === "webgl") {
      try {
        const w = new WebGLRenderer(canvas);
        if (w && w.init && w.init()) renderer = w;
      } catch (e) {
      }
    }
    if (!renderer) {
      try {
        renderer = new CanvasRenderer(canvas);
        renderer.init && renderer.init();
      } catch (e) {
        renderer = null;
      }
    }
  }
  if (renderer && typeof renderer.preloadAllAssets === "function") {
    try {
      renderer.preloadAllAssets();
    } catch (e) {
    }
  }
  try {
    if (typeof window !== "undefined" && svgRenderer_default && typeof svgRenderer_default.prewarmAssets === "function") {
      try {
        const assetsConfig = assetsConfig_default || globalThis.AssetsConfig || {};
        const svgAssets = assetsConfig.svgAssets || {};
        const keys = Object.keys(svgAssets).slice(0, 8);
        const teams = globalThis.TeamsConfig && globalThis.TeamsConfig.teams ? globalThis.TeamsConfig.teams : {};
        const teamColors = [];
        for (const tName of Object.keys(teams)) {
          const t = teams[tName];
          if (t && t.color) teamColors.push(t.color);
        }
        if (teamColors.length === 0) {
          const p = assetsConfig.palette || {};
          if (p.shipHull) teamColors.push(p.shipHull);
          if (p.shipAccent) teamColors.push(p.shipAccent);
        }
        try {
          const g = globalThis.__SpaceAutoBattler_svgRenderer;
          if (g && typeof g.prewarmAssets === "function") {
            try {
              g.prewarmAssets(keys, teamColors, 128, 128).catch(() => {
              });
            } catch (e) {
            }
          } else {
            svgRenderer_default.prewarmAssets(keys, teamColors).catch(() => {
            });
          }
        } catch (e) {
          try {
            svgRenderer_default.prewarmAssets(keys, teamColors).catch(() => {
            });
          } catch (ee) {
          }
        }
      } catch (e) {
      }
    }
  } catch (e) {
  }
  if (!renderer) {
    renderer = {
      type: "noop",
      init: () => false,
      renderState: (_) => {
      },
      isRunning: () => false
    };
  }
  try {
    window.gm = window.gm || {};
  } catch (e) {
  }
  const gm = createGameManager({ renderer, useWorker: false, seed: 12345 });
  if (gm && gm._internal) {
    gm._internal.bounds = LOGICAL_BOUNDS;
    gm._internal.state = gameState;
  }
  try {
    if (typeof window !== "undefined" && window.gm)
      Object.assign(window.gm, gm);
    try {
      const host = location && location.hostname || "";
      if (host === "127.0.0.1" || host === "localhost") {
        try {
          Object.defineProperty(window, "__renderer", {
            value: renderer,
            writable: false,
            configurable: true,
            enumerable: false
          });
        } catch (e) {
          try {
            window.__renderer = renderer;
          } catch (err) {
          }
        }
      }
    } catch (e) {
    }
  } catch (e) {
  }
  try {
    if (typeof window !== "undefined") {
      const host = location && location.hostname || "";
      const urlParams = typeof URLSearchParams !== "undefined" ? new URLSearchParams(location.search) : null;
      const enabled = host === "127.0.0.1" || host === "localhost" || urlParams?.get("devShipTable") === "1";
      if (enabled) {
        Promise.resolve().then(() => (init_shipPipelineOverlay(), shipPipelineOverlay_exports)).then((m) => {
          try {
            m.default && m.default();
          } catch (e) {
          }
        }).catch((e) => {
          console.warn("Failed to load dev overlay", e);
        });
      }
    }
  } catch (e) {
  }
  let simSpeedMultiplier = 1;
  if (ui.speed) {
    const onSpeedClick = () => {
      simSpeedMultiplier = simSpeedMultiplier >= 4 ? 0.25 : simSpeedMultiplier * 2;
      ui.speed.textContent = `Speed: ${simSpeedMultiplier}\xD7`;
    };
    addListener(ui.speed, "click", onSpeedClick);
    ui.speed.textContent = `Speed: ${simSpeedMultiplier}\xD7`;
  }
  if (gm && typeof gm.stepOnce === "function") {
    const origStepOnce = gm.stepOnce.bind(gm);
    gm.stepOnce = (dt = SIM.DT_MS / 1e3) => origStepOnce(dt * simSpeedMultiplier);
  }
  if (ui.formationBtn) {
    const onFormationClick = () => {
      if (gm && typeof gm.formFleets === "function") {
        gm.formFleets();
      }
    };
    addListener(ui.formationBtn, "click", onFormationClick);
  }
  let engineTrailsEnabled = true;
  gameState.engineTrailsEnabled = engineTrailsEnabled;
  if (ui.toggleTrails) {
    const onToggleTrails = () => {
      engineTrailsEnabled = !engineTrailsEnabled;
      gameState.engineTrailsEnabled = engineTrailsEnabled;
      ui.toggleTrails.textContent = engineTrailsEnabled ? "\u2604 Trails: On" : "\u2604 Trails: Off";
    };
    addListener(ui.toggleTrails, "click", onToggleTrails);
    ui.toggleTrails.textContent = engineTrailsEnabled ? "\u2604 Trails: On" : "\u2604 Trails: Off";
  }
  try {
    const host = location && location.hostname || "";
    const urlParams = typeof URLSearchParams !== "undefined" ? new URLSearchParams(location.search) : null;
    const autotest = urlParams && urlParams.get("autotest") === "1" || !!window.__AUTO_REINFORCE_DEV__;
    if ((host === "127.0.0.1" || host === "localhost") && autotest) {
      try {
        if (gm && typeof gm.setContinuousEnabled === "function")
          gm.setContinuousEnabled(true);
      } catch (e) {
      }
      try {
        if (gm && typeof gm.setReinforcementInterval === "function")
          gm.setReinforcementInterval(0.01);
      } catch (e) {
      }
      try {
        if (gm && typeof gm.stepOnce === "function") gm.stepOnce(0.02);
      } catch (e) {
      }
    }
  } catch (e) {
  }
  let lastReinforcementSummary = "";
  let reinforcementsHandler = null;
  try {
    if (gm && typeof gm.on === "function") {
      reinforcementsHandler = (msg) => {
        const list = msg && msg.spawned || [];
        const types = list.map((s) => s.type).filter(Boolean);
        const summary = `Reinforcements: spawned ${list.length} ships (${types.join(", ")})`;
        lastReinforcementSummary = summary;
        try {
          const tid = setTimeout(() => {
            lastReinforcementSummary = "";
          }, 3e3);
          pendingTimers.add(tid);
        } catch (e) {
        }
        try {
          if (ui && ui.stats)
            ui.stats.textContent = `${ui.stats.textContent} | ${summary}`;
        } catch (e) {
        }
      };
      gm.on("reinforcements", reinforcementsHandler);
    }
  } catch (e) {
  }
  const workerIndicator = rootDocument.getElementById("workerIndicator");
  let toastContainer = rootDocument.getElementById("toastContainer");
  if (!toastContainer) {
    try {
      toastContainer = rootDocument.createElement("div");
      toastContainer.id = "toastContainer";
      toastContainer.style.position = "fixed";
      toastContainer.style.right = "16px";
      toastContainer.style.top = "16px";
      toastContainer.style.zIndex = "9999";
      toastContainer.style.pointerEvents = "none";
      rootDocument.body.appendChild(toastContainer);
      disposables.push(() => {
        try {
          if (toastContainer && toastContainer.parentNode)
            toastContainer.parentNode.removeChild(toastContainer);
        } catch (e) {
        }
      });
    } catch (e) {
      toastContainer = null;
    }
  }
  function showToast(msg, opts = {}) {
    try {
      if (!toastContainer) return;
      const ttl = typeof opts.ttl === "number" ? opts.ttl : 2e3;
      const el = rootDocument.createElement("div");
      el.style.background = "rgba(20,20,30,0.9)";
      el.style.color = "#fff";
      el.style.padding = "8px 12px";
      el.style.marginTop = "6px";
      el.style.borderRadius = "6px";
      el.style.boxShadow = "0 2px 8px rgba(0,0,0,0.5)";
      el.style.fontFamily = "sans-serif";
      el.style.fontSize = "13px";
      el.style.pointerEvents = "auto";
      el.textContent = msg;
      toastContainer.appendChild(el);
      const tid = setTimeout(() => {
        try {
          el.style.transition = "opacity 300ms ease";
          el.style.opacity = "0";
        } catch (e) {
        }
        setTimeout(() => {
          try {
            if (el && el.parentNode) el.parentNode.removeChild(el);
          } catch (err) {
          }
        }, 350);
      }, ttl);
      pendingTimers.add(tid);
    } catch (e) {
    }
  }
  let levelupHandler = null;
  try {
    if (gm && typeof gm.on === "function") {
      levelupHandler = (m) => {
        try {
          const ship = m && m.ship || null;
          const lvl = m && m.newLevel || (m && m.newLevel === 0 ? 0 : void 0);
          const who = ship && ship.team ? `${ship.team} ship` : "Ship";
          const msg = `${who} leveled up to ${lvl}`;
          showToast(msg, { ttl: 2200 });
        } catch (e) {
        }
      };
      gm.on("levelup", levelupHandler);
    }
  } catch (e) {
  }
  if (workerIndicator) {
    try {
      const refresh = () => {
        try {
          workerIndicator.textContent = gm.isWorker && gm.isWorker() ? "Worker" : "Main";
        } catch (e) {
        }
        try {
          workerIndicatorRaf = requestAnimationFrame(refresh);
        } catch (e) {
          workerIndicatorRaf = null;
        }
      };
      refresh();
    } catch (e) {
      workerIndicator.textContent = "Unknown";
    }
  }
  try {
    if (ui.startPause)
      addListener(ui.startPause, "click", () => {
        if (gm.isRunning()) {
          gm.pause();
          ui.startPause.textContent = "\u25B6 Start";
        } else {
          gm.start();
          ui.startPause.textContent = "\u23F8 Pause";
        }
      });
  } catch (e) {
  }
  try {
    if (ui.reset) addListener(ui.reset, "click", () => gm.reset());
  } catch (e) {
  }
  try {
    const cfg = getRuntimeShipConfigSafe();
    const selectEl = rootDocument.getElementById(
      "shipTypeSelect"
    );
    if (selectEl && cfg) {
      selectEl.innerHTML = "";
      for (const key of Object.keys(cfg)) {
        try {
          const opt = rootDocument.createElement("option");
          opt.value = key;
          opt.textContent = key;
          selectEl.appendChild(opt);
        } catch (e) {
        }
      }
    }
  } catch (e) {
  }
  function spawnSelected(team) {
    try {
      const selectEl = rootDocument.getElementById(
        "shipTypeSelect"
      );
      const selectedType = selectEl ? selectEl.value : null;
      try {
        if (gm && typeof gm.spawnShip === "function") {
          if (selectedType) {
            try {
              const maybe = gm.spawnShip(team, selectedType);
              if (maybe) return maybe;
            } catch (e) {
            }
          }
          const ship = gm.spawnShip(team);
          if (ship && selectedType) {
            try {
              ship.type = selectedType;
              try {
                const scfg = getRuntimeShipConfigSafe();
                if (scfg && scfg[selectedType])
                  ship._config = scfg[selectedType];
              } catch (e) {
              }
            } catch (e) {
            }
          }
          return ship;
        }
      } catch (e) {
      }
    } catch (e) {
    }
    return null;
  }
  try {
    if (ui.addRed) addListener(ui.addRed, "click", () => spawnSelected("red"));
  } catch (e) {
  }
  try {
    if (ui.addBlue)
      addListener(ui.addBlue, "click", () => spawnSelected("blue"));
  } catch (e) {
  }
  function onSeedBtnClick() {
    try {
      const raw = typeof window !== "undefined" && typeof window.prompt === "function" ? window.prompt("Enter new seed (leave blank for random):", "") : null;
      if (raw == null) return;
      const trimmed = String(raw).trim();
      if (trimmed === "") {
        try {
          gm.reseed();
          showToast("Reseeded with random seed");
        } catch (e) {
        }
        return;
      }
      const asNum = Number(trimmed);
      if (!Number.isFinite(asNum) || Math.floor(asNum) !== asNum) {
        try {
          showToast("Invalid seed. Please enter an integer.");
        } catch (e) {
        }
        return;
      }
      try {
        gm.reseed(asNum >>> 0);
        showToast(`Reseeded with ${asNum >>> 0}`);
      } catch (e) {
      }
    } catch (e) {
    }
  }
  try {
    if (ui.seedBtn) addListener(ui.seedBtn, "click", onSeedBtnClick);
  } catch (e) {
  }
  try {
    if (ui.continuousCheckbox) {
      addListener(ui.continuousCheckbox, "change", (ev) => {
        const v = !!ev.target.checked;
        if (gm && typeof gm.setContinuousEnabled === "function")
          gm.setContinuousEnabled(v);
      });
    }
  } catch (e) {
  }
  function uiTick() {
    if (isUiTickRunning) return;
    isUiTickRunning = true;
    const startTick = performance.now();
    let skipRender = false;
    try {
      const s = gm.snapshot();
      ui.redScore.textContent = `Red ${gm.score.red}`;
      ui.blueScore.textContent = `Blue ${gm.score.blue}`;
      const redCount = s.teamCounts && s.teamCounts.red || 0;
      const blueCount = s.teamCounts && s.teamCounts.blue || 0;
      ui.stats.textContent = `Ships: ${s.ships.length} (R:${redCount} B:${blueCount}) Bullets: ${s.bullets.length}` + (lastReinforcementSummary ? ` | ${lastReinforcementSummary}` : "");
    } catch (e) {
    }
    const endTick = performance.now();
    const tickTime = endTick - startTick;
    if (tickTime > SIM.DT_MS) {
      skipRender = true;
    }
    const dynamicEnabled = !!RendererConfig.dynamicScaleEnabled;
    const scaleSliderEl = rootDocument.getElementById(
      "rendererScaleRange"
    );
    const scaleValEl = rootDocument.getElementById("rendererScaleValue");
    const now = performance.now();
    RendererConfig._lastUiTick = RendererConfig._lastUiTick || now;
    const dt = now - RendererConfig._lastUiTick;
    RendererConfig._lastUiTick = now;
    RendererConfig.lastFrameTime = dt;
    let frameScore = "green";
    if (dt > 33) frameScore = "red";
    else if (dt > 20) frameScore = "yellow";
    RendererConfig.frameScore = frameScore;
    if (scaleValEl) {
      scaleValEl.style.color = frameScore === "green" ? "#4caf50" : frameScore === "yellow" ? "#ffd600" : "#ff1744";
    }
    if (dynamicEnabled && scaleSliderEl) {
      let scale = RendererConfig.renderScale;
      if (frameScore === "red" && scale > 0.25)
        scale = Math.max(0.25, scale - 0.05);
      else if (frameScore === "green" && scale < 2)
        scale = Math.min(2, scale + 0.01);
      if (scale !== RendererConfig.renderScale) {
        RendererConfig.renderScale = scale;
        internalScaleUpdate = true;
        scaleSliderEl.value = scale.toFixed(2);
        if (scaleValEl) scaleValEl.textContent = scale.toFixed(2);
        fitCanvasToWindow();
        internalScaleUpdate = false;
      }
    }
    if (!skipRender) {
      try {
        uiRaf = requestAnimationFrame(() => {
          isUiTickRunning = false;
          uiTick();
        });
      } catch (e) {
        uiRaf = null;
        isUiTickRunning = false;
      }
    } else {
      const tid = setTimeout(() => {
        isUiTickRunning = false;
        uiTick();
      }, SIM.DT_MS);
      if (typeof tid === "number") pendingTimers.add(tid);
    }
  }
  uiRaf = requestAnimationFrame(uiTick);
  function dispose() {
    try {
      if (gm && typeof gm.destroy === "function") gm.destroy();
    } catch (e) {
    }
    try {
      if (gm && typeof gm.pause === "function") gm.pause();
    } catch (e) {
    }
    try {
      if (gm && typeof gm.off === "function") {
        if (reinforcementsHandler)
          gm.off("reinforcements", reinforcementsHandler);
        if (levelupHandler) gm.off("levelup", levelupHandler);
      }
    } catch (e) {
    }
    if (uiRaf != null) {
      try {
        cancelAnimationFrame(uiRaf);
      } catch (e) {
      }
      uiRaf = null;
    }
    isUiTickRunning = false;
    if (workerIndicatorRaf != null) {
      try {
        cancelAnimationFrame(workerIndicatorRaf);
      } catch (e) {
      }
      workerIndicatorRaf = null;
    }
    try {
      clearAllTimers();
    } catch (e) {
    }
    for (const fn of disposables.slice()) {
      try {
        fn();
      } catch (e) {
      }
    }
    disposables.length = 0;
    try {
      if (typeof window !== "undefined" && window.gm) {
        try {
          delete window.gm;
        } catch (e) {
        }
      }
    } catch (e) {
    }
  }
  return { gm, renderer, dispose };
}
if (typeof window !== "undefined") {
  let safeStartApp = function(doc) {
    if (appInstance && typeof appInstance.dispose === "function") {
      appInstance.dispose();
    }
    startApp(doc).then((instance) => {
      appInstance = instance;
    });
  };
  safeStartApp2 = safeStartApp;
  let appInstance = null;
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", () => safeStartApp(document));
  else safeStartApp(document);
  window.addEventListener("beforeunload", () => {
    if (appInstance && typeof appInstance.dispose === "function") {
      appInstance.dispose();
    }
  });
}
var safeStartApp2;
var main_default = startApp;
export {
  main_default as default,
  startApp
};
//# sourceMappingURL=bundled.js.map
