import type { PlayerPosition } from './scoring';

export interface LineupPlayer {
  readonly playerId: string;
  readonly position: PlayerPosition;
}

export interface FantasyLineup {
  readonly competitionId: string;
  readonly roundId: string;
  readonly starters: readonly LineupPlayer[];
  /** Order is significant for automatic substitutions. */
  readonly bench: readonly LineupPlayer[];
  readonly captainPlayerId: string;
  readonly viceCaptainPlayerId: string;
}

export interface FormationRules {
  readonly starterCount: number;
  readonly maximumBenchSize: number;
  readonly minimumByPosition: Readonly<Record<PlayerPosition, number>>;
  readonly maximumByPosition: Readonly<Record<PlayerPosition, number>>;
}

export const DEFAULT_FORMATION_RULES: FormationRules = {
  starterCount: 11,
  maximumBenchSize: 7,
  minimumByPosition: { GK: 1, DEF: 3, MID: 2, FWD: 1 },
  maximumByPosition: { GK: 1, DEF: 5, MID: 5, FWD: 3 }
};

export type LineupValidationCode =
  | 'STARTER_COUNT'
  | 'BENCH_SIZE'
  | 'POSITION_MINIMUM'
  | 'POSITION_MAXIMUM'
  | 'DUPLICATE_PLAYER'
  | 'INELIGIBLE_PLAYER'
  | 'CAPTAIN_NOT_STARTER'
  | 'VICE_CAPTAIN_NOT_STARTER'
  | 'CAPTAIN_AND_VICE_SAME';

export interface LineupValidationIssue {
  readonly code: LineupValidationCode;
  readonly message: string;
  readonly playerId: string | null;
  readonly position: PlayerPosition | null;
}

export interface FormationValidationResult {
  readonly valid: boolean;
  readonly counts: Readonly<Record<PlayerPosition, number>>;
  readonly issues: readonly LineupValidationIssue[];
}

export interface LineupValidationOptions {
  readonly eligiblePlayerIds?: readonly string[];
  readonly rules?: FormationRules;
}

export type LineupValidationResult = FormationValidationResult;

function positionCounts(players: readonly LineupPlayer[]): Record<PlayerPosition, number> {
  const counts: Record<PlayerPosition, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
  for (const player of players) counts[player.position] += 1;
  return counts;
}

export function validateFormation(
  starters: readonly LineupPlayer[],
  rules: FormationRules = DEFAULT_FORMATION_RULES
): FormationValidationResult {
  const counts = positionCounts(starters);
  const issues: LineupValidationIssue[] = [];
  if (starters.length !== rules.starterCount) {
    issues.push({
      code: 'STARTER_COUNT',
      message: `A lineup must contain exactly ${rules.starterCount} starters.`,
      playerId: null,
      position: null
    });
  }
  (Object.keys(counts) as PlayerPosition[]).forEach((position) => {
    if (counts[position] < rules.minimumByPosition[position]) {
      issues.push({
        code: 'POSITION_MINIMUM',
        message: `A formation needs at least ${rules.minimumByPosition[position]} ${position}.`,
        playerId: null,
        position
      });
    }
    if (counts[position] > rules.maximumByPosition[position]) {
      issues.push({
        code: 'POSITION_MAXIMUM',
        message: `A formation allows at most ${rules.maximumByPosition[position]} ${position}.`,
        playerId: null,
        position
      });
    }
  });
  return { valid: issues.length === 0, counts, issues };
}

export function validateLineup(
  lineup: FantasyLineup,
  options: LineupValidationOptions = {}
): LineupValidationResult {
  const rules = options.rules ?? DEFAULT_FORMATION_RULES;
  const formation = validateFormation(lineup.starters, rules);
  const issues = [...formation.issues];
  if (lineup.bench.length > rules.maximumBenchSize) {
    issues.push({
      code: 'BENCH_SIZE',
      message: `A lineup can have at most ${rules.maximumBenchSize} substitutes.`,
      playerId: null,
      position: null
    });
  }

  const allPlayers = [...lineup.starters, ...lineup.bench];
  const seen = new Set<string>();
  for (const player of allPlayers) {
    if (seen.has(player.playerId)) {
      issues.push({
        code: 'DUPLICATE_PLAYER',
        message: 'A player can only occupy one lineup slot.',
        playerId: player.playerId,
        position: player.position
      });
    }
    seen.add(player.playerId);
  }

  if (options.eligiblePlayerIds !== undefined) {
    const eligible = new Set(options.eligiblePlayerIds);
    for (const player of allPlayers) {
      if (!eligible.has(player.playerId)) {
        issues.push({
          code: 'INELIGIBLE_PLAYER',
          message: "This player is not eligible for the club's lineup.",
          playerId: player.playerId,
          position: player.position
        });
      }
    }
  }

  const starterIds = new Set(lineup.starters.map((player) => player.playerId));
  if (!starterIds.has(lineup.captainPlayerId)) {
    issues.push({
      code: 'CAPTAIN_NOT_STARTER',
      message: 'The captain must be one of the starting eleven.',
      playerId: lineup.captainPlayerId,
      position: null
    });
  }
  if (!starterIds.has(lineup.viceCaptainPlayerId)) {
    issues.push({
      code: 'VICE_CAPTAIN_NOT_STARTER',
      message: 'The vice-captain must be one of the starting eleven.',
      playerId: lineup.viceCaptainPlayerId,
      position: null
    });
  }
  if (lineup.captainPlayerId === lineup.viceCaptainPlayerId) {
    issues.push({
      code: 'CAPTAIN_AND_VICE_SAME',
      message: 'Captain and vice-captain must be different players.',
      playerId: lineup.captainPlayerId,
      position: null
    });
  }

  return {
    valid: issues.length === 0,
    counts: formation.counts,
    issues
  };
}

export type FixtureLockStatus =
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'postponed'
  | 'cancelled';

export interface PlayerFixtureLock {
  readonly playerId: string;
  readonly kickoffAt: string | null;
  readonly status: FixtureLockStatus;
}

export interface LineupEditLockContext {
  readonly now: string;
  readonly deadlineAt: string;
  readonly playerFixtures: readonly PlayerFixtureLock[];
  /** Administrators may choose a traditional hard lock for the entire round. */
  readonly hardLockAtDeadline?: boolean;
}

export type LineupLockIssueCode = 'ROUND_LOCKED' | 'PLAYER_LOCKED';

export interface LineupLockIssue {
  readonly code: LineupLockIssueCode;
  readonly playerId: string | null;
  readonly message: string;
}

export interface LineupEditValidationResult {
  readonly valid: boolean;
  readonly deadlinePassed: boolean;
  readonly lockedPlayerIds: readonly string[];
  readonly issues: readonly LineupLockIssue[];
}

function timestamp(value: string, label: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new RangeError(`${label} must be a valid date`);
  return parsed;
}

export function isLineupDeadlinePassed(now: string, deadlineAt: string): boolean {
  return timestamp(now, 'now') >= timestamp(deadlineAt, 'deadlineAt');
}

export function deriveLineupDeadline(fixtureKickoffs: readonly (string | null)[]): string | null {
  const valid = fixtureKickoffs
    .filter((kickoff): kickoff is string => kickoff !== null)
    .map((kickoff) => ({ kickoff, time: Date.parse(kickoff) }))
    .filter((item) => Number.isFinite(item.time))
    .sort((left, right) => left.time - right.time);
  return valid[0]?.kickoff ?? null;
}

export function isPlayerFixtureLocked(fixture: PlayerFixtureLock, now: string): boolean {
  if (fixture.status === 'postponed' || fixture.status === 'cancelled') return false;
  if (fixture.status === 'in_progress' || fixture.status === 'completed') return true;
  return fixture.kickoffAt === null
    ? false
    : timestamp(now, 'now') >= timestamp(fixture.kickoffAt, 'kickoffAt');
}

function playerRole(lineup: FantasyLineup, playerId: string): string {
  const starter = lineup.starters.some((player) => player.playerId === playerId);
  const benchIndex = lineup.bench.findIndex((player) => player.playerId === playerId);
  const selection = starter ? 'starter' : benchIndex >= 0 ? `bench:${benchIndex}` : 'absent';
  const captain = lineup.captainPlayerId === playerId ? ':captain' : '';
  const vice = lineup.viceCaptainPlayerId === playerId ? ':vice' : '';
  return `${selection}${captain}${vice}`;
}

function lineupsEquivalent(left: FantasyLineup, right: FantasyLineup): boolean {
  const ids = new Set([
    ...left.starters.map((player) => player.playerId),
    ...left.bench.map((player) => player.playerId),
    ...right.starters.map((player) => player.playerId),
    ...right.bench.map((player) => player.playerId)
  ]);
  return [...ids].every((id) => playerRole(left, id) === playerRole(right, id));
}

export function validateLineupEdit(
  previous: FantasyLineup,
  next: FantasyLineup,
  context: LineupEditLockContext
): LineupEditValidationResult {
  const deadlinePassed = isLineupDeadlinePassed(context.now, context.deadlineAt);
  if (!deadlinePassed) {
    return { valid: true, deadlinePassed: false, lockedPlayerIds: [], issues: [] };
  }
  if (context.hardLockAtDeadline === true && !lineupsEquivalent(previous, next)) {
    return {
      valid: false,
      deadlinePassed: true,
      lockedPlayerIds: [...previous.starters, ...previous.bench].map((player) => player.playerId),
      issues: [
        {
          code: 'ROUND_LOCKED',
          playerId: null,
          message: 'This competition round is locked.'
        }
      ]
    };
  }

  const fixtureByPlayer = new Map(
    context.playerFixtures.map((fixture) => [fixture.playerId, fixture] as const)
  );
  const selectedIds = new Set([
    ...previous.starters.map((player) => player.playerId),
    ...previous.bench.map((player) => player.playerId),
    ...next.starters.map((player) => player.playerId),
    ...next.bench.map((player) => player.playerId)
  ]);
  const lockedPlayerIds = [...selectedIds]
    .filter((playerId) => {
      const fixture = fixtureByPlayer.get(playerId);
      return fixture !== undefined && isPlayerFixtureLocked(fixture, context.now);
    })
    .sort();
  const issues = lockedPlayerIds
    .filter((playerId) => playerRole(previous, playerId) !== playerRole(next, playerId))
    .map(
      (playerId): LineupLockIssue => ({
        code: 'PLAYER_LOCKED',
        playerId,
        message: "This player's relevant fixture has started, so their slot is locked."
      })
    );
  return { valid: issues.length === 0, deadlinePassed, lockedPlayerIds, issues };
}

export interface PlayerRoundPerformance {
  readonly playerId: string;
  readonly didPlay: boolean;
  readonly points: number;
}

export interface EffectiveStarter {
  readonly slot: number;
  readonly originalPlayerId: string;
  readonly player: LineupPlayer;
  readonly source: 'starter' | 'bench';
  readonly points: number;
}

export interface AutomaticSubstitution {
  readonly starterOutPlayerId: string;
  readonly benchInPlayerId: string;
  readonly benchIndex: number;
  readonly starterSlot: number;
}

export interface ResolvedLineupRound {
  readonly effectiveStarters: readonly EffectiveStarter[];
  readonly substitutions: readonly AutomaticSubstitution[];
  readonly unusedBenchPlayerIds: readonly string[];
  readonly captainAppliedToPlayerId: string | null;
  readonly viceCaptainActivated: boolean;
  readonly captainMultiplier: number;
  readonly basePoints: number;
  readonly captainBonusPoints: number;
  readonly totalPoints: number;
}

function twoDecimals(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Deterministic: missing starters are considered in slot order, bench in order. */
export function resolveAutomaticSubstitutions(
  lineup: FantasyLineup,
  performances: readonly PlayerRoundPerformance[],
  captainMultiplier = 1.5,
  rules: FormationRules = DEFAULT_FORMATION_RULES
): ResolvedLineupRound {
  const validation = validateLineup(lineup, { rules });
  if (!validation.valid) {
    throw new Error(
      `cannot resolve an invalid lineup: ${validation.issues[0]?.message ?? 'unknown error'}`
    );
  }
  if (!Number.isFinite(captainMultiplier) || captainMultiplier < 1) {
    throw new RangeError('captain multiplier must be a finite value of at least 1');
  }
  const performanceByPlayer = new Map<string, PlayerRoundPerformance>();
  for (const performance of performances) {
    if (performanceByPlayer.has(performance.playerId)) {
      throw new Error(`duplicate performance for player ${performance.playerId}`);
    }
    if (!Number.isFinite(performance.points)) {
      throw new RangeError('player round points must be finite');
    }
    performanceByPlayer.set(performance.playerId, performance);
  }

  const effectivePlayers = [...lineup.starters];
  const usedBenchIndexes = new Set<number>();
  const substitutions: AutomaticSubstitution[] = [];
  lineup.starters.forEach((starter, starterSlot) => {
    if (performanceByPlayer.get(starter.playerId)?.didPlay === true) return;
    for (let benchIndex = 0; benchIndex < lineup.bench.length; benchIndex += 1) {
      if (usedBenchIndexes.has(benchIndex)) continue;
      const candidate = lineup.bench[benchIndex];
      if (
        candidate === undefined ||
        performanceByPlayer.get(candidate.playerId)?.didPlay !== true
      ) {
        continue;
      }
      const proposed = [...effectivePlayers];
      proposed[starterSlot] = candidate;
      if (!validateFormation(proposed, rules).valid) continue;
      effectivePlayers[starterSlot] = candidate;
      usedBenchIndexes.add(benchIndex);
      substitutions.push({
        starterOutPlayerId: starter.playerId,
        benchInPlayerId: candidate.playerId,
        benchIndex,
        starterSlot
      });
      break;
    }
  });

  const effectiveStarters: EffectiveStarter[] = effectivePlayers.map((player, slot) => {
    const performance = performanceByPlayer.get(player.playerId);
    const substituted = player.playerId !== lineup.starters[slot]?.playerId;
    return {
      slot,
      originalPlayerId: lineup.starters[slot]?.playerId ?? player.playerId,
      player,
      source: substituted ? 'bench' : 'starter',
      points: performance?.didPlay === true ? performance.points : 0
    };
  });
  const effectiveIds = new Set(effectiveStarters.map((starter) => starter.player.playerId));
  const captainPlayed =
    performanceByPlayer.get(lineup.captainPlayerId)?.didPlay === true &&
    effectiveIds.has(lineup.captainPlayerId);
  const vicePlayed =
    performanceByPlayer.get(lineup.viceCaptainPlayerId)?.didPlay === true &&
    effectiveIds.has(lineup.viceCaptainPlayerId);
  const captainAppliedToPlayerId = captainPlayed
    ? lineup.captainPlayerId
    : vicePlayed
      ? lineup.viceCaptainPlayerId
      : null;
  const basePoints = twoDecimals(
    effectiveStarters.reduce((total, starter) => total + starter.points, 0)
  );
  const captainPoints =
    captainAppliedToPlayerId === null
      ? 0
      : (performanceByPlayer.get(captainAppliedToPlayerId)?.points ?? 0);
  const captainBonusPoints = twoDecimals(captainPoints * (captainMultiplier - 1));

  return {
    effectiveStarters,
    substitutions,
    unusedBenchPlayerIds: lineup.bench
      .filter((_player, index) => !usedBenchIndexes.has(index))
      .map((player) => player.playerId),
    captainAppliedToPlayerId,
    viceCaptainActivated: captainAppliedToPlayerId === lineup.viceCaptainPlayerId,
    captainMultiplier,
    basePoints,
    captainBonusPoints,
    totalPoints: twoDecimals(basePoints + captainBonusPoints)
  };
}
