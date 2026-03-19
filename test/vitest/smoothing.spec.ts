import { describe, it, expect } from 'vite-plus/test';
import { Vector3 } from 'three';
import { smoothHeading, smoothThrust } from '../../src/game/systems/decision/smoothing.js';
import type { AIState } from '../../src/types/index.js';

function createAI(): AIState {
  return {
    profileId: 'tester',
    intent: 'Attack',
    nextThinkAt: 0,
    cooldowns: { dodgeAt: 0, burstAt: 0 },
    lod: 0,
    traitSeed: 42,
    traits: { aggression: 0.5, patience: 0.5, dodge: 0 },
    command: {
      heading: new Vector3(0, 0, 1),
      thrust: 0,
      firePrimary: false,
      ttl: 0,
    },
    stickinessUntil: 0,
    stickinessHeading: new Vector3(),
    stickinessTargetId: undefined,
  } as unknown as AIState;
}

function meanHeadingDelta(headings: Vector3[]): number {
  if (headings.length < 2) return 0;
  let sum = 0;
  for (let i = 1; i < headings.length; i++) {
    sum += headings[i]
      .clone()
      .sub(headings[i - 1])
      .length();
  }
  return sum / (headings.length - 1);
}

describe('smoothing edge cases', () => {
  it('initializes thrust and heading on first tick (thrust-first)', () => {
    const ai = createAI();
    const rawHeading = new Vector3(1, 0, 0);

    // Call thrust smoothing first on a fresh AI: should adopt raw thrust
    const smoothed = smoothThrust(ai, 1, 0.5, 0.5, 'fighter', 1000);
    expect(smoothed).toBe(1);

    // Now call heading smoothing on the same tick, it should detect a
    // discontinuity and adopt the raw heading rather than blend.
    smoothHeading(ai, rawHeading, 0.5, 0.5, 'fighter', 1000);
    expect(rawHeading.x).toBeCloseTo(1, 6);
    expect(rawHeading.y).toBeCloseTo(0, 6);
  });

  it('initializes thrust and heading on first tick (heading-first)', () => {
    const ai = createAI();
    const rawHeading = new Vector3(0, 1, 0);

    // Heading first
    smoothHeading(ai, rawHeading, 0.5, 0.5, 'fighter', 2000);
    expect(rawHeading.y).toBeCloseTo(1, 6);

    // Thrust after
    const smoothed = smoothThrust(ai, 0.75, 0.5, 0.5, 'fighter', 2000);
    expect(smoothed).toBeCloseTo(0.75, 12);
  });

  it('immediately adopts large-angle reverse headings (no partial smoothing)', () => {
    const ai = createAI();

    // Initialize previous heading to forward
    const previous = new Vector3(0, 0, 1);
    smoothHeading(ai, previous, 0.5, 0.5, 'fighter', 10);

    // Now request a full reverse; smoothing should adopt the new heading
    const reversed = new Vector3(-1, 0, 0);
    smoothHeading(ai, reversed, 0.5, 0.5, 'fighter', 11);

    expect(reversed.x).toBeCloseTo(-1, 6);
    expect(reversed.y).toBeCloseTo(0, 6);
    expect(reversed.z).toBeCloseTo(0, 6);
  });

  it('smooths moderate-angle perturbations', () => {
    const ai = createAI();

    const rawSeq: Vector3[] = [];
    const smoothSeq: Vector3[] = [];

    // Generate a sequence of moderate vertical perturbations (small Y)
    for (let t = 0; t < 12; t++) {
      ai.command.heading.set(0, 0, 1); // base
      const y = Math.sin(t * 0.9) * 0.18; // moderate perturbation pattern
      const raw = new Vector3(0, y, 1).normalize();
      rawSeq.push(raw.clone());

      // Copy and smooth
      const sm = raw.clone();
      smoothHeading(ai, sm, 0.5, 0.5, 'fighter', 100 + t);
      smoothSeq.push(sm.clone());
    }

    const rawMean = meanHeadingDelta(rawSeq);
    const smoothMean = meanHeadingDelta(smoothSeq);

    expect(rawSeq.length).toBeGreaterThan(1);
    expect(rawMean).toBeGreaterThan(0);
    // Smoothed mean should be smaller than raw mean
    expect(smoothMean).toBeLessThan(rawMean);
  });
});
