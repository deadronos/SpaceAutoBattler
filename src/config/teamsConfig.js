// Teams configuration and seeded fleet helpers
// Exports:
// - TeamsConfig: colors and defaults
// - generateFleetForTeam(seed, teamId, bounds, shipFactory, options)
// - makeInitialFleets(seed, bounds, shipFactory, options)
// - chooseReinforcements(seed, state, options)

export const TeamsConfig = {
  teams: {
    red: { id: 'red', color: '#ff4d4d', label: 'Red' },
    blue: { id: 'blue', color: '#4da6ff', label: 'Blue' }
  },
  // Default fleet composition when prepopulating a game
  defaultFleet: {
    // counts per ship type
    counts: {
      fighter: 8,
      corvette: 3,
      frigate: 1
    },
    // jitter and spacing used when scattering initial ships
    spacing: 28,
    jitter: { x: 80, y: 120 }
  },
  // Continuous reinforcement defaults
  continuousReinforcement: {
    enabled: true,        // toggle to enable/disable
    scoreMargin: 0.12,     // if weaker team has less than (1 - scoreMargin) of strength, reinforce
    perTick: 1,            // number of reinforcement ships to provide when triggered
    reinforceType: undefined // default reinforcement ship type (use ShipConfig first key when needed)
  }
};

// Validate TeamsConfig at module init
import { validateConfigOrThrow, validateTeamsConfig } from './validateConfig';
try {
  const errs = validateTeamsConfig(TeamsConfig);
  if (errs && errs.length) {
    // validateConfigOrThrow will throw in CI/production based on env
    validateConfigOrThrow(TeamsConfig);
  }
} catch (err) {
  // eslint-disable-next-line no-console
  console.error('TeamsConfig validation failed:', err && err.message ? err.message : err);
  throw err;
}

// Small local seeded PRNG (does not modify global RNG state)
function mulberry32(seed) {
  let t = seed >>> 0;
  return function() {
    t += 0x6D2B79F5;
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

// Generate a fleet for a single team. If shipFactory is provided it will be
// called as shipFactory(type, x, y, team) for each generated ship. Otherwise
// plain descriptors are returned.
export function generateFleetForTeam(seed = 0, teamId = 'red', bounds = { W: 800, H: 600 }, shipFactory, options = {}) {
  const cfg = Object.assign({}, TeamsConfig.defaultFleet, options.fleet || {});
  const spacing = options.spacing ?? cfg.spacing;
  const jitter = Object.assign({}, cfg.jitter, options.jitter || {});
  const centerY = bounds.H / 2;
  const baseX = teamId === 'red' ? bounds.W * 0.22 : bounds.W * 0.78;

  const rng = mulberry32((seed >>> 0) + hashStringToInt(teamId));
  const out = [];

  for (const [type, count] of Object.entries(cfg.counts)) {
    for (let i = 0; i < count; i++) {
      // polar scatter around base point
      const r = spacing * Math.sqrt(rng());
      const angle = rng() * Math.PI * 2;
      const dx = Math.cos(angle) * r + (rng() - 0.5) * (jitter.x ?? 0);
      const dy = Math.sin(angle) * r + (rng() - 0.5) * (jitter.y ?? 0);
      const x = Math.max(0, Math.min(bounds.W, baseX + dx));
      const y = Math.max(0, Math.min(bounds.H, centerY + dy));

      if (typeof shipFactory === 'function') {
        out.push(shipFactory(type, x, y, teamId));
      } else {
        out.push({ type, x, y, team: teamId });
      }
    }
  }

  return out;
}

// Convenience: create both teams' initial fleets and return a combined array
export function makeInitialFleets(seed = 0, bounds = { W: 800, H: 600 }, shipFactory, options = {}) {
  const red = generateFleetForTeam(seed, 'red', bounds, shipFactory, options);
  const blue = generateFleetForTeam(seed + 1, 'blue', bounds, shipFactory, options);
  return red.concat(blue);
}

// Choose reinforcements for the weaker team according to the config.
// Returns a small array of reinforcement orders: { type, team, x, y }
export function chooseReinforcements(seed = 0, state = {}, options = {}) {
  const cfg = Object.assign({}, TeamsConfig.continuousReinforcement, options);
  if (!cfg.enabled) return [];

  // Compute simple strength by summing HP of alive ships per team (fallback to counts)
  const teamStrength = {};
  if (Array.isArray(state.ships)) {
    for (const s of state.ships) {
      if (!s || !s.team) continue;
      const hp = (typeof s.hp === 'number' ? s.hp : 1);
      teamStrength[s.team] = (teamStrength[s.team] || 0) + hp;
    }
  }

  const teams = Object.keys(TeamsConfig.teams);
  if (teams.length === 0) return [];

  // If no numeric strengths available, fall back to ship counts
  for (const t of teams) {
    if (!teamStrength[t]) {
      const cnt = (state.ships || []).filter(s => s && s.team === t).length;
      teamStrength[t] = cnt > 0 ? cnt : 0;
    }
  }

  // Find weakest and strongest teams
  let weakest = teams[0];
  let strongest = teams[0];
  for (const t of teams) {
    if (teamStrength[t] < teamStrength[weakest]) weakest = t;
    if (teamStrength[t] > teamStrength[strongest]) strongest = t;
  }

  const total = teams.reduce((s, t) => s + (teamStrength[t] || 0), 0) || 1;
  const weakestRatio = (teamStrength[weakest] || 0) / total;

  // If the weakest side is sufficiently behind, return reinforcement orders
  if (weakestRatio < (0.5 - cfg.scoreMargin)) {
    const orders = [];
    const rng = mulberry32((seed >>> 0) + hashStringToInt(weakest));
    // determine candidate ship types: either explicit list or keys from defaultFleet
    const candidateTypes = Array.isArray(cfg.shipTypes) && cfg.shipTypes.length ? cfg.shipTypes : Object.keys(TeamsConfig.defaultFleet.counts || { fighter: 1 });
    const maxPerTick = Math.max(1, Math.floor(Number(cfg.perTick) || 1));
    const spawnCount = Math.max(1, Math.floor(rng() * maxPerTick) + 1);
    const b = (options.bounds || { W: 800, H: 600 });
    const centerY = b.H / 2;
    const baseX = weakest === 'red' ? b.W * 0.18 : b.W * 0.82;
    for (let i = 0; i < spawnCount; i++) {
      const x = Math.max(0, Math.min(b.W, baseX + (rng() - 0.5) * 120));
      const y = Math.max(0, Math.min(b.H, centerY + (rng() - 0.5) * 160));
  const type = candidateTypes[Math.floor(rng() * candidateTypes.length)] || (cfg.reinforceType || undefined);
      orders.push({ type, team: weakest, x, y });
    }
    return orders;
  }

  return [];
}

export default TeamsConfig;

// Helper: call chooseReinforcements using a manager-derived seed (from global RNG)
// This is convenient for callers (like gamemanager) that want to keep
// reinforcements deterministic relative to the global `srand`/`srandom` state.
import { srandom } from '../rng';
export function chooseReinforcementsWithManagerSeed(state = {}, options = {}) {
  const seed = Math.floor(srandom() * 0xffffffff) >>> 0;
  return chooseReinforcements(seed, state, options);
}
