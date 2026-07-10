/** Provider-neutral records and the API-Football response normalizer. */

import type { FixturePlayerStatistics, PlayerPosition } from './scoring';

export type ProviderName = 'api-football';
export type ProviderPlayerPosition =
  | 'goalkeeper'
  | 'defender'
  | 'midfielder'
  | 'forward'
  | 'unknown';

export type DerivedStatisticSource = 'provider' | 'calculated' | null;

export interface NormalizedFixturePlayerStatistics {
  readonly provider: ProviderName;
  readonly fixtureProviderId: number;
  readonly competitionProviderId: number;
  readonly season: number | null;
  readonly teamProviderId: number;
  readonly playerProviderId: number;
  readonly playerName: string | null;
  readonly position: ProviderPlayerPosition;
  readonly shirtNumber: number | null;
  readonly captain: boolean | null;
  readonly substitute: boolean | null;
  readonly appeared: boolean | null;
  readonly started: boolean | null;
  readonly minutes: number | null;
  readonly rating: number | null;
  readonly offsides: number | null;
  readonly shots: number | null;
  readonly shotsOnTarget: number | null;
  readonly goals: number | null;
  readonly assists: number | null;
  readonly ownGoals: number | null;
  readonly goalsConceded: number | null;
  readonly saves: number | null;
  readonly passesAttempted: number | null;
  readonly passCompletionPercentage: number | null;
  readonly completedPasses: number | null;
  readonly completedPassesSource: DerivedStatisticSource;
  readonly keyPasses: number | null;
  readonly longPasses: number | null;
  readonly tackles: number | null;
  readonly blocks: number | null;
  readonly interceptions: number | null;
  readonly clearances: number | null;
  readonly duels: number | null;
  readonly duelsWon: number | null;
  readonly aerialDuelsWon: number | null;
  readonly dribblesAttempted: number | null;
  readonly successfulDribbles: number | null;
  readonly failedDribbles: number | null;
  readonly failedDribblesSource: DerivedStatisticSource;
  readonly foulsDrawn: number | null;
  readonly foulsCommitted: number | null;
  readonly yellowCards: number | null;
  readonly secondYellowCards: number | null;
  readonly redCards: number | null;
  readonly penaltiesWon: number | null;
  readonly penaltiesConceded: number | null;
  readonly penaltiesScored: number | null;
  readonly penaltiesMissed: number | null;
  readonly penaltiesSaved: number | null;
  readonly errors: number | null;
  readonly claims: number | null;
  readonly possessionLost: number | null;
  readonly cleanSheet: boolean | null;
  readonly syncedAt: string;
  /** Exact provider fragment used to build this record. */
  readonly rawPayload: unknown;
}

export interface NormalizationIssue {
  readonly path: string;
  readonly code: 'INVALID_SHAPE' | 'MISSING_ID' | 'INVALID_VALUE';
  readonly message: string;
}

export interface FixturePlayerNormalizationContext {
  readonly fixtureProviderId: number;
  readonly competitionProviderId: number;
  readonly season?: number | null;
  readonly syncedAt: string;
}

export interface FixturePlayerNormalizationResult {
  readonly records: readonly NormalizedFixturePlayerStatistics[];
  readonly issues: readonly NormalizationIssue[];
}

export interface NormalizedFixture {
  readonly provider: ProviderName;
  readonly fixtureProviderId: number;
  readonly competitionProviderId: number;
  readonly season: number | null;
  readonly round: string | null;
  readonly kickoffAt: string | null;
  readonly timezone: string | null;
  readonly statusShort: string | null;
  readonly statusLong: string | null;
  readonly elapsedMinutes: number | null;
  readonly completed: boolean;
  readonly eligibleForScoring: boolean;
  readonly homeTeamProviderId: number;
  readonly awayTeamProviderId: number;
  readonly homeGoals: number | null;
  readonly awayGoals: number | null;
  readonly syncedAt: string;
  readonly rawPayload: unknown;
}

export class ProviderNormalizationError extends Error {
  readonly issue: NormalizationIssue;

  constructor(issue: NormalizationIssue) {
    super(issue.message);
    this.name = 'ProviderNormalizationError';
    this.issue = issue;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function recordAt(value: unknown, key: string): Record<string, unknown> | null {
  if (!isRecord(value)) return null;
  const nested = value[key];
  return isRecord(nested) ? nested : null;
}

function valueAt(value: unknown, ...path: readonly string[]): unknown {
  let cursor = value;
  for (const segment of path) {
    if (!isRecord(cursor)) return undefined;
    cursor = cursor[segment];
  }
  return cursor;
}

function nullableNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function nullableCount(value: unknown): number | null {
  const parsed = nullableNumber(value);
  if (parsed === null || !Number.isInteger(parsed) || parsed < 0) return null;
  return parsed;
}

function nullableId(value: unknown): number | null {
  const parsed = nullableCount(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}

function nullableBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function nullablePercentage(value: unknown): number | null {
  const stripped = typeof value === 'string' ? value.trim().replace(/%$/, '') : value;
  const percentage = nullableNumber(stripped);
  return percentage !== null && percentage >= 0 && percentage <= 100 ? percentage : null;
}

export function normalizePosition(value: unknown): ProviderPlayerPosition {
  const normal = nullableString(value)?.toLowerCase();
  if (normal === 'g' || normal === 'goalkeeper' || normal === 'goalie') {
    return 'goalkeeper';
  }
  if (normal === 'd' || normal === 'defender' || normal === 'defence') {
    return 'defender';
  }
  if (normal === 'm' || normal === 'midfielder' || normal === 'midfield') {
    return 'midfielder';
  }
  if (normal === 'f' || normal === 'forward' || normal === 'attacker') {
    return 'forward';
  }
  return 'unknown';
}

export function toScoringPosition(position: ProviderPlayerPosition): PlayerPosition | null {
  switch (position) {
    case 'goalkeeper':
      return 'GK';
    case 'defender':
      return 'DEF';
    case 'midfielder':
      return 'MID';
    case 'forward':
      return 'FWD';
    case 'unknown':
      return null;
  }
}

/** Explicit adapter boundary between provider normalization and game scoring. */
export function toScoringStatistics(
  normalized: NormalizedFixturePlayerStatistics
): FixturePlayerStatistics {
  return {
    appeared: normalized.appeared,
    minutes: normalized.minutes,
    started: normalized.started,
    goals: normalized.goals,
    assists: normalized.assists,
    penaltiesWon: normalized.penaltiesWon,
    penaltiesMissed: normalized.penaltiesMissed,
    ownGoals: normalized.ownGoals,
    shots: normalized.shots,
    shotsOnTarget: normalized.shotsOnTarget,
    keyPasses: normalized.keyPasses,
    successfulDribbles: normalized.successfulDribbles,
    foulsDrawn: normalized.foulsDrawn,
    passesAttempted: normalized.passesAttempted,
    passCompletionPercentage: normalized.passCompletionPercentage,
    completedPasses: normalized.completedPasses,
    longPasses: normalized.longPasses,
    tackles: normalized.tackles,
    interceptions: normalized.interceptions,
    blocks: normalized.blocks,
    duelsWon: normalized.duelsWon,
    aerialDuelsWon: normalized.aerialDuelsWon,
    clearances: normalized.clearances,
    saves: normalized.saves,
    penaltySaves: normalized.penaltiesSaved,
    goalsConceded: normalized.goalsConceded,
    cleanSheet: normalized.cleanSheet,
    claims: normalized.claims,
    foulsCommitted: normalized.foulsCommitted,
    yellowCards: normalized.yellowCards,
    secondYellowDismissals: normalized.secondYellowCards,
    redCards: normalized.redCards,
    penaltiesConceded: normalized.penaltiesConceded,
    errorsLeadingToGoal: normalized.errors,
    failedDribbles: normalized.failedDribbles,
    possessionLost: normalized.possessionLost
  };
}

function normalizeStatisticsFragment(
  playerFragment: Record<string, unknown>,
  statisticFragment: Record<string, unknown>,
  teamProviderId: number,
  context: FixturePlayerNormalizationContext
): NormalizedFixturePlayerStatistics | NormalizationIssue {
  const player = recordAt(playerFragment, 'player') ?? playerFragment;
  const playerProviderId = nullableId(player.id);
  if (playerProviderId === null) {
    return {
      path: 'response[].players[].player.id',
      code: 'MISSING_ID',
      message: 'A fixture player statistic was skipped because its player ID is missing.'
    };
  }

  const substitute = nullableBoolean(valueAt(statisticFragment, 'games', 'substitute'));
  const minutes = nullableCount(valueAt(statisticFragment, 'games', 'minutes'));
  const passesAttempted = nullableCount(valueAt(statisticFragment, 'passes', 'total'));
  const passCompletionPercentage = nullablePercentage(
    valueAt(statisticFragment, 'passes', 'accuracy')
  );
  const providerCompletedPasses = nullableCount(valueAt(statisticFragment, 'passes', 'completed'));
  const calculatedCompletedPasses =
    providerCompletedPasses === null &&
    passesAttempted !== null &&
    passCompletionPercentage !== null
      ? Math.round((passesAttempted * passCompletionPercentage) / 100)
      : null;

  const dribblesAttempted = nullableCount(valueAt(statisticFragment, 'dribbles', 'attempts'));
  const successfulDribbles = nullableCount(valueAt(statisticFragment, 'dribbles', 'success'));
  const providerFailedDribbles = nullableCount(valueAt(statisticFragment, 'dribbles', 'failed'));
  const calculatedFailedDribbles =
    providerFailedDribbles === null &&
    dribblesAttempted !== null &&
    successfulDribbles !== null &&
    successfulDribbles <= dribblesAttempted
      ? dribblesAttempted - successfulDribbles
      : null;

  const secondYellow =
    nullableCount(valueAt(statisticFragment, 'cards', 'second_yellow')) ??
    nullableCount(valueAt(statisticFragment, 'cards', 'yellowred'));
  const penaltiesConceded =
    nullableCount(valueAt(statisticFragment, 'penalty', 'committed')) ??
    nullableCount(valueAt(statisticFragment, 'penalty', 'commited'));

  return {
    provider: 'api-football',
    fixtureProviderId: context.fixtureProviderId,
    competitionProviderId: context.competitionProviderId,
    season: context.season ?? null,
    teamProviderId,
    playerProviderId,
    playerName: nullableString(player.name),
    position: normalizePosition(valueAt(statisticFragment, 'games', 'position')),
    shirtNumber: nullableCount(valueAt(statisticFragment, 'games', 'number')),
    captain: nullableBoolean(valueAt(statisticFragment, 'games', 'captain')),
    substitute,
    appeared: minutes === null ? null : minutes > 0,
    started: substitute === null ? null : !substitute,
    minutes,
    rating: nullableNumber(valueAt(statisticFragment, 'games', 'rating')),
    offsides: nullableCount(statisticFragment.offsides),
    shots: nullableCount(valueAt(statisticFragment, 'shots', 'total')),
    shotsOnTarget: nullableCount(valueAt(statisticFragment, 'shots', 'on')),
    goals: nullableCount(valueAt(statisticFragment, 'goals', 'total')),
    assists: nullableCount(valueAt(statisticFragment, 'goals', 'assists')),
    ownGoals:
      nullableCount(valueAt(statisticFragment, 'goals', 'own')) ??
      nullableCount(statisticFragment.own_goals),
    goalsConceded: nullableCount(valueAt(statisticFragment, 'goals', 'conceded')),
    saves: nullableCount(valueAt(statisticFragment, 'goals', 'saves')),
    passesAttempted,
    passCompletionPercentage,
    completedPasses: providerCompletedPasses ?? calculatedCompletedPasses,
    completedPassesSource:
      providerCompletedPasses !== null
        ? 'provider'
        : calculatedCompletedPasses !== null
          ? 'calculated'
          : null,
    keyPasses: nullableCount(valueAt(statisticFragment, 'passes', 'key')),
    longPasses:
      nullableCount(valueAt(statisticFragment, 'passes', 'long')) ??
      nullableCount(valueAt(statisticFragment, 'passes', 'long_total')),
    tackles: nullableCount(valueAt(statisticFragment, 'tackles', 'total')),
    blocks: nullableCount(valueAt(statisticFragment, 'tackles', 'blocks')),
    interceptions: nullableCount(valueAt(statisticFragment, 'tackles', 'interceptions')),
    clearances:
      nullableCount(valueAt(statisticFragment, 'tackles', 'clearances')) ??
      nullableCount(statisticFragment.clearances),
    duels: nullableCount(valueAt(statisticFragment, 'duels', 'total')),
    duelsWon: nullableCount(valueAt(statisticFragment, 'duels', 'won')),
    aerialDuelsWon:
      nullableCount(valueAt(statisticFragment, 'duels', 'aerial_won')) ??
      nullableCount(statisticFragment.aerial_duels_won),
    dribblesAttempted,
    successfulDribbles,
    failedDribbles: providerFailedDribbles ?? calculatedFailedDribbles,
    failedDribblesSource:
      providerFailedDribbles !== null
        ? 'provider'
        : calculatedFailedDribbles !== null
          ? 'calculated'
          : null,
    foulsDrawn: nullableCount(valueAt(statisticFragment, 'fouls', 'drawn')),
    foulsCommitted: nullableCount(valueAt(statisticFragment, 'fouls', 'committed')),
    yellowCards: nullableCount(valueAt(statisticFragment, 'cards', 'yellow')),
    secondYellowCards: secondYellow,
    redCards: nullableCount(valueAt(statisticFragment, 'cards', 'red')),
    penaltiesWon: nullableCount(valueAt(statisticFragment, 'penalty', 'won')),
    penaltiesConceded,
    penaltiesScored: nullableCount(valueAt(statisticFragment, 'penalty', 'scored')),
    penaltiesMissed: nullableCount(valueAt(statisticFragment, 'penalty', 'missed')),
    penaltiesSaved: nullableCount(valueAt(statisticFragment, 'penalty', 'saved')),
    errors:
      nullableCount(statisticFragment.errors) ??
      nullableCount(valueAt(statisticFragment, 'defending', 'errors')),
    claims:
      nullableCount(statisticFragment.claims) ??
      nullableCount(valueAt(statisticFragment, 'goalkeeping', 'claims')),
    possessionLost:
      nullableCount(statisticFragment.possession_lost) ??
      nullableCount(statisticFragment.turnovers),
    cleanSheet:
      nullableBoolean(statisticFragment.clean_sheet) ??
      nullableBoolean(valueAt(statisticFragment, 'goals', 'clean_sheet')),
    syncedAt: context.syncedAt,
    rawPayload: playerFragment
  };
}

export function normalizeApiFootballFixturePlayerResponse(
  payload: unknown,
  context: FixturePlayerNormalizationContext
): FixturePlayerNormalizationResult {
  const records: NormalizedFixturePlayerStatistics[] = [];
  const issues: NormalizationIssue[] = [];
  if (
    !Number.isSafeInteger(context.fixtureProviderId) ||
    context.fixtureProviderId <= 0 ||
    !Number.isSafeInteger(context.competitionProviderId) ||
    context.competitionProviderId <= 0 ||
    !Number.isFinite(Date.parse(context.syncedAt))
  ) {
    return {
      records,
      issues: [
        {
          path: 'context',
          code: 'INVALID_VALUE',
          message: 'Fixture, competition and synchronisation context is invalid.'
        }
      ]
    };
  }

  const response = isRecord(payload) ? payload.response : undefined;
  if (!Array.isArray(response)) {
    return {
      records,
      issues: [
        {
          path: 'response',
          code: 'INVALID_SHAPE',
          message: 'API-Football player statistics response must be an array.'
        }
      ]
    };
  }

  response.forEach((teamFragment, teamIndex) => {
    if (!isRecord(teamFragment)) {
      issues.push({
        path: `response[${teamIndex}]`,
        code: 'INVALID_SHAPE',
        message: 'A team statistics block is not an object.'
      });
      return;
    }
    const teamProviderId = nullableId(valueAt(teamFragment, 'team', 'id'));
    if (teamProviderId === null) {
      issues.push({
        path: `response[${teamIndex}].team.id`,
        code: 'MISSING_ID',
        message: 'A team statistics block was skipped because its team ID is missing.'
      });
      return;
    }
    const players = teamFragment.players;
    if (!Array.isArray(players)) {
      issues.push({
        path: `response[${teamIndex}].players`,
        code: 'INVALID_SHAPE',
        message: 'A team statistics block has no player array.'
      });
      return;
    }
    players.forEach((playerFragment, playerIndex) => {
      if (!isRecord(playerFragment)) {
        issues.push({
          path: `response[${teamIndex}].players[${playerIndex}]`,
          code: 'INVALID_SHAPE',
          message: 'A player statistics block is not an object.'
        });
        return;
      }
      const statistics = playerFragment.statistics;
      if (!Array.isArray(statistics) || statistics.length === 0) {
        issues.push({
          path: `response[${teamIndex}].players[${playerIndex}].statistics`,
          code: 'INVALID_SHAPE',
          message: 'A player statistics block has no statistics array.'
        });
        return;
      }
      statistics.forEach((statisticFragment, statisticIndex) => {
        if (!isRecord(statisticFragment)) {
          issues.push({
            path: `response[${teamIndex}].players[${playerIndex}].statistics[${statisticIndex}]`,
            code: 'INVALID_SHAPE',
            message: 'A player statistic is not an object.'
          });
          return;
        }
        const normalized = normalizeStatisticsFragment(
          playerFragment,
          statisticFragment,
          teamProviderId,
          context
        );
        if ('code' in normalized) issues.push(normalized);
        else records.push(normalized);
      });
    });
  });

  return { records, issues };
}

const completedFixtureStatuses = new Set(['FT', 'AET', 'PEN']);

export function isCompletedFixtureStatus(statusShort: string | null): boolean {
  return statusShort !== null && completedFixtureStatuses.has(statusShort.toUpperCase());
}

export function normalizeApiFootballFixture(payload: unknown, syncedAt: string): NormalizedFixture {
  const fixtureRoot = isRecord(payload) ? payload : null;
  const fixture = fixtureRoot === null ? null : recordAt(fixtureRoot, 'fixture');
  const league = fixtureRoot === null ? null : recordAt(fixtureRoot, 'league');
  const teams = fixtureRoot === null ? null : recordAt(fixtureRoot, 'teams');
  if (fixture === null || league === null || teams === null) {
    throw new ProviderNormalizationError({
      path: 'fixture',
      code: 'INVALID_SHAPE',
      message: 'API-Football fixture payload is missing fixture, league or teams data.'
    });
  }
  const fixtureProviderId = nullableId(fixture.id);
  const competitionProviderId = nullableId(league.id);
  const homeTeamProviderId = nullableId(valueAt(teams, 'home', 'id'));
  const awayTeamProviderId = nullableId(valueAt(teams, 'away', 'id'));
  if (
    fixtureProviderId === null ||
    competitionProviderId === null ||
    homeTeamProviderId === null ||
    awayTeamProviderId === null
  ) {
    throw new ProviderNormalizationError({
      path: 'fixture.id',
      code: 'MISSING_ID',
      message: 'Fixture, competition and team provider IDs are required.'
    });
  }
  const statusShort = nullableString(valueAt(fixture, 'status', 'short'));
  const completed = isCompletedFixtureStatus(statusShort);
  const goals = fixtureRoot === null ? null : recordAt(fixtureRoot, 'goals');
  return {
    provider: 'api-football',
    fixtureProviderId,
    competitionProviderId,
    season: nullableCount(league.season),
    round: nullableString(league.round),
    kickoffAt: nullableString(fixture.date),
    timezone: nullableString(fixture.timezone),
    statusShort,
    statusLong: nullableString(valueAt(fixture, 'status', 'long')),
    elapsedMinutes: nullableCount(valueAt(fixture, 'status', 'elapsed')),
    completed,
    eligibleForScoring: completed,
    homeTeamProviderId,
    awayTeamProviderId,
    homeGoals: goals === null ? null : nullableCount(goals.home),
    awayGoals: goals === null ? null : nullableCount(goals.away),
    syncedAt,
    rawPayload: payload
  };
}

export const coverageMetrics = [
  'minutes',
  'shots',
  'shotsOnTarget',
  'goals',
  'assists',
  'passesAttempted',
  'passCompletionPercentage',
  'keyPasses',
  'tackles',
  'interceptions',
  'blocks',
  'duelsWon',
  'aerialDuelsWon',
  'clearances',
  'saves',
  'penaltiesSaved',
  'errors',
  'possessionLost'
] as const;

export type CoverageMetric = (typeof coverageMetrics)[number];

export interface MetricCoverage {
  readonly observed: number;
  readonly total: number;
  readonly ratio: number;
}

export interface CompetitionCoverage {
  readonly competitionProviderId: number;
  readonly metrics: Readonly<Record<CoverageMetric, MetricCoverage>>;
}

export function buildCompetitionCoverageReport(
  records: readonly NormalizedFixturePlayerStatistics[]
): readonly CompetitionCoverage[] {
  const groups = new Map<number, NormalizedFixturePlayerStatistics[]>();
  for (const record of records) {
    const group = groups.get(record.competitionProviderId) ?? [];
    group.push(record);
    groups.set(record.competitionProviderId, group);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left - right)
    .map(([competitionProviderId, group]) => {
      const metrics = {} as Record<CoverageMetric, MetricCoverage>;
      for (const metric of coverageMetrics) {
        const observed = group.filter((record) => record[metric] !== null).length;
        metrics[metric] = {
          observed,
          total: group.length,
          ratio: group.length === 0 ? 0 : observed / group.length
        };
      }
      return { competitionProviderId, metrics };
    });
}

export function globallySupportedCoverageMetrics(
  report: readonly CompetitionCoverage[],
  minimumCoverage = 0.95
): readonly CoverageMetric[] {
  if (minimumCoverage < 0 || minimumCoverage > 1 || report.length === 0) {
    return [];
  }
  return coverageMetrics.filter((metric) =>
    report.every((competition) => competition.metrics[metric].ratio >= minimumCoverage)
  );
}
