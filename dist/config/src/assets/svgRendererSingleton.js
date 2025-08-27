// Lightweight singleton helper to obtain a shared svgRenderer instance.
// Prefer synchronous resolution (require or existing global bridge) so callers
// that need a sync cached canvas can get it. Provide an async loader for
// warming when sync resolution isn't available.
export function getSvgRendererSync() {
    try {
        // If a global bridge already exists (other bundle attached it), use it
        if (typeof globalThis !== "undefined") {
            const g = globalThis.__SpaceAutoBattler_svgRenderer;
            if (g)
                return g;
        }
    }
    catch (e) { }
    // Try a synchronous require of common module specifiers.
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        if (typeof require === "function") {
            const candidates = [
                "./svgRenderer",
                "../assets/svgRenderer",
                "../../src/assets/svgRenderer",
                "src/assets/svgRenderer",
            ];
            for (const p of candidates) {
                try {
                    const mod = require(p);
                    if (mod)
                        return mod.default || mod;
                }
                catch (e) {
                    // try next
                }
            }
        }
    }
    catch (e) { }
    return undefined;
}
export async function getSvgRenderer() {
    // Prefer sync if available
    const s = getSvgRendererSync();
    if (s)
        return s;
    // Try dynamic import - will work in browser bundles
    try {
        const m = await import("./svgRenderer");
        const inst = (m && (m.default || m));
        // If module attached a global bridge, prefer that singleton
        try {
            if (typeof globalThis !== "undefined") {
                const g = globalThis.__SpaceAutoBattler_svgRenderer;
                if (g)
                    return g;
            }
        }
        catch (e) { }
        return inst;
    }
    catch (e) {
        // last-ditch: return whatever global bridge exists
        try {
            if (typeof globalThis !== "undefined")
                return globalThis.__SpaceAutoBattler_svgRenderer;
        }
        catch (ee) { }
    }
    return undefined;
}
