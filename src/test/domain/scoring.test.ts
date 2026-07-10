import { describe, expect, it } from 'vitest';

import {
  calculatePlayerMatchScore,
  DEFAULT_SCORING_RULE_SET,
  scorePlayerMatch,
  type PlayerPosition,
  type ScoringRuleSet
} from '../../domain/scoring';

describe('calculatePlayerMatchScore', () => {
  it('scores a goalkeeper with position-specific goalkeeping rules', () => {
    const result = calculatePlayerMatchScore({
      position: 'GK',
      statistics: {
        appeared: true,
        minutes: 90,
        started: true,
        saves: 4,
        penaltySaves: 1,
        goalsConceded: 0,
        cleanSheet: true
      }
    });

    expect(result.ruleVersion).toBe('default-2026.1');
    expect(result.total).toBe(13);
    expect(result.breakdown).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ metric: 'saves', points: 2 }),
        expect.objectContaining({ metric: 'penaltySaves', points: 5 }),
        expect.objectContaining({ metric: 'cleanSheet', points: 4 })
      ])
    );
  });

  it.each<[PlayerPosition, number]>([
    ['GK', 8],
    ['DEF', 6],
    ['MID', 5],
    ['FWD', 4]
  ])('uses the configured %s goal value', (position, goalPoints) => {
    const result = scorePlayerMatch({ goals: 1 }, position);

    expect(result.total).toBe(goalPoints);
    expect(result.breakdown).toContainEqual(
      expect.objectContaining({ metric: 'goals', unitPoints: goalPoints })
    );
  });

  it('combines defender actions and negative events as decimal contributions', () => {
    const result = scorePlayerMatch(
      {
        appeared: true,
        minutes: 90,
        started: true,
        tackles: 4,
        interceptions: 3,
        yellowCards: 1
      },
      'DEF'
    );

    expect(result.total).toBe(3.6);
    expect(result.breakdown).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ metric: 'tackles', points: 1.4 }),
        expect.objectContaining({ metric: 'interceptions', points: 1.2 }),
        expect.objectContaining({ metric: 'yellowCards', points: -1 })
      ])
    );
  });

  it('keeps null and missing provider fields unavailable instead of inventing zeroes', () => {
    const result = scorePlayerMatch(
      {
        appeared: null,
        minutes: null,
        tackles: null,
        possessionLost: undefined
      },
      'MID'
    );

    expect(result.total).toBe(0);
    expect(Number.isFinite(result.total)).toBe(true);
    expect(result.missingMetrics).toEqual(
      expect.arrayContaining([
        'appearance',
        'minutesPlayed',
        'playedAtLeast60',
        'tackles',
        'possessionLost'
      ])
    );
    expect(result.availableMetrics).not.toContain('possessionLost');
  });

  it('marks safe derivations rather than presenting them as provider fields', () => {
    const result = scorePlayerMatch(
      {
        minutes: 12,
        passesAttempted: 40,
        passCompletionPercentage: 80
      },
      'MID'
    );

    expect(result.breakdown).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          metric: 'appearance',
          source: 'derived',
          sourceValue: true
        }),
        expect.objectContaining({
          metric: 'completedPasses',
          source: 'derived',
          sourceValue: 32
        })
      ])
    );
  });

  it('prefers explicitly supplied completed passes over a derivation', () => {
    const result = scorePlayerMatch(
      {
        passesAttempted: 40,
        passCompletionPercentage: 80,
        completedPasses: 29
      },
      'MID'
    );

    expect(result.breakdown).toContainEqual(
      expect.objectContaining({
        metric: 'completedPasses',
        source: 'provided',
        sourceValue: 29
      })
    );
  });

  it('caps repetitive statistics so they cannot dominate a score', () => {
    const result = scorePlayerMatch({ keyPasses: 20 }, 'MID');
    const keyPasses = result.breakdown.find((item) => item.metric === 'keyPasses');

    expect(keyPasses).toMatchObject({
      sourceValue: 20,
      appliedValue: 6,
      points: 3,
      cap: 6,
      capApplied: true
    });
  });

  it('applies thresholds only when their sample requirement is satisfied', () => {
    const smallSample = scorePlayerMatch(
      { passesAttempted: 10, passCompletionPercentage: 90 },
      'MID'
    );
    const validSample = scorePlayerMatch(
      { passesAttempted: 20, passCompletionPercentage: 90 },
      'MID'
    );

    expect(smallSample.breakdown.some((item) => item.metric === 'passCompletionPercentage')).toBe(
      false
    );
    expect(validSample.breakdown).toContainEqual(
      expect.objectContaining({
        metric: 'passCompletionPercentage',
        thresholdMet: true,
        companionRequirementMet: true,
        points: 0.25
      })
    );
  });

  it('requires 60 minutes before a supplied clean sheet scores', () => {
    const shortAppearance = scorePlayerMatch({ minutes: 59, cleanSheet: true }, 'DEF');
    const fullAppearance = scorePlayerMatch({ minutes: 60, cleanSheet: true }, 'DEF');

    expect(shortAppearance.breakdown.some((item) => item.metric === 'cleanSheet')).toBe(false);
    expect(fullAppearance.breakdown).toContainEqual(
      expect.objectContaining({ metric: 'cleanSheet', points: 4 })
    );
  });

  it('returns the custom rule version and rounds decimal totals to two places', () => {
    const keyPassRule = DEFAULT_SCORING_RULE_SET.rules.find((rule) => rule.metric === 'keyPasses');
    expect(keyPassRule).toBeDefined();
    if (keyPassRule === undefined) {
      throw new Error('Expected the default key-pass rule.');
    }

    const customRules: ScoringRuleSet = {
      version: 'league-custom-v7',
      rules: [
        {
          ...keyPassRule,
          cap: 3,
          weights: { GK: 0.333, DEF: 0.333, MID: 0.333, FWD: 0.333 }
        }
      ]
    };
    const result = scorePlayerMatch({ keyPasses: 3 }, 'FWD', customRules);

    expect(result.ruleVersion).toBe('league-custom-v7');
    expect(result.total).toBe(1);
  });

  it('rejects ambiguous duplicate metrics in a rule version', () => {
    const firstRule = DEFAULT_SCORING_RULE_SET.rules[0];
    expect(firstRule).toBeDefined();
    if (firstRule === undefined) {
      throw new Error('Expected a default scoring rule.');
    }
    const invalidRules: ScoringRuleSet = {
      version: 'invalid',
      rules: [firstRule, firstRule]
    };

    expect(() => scorePlayerMatch({}, 'GK', invalidRules)).toThrow('Duplicate scoring metric');
  });
});
