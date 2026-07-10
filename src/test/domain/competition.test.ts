import { describe, expect, it } from 'vitest';

import {
  aggregateClubCompetitionTotals,
  allocatePointsToFixtureCompetitions,
  pointsForCompetition,
  type FixtureCompetitionAssignment
} from '../../domain/competition';

const fixtures: readonly FixtureCompetitionAssignment[] = [
  {
    fixtureId: 'league-fixture',
    competitionId: 'premier-league',
    roundId: 'pl-1',
    completed: true
  },
  {
    fixtureId: 'cup-fixture',
    competitionId: 'fa-cup',
    roundId: 'fac-r3',
    completed: true
  }
];

describe('competition-specific point allocation', () => {
  it('uses the fixture competition even when the same player plays in both', () => {
    const result = allocatePointsToFixtureCompetitions(fixtures, [
      {
        fixtureId: 'league-fixture',
        playerId: 'player-1',
        points: 8.123,
        scoringRuleVersionId: 'rules-v1'
      },
      {
        fixtureId: 'cup-fixture',
        playerId: 'player-1',
        points: 5.456,
        scoringRuleVersionId: 'rules-v1'
      }
    ]);

    expect(pointsForCompetition(result.records, 'premier-league')).toMatchObject([
      { fixtureId: 'league-fixture', playerId: 'player-1', points: 8.12 }
    ]);
    expect(pointsForCompetition(result.records, 'fa-cup')).toMatchObject([
      { fixtureId: 'cup-fixture', playerId: 'player-1', points: 5.46 }
    ]);
  });

  it('rejects an upstream attempt to put points into another competition', () => {
    expect(() =>
      allocatePointsToFixtureCompetitions(fixtures, [
        {
          fixtureId: 'cup-fixture',
          playerId: 'player-1',
          points: 5,
          scoringRuleVersionId: 'rules-v1',
          reportedCompetitionId: 'premier-league'
        }
      ])
    ).toThrow(/wrong competition/);
  });

  it('is idempotent and updates provider corrections rather than duplicating', () => {
    const score = {
      fixtureId: 'league-fixture',
      playerId: 'player-1',
      points: 4,
      scoringRuleVersionId: 'rules-v1'
    } as const;
    const first = allocatePointsToFixtureCompetitions(fixtures, [score]);
    const replay = allocatePointsToFixtureCompetitions(fixtures, [score], first.records);
    const correction = allocatePointsToFixtureCompetitions(
      fixtures,
      [{ ...score, points: 7 }],
      replay.records
    );

    expect(replay).toMatchObject({ inserted: 0, updated: 0, unchanged: 1 });
    expect(replay.records).toHaveLength(1);
    expect(correction).toMatchObject({ inserted: 0, updated: 1 });
    expect(correction.records[0]?.points).toBe(7);
  });

  it('does not score unfinished or unassigned fixtures', () => {
    const score = {
      fixtureId: 'upcoming',
      playerId: 'player-1',
      points: 4,
      scoringRuleVersionId: 'rules-v1'
    } as const;
    expect(() =>
      allocatePointsToFixtureCompetitions(
        [
          {
            fixtureId: 'upcoming',
            competitionId: 'premier-league',
            roundId: 'pl-2',
            completed: false
          }
        ],
        [score]
      )
    ).toThrow(/not completed/);
    expect(() => allocatePointsToFixtureCompetitions(fixtures, [score])).toThrow(
      /no competition assignment/
    );
  });

  it('aggregates club totals independently for each competition and round', () => {
    expect(
      aggregateClubCompetitionTotals([
        {
          clubId: 'club-a',
          competitionId: 'premier-league',
          roundId: 'pl-1',
          playerId: 'player-1',
          points: 7.1
        },
        {
          clubId: 'club-a',
          competitionId: 'premier-league',
          roundId: 'pl-1',
          playerId: 'player-2',
          points: 2.2
        },
        {
          clubId: 'club-a',
          competitionId: 'fa-cup',
          roundId: 'fac-r3',
          playerId: 'player-1',
          points: 5
        }
      ])
    ).toEqual([
      {
        clubId: 'club-a',
        competitionId: 'fa-cup',
        points: 5,
        roundPoints: { 'fac-r3': 5 }
      },
      {
        clubId: 'club-a',
        competitionId: 'premier-league',
        points: 9.3,
        roundPoints: { 'pl-1': 9.3 }
      }
    ]);
  });
});
