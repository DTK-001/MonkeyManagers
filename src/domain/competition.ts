import { mergeIdempotentRecords } from './sync';

export type CompetitionFormat =
  | 'domestic_league'
  | 'domestic_knockout'
  | 'european_league_or_group'
  | 'european_knockout'
  | 'international_tournament';

export interface FixtureCompetitionAssignment {
  readonly fixtureId: string;
  readonly competitionId: string;
  readonly roundId: string | null;
  readonly completed: boolean;
}

export interface CalculatedPlayerMatchPoints {
  readonly fixtureId: string;
  readonly playerId: string;
  readonly points: number;
  readonly scoringRuleVersionId: string;
  /** If supplied by an upstream adapter, it must agree with the fixture. */
  readonly reportedCompetitionId?: string | null;
}

export interface CompetitionPlayerPointRecord {
  readonly id: string;
  readonly fixtureId: string;
  readonly competitionId: string;
  readonly roundId: string | null;
  readonly playerId: string;
  readonly points: number;
  readonly scoringRuleVersionId: string;
}

export interface CompetitionAllocationResult {
  readonly records: readonly CompetitionPlayerPointRecord[];
  readonly inserted: number;
  readonly updated: number;
  readonly unchanged: number;
  readonly duplicatesInBatch: number;
}

export interface SelectedCompetitionPerformance {
  readonly clubId: string;
  readonly competitionId: string;
  readonly roundId: string;
  readonly playerId: string;
  readonly points: number;
}

export interface ClubCompetitionTotal {
  readonly clubId: string;
  readonly competitionId: string;
  readonly points: number;
  readonly roundPoints: Readonly<Record<string, number>>;
}

function roundPoints(points: number): number {
  return Math.round((points + Number.EPSILON) * 100) / 100;
}

export function competitionPointIdentity(record: {
  readonly fixtureId: string;
  readonly playerId: string;
  readonly scoringRuleVersionId: string;
}): string {
  return `${record.fixtureId}:${record.playerId}:${record.scoringRuleVersionId}`;
}

/**
 * Assigns scores exclusively through the fixture-to-competition relationship.
 * A caller cannot redirect points by putting a different competition on a score.
 */
export function allocatePointsToFixtureCompetitions(
  fixtures: readonly FixtureCompetitionAssignment[],
  scores: readonly CalculatedPlayerMatchPoints[],
  existing: readonly CompetitionPlayerPointRecord[] = []
): CompetitionAllocationResult {
  const fixturesById = new Map<string, FixtureCompetitionAssignment>();
  for (const fixture of fixtures) {
    const prior = fixturesById.get(fixture.fixtureId);
    if (
      prior !== undefined &&
      (prior.competitionId !== fixture.competitionId || prior.roundId !== fixture.roundId)
    ) {
      throw new Error(`fixture ${fixture.fixtureId} has conflicting competition assignments`);
    }
    fixturesById.set(fixture.fixtureId, fixture);
  }

  const allocated = scores.map((score): CompetitionPlayerPointRecord => {
    const fixture = fixturesById.get(score.fixtureId);
    if (fixture === undefined) {
      throw new Error(`fixture ${score.fixtureId} has no competition assignment`);
    }
    if (!fixture.completed) {
      throw new Error(`fixture ${score.fixtureId} is not completed`);
    }
    if (
      score.reportedCompetitionId !== undefined &&
      score.reportedCompetitionId !== null &&
      score.reportedCompetitionId !== fixture.competitionId
    ) {
      throw new Error(`score for fixture ${score.fixtureId} reports the wrong competition`);
    }
    if (!Number.isFinite(score.points)) {
      throw new RangeError('player match points must be finite');
    }
    return {
      id: competitionPointIdentity(score),
      fixtureId: score.fixtureId,
      competitionId: fixture.competitionId,
      roundId: fixture.roundId,
      playerId: score.playerId,
      points: roundPoints(score.points),
      scoringRuleVersionId: score.scoringRuleVersionId
    };
  });

  return mergeIdempotentRecords(existing, allocated, competitionPointIdentity);
}

export function aggregateClubCompetitionTotals(
  performances: readonly SelectedCompetitionPerformance[]
): readonly ClubCompetitionTotal[] {
  const totals = new Map<
    string,
    {
      clubId: string;
      competitionId: string;
      points: number;
      roundPoints: Record<string, number>;
    }
  >();
  for (const performance of performances) {
    if (!Number.isFinite(performance.points)) {
      throw new RangeError('selected player points must be finite');
    }
    const identity = `${performance.competitionId}\u0000${performance.clubId}`;
    const total = totals.get(identity) ?? {
      clubId: performance.clubId,
      competitionId: performance.competitionId,
      points: 0,
      roundPoints: {}
    };
    total.points = roundPoints(total.points + performance.points);
    total.roundPoints[performance.roundId] = roundPoints(
      (total.roundPoints[performance.roundId] ?? 0) + performance.points
    );
    totals.set(identity, total);
  }

  return [...totals.values()]
    .sort(
      (left, right) =>
        left.competitionId.localeCompare(right.competitionId) ||
        left.clubId.localeCompare(right.clubId)
    )
    .map((total) => ({
      clubId: total.clubId,
      competitionId: total.competitionId,
      points: total.points,
      roundPoints: { ...total.roundPoints }
    }));
}

export function pointsForCompetition(
  records: readonly CompetitionPlayerPointRecord[],
  competitionId: string
): readonly CompetitionPlayerPointRecord[] {
  return records.filter((record) => record.competitionId === competitionId);
}
