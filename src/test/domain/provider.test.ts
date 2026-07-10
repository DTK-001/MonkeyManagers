import { describe, expect, it } from 'vitest';

import {
  buildCompetitionCoverageReport,
  globallySupportedCoverageMetrics,
  normalizeApiFootballFixture,
  normalizeApiFootballFixturePlayerResponse,
  ProviderNormalizationError,
  toScoringPosition,
  toScoringStatistics
} from '../../domain/provider';

const context = {
  fixtureProviderId: 8_001,
  competitionProviderId: 39,
  season: 2026,
  syncedAt: '2026-07-10T03:30:00.000Z'
} as const;

function responseWithStatistic(statistic: Record<string, unknown>): unknown {
  return {
    response: [
      {
        team: { id: 101, name: 'Northbridge Athletic' },
        players: [
          {
            player: { id: 5001, name: 'Alex Vale' },
            statistics: [statistic]
          }
        ]
      }
    ]
  };
}

describe('API-Football response normalization', () => {
  it('normalizes documented nested fields and labels safe calculations', () => {
    const payload = responseWithStatistic({
      games: {
        minutes: 90,
        number: 8,
        position: 'M',
        rating: '7.8',
        captain: false,
        substitute: false
      },
      shots: { total: 4, on: 2 },
      goals: { total: 1, assists: 1 },
      passes: { total: 40, key: 3, accuracy: '80%' },
      tackles: { total: 4, blocks: 1, interceptions: 2 },
      duels: { total: 8, won: 5 },
      dribbles: { attempts: 5, success: 3 },
      fouls: { drawn: 2, committed: 1 },
      cards: { yellow: 1, red: 0 },
      penalty: { won: 0, commited: 1, scored: 0, missed: 0, saved: 0 }
    });

    const result = normalizeApiFootballFixturePlayerResponse(payload, context);
    expect(result.issues).toEqual([]);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      fixtureProviderId: 8_001,
      competitionProviderId: 39,
      teamProviderId: 101,
      playerProviderId: 5001,
      position: 'midfielder',
      appeared: true,
      started: true,
      minutes: 90,
      goals: 1,
      completedPasses: 32,
      completedPassesSource: 'calculated',
      failedDribbles: 2,
      failedDribblesSource: 'calculated',
      penaltiesConceded: 1
    });
    const record = result.records[0];
    if (record === undefined) throw new Error('expected a normalized record');
    expect(toScoringPosition(record.position)).toBe('MID');
    expect(toScoringStatistics(record)).toMatchObject({
      goals: 1,
      assists: 1,
      secondYellowDismissals: null,
      penaltiesConceded: 1
    });
  });

  it('keeps unavailable metrics null and never turns missing data into zero', () => {
    const result = normalizeApiFootballFixturePlayerResponse(
      responseWithStatistic({
        games: { minutes: null, position: 'F', substitute: null },
        goals: { total: null, assists: null },
        passes: { total: null, accuracy: null }
      }),
      context
    );
    const record = result.records[0];
    expect(record).toBeDefined();
    expect(record).toMatchObject({
      appeared: null,
      started: null,
      minutes: null,
      goals: null,
      assists: null,
      tackles: null,
      completedPasses: null,
      completedPassesSource: null,
      possessionLost: null,
      cleanSheet: null
    });
  });

  it('preserves a provider-supplied completed-pass value without recalculating', () => {
    const result = normalizeApiFootballFixturePlayerResponse(
      responseWithStatistic({
        games: { minutes: 45, position: 'D', substitute: true },
        passes: { total: 31, completed: 23, accuracy: '74%' }
      }),
      context
    );
    expect(result.records[0]).toMatchObject({
      substitute: true,
      started: false,
      completedPasses: 23,
      completedPassesSource: 'provider'
    });
  });

  it('reports malformed blocks while still importing other valid players', () => {
    const payload = {
      response: [
        {
          team: { id: 101 },
          players: [
            { player: { name: 'Missing ID' }, statistics: [{ games: {} }] },
            {
              player: { id: 5002, name: 'Valid Player' },
              statistics: [{ games: { minutes: 10, position: 'F' } }]
            }
          ]
        }
      ]
    };
    const result = normalizeApiFootballFixturePlayerResponse(payload, context);
    expect(result.records.map((record) => record.playerProviderId)).toEqual([5002]);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]?.code).toBe('MISSING_ID');
  });

  it('rejects a non-array provider response with a useful issue', () => {
    const result = normalizeApiFootballFixturePlayerResponse({ response: null }, context);
    expect(result.records).toEqual([]);
    expect(result.issues[0]).toMatchObject({
      path: 'response',
      code: 'INVALID_SHAPE'
    });
  });
});

describe('fixture and coverage normalization', () => {
  const baseFixture = {
    fixture: {
      id: 8001,
      date: '2026-07-09T19:45:00+00:00',
      timezone: 'UTC',
      status: { long: 'Match Finished', short: 'FT', elapsed: 90 }
    },
    league: { id: 39, season: 2026, round: 'Regular Season - 1' },
    teams: { home: { id: 101 }, away: { id: 102 } },
    goals: { home: 2, away: 1 }
  };

  it('marks only completed fixture statuses as eligible for scoring', () => {
    expect(normalizeApiFootballFixture(baseFixture, context.syncedAt)).toMatchObject({
      fixtureProviderId: 8001,
      competitionProviderId: 39,
      completed: true,
      eligibleForScoring: true,
      homeGoals: 2,
      awayGoals: 1
    });

    const postponed = normalizeApiFootballFixture(
      {
        ...baseFixture,
        fixture: {
          ...baseFixture.fixture,
          status: { long: 'Match Postponed', short: 'PST', elapsed: null }
        }
      },
      context.syncedAt
    );
    expect(postponed.completed).toBe(false);
    expect(postponed.eligibleForScoring).toBe(false);
  });

  it('throws a typed normalization error when stable external IDs are absent', () => {
    expect(() =>
      normalizeApiFootballFixture(
        { ...baseFixture, fixture: { ...baseFixture.fixture, id: null } },
        context.syncedAt
      )
    ).toThrow(ProviderNormalizationError);
  });

  it('only enables metrics consistently covered in every competition', () => {
    const first = normalizeApiFootballFixturePlayerResponse(
      responseWithStatistic({
        games: { minutes: 90, position: 'M' },
        goals: { total: 1 },
        shots: { total: 2 }
      }),
      context
    ).records[0];
    const second = normalizeApiFootballFixturePlayerResponse(
      responseWithStatistic({
        games: { minutes: 80, position: 'M' },
        goals: { total: 0 }
      }),
      { ...context, competitionProviderId: 2 }
    ).records[0];
    if (first === undefined || second === undefined) {
      throw new Error('normalization test fixture failed');
    }
    const report = buildCompetitionCoverageReport([first, second]);
    expect(globallySupportedCoverageMetrics(report, 1)).toContain('goals');
    expect(globallySupportedCoverageMetrics(report, 1)).not.toContain('shots');
  });
});
