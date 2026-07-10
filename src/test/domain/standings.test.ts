import { describe, expect, it } from 'vitest';

import {
  buildCompetitionStandings,
  buildOverallStandings,
  rankStandings,
  type ClubRoundScore,
  type StandingClub
} from '../../domain/standings';

describe('standings ranking rules', () => {
  it('ranks by total points first', () => {
    const result = rankStandings([
      {
        clubId: 'a',
        clubName: 'Albion',
        totalPoints: 50,
        victoryCount: 9,
        highestSingleRoundScore: 20
      },
      {
        clubId: 'b',
        clubName: 'Borough',
        totalPoints: 51,
        victoryCount: 0,
        highestSingleRoundScore: 1
      }
    ]);
    expect(result.map((standing) => standing.clubId)).toEqual(['b', 'a']);
  });

  it('uses wins/first-place finishes, then highest round, then club name', () => {
    const result = rankStandings([
      {
        clubId: 'alphabetical-second',
        clubName: 'Borough',
        totalPoints: 50,
        victoryCount: 2,
        highestSingleRoundScore: 12
      },
      {
        clubId: 'more-wins',
        clubName: 'Zephyrs',
        totalPoints: 50,
        victoryCount: 3,
        highestSingleRoundScore: 5
      },
      {
        clubId: 'higher-round',
        clubName: 'Rovers',
        totalPoints: 50,
        victoryCount: 2,
        highestSingleRoundScore: 13
      },
      {
        clubId: 'alphabetical-first',
        clubName: 'Athletic',
        totalPoints: 50,
        victoryCount: 2,
        highestSingleRoundScore: 12
      }
    ]);
    expect(result.map((standing) => standing.clubId)).toEqual([
      'more-wins',
      'higher-round',
      'alphabetical-first',
      'alphabetical-second'
    ]);
    expect(result.map((standing) => standing.rank)).toEqual([1, 2, 3, 4]);
  });

  it('does not mutate the input order and rejects duplicate clubs', () => {
    const candidates = [
      {
        clubId: 'b',
        clubName: 'B',
        totalPoints: 1,
        victoryCount: 0,
        highestSingleRoundScore: 1
      },
      {
        clubId: 'a',
        clubName: 'A',
        totalPoints: 2,
        victoryCount: 0,
        highestSingleRoundScore: 2
      }
    ] as const;
    rankStandings(candidates);
    expect(candidates[0].clubId).toBe('b');
    expect(() => rankStandings([candidates[0], candidates[0]])).toThrow(/more than once/);
  });
});

describe('recomputed overall and competition tables', () => {
  const clubs: readonly StandingClub[] = [
    { clubId: 'a', clubName: 'Albion' },
    { clubId: 'b', clubName: 'Borough' },
    { clubId: 'c', clubName: 'City' }
  ];
  const scores: readonly ClubRoundScore[] = [
    { competitionId: 'league', roundId: 'l1', clubId: 'a', points: 10 },
    { competitionId: 'league', roundId: 'l1', clubId: 'b', points: 8 },
    { competitionId: 'league', roundId: 'l1', clubId: 'c', points: 6 },
    { competitionId: 'league', roundId: 'l2', clubId: 'a', points: 5 },
    { competitionId: 'league', roundId: 'l2', clubId: 'b', points: 7 },
    { competitionId: 'league', roundId: 'l2', clubId: 'c', points: 3 },
    { competitionId: 'cup', roundId: 'c1', clubId: 'a', points: 1 },
    { competitionId: 'cup', roundId: 'c1', clubId: 'b', points: 1 },
    { competitionId: 'cup', roundId: 'c1', clubId: 'c', points: 9 }
  ];

  it('derives totals, first-place finishes, competition wins and highest round', () => {
    const result = buildOverallStandings(clubs, scores, [
      { competitionId: 'league', clubId: 'a' },
      { competitionId: 'cup', clubId: 'c' }
    ]);
    expect(result.find((standing) => standing.clubId === 'a')).toMatchObject({
      totalPoints: 16,
      victoryCount: 2,
      highestSingleRoundScore: 10
    });
    expect(result.find((standing) => standing.clubId === 'b')).toMatchObject({
      totalPoints: 16,
      victoryCount: 1,
      highestSingleRoundScore: 8
    });
    expect(result.map((standing) => standing.clubId)).toEqual(['c', 'a', 'b']);
  });

  it("builds each competition table from only that competition's points", () => {
    const league = buildCompetitionStandings(clubs, scores, 'league');
    const cup = buildCompetitionStandings(clubs, scores, 'cup');
    expect(league.map(({ clubId, totalPoints }) => [clubId, totalPoints])).toEqual([
      ['a', 15],
      ['b', 15],
      ['c', 9]
    ]);
    expect(cup.map(({ clubId, totalPoints }) => [clubId, totalPoints])).toEqual([
      ['c', 9],
      ['a', 1],
      ['b', 1]
    ]);
  });

  it('treats tied top round scores as first-place finishes', () => {
    const result = buildOverallStandings(clubs, [
      { competitionId: 'cup', roundId: 'r1', clubId: 'a', points: 5 },
      { competitionId: 'cup', roundId: 'r1', clubId: 'b', points: 5 },
      { competitionId: 'cup', roundId: 'r1', clubId: 'c', points: 2 }
    ]);
    expect(result.find((standing) => standing.clubId === 'a')?.victoryCount).toBe(1);
    expect(result.find((standing) => standing.clubId === 'b')?.victoryCount).toBe(1);
  });
});
