// Pure, side-effect-free schema validators for the AI tunables:
// `AI_PROFILES` (behavior profiles) and `DOCTRINE_CARDS`.
//
// Both functions return a list of human-readable issues (empty = valid) so they
// can be unit-tested without touching the error reporter. The startup wiring in
// `../aiProfiles.ts` and `../aiDoctrine.ts` is the only side-effectful call site.
//
// The validators never mutate their input and never throw: non-object inputs and
// non-object entries are reported as issues instead of raising, so a future
// mis-tuned constant warns (never crashes) at module load.

import type { BehaviorProfile, DoctrineCard, DoctrineCardId } from '../../types/index.js';

type UnknownRecord = Record<string, unknown>;

const BAND_PREFERENCES: ReadonlySet<string> = new Set(['outer', 'mid', 'inner']);
const ELEVATION_PREFERENCES: ReadonlySet<string> = new Set(['above', 'below', 'follow']);
const BEHAVIOR_STYLES: ReadonlySet<string> = new Set(['brawler', 'kiter', 'artillery', 'escort']);
const TEAM_POSTURES: ReadonlySet<string> = new Set(['aggressive', 'hold', 'retreat']);

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPositiveFinite(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0;
}

function isInUnitInterval(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0 && value <= 1;
}

function isNonNegativeFinite(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0;
}

function describe(value: unknown): string {
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function check(
  issues: string[],
  label: string,
  value: unknown,
  predicate: (candidate: unknown) => boolean,
  expectation: string,
): void {
  if (!predicate(value)) {
    issues.push(`${label} must be ${expectation} (received ${describe(value)})`);
  }
}

/**
 * Validates a single behavior profile. Optional fields are only checked when
 * present; required fields are always checked.
 */
function validateProfile(issues: string[], label: string, profile: UnknownRecord): void {
  const range = profile.desiredRange;
  if (
    !Array.isArray(range) ||
    range.length !== 2 ||
    !isNonNegativeFinite(range[0]) ||
    !isFiniteNumber(range[1]) ||
    !(range[0] < range[1])
  ) {
    issues.push(
      `${label}.desiredRange must be a 2-tuple with 0 <= min < max (received ${describe(range)})`,
    );
  }

  check(issues, `${label}.orbit`, profile.orbit, isNonNegativeFinite, 'a finite number >= 0');
  check(issues, `${label}.aggression`, profile.aggression, isInUnitInterval, 'a number in [0, 1]');
  check(issues, `${label}.patience`, profile.patience, isInUnitInterval, 'a number in [0, 1]');
  check(issues, `${label}.dodgeFreq`, profile.dodgeFreq, isInUnitInterval, 'a number in [0, 1]');
  check(
    issues,
    `${label}.verticalManeuver`,
    profile.verticalManeuver,
    isInUnitInterval,
    'a number in [0, 1]',
  );

  const classBias = profile.classBias;
  if (!isRecord(classBias)) {
    issues.push(
      `${label}.classBias must be an object of finite numbers (received ${describe(classBias)})`,
    );
  } else {
    for (const [hull, bias] of Object.entries(classBias)) {
      check(issues, `${label}.classBias.${hull}`, bias, isFiniteNumber, 'a finite number');
    }
  }

  check(
    issues,
    `${label}.style`,
    profile.style,
    (value) => typeof value === 'string' && BEHAVIOR_STYLES.has(value),
    'one of brawler | kiter | artillery | escort',
  );

  const gates = profile.gates;
  if (gates !== undefined) {
    if (!isRecord(gates)) {
      issues.push(`${label}.gates must be an object when present (received ${describe(gates)})`);
    } else if (gates.hpRetreatPct !== undefined) {
      check(
        issues,
        `${label}.gates.hpRetreatPct`,
        gates.hpRetreatPct,
        isInUnitInterval,
        'a number in [0, 1]',
      );
    }
  }

  if (profile.elevationPreference !== undefined) {
    check(
      issues,
      `${label}.elevationPreference`,
      profile.elevationPreference,
      (value) => typeof value === 'string' && ELEVATION_PREFERENCES.has(value),
      'one of above | below | follow',
    );
  }

  if (profile.bandPreference !== undefined) {
    check(
      issues,
      `${label}.bandPreference`,
      profile.bandPreference,
      (value) => typeof value === 'string' && BAND_PREFERENCES.has(value),
      'one of outer | mid | inner',
    );
  }
}

/**
 * Validates the `AI_PROFILES` tunables. Returns an empty array when every
 * profile satisfies the declared schema.
 *
 * @param {Record<string, BehaviorProfile>} profiles - The profile map to validate.
 * @returns {string[]} Human-readable issue strings (empty = valid).
 */
export function validateAiProfiles(profiles: Record<string, BehaviorProfile>): string[] {
  const issues: string[] = [];
  const source = profiles as unknown;

  if (!isRecord(source)) {
    issues.push(`AI_PROFILES must be an object (received ${describe(source)})`);
    return issues;
  }

  for (const [id, profile] of Object.entries(source)) {
    const label = `AI_PROFILES.${id}`;
    if (!isRecord(profile)) {
      issues.push(`${label} must be a behavior profile object (received ${describe(profile)})`);
      continue;
    }
    validateProfile(issues, label, profile);
  }

  return issues;
}

function validateProfileModifiers(issues: string[], label: string, profile: UnknownRecord): void {
  const multipliers = [
    'aggressionMultiplier',
    'patienceMultiplier',
    'desiredRangeScale',
    'orbitMultiplier',
  ] as const;
  for (const key of multipliers) {
    if (profile[key] !== undefined) {
      check(issues, `${label}.${key}`, profile[key], isPositiveFinite, 'a positive finite number');
    }
  }

  const offsets = ['desiredRangeOffset', 'engagementBiasBonus'] as const;
  for (const key of offsets) {
    if (profile[key] !== undefined) {
      check(issues, `${label}.${key}`, profile[key], isFiniteNumber, 'a finite number');
    }
  }

  if (profile.bandPreference !== undefined) {
    check(
      issues,
      `${label}.bandPreference`,
      profile.bandPreference,
      (value) => typeof value === 'string' && BAND_PREFERENCES.has(value),
      'one of outer | mid | inner',
    );
  }
}

function validateThreatModifiers(issues: string[], label: string, threat: UnknownRecord): void {
  const multipliers = [
    'focusPenaltyMultiplier',
    'vipBonusMultiplier',
    'distanceScaleMultiplier',
  ] as const;
  for (const key of multipliers) {
    if (threat[key] !== undefined) {
      check(issues, `${label}.${key}`, threat[key], isPositiveFinite, 'a positive finite number');
    }
  }

  if (threat.hullBiasAdd !== undefined) {
    if (!isRecord(threat.hullBiasAdd)) {
      issues.push(
        `${label}.hullBiasAdd must be an object of finite numbers (received ${describe(threat.hullBiasAdd)})`,
      );
    } else {
      for (const [hull, bias] of Object.entries(threat.hullBiasAdd)) {
        check(issues, `${label}.hullBiasAdd.${hull}`, bias, isFiniteNumber, 'a finite number');
      }
    }
  }
}

function validateSquadDirectives(issues: string[], label: string, squad: UnknownRecord): void {
  if (squad.escortReserveRatio !== undefined) {
    check(
      issues,
      `${label}.escortReserveRatio`,
      squad.escortReserveRatio,
      isInUnitInterval,
      'a number in [0, 1]',
    );
  }

  if (squad.postureOverride !== undefined) {
    check(
      issues,
      `${label}.postureOverride`,
      squad.postureOverride,
      (value) => typeof value === 'string' && TEAM_POSTURES.has(value),
      'one of aggressive | hold | retreat',
    );
  }
}

function validateSensorModifiers(issues: string[], label: string, sensor: UnknownRecord): void {
  const multipliers = ['detectionMultiplier', 'contactRetentionMultiplier'] as const;
  for (const key of multipliers) {
    if (sensor[key] !== undefined) {
      check(issues, `${label}.${key}`, sensor[key], isPositiveFinite, 'a positive finite number');
    }
  }

  if (sensor.stealthBonus !== undefined) {
    check(issues, `${label}.stealthBonus`, sensor.stealthBonus, isFiniteNumber, 'a finite number');
  }
}

/**
 * Validates the `DOCTRINE_CARDS` tunables. Returns an empty array when every
 * card satisfies the declared schema.
 *
 * @param {Record<DoctrineCardId, DoctrineCard>} cards - The doctrine card map to validate.
 * @returns {string[]} Human-readable issue strings (empty = valid).
 */
export function validateDoctrineCards(cards: Record<DoctrineCardId, DoctrineCard>): string[] {
  const issues: string[] = [];
  const source = cards as unknown;

  if (!isRecord(source)) {
    issues.push(`DOCTRINE_CARDS must be an object (received ${describe(source)})`);
    return issues;
  }

  for (const [id, card] of Object.entries(source)) {
    const label = `DOCTRINE_CARDS.${id}`;
    if (!isRecord(card)) {
      issues.push(`${label} must be a doctrine card object (received ${describe(card)})`);
      continue;
    }

    if (card.id !== id) {
      issues.push(`${label}.id must match its key (received ${describe(card.id)})`);
    }

    if (card.profile !== undefined) {
      if (!isRecord(card.profile)) {
        issues.push(
          `${label}.profile must be an object when present (received ${describe(card.profile)})`,
        );
      } else {
        validateProfileModifiers(issues, `${label}.profile`, card.profile);
      }
    }

    if (card.threat !== undefined) {
      if (!isRecord(card.threat)) {
        issues.push(
          `${label}.threat must be an object when present (received ${describe(card.threat)})`,
        );
      } else {
        validateThreatModifiers(issues, `${label}.threat`, card.threat);
      }
    }

    if (card.squad !== undefined) {
      if (!isRecord(card.squad)) {
        issues.push(
          `${label}.squad must be an object when present (received ${describe(card.squad)})`,
        );
      } else {
        validateSquadDirectives(issues, `${label}.squad`, card.squad);
      }
    }

    if (card.sensor !== undefined) {
      if (!isRecord(card.sensor)) {
        issues.push(
          `${label}.sensor must be an object when present (received ${describe(card.sensor)})`,
        );
      } else {
        validateSensorModifiers(issues, `${label}.sensor`, card.sensor);
      }
    }
  }

  return issues;
}
