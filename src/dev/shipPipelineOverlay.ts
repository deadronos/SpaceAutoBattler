import { AssetsConfig, getSpriteAsset } from "../config/assets/assetsConfig";

function detectPipeline(type: string) {
  const sprite = getSpriteAsset(type);
  if (sprite.svg) return { pipeline: "svg", source: sprite.svg };
  if (sprite.model3d && sprite.model3d.url)
    return { pipeline: "mesh3d", source: sprite.model3d.url };
  if (sprite.shape) return { pipeline: "shape2d", source: "shapes2d" };
  return { pipeline: "unknown", source: "-" };
}

function createOverlay() {
  if (typeof document === "undefined") return null;
  const host = (location && location.hostname) || "";
  const urlParams =
    typeof URLSearchParams !== "undefined"
      ? new URLSearchParams(location.search)
      : null;
  const enabled =
    urlParams?.get("devShipTable") === "1" ||
    host === "127.0.0.1" ||
    host === "localhost";
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

  const types = new Set<string>([
    ...Object.keys(AssetsConfig.shapes2d || {}),
    ...Object.keys((AssetsConfig as any).svgAssets || {}),
  ]);
  for (const t of Array.from(types).sort()) {
    const res = detectPipeline(t as string);
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
  function setOpen(v: boolean) {
    open = !!v;
    panel.style.display = open ? "block" : "none";
    badge.style.background = open
      ? "rgba(60,60,70,0.95)"
      : "rgba(20,20,30,0.9)";
    try {
      localStorage.setItem("shipPipelineOpen", open ? "1" : "0");
    } catch (e) {}
  }

  badge.addEventListener("click", () => setOpen(!open));
  badge.addEventListener("keydown", (ev) => {
    if (
      (ev as KeyboardEvent).key === "Enter" ||
      (ev as KeyboardEvent).key === " "
    ) {
      ev.preventDefault();
      setOpen(!open);
    }
  });

  // restore state
  try {
    if (localStorage.getItem("shipPipelineOpen") === "1") setOpen(true);
  } catch (e) {}

  container.appendChild(badge);
  container.appendChild(panel);
  document.body.appendChild(container);
  return { container, badge, panel };
}

export default function initShipPipelineOverlay() {
  try {
    createOverlay();
  } catch (e) {
    console.warn("shipPipelineOverlay init failed", e);
  }
}
