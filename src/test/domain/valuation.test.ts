import { describe, expect, it } from 'vitest';

import {
  calculatePlayerValuation,
  calculateWeightedRecentForm,
  DEFAULT_VALUATION_RULE_SET,
  type RecentAppearance
} from '../../domain/valuation';

const fiveAppearances = (percentile: number): RecentAppearance[] =>
  Array.from({ length: 5 }, () => ({
    performancePercentile: percentile,
    minutes: 90,
    started: true
  }));

describe('calculateWeightedRecentForm', () => {
  it('weights the newest of approximately five appearances most heavily', () => {
    const result = calculateWeightedRecentForm([
      { performancePercentile: 1, minutes: 90 },
      { performancePercentile: 0.8, minutes: 90 },
      { performancePercentile: 0.6, minutes: 90 },
      { performancePercentile: 0.4, minutes: 90 },
      { performancePercentile: 0.2, minutes: 90 },
      // Older appearances are deliberately ignored by the five-value rule.
      { performancePercentile: 0, minutes: 90 }
    ]);

    expect(result.rawPercentile).toBeCloseTo(11 / 15, 8);
    expect(result.adjustedPercentile).toBeCloseTo(11 / 15, 8);
    expect(result.appearancesUsed).toBe(5);
    expect(result.sampleMinutes).toBe(450);
    expect(result.sampleReliability).toBe(1);
  });

  it('blends a tiny per-90 sample strongly toward neutral', () => {
    const result = calculateWeightedRecentForm([{ performancePercentile: 1, minutes: 45 }]);

    expect(result.rawPercentile).toBe(1);
    expect(result.sampleReliability).toBe(0.1);
    expect(result.adjustedPercentile).toBeCloseTo(0.55, 8);
  });

  it('uses a neutral fallback rather than fabricating form for missing data', () => {
    const result = calculateWeightedRecentForm([{ performancePercentile: null, minutes: 90 }]);

    expect(result).toMatchObject({
      rawPercentile: null,
      adjustedPercentile: 0.5,
      sampleMinutes: 0,
      sampleReliability: 0,
      appearancesUsed: 0
    });
  });
});

describe('calculatePlayerValuation', () => {
  it('uses the documented 45/35/15/5 component weights', () => {
    const result = calculatePlayerValuation({
      position: 'MID',
      currentValueMinor: 600_000_000,
      seasonPerformancePercentile: 0.75,
      seasonMinutes: 900,
      recentAppearances: fiveAppearances(0.7),
      playingTimeReliability: 0.8,
      availability: 1
    });

    expect(
      Object.fromEntries(
        result.components.map((component) => [component.component, component.weight])
      )
    ).toEqual({
      seasonPerformance: 0.45,
      recentForm: 0.35,
      playingTimeReliability: 0.15,
      availability: 0.05
    });
    expect(result.components.reduce((total, component) => total + component.weight, 0)).toBe(1);
  });

  it('maps fully strong evidence to the configured maximum target', () => {
    const result = calculatePlayerValuation({
      position: 'FWD',
      currentValueMinor: 700_000_000,
      seasonPerformancePercentile: 1,
      seasonMinutes: 900,
      recentAppearances: fiveAppearances(1),
      playingTimeReliability: 1,
      availability: 1
    });

    expect(result.normalTargetValueMinor).toBe(DEFAULT_VALUATION_RULE_SET.maximumValueMinor);
    expect(result.targetValueMinor).toBe(DEFAULT_VALUATION_RULE_SET.maximumValueMinor);
  });

  it('maps fully weak evidence to the configured minimum target', () => {
    const result = calculatePlayerValuation({
      position: 'GK',
      currentValueMinor: 400_000_000,
      seasonPerformancePercentile: 0,
      seasonMinutes: 900,
      recentAppearances: fiveAppearances(0),
      playingTimeReliability: 0,
      availability: 0
    });

    expect(result.normalTargetValueMinor).toBe(DEFAULT_VALUATION_RULE_SET.minimumValueMinor);
  });

  it('caps a normal nightly rise at exactly five percent', () => {
    const result = calculatePlayerValuation({
      position: 'FWD',
      currentValueMinor: 500_000_000,
      seasonPerformancePercentile: 1,
      seasonMinutes: 900,
      recentAppearances: fiveAppearances(1),
      playingTimeReliability: 1,
      availability: 1
    });

    expect(result.previousValueMinor).toBe(500_000_000);
    expect(result.currentValueMinor).toBe(525_000_000);
    expect(result.valueChangeAmountMinor).toBe(25_000_000);
    expect(result.valueChangePercentage).toBe(5);
    expect(result.dailyCapApplied).toBe(true);
    expect(result.explanation).toContainEqual(
      expect.objectContaining({ code: 'daily-movement-cap' })
    );
  });

  it('caps a normal nightly fall at exactly five percent', () => {
    const result = calculatePlayerValuation({
      position: 'MID',
      currentValueMinor: 600_000_000,
      seasonPerformancePercentile: 0,
      seasonMinutes: 900,
      recentAppearances: fiveAppearances(0),
      playingTimeReliability: 0,
      availability: 0
    });

    expect(result.currentValueMinor).toBe(570_000_000);
    expect(result.valueChangeAmountMinor).toBe(-30_000_000);
    expect(result.valueChangePercentage).toBe(-5);
    expect(result.dailyCapApplied).toBe(true);
  });

  it('keeps a no-data player at a provisional position baseline', () => {
    const result = calculatePlayerValuation({
      position: 'DEF',
      seasonPerformancePercentile: null,
      seasonMinutes: 0,
      recentAppearances: [],
      playingTimeReliability: null,
      availability: null
    });

    expect(result.initialValueMinor).toBe(500_000_000);
    expect(result.previousValueMinor).toBe(500_000_000);
    expect(result.targetValueMinor).toBe(500_000_000);
    expect(result.currentValueMinor).toBe(500_000_000);
    expect(result.provisional).toBe(true);
    expect(result.explanation).toContainEqual(
      expect.objectContaining({ code: 'provisional-baseline' })
    );
  });

  it('allows an audited administrator correction to bypass the daily cap', () => {
    const result = calculatePlayerValuation({
      position: 'DEF',
      currentValueMinor: 500_000_000,
      seasonPerformancePercentile: 0.5,
      seasonMinutes: 900,
      recentAppearances: fiveAppearances(0.5),
      playingTimeReliability: 0.5,
      availability: 0.5,
      adminOverride: {
        valueMinor: 2_000_000_000,
        reason: 'Correct an imported season mapping',
        bypassDailyCap: true
      }
    });

    expect(result.targetValueMinor).toBe(2_000_000_000);
    expect(result.currentValueMinor).toBe(2_000_000_000);
    expect(result.adminOverrideApplied).toBe(true);
    expect(result.dailyCapApplied).toBe(false);
    const overrideExplanation = result.explanation.find(
      (item) => item.code === 'administrator-override'
    );
    expect(overrideExplanation?.details.reason).toBe('Correct an imported season mapping');
    expect(overrideExplanation?.details.bypassDailyCap).toBe(true);
  });

  it('still caps an administrator target when bypass was not authorised', () => {
    const result = calculatePlayerValuation({
      position: 'DEF',
      currentValueMinor: 500_000_000,
      seasonPerformancePercentile: 0.5,
      seasonMinutes: 900,
      recentAppearances: fiveAppearances(0.5),
      playingTimeReliability: 0.5,
      availability: 0.5,
      adminOverride: {
        valueMinor: 2_000_000_000,
        reason: 'Set a reviewed target'
      }
    });

    expect(result.targetValueMinor).toBe(2_000_000_000);
    expect(result.currentValueMinor).toBe(525_000_000);
    expect(result.dailyCapApplied).toBe(true);
  });

  it('stores a structured availability reduction', () => {
    const result = calculatePlayerValuation({
      position: 'FWD',
      currentValueMinor: 700_000_000,
      seasonPerformancePercentile: 0.5,
      seasonMinutes: 900,
      recentAppearances: fiveAppearances(0.5),
      playingTimeReliability: 0.5,
      availability: 0
    });
    const availability = result.components.find(
      (component) => component.component === 'availability'
    );

    expect(availability).toMatchObject({
      rawPercentile: 0,
      adjustedPercentile: 0,
      weight: 0.05,
      contributionMinor: -32_500_000
    });
    expect(result.explanation).toContainEqual(
      expect.objectContaining({
        code: 'availability',
        direction: 'decrease',
        impactMinor: -32_500_000
      })
    );
  });

  it('protects the target from overreacting to one exceptional short appearance', () => {
    const result = calculatePlayerValuation({
      position: 'MID',
      currentValueMinor: 600_000_000,
      seasonPerformancePercentile: 0.5,
      seasonMinutes: 900,
      recentAppearances: [{ performancePercentile: 1, minutes: 90, started: true }],
      playingTimeReliability: 0.5,
      availability: 0.5
    });
    const recent = result.components.find((component) => component.component === 'recentForm');

    expect(recent).toMatchObject({
      rawPercentile: 1,
      adjustedPercentile: 0.6,
      sampleReliability: 0.2
    });
    expect(result.normalTargetValueMinor).toBeLessThan(800_000_000);
  });

  it('requires a reason for every administrator override', () => {
    expect(() =>
      calculatePlayerValuation({
        position: 'GK',
        seasonPerformancePercentile: null,
        seasonMinutes: 0,
        recentAppearances: [],
        playingTimeReliability: null,
        availability: null,
        adminOverride: { valueMinor: 1_000_000_000, reason: '  ' }
      })
    ).toThrow('requires a reason');
  });
});
