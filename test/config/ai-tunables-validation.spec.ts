import { describe, expect, it } from 'vite-plus/test';
import { DOCTRINE_CARDS } from '../../src/game/aiDoctrine.js';
import { AI_PROFILES } from '../../src/game/aiProfiles.js';
import { validateAiProfiles, validateDoctrineCards } from '../../src/game/config.js';
import { getGameErrors } from '../../src/game/errors.js';

type MutableRecord = Record<string, unknown>;

function cloneProfiles(): Record<string, MutableRecord> {
  return structuredClone(AI_PROFILES) as unknown as Record<string, MutableRecord>;
}

function profileIssues(mutate: (profiles: Record<string, MutableRecord>) => void): string[] {
  const profiles = cloneProfiles();
  mutate(profiles);
  return validateAiProfiles(profiles as unknown as typeof AI_PROFILES);
}

/** Index a clone map without tripping `noUncheckedIndexedAccess`. */
function entry(map: Record<string, MutableRecord>, key: string): MutableRecord {
  return map[key] as MutableRecord;
}

function classBias(profile: MutableRecord): MutableRecord {
  return profile.classBias as MutableRecord;
}

function gates(profile: MutableRecord): MutableRecord {
  return profile.gates as MutableRecord;
}

function cloneCards(): Record<string, MutableRecord> {
  return structuredClone(DOCTRINE_CARDS) as unknown as Record<string, MutableRecord>;
}

function cardIssues(mutate: (cards: Record<string, MutableRecord>) => void): string[] {
  const cards = cloneCards();
  mutate(cards);
  return validateDoctrineCards(cards as unknown as typeof DOCTRINE_CARDS);
}

function section(card: MutableRecord, key: string): MutableRecord {
  return card[key] as MutableRecord;
}

describe('validateAiProfiles', () => {
  it('accepts the shipped AI_PROFILES', () => {
    expect(validateAiProfiles(AI_PROFILES)).toEqual([]);
  });

  const brokenCases: Array<{
    name: string;
    mutate: (profiles: Record<string, MutableRecord>) => void;
  }> = [
    {
      name: 'desiredRange not a 2-tuple',
      mutate: (p) => (entry(p, 'brawler').desiredRange = [100]),
    },
    {
      name: 'desiredRange min >= max',
      mutate: (p) => (entry(p, 'brawler').desiredRange = [200, 100]),
    },
    {
      name: 'desiredRange negative min',
      mutate: (p) => (entry(p, 'brawler').desiredRange = [-1, 100]),
    },
    { name: 'orbit negative', mutate: (p) => (entry(p, 'brawler').orbit = -1) },
    { name: 'orbit non-finite', mutate: (p) => (entry(p, 'brawler').orbit = Number.NaN) },
    { name: 'aggression above 1', mutate: (p) => (entry(p, 'brawler').aggression = 1.5) },
    { name: 'patience below 0', mutate: (p) => (entry(p, 'brawler').patience = -0.1) },
    {
      name: 'dodgeFreq non-finite',
      mutate: (p) => (entry(p, 'brawler').dodgeFreq = Number.POSITIVE_INFINITY),
    },
    { name: 'verticalManeuver above 1', mutate: (p) => (entry(p, 'brawler').verticalManeuver = 2) },
    {
      name: 'classBias value non-finite',
      mutate: (p) => (classBias(entry(p, 'brawler')).fighter = Number.NaN),
    },
    {
      name: 'gates.hpRetreatPct above 1',
      mutate: (p) => (gates(entry(p, 'brawler')).hpRetreatPct = 1.2),
    },
    {
      name: 'bandPreference invalid',
      mutate: (p) => (entry(p, 'brawler').bandPreference = 'wide'),
    },
    {
      name: 'elevationPreference invalid',
      mutate: (p) => (entry(p, 'brawler').elevationPreference = 'sideways'),
    },
    { name: 'style invalid', mutate: (p) => (entry(p, 'brawler').style = 'sniper') },
    { name: 'profile non-object', mutate: (p) => (p.brawler = null as unknown as MutableRecord) },
  ];

  for (const { name, mutate } of brokenCases) {
    it(`flags ${name}`, () => {
      expect(profileIssues(mutate).length).toBeGreaterThan(0);
    });
  }

  it('returns issues (never throws) for non-object input', () => {
    expect(() => validateAiProfiles(null as unknown as typeof AI_PROFILES)).not.toThrow();
    expect(() => validateAiProfiles(undefined as unknown as typeof AI_PROFILES)).not.toThrow();
    expect(validateAiProfiles(null as unknown as typeof AI_PROFILES).length).toBeGreaterThan(0);
    expect(validateAiProfiles(undefined as unknown as typeof AI_PROFILES).length).toBeGreaterThan(
      0,
    );
  });
});

describe('validateDoctrineCards', () => {
  it('accepts the shipped DOCTRINE_CARDS', () => {
    expect(validateDoctrineCards(DOCTRINE_CARDS)).toEqual([]);
  });

  const brokenCases: Array<{
    name: string;
    mutate: (cards: Record<string, MutableRecord>) => void;
  }> = [
    { name: 'card id mismatch', mutate: (c) => (entry(c, 'ambush').id = 'aggressivePush') },
    {
      name: 'profile multiplier non-positive',
      mutate: (c) => (section(entry(c, 'aggressivePush'), 'profile').aggressionMultiplier = 0),
    },
    {
      name: 'profile multiplier non-finite',
      mutate: (c) =>
        (section(entry(c, 'aggressivePush'), 'profile').patienceMultiplier = Number.NaN),
    },
    {
      name: 'profile offset non-finite',
      mutate: (c) =>
        (section(entry(c, 'aggressivePush'), 'profile').desiredRangeOffset =
          Number.POSITIVE_INFINITY),
    },
    {
      name: 'profile bandPreference invalid',
      mutate: (c) => (section(entry(c, 'aggressivePush'), 'profile').bandPreference = 'wide'),
    },
    {
      name: 'squad escortReserveRatio above 1',
      mutate: (c) => (section(entry(c, 'aggressivePush'), 'squad').escortReserveRatio = 1.5),
    },
    {
      name: 'squad escortReserveRatio below 0',
      mutate: (c) => (section(entry(c, 'elasticDefense'), 'squad').escortReserveRatio = -0.1),
    },
    {
      name: 'squad postureOverride invalid',
      mutate: (c) => (section(entry(c, 'aggressivePush'), 'squad').postureOverride = 'charge'),
    },
    {
      name: 'threat multiplier non-positive',
      mutate: (c) => (section(entry(c, 'aggressivePush'), 'threat').distanceScaleMultiplier = -1),
    },
    {
      name: 'threat multiplier non-finite',
      mutate: (c) =>
        (section(entry(c, 'elasticDefense'), 'threat').vipBonusMultiplier = Number.NaN),
    },
    {
      name: 'sensor multiplier non-positive',
      mutate: (c) => (section(entry(c, 'ambush'), 'sensor').detectionMultiplier = 0),
    },
    {
      name: 'sensor multiplier non-finite',
      mutate: (c) =>
        (section(entry(c, 'ambush'), 'sensor').contactRetentionMultiplier =
          Number.POSITIVE_INFINITY),
    },
    { name: 'card non-object', mutate: (c) => (c.ambush = null as unknown as MutableRecord) },
  ];

  for (const { name, mutate } of brokenCases) {
    it(`flags ${name}`, () => {
      expect(cardIssues(mutate).length).toBeGreaterThan(0);
    });
  }

  it('returns issues (never throws) for non-object input', () => {
    expect(() => validateDoctrineCards(null as unknown as typeof DOCTRINE_CARDS)).not.toThrow();
    expect(() =>
      validateDoctrineCards(undefined as unknown as typeof DOCTRINE_CARDS),
    ).not.toThrow();
    expect(validateDoctrineCards(null as unknown as typeof DOCTRINE_CARDS).length).toBeGreaterThan(
      0,
    );
    expect(
      validateDoctrineCards(undefined as unknown as typeof DOCTRINE_CARDS).length,
    ).toBeGreaterThan(0);
  });
});

describe('AI tunables startup wiring', () => {
  it('emits no ai-tunables-invalid reports for the shipped constants', () => {
    const tunableReports = getGameErrors(200).filter(
      (report) => report.context?.code === 'ai-tunables-invalid',
    );
    expect(tunableReports).toEqual([]);
  });
});
