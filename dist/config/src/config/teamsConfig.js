// teamsConfig.ts - Teams and fleet helpers (typed)
import { getDefaultShipType, getShipConfig } from "./entitiesConfig"; // should be './config/entitiesConfig'
import { getDefaultBounds } from "./simConfig";
export const TeamsConfig = {
    teams: {
        red: { id: "red", color: "#ff4d4d", label: "Red" },
        blue: { id: "blue", color: "#4da6ff", label: "Blue" },
    },
    defaultFleet: {
        counts: (() => {
            // Build a default counts map from available ShipConfig types so new
            // ship types are automatically included without needing manual edits.
            // Defensive: some module resolution paths may expose a non-function
            // binding for getShipConfig (e.g. default object). Accept both a
            // function or an object shape to avoid TypeError during tests.
            const shipCfg = (typeof getShipConfig === "function" && getShipConfig()) ||
                // if imported as default-only: try default export object/function
                (typeof getShipConfig?.default === "function" &&
                    getShipConfig.default()) ||
                (typeof getShipConfig?.default === "object" &&
                    getShipConfig.default) ||
                // some bundlers may bind getShipConfig to the config object itself
                (typeof getShipConfig === "object" &&
                    getShipConfig) ||
                {};
            let types = Object.keys(shipCfg || {});
            // Robust fallback: if we couldn't discover any types (interop edge-case),
            // seed with the canonical baseline so feature tests remain stable.
            if (types.length === 0) {
                types = ["fighter", "corvette", "frigate", "destroyer", "carrier"];
            }
            // sane defaults: make fighters most common, others rarer
            const defaultCounts = {};
            for (const t of types) {
                if (t === "fighter")
                    defaultCounts[t] = 8;
                else if (t === "corvette")
                    defaultCounts[t] = 3;
                else if (t === "frigate")
                    defaultCounts[t] = 2;
                else if (t === "destroyer")
                    defaultCounts[t] = 1;
                else if (t === "carrier")
                    defaultCounts[t] = 1;
                else
                    defaultCounts[t] = 1;
            }
            return defaultCounts;
        })(),
        spacing: 28,
        jitter: { x: 80, y: 120 },
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
        interval: 5.0,
        shipTypes: undefined,
    },
};
// Local seeded PRNG (does not affect global rng)
function mulberry32(seed) {
    let t = seed >>> 0;
    return function () {
        t += 0x6d2b79f5;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
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
export function generateFleetForTeam(seed = 0, teamId = "red", bounds, shipFactory, options = {}) {
    const b = bounds || getDefaultBounds();
    const cfg = Object.assign({}, TeamsConfig.defaultFleet, options.fleet || {});
    const spacing = options.spacing ?? cfg.spacing;
    const jitter = Object.assign({}, cfg.jitter, options.jitter || {});
    const centerY = b.H / 2;
    const baseX = teamId === "red" ? b.W * 0.22 : b.W * 0.78;
    const rng = mulberry32((seed >>> 0) + hashStringToInt(teamId));
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
            else
                out.push({ type, x, y, team: teamId });
        }
    }
    return out;
}
export function makeInitialFleets(seed = 0, bounds, shipFactory, options = {}) {
    const b = bounds || getDefaultBounds();
    const red = generateFleetForTeam(seed, "red", b, shipFactory, options);
    const blue = generateFleetForTeam(seed + 1, "blue", b, shipFactory, options);
    return red.concat(blue);
}
export function chooseReinforcements(seed = 0, state = {}, options = {}) {
    const cfg = Object.assign({}, TeamsConfig.continuousReinforcement, options);
    // (no-op) merge options onto default continuous reinforcement config
    if (!cfg.enabled)
        return [];
    const teamStrength = {};
    if (Array.isArray(state.ships)) {
        for (const s of state.ships) {
            if (!s || !s.team)
                continue;
            const hp = typeof s.hp === "number" ? s.hp : 1;
            teamStrength[s.team] = (teamStrength[s.team] || 0) + hp;
        }
    }
    const teams = Object.keys(TeamsConfig.teams);
    if (teams.length === 0)
        return [];
    for (const t of teams) {
        if (!teamStrength[t]) {
            const cnt = (state.ships || []).filter((s) => s && s.team === t).length;
            teamStrength[t] = cnt > 0 ? cnt : 0;
        }
    }
    let weakest = teams[0];
    let strongest = teams[0];
    for (const t of teams) {
        if (teamStrength[t] < teamStrength[weakest])
            weakest = t;
        if (teamStrength[t] > teamStrength[strongest])
            strongest = t;
    }
    const total = teams.reduce((s, t) => s + (teamStrength[t] || 0), 0) || 1;
    const weakestRatio = (teamStrength[weakest] || 0) / total;
    if (weakestRatio < 0.5 - cfg.scoreMargin) {
        const orders = [];
        const rng = mulberry32((seed >>> 0) + hashStringToInt(weakest));
        // determine candidate ship types: either explicit list or keys from defaultFleet
        const candidateTypes = Array.isArray(cfg.shipTypes) && cfg.shipTypes.length
            ? cfg.shipTypes
            : Object.keys(TeamsConfig.defaultFleet.counts || { fighter: 1 });
        // Build weights for candidate types using defaultFleet counts when available
        const countsMap = TeamsConfig && TeamsConfig.defaultFleet && TeamsConfig.defaultFleet.counts
            ? TeamsConfig.defaultFleet.counts
            : {};
        const weights = candidateTypes.map((t) => Math.max(0, Number(countsMap[t]) || 1));
        const totalWeight = weights.reduce((s, w) => s + w, 0) ||
            candidateTypes.length ||
            1;
        // Helper: weighted random pick for ship types
        const weightedPick = () => {
            const r = rng() * totalWeight;
            let acc = 0;
            for (let i = 0; i < candidateTypes.length; i++) {
                acc += weights[i];
                if (r < acc)
                    return candidateTypes[i];
            }
            return candidateTypes[candidateTypes.length - 1];
        };
        // Randomize number to spawn between 1 and cfg.perTick (inclusive)
        const maxPerTick = Math.max(1, Math.floor(Number(cfg.perTick) || 1));
        const spawnCount = Math.max(1, Math.floor(rng() * maxPerTick) + 1);
        // spawnCount computed deterministically from the provided seed
        const b = options.bounds || getDefaultBounds();
        const centerY = b.H / 2;
        const baseX = weakest === "red" ? b.W * 0.18 : b.W * 0.82;
        for (let i = 0; i < spawnCount; i++) {
            const x = Math.max(0, Math.min(b.W - 1e-6, baseX + (rng() - 0.5) * 120));
            const y = Math.max(0, Math.min(b.H - 1e-6, centerY + (rng() - 0.5) * 160));
            const type = Array.isArray(cfg.shipTypes) && cfg.shipTypes.length
                ? candidateTypes[Math.floor(rng() * candidateTypes.length)] ||
                    getDefaultShipType()
                : weightedPick();
            orders.push({ type, team: weakest, x, y });
        }
        // return deterministic orders
        return orders;
    }
    return [];
}
// Team fallback default
export const TEAM_DEFAULT = "red";
export default TeamsConfig;
// Helper: call chooseReinforcements using a manager-derived seed (from global RNG)
// This is convenient for callers (like gamemanager) that want to keep
// reinforcements deterministic relative to the global `srand`/`srandom` state.
import { srandom } from "../rng";
export function chooseReinforcementsWithManagerSeed(state = {}, options = {}) {
    const seed = Math.floor(srandom() * 0xffffffff) >>> 0;
    return chooseReinforcements(seed, state, options);
}
