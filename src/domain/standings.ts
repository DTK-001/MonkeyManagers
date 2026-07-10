export interface StandingCandidate {
  readonly clubId: string;
  readonly clubName: string;
  readonly totalPoints: number;
  /** Competition victories and/or first-place round finishes, as configured. */
  readonly victoryCount: number;
  readonly highestSingleRoundScore: number;
}

export interface RankedStanding extends StandingCandidate {
  readonly rank: number;
}

export interface StandingClub {
  readonly clubId: string;
  readonly clubName: string;
}

export interface ClubRoundScore {
  readonly competitionId: string;
  readonly roundId: string;
  readonly clubId: string;
  readonly points: number;
}

export interface CompetitionWinner {
  readonly competitionId: string;
  readonly clubId: string;
}

function validateCandidate(candidate: StandingCandidate): void {
  if (candidate.clubId.trim() === '' || candidate.clubName.trim() === '') {
    throw new Error('standing candidates need a club ID and name');
  }
  if (
    !Number.isFinite(candidate.totalPoints) ||
    !Number.isFinite(candidate.highestSingleRoundScore) ||
    !Number.isSafeInteger(candidate.victoryCount) ||
    candidate.victoryCount < 0
  ) {
    throw new Error('standing values must be finite and victory counts non-negative');
  }
}

export function compareStandingCandidates(
  left: StandingCandidate,
  right: StandingCandidate
): number {
  return (
    right.totalPoints - left.totalPoints ||
    right.victoryCount - left.victoryCount ||
    right.highestSingleRoundScore - left.highestSingleRoundScore ||
    left.clubName.localeCompare(right.clubName, 'en', { sensitivity: 'base' }) ||
    left.clubName.localeCompare(right.clubName, 'en') ||
    left.clubId.localeCompare(right.clubId, 'en')
  );
}

/** Rank is always deterministic; club name is the specified final game fallback. */
export function rankStandings(candidates: readonly StandingCandidate[]): readonly RankedStanding[] {
  const seenClubIds = new Set<string>();
  for (const candidate of candidates) {
    validateCandidate(candidate);
    if (seenClubIds.has(candidate.clubId)) {
      throw new Error(`club ${candidate.clubId} appears more than once in standings`);
    }
    seenClubIds.add(candidate.clubId);
  }
  return [...candidates]
    .sort(compareStandingCandidates)
    .map((candidate, index) => ({ ...candidate, rank: index + 1 }));
}

function roundToTwo(points: number): number {
  return Math.round((points + Number.EPSILON) * 100) / 100;
}

function assertScoresValid(
  clubs: readonly StandingClub[],
  scores: readonly ClubRoundScore[]
): void {
  const clubIds = new Set<string>();
  for (const club of clubs) {
    if (clubIds.has(club.clubId)) {
      throw new Error(`club ${club.clubId} appears more than once`);
    }
    clubIds.add(club.clubId);
  }
  const scoreIdentities = new Set<string>();
  for (const score of scores) {
    if (!clubIds.has(score.clubId)) {
      throw new Error(`round score refers to unknown club ${score.clubId}`);
    }
    if (!Number.isFinite(score.points)) {
      throw new Error('round points must be finite');
    }
    const identity = `${score.competitionId}\u0000${score.roundId}\u0000${score.clubId}`;
    if (scoreIdentities.has(identity)) {
      throw new Error(`club ${score.clubId} has duplicate totals for round ${score.roundId}`);
    }
    scoreIdentities.add(identity);
  }
}

function firstPlaceRoundFinishCounts(
  scores: readonly ClubRoundScore[]
): ReadonlyMap<string, number> {
  const roundGroups = new Map<string, ClubRoundScore[]>();
  for (const score of scores) {
    const identity = `${score.competitionId}\u0000${score.roundId}`;
    const group = roundGroups.get(identity) ?? [];
    group.push(score);
    roundGroups.set(identity, group);
  }
  const counts = new Map<string, number>();
  for (const group of roundGroups.values()) {
    if (group.length === 0) continue;
    const topScore = Math.max(...group.map((score) => score.points));
    // A tied top score is still a first-place round finish for each tied club.
    for (const score of group) {
      if (score.points === topScore) {
        counts.set(score.clubId, (counts.get(score.clubId) ?? 0) + 1);
      }
    }
  }
  return counts;
}

/**
 * Recomputes the overall table from round facts. Victory count combines
 * completed competition wins and first-place round finishes.
 */
export function buildOverallStandings(
  clubs: readonly StandingClub[],
  scores: readonly ClubRoundScore[],
  competitionWinners: readonly CompetitionWinner[] = []
): readonly RankedStanding[] {
  assertScoresValid(clubs, scores);
  const roundWins = firstPlaceRoundFinishCounts(scores);
  const competitionWins = new Map<string, number>();
  const seenCompetitionWinners = new Set<string>();
  const clubIds = new Set(clubs.map((club) => club.clubId));
  for (const winner of competitionWinners) {
    if (!clubIds.has(winner.clubId)) {
      throw new Error(`competition winner refers to unknown club ${winner.clubId}`);
    }
    if (seenCompetitionWinners.has(winner.competitionId)) {
      throw new Error(`competition ${winner.competitionId} has multiple winners`);
    }
    seenCompetitionWinners.add(winner.competitionId);
    competitionWins.set(winner.clubId, (competitionWins.get(winner.clubId) ?? 0) + 1);
  }

  return rankStandings(
    clubs.map((club): StandingCandidate => {
      const clubScores = scores.filter((score) => score.clubId === club.clubId);
      return {
        ...club,
        totalPoints: roundToTwo(clubScores.reduce((total, score) => total + score.points, 0)),
        victoryCount: (roundWins.get(club.clubId) ?? 0) + (competitionWins.get(club.clubId) ?? 0),
        highestSingleRoundScore:
          clubScores.length === 0 ? 0 : Math.max(...clubScores.map((score) => score.points))
      };
    })
  );
}

/** Builds a table solely from points and rounds in the requested competition. */
export function buildCompetitionStandings(
  clubs: readonly StandingClub[],
  scores: readonly ClubRoundScore[],
  competitionId: string
): readonly RankedStanding[] {
  return buildOverallStandings(
    clubs,
    scores.filter((score) => score.competitionId === competitionId)
  );
}
