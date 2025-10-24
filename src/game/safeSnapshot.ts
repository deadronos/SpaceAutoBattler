/**
 * Utilities for producing small, serializable snapshots of GameState that
 * avoid traversing or inspecting WASM-backed Rapier internals. These helpers
 * are defensive and designed to be safe for use in error handlers and
 * diagnostics where accidental property traversal can trigger Rapier panics.
 */
import type { GameState } from '../types/index.js';

function isPrimitive(v: unknown): boolean {
  return v === null || (typeof v !== 'object' && typeof v !== 'function');
}

export function isWasmBacked(value: unknown): boolean {
  if (value == null || typeof value !== 'object') return false;
  try {
    const ctor = (value as Record<string, unknown>).constructor as { name?: string } | undefined;
    const name = ctor?.name ?? '';
    return /World|RigidBody|Collider|EventQueue|Rapier|Rigid/.test(name);
  } catch {
    return false;
  }
}

const MAX_OBJECT_KEYS = 32;

export function sanitizeForLog(value: unknown, depth = 2): unknown {
  if (isPrimitive(value)) return value;
  if (depth <= 0) return '[TooDeep]';

  if (Array.isArray(value)) {
    const out: unknown[] = [];
    for (let i = 0; i < value.length; i += 1) {
      try {
        const el = value[i];
        if (isWasmBacked(el)) {
          out.push('[WASM]');
        } else {
          out.push(sanitizeForLog(el, depth - 1));
        }
      } catch {
        out.push('[Error]');
      }
    }
    return out;
  }

  // Object
  try {
    const obj = value as Record<string, unknown>;
    if (isWasmBacked(obj)) return '[WASM]';
    const keys = Object.keys(obj).slice(0, MAX_OBJECT_KEYS);
    const out: Record<string, unknown> = Object.create(null);
    for (const k of keys) {
      try {
        const v = obj[k];
        if (typeof v === 'function') continue;
        if (isWasmBacked(v)) {
          out[k] = '[WASM]';
        } else {
          out[k] = sanitizeForLog(v, depth - 1);
        }
      } catch {
        out[k] = '[Error]';
      }
    }
    return out;
  } catch {
    return '[Unserializable]';
  }
}

export function safeSnapshot(state: GameState): Record<string, unknown> {
  try {
    const sim = state.simulation;
    const worldEntities = Array.isArray(
      (state.world as unknown as Record<string, unknown>).entities,
    )
      ? (state.world as unknown as { entities: unknown[] }).entities.length
      : undefined;

    const ships = (() => {
      try {
        return Array.isArray(state.queries.ships.entities)
          ? state.queries.ships.entities.length
          : undefined;
      } catch {
        return undefined;
      }
    })();

    const projectiles = (() => {
      try {
        return Array.isArray(state.queries.projectiles.entities)
          ? state.queries.projectiles.entities.length
          : undefined;
      } catch {
        return undefined;
      }
    })();

    const turretCount = (() => {
      try {
        return Array.isArray(state.queries.turrets.entities)
          ? state.queries.turrets.entities.length
          : undefined;
      } catch {
        return undefined;
      }
    })();

    return {
      time: state.time,
      tickIndex: sim.lastTickIndex,
      lastTickDuration: sim.lastTickDuration,
      accumulator: sim.accumulator,
      counts: {
        entities: worldEntities,
        ships,
        projectiles,
        turrets: turretCount,
        colliders: state.colliderLookup ? state.colliderLookup.size : undefined,
      },
      deferredMutations: sim.deferredMutations.length,
      postStepMutations: sim.postStepMutations.length,
      ai: {
        tickIndex: state.ai.tickIndex,
        cursor: state.ai.cursor,
      },
      // Accept a shallow, sanitized representation of the blackboard so we can
      // inspect team counts and a small set of useful primitives without
      // traversing Three.js or Rapier internals.
      blackboard: sanitizeForLog(
        {
          teamCounts: state.blackboard.teamCounts,
        },
        1,
      ),
    };
  } catch {
    return { error: 'safeSnapshot failed' };
  }
}
