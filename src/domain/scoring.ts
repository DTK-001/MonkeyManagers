/**
 * Transparent, provider-independent fantasy scoring.
 *
 * The normalisation layer is responsible for mapping a provider payload to
 * `FixturePlayerStatistics`. Missing data stays missing: this module never
 * substitutes a made-up zero. The two documented derivations (appearance from
 * positive minutes and completed passes from attempts x completion percentage)
 * are explicitly labelled in the result.
 */

export type PlayerPosition = 'GK' | 'DEF' | 'MID' | 'FWD';

type NullableNumber = number | null | undefined;
type NullableBoolean = boolean | null | undefined;

export interface FixturePlayerStatistics {
  readonly appeared?: NullableBoolean;
  readonly minutes?: NullableNumber;
  readonly started?: NullableBoolean;
  readonly goals?: NullableNumber;
  readonly assists?: NullableNumber;
  readonly penaltiesWon?: NullableNumber;
  readonly penaltiesMissed?: NullableNumber;
  readonly ownGoals?: NullableNumber;
  readonly shots?: NullableNumber;
  readonly shotsOnTarget?: NullableNumber;
  readonly keyPasses?: NullableNumber;
  readonly successfulDribbles?: NullableNumber;
  readonly foulsDrawn?: NullableNumber;
  readonly passesAttempted?: NullableNumber;
  readonly passCompletionPercentage?: NullableNumber;
  readonly completedPasses?: NullableNumber;
  readonly longPasses?: NullableNumber;
  readonly tackles?: NullableNumber;
  readonly interceptions?: NullableNumber;
  readonly blocks?: NullableNumber;
  readonly duelsWon?: NullableNumber;
  readonly aerialDuelsWon?: NullableNumber;
  readonly clearances?: NullableNumber;
  readonly saves?: NullableNumber;
  readonly penaltySaves?: NullableNumber;
  readonly goalsConceded?: NullableNumber;
  readonly cleanSheet?: NullableBoolean;
  readonly claims?: NullableNumber;
  readonly foulsCommitted?: NullableNumber;
  readonly yellowCards?: NullableNumber;
  readonly secondYellowDismissals?: NullableNumber;
  readonly redCards?: NullableNumber;
  readonly penaltiesConceded?: NullableNumber;
  readonly errorsLeadingToGoal?: NullableNumber;
  readonly failedDribbles?: NullableNumber;
  readonly possessionLost?: NullableNumber;
}

export type ScoringMetric =
  | 'appearance'
  | 'minutesPlayed'
  | 'started'
  | 'playedAtLeast60'
  | 'goals'
  | 'assists'
  | 'penaltiesWon'
  | 'penaltiesMissed'
  | 'ownGoals'
  | 'shots'
  | 'shotsOnTarget'
  | 'keyPasses'
  | 'successfulDribbles'
  | 'foulsDrawn'
  | 'passesAttempted'
  | 'passCompletionPercentage'
  | 'completedPasses'
  | 'longPasses'
  | 'tackles'
  | 'interceptions'
  | 'blocks'
  | 'duelsWon'
  | 'aerialDuelsWon'
  | 'clearances'
  | 'saves'
  | 'penaltySaves'
  | 'goalsConceded'
  | 'cleanSheet'
  | 'claims'
  | 'foulsCommitted'
  | 'yellowCards'
  | 'secondYellowDismissals'
  | 'redCards'
  | 'penaltiesConceded'
  | 'errorsLeadingToGoal'
  | 'failedDribbles'
  | 'possessionLost';

export type MetricCalculation = 'count' | 'boolean' | 'threshold' | 'steps';

export interface PositionWeights {
  readonly GK: number;
  readonly DEF: number;
  readonly MID: number;
  readonly FWD: number;
}

export interface MetricCompanionRequirement {
  readonly statistic: keyof FixturePlayerStatistics;
  readonly minimum: number;
}

export interface ScoringMetricRule {
  readonly metric: ScoringMetric;
  readonly label: string;
  readonly sourceStatistic: keyof FixturePlayerStatistics;
  readonly calculation: MetricCalculation;
  readonly weights: PositionWeights;
  /** Maximum source count that can score. */
  readonly cap?: number;
  /** Minimum value for threshold rules, or size of each step for step rules. */
  readonly threshold?: number;
  readonly minimumCompanion?: MetricCompanionRequirement;
}

export interface ScoringRuleSet {
  readonly version: string;
  readonly rules: readonly ScoringMetricRule[];
}

export interface ScoreBreakdownItem {
  readonly metric: ScoringMetric;
  readonly label: string;
  readonly sourceStatistic: keyof FixturePlayerStatistics;
  readonly sourceValue: number | boolean;
  readonly source: 'provided' | 'derived';
  readonly calculation: MetricCalculation;
  readonly appliedValue: number;
  readonly unitPoints: number;
  readonly points: number;
  readonly cap: number | null;
  readonly capApplied: boolean;
  readonly threshold: number | null;
  readonly thresholdMet: boolean | null;
  readonly companionRequirementMet: boolean | null;
}

export interface PlayerMatchScore {
  readonly position: PlayerPosition;
  readonly ruleVersion: string;
  /** Decimal score rounded to two decimal places. Negative totals are valid. */
  readonly total: number;
  readonly breakdown: readonly ScoreBreakdownItem[];
  readonly availableMetrics: readonly ScoringMetric[];
  readonly missingMetrics: readonly ScoringMetric[];
}

export interface PlayerMatchScoreInput {
  readonly position: PlayerPosition;
  readonly statistics: FixturePlayerStatistics;
}

const positions = (GK: number, DEF: number, MID: number, FWD: number): PositionWeights => ({
  GK,
  DEF,
  MID,
  FWD
});

const allPositions = (weight: number): PositionWeights => positions(weight, weight, weight, weight);

/**
 * Versioned defaults. Replacing this object with a database-backed rule set does
 * not change the evaluator. Passing volume has intentionally tiny, capped
 * weights so low-risk touches cannot dominate a performance.
 */
export const DEFAULT_SCORING_RULE_SET: ScoringRuleSet = {
  version: 'default-2026.1',
  rules: [
    {
      metric: 'appearance',
      label: 'Appearance',
      sourceStatistic: 'appeared',
      calculation: 'boolean',
      weights: allPositions(0.25)
    },
    {
      metric: 'minutesPlayed',
      label: 'Minutes played',
      sourceStatistic: 'minutes',
      calculation: 'count',
      weights: allPositions(0.01),
      cap: 50
    },
    {
      metric: 'started',
      label: 'Started match',
      sourceStatistic: 'started',
      calculation: 'boolean',
      weights: allPositions(0.25)
    },
    {
      metric: 'playedAtLeast60',
      label: 'Played at least 60 minutes',
      sourceStatistic: 'minutes',
      calculation: 'threshold',
      weights: allPositions(1),
      threshold: 60
    },
    {
      metric: 'goals',
      label: 'Goals',
      sourceStatistic: 'goals',
      calculation: 'count',
      weights: positions(8, 6, 5, 4),
      cap: 4
    },
    {
      metric: 'assists',
      label: 'Assists',
      sourceStatistic: 'assists',
      calculation: 'count',
      weights: allPositions(3),
      cap: 3
    },
    {
      metric: 'penaltiesWon',
      label: 'Penalties won',
      sourceStatistic: 'penaltiesWon',
      calculation: 'count',
      weights: allPositions(1),
      cap: 2
    },
    {
      metric: 'penaltiesMissed',
      label: 'Penalties missed',
      sourceStatistic: 'penaltiesMissed',
      calculation: 'count',
      weights: allPositions(-2),
      cap: 2
    },
    {
      metric: 'ownGoals',
      label: 'Own goals',
      sourceStatistic: 'ownGoals',
      calculation: 'count',
      weights: allPositions(-3),
      cap: 2
    },
    {
      metric: 'shots',
      label: 'Shots',
      sourceStatistic: 'shots',
      calculation: 'count',
      weights: positions(0.05, 0.08, 0.1, 0.12),
      cap: 6
    },
    {
      metric: 'shotsOnTarget',
      label: 'Shots on target',
      sourceStatistic: 'shotsOnTarget',
      calculation: 'count',
      weights: positions(0.15, 0.2, 0.25, 0.3),
      cap: 5
    },
    {
      metric: 'keyPasses',
      label: 'Key passes',
      sourceStatistic: 'keyPasses',
      calculation: 'count',
      weights: positions(0.25, 0.35, 0.5, 0.4),
      cap: 6
    },
    {
      metric: 'successfulDribbles',
      label: 'Successful dribbles',
      sourceStatistic: 'successfulDribbles',
      calculation: 'count',
      weights: positions(0.1, 0.15, 0.2, 0.2),
      cap: 5
    },
    {
      metric: 'foulsDrawn',
      label: 'Fouls drawn',
      sourceStatistic: 'foulsDrawn',
      calculation: 'count',
      weights: allPositions(0.15),
      cap: 4
    },
    {
      metric: 'passesAttempted',
      label: 'Passes attempted',
      sourceStatistic: 'passesAttempted',
      calculation: 'count',
      weights: allPositions(0.002),
      cap: 50
    },
    {
      metric: 'passCompletionPercentage',
      label: 'At least 85% pass completion',
      sourceStatistic: 'passCompletionPercentage',
      calculation: 'threshold',
      weights: positions(0.1, 0.2, 0.25, 0.2),
      threshold: 85,
      minimumCompanion: { statistic: 'passesAttempted', minimum: 20 }
    },
    {
      metric: 'completedPasses',
      label: 'Completed passes',
      sourceStatistic: 'completedPasses',
      calculation: 'count',
      weights: allPositions(0.005),
      cap: 60
    },
    {
      metric: 'longPasses',
      label: 'Accurate long passes',
      sourceStatistic: 'longPasses',
      calculation: 'count',
      weights: positions(0.04, 0.05, 0.04, 0.03),
      cap: 12
    },
    {
      metric: 'tackles',
      label: 'Tackles',
      sourceStatistic: 'tackles',
      calculation: 'count',
      weights: positions(0.15, 0.35, 0.3, 0.15),
      cap: 6
    },
    {
      metric: 'interceptions',
      label: 'Interceptions',
      sourceStatistic: 'interceptions',
      calculation: 'count',
      weights: positions(0.15, 0.4, 0.3, 0.15),
      cap: 5
    },
    {
      metric: 'blocks',
      label: 'Blocks',
      sourceStatistic: 'blocks',
      calculation: 'count',
      weights: positions(0.1, 0.4, 0.25, 0.1),
      cap: 4
    },
    {
      metric: 'duelsWon',
      label: 'Duels won',
      sourceStatistic: 'duelsWon',
      calculation: 'count',
      weights: positions(0.05, 0.1, 0.12, 0.1),
      cap: 10
    },
    {
      metric: 'aerialDuelsWon',
      label: 'Aerial duels won',
      sourceStatistic: 'aerialDuelsWon',
      calculation: 'count',
      weights: positions(0.05, 0.15, 0.12, 0.15),
      cap: 8
    },
    {
      metric: 'clearances',
      label: 'Clearances',
      sourceStatistic: 'clearances',
      calculation: 'count',
      weights: positions(0.05, 0.15, 0.08, 0.03),
      cap: 10
    },
    {
      metric: 'saves',
      label: 'Saves',
      sourceStatistic: 'saves',
      calculation: 'count',
      weights: positions(0.5, 0, 0, 0),
      cap: 8
    },
    {
      metric: 'penaltySaves',
      label: 'Penalty saves',
      sourceStatistic: 'penaltySaves',
      calculation: 'count',
      weights: positions(5, 0, 0, 0),
      cap: 2
    },
    {
      metric: 'goalsConceded',
      label: 'Every two goals conceded',
      sourceStatistic: 'goalsConceded',
      calculation: 'steps',
      weights: positions(-1, -1, 0, 0),
      cap: 6,
      threshold: 2
    },
    {
      metric: 'cleanSheet',
      label: 'Clean sheet',
      sourceStatistic: 'cleanSheet',
      calculation: 'boolean',
      weights: positions(4, 4, 1, 0),
      minimumCompanion: { statistic: 'minutes', minimum: 60 }
    },
    {
      metric: 'claims',
      label: 'Goalkeeper claims',
      sourceStatistic: 'claims',
      calculation: 'count',
      weights: positions(0.2, 0, 0, 0),
      cap: 5
    },
    {
      metric: 'foulsCommitted',
      label: 'Fouls committed',
      sourceStatistic: 'foulsCommitted',
      calculation: 'count',
      weights: allPositions(-0.2),
      cap: 5
    },
    {
      metric: 'yellowCards',
      label: 'Yellow cards',
      sourceStatistic: 'yellowCards',
      calculation: 'count',
      weights: allPositions(-1),
      cap: 1
    },
    {
      metric: 'secondYellowDismissals',
      label: 'Second-yellow dismissals',
      sourceStatistic: 'secondYellowDismissals',
      calculation: 'count',
      weights: allPositions(-3),
      cap: 1
    },
    {
      metric: 'redCards',
      label: 'Straight red cards',
      sourceStatistic: 'redCards',
      calculation: 'count',
      weights: allPositions(-4),
      cap: 1
    },
    {
      metric: 'penaltiesConceded',
      label: 'Penalties conceded',
      sourceStatistic: 'penaltiesConceded',
      calculation: 'count',
      weights: allPositions(-2),
      cap: 2
    },
    {
      metric: 'errorsLeadingToGoal',
      label: 'Errors leading to a goal',
      sourceStatistic: 'errorsLeadingToGoal',
      calculation: 'count',
      weights: allPositions(-2),
      cap: 2
    },
    {
      metric: 'failedDribbles',
      label: 'Failed dribbles',
      sourceStatistic: 'failedDribbles',
      calculation: 'count',
      weights: allPositions(-0.1),
      cap: 5
    },
    {
      metric: 'possessionLost',
      label: 'Possession lost (provider supplied)',
      sourceStatistic: 'possessionLost',
      calculation: 'count',
      weights: allPositions(-0.03),
      cap: 10
    }
  ]
};

interface ResolvedValue {
  readonly available: boolean;
  readonly numericValue: number;
  readonly displayValue: number | boolean;
  readonly source: 'provided' | 'derived';
}

const unavailableValue: ResolvedValue = {
  available: false,
  numericValue: 0,
  displayValue: 0,
  source: 'provided'
};

const isUsableCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

const resolveMetricValue = (
  rule: ScoringMetricRule,
  statistics: FixturePlayerStatistics
): ResolvedValue => {
  if (rule.metric === 'appearance') {
    const appeared = statistics.appeared;
    if (typeof appeared === 'boolean') {
      return {
        available: true,
        numericValue: appeared ? 1 : 0,
        displayValue: appeared,
        source: 'provided'
      };
    }

    if (isUsableCount(statistics.minutes) && statistics.minutes > 0) {
      return {
        available: true,
        numericValue: 1,
        displayValue: true,
        source: 'derived'
      };
    }

    return unavailableValue;
  }

  if (rule.metric === 'completedPasses') {
    if (isUsableCount(statistics.completedPasses)) {
      return {
        available: true,
        numericValue: statistics.completedPasses,
        displayValue: statistics.completedPasses,
        source: 'provided'
      };
    }

    const attempts = statistics.passesAttempted;
    const percentage = statistics.passCompletionPercentage;
    if (isUsableCount(attempts) && isUsableCount(percentage) && percentage <= 100) {
      const derivedCompletedPasses = Math.round(attempts * (percentage / 100));
      return {
        available: true,
        numericValue: derivedCompletedPasses,
        displayValue: derivedCompletedPasses,
        source: 'derived'
      };
    }

    return unavailableValue;
  }

  const value = statistics[rule.sourceStatistic];
  if (typeof value === 'boolean') {
    return {
      available: true,
      numericValue: value ? 1 : 0,
      displayValue: value,
      source: 'provided'
    };
  }

  if (isUsableCount(value)) {
    return {
      available: true,
      numericValue: value,
      displayValue: value,
      source: 'provided'
    };
  }

  return unavailableValue;
};

const roundToTwo = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

const companionRequirementMet = (
  rule: ScoringMetricRule,
  statistics: FixturePlayerStatistics
): boolean | null => {
  if (rule.minimumCompanion === undefined) {
    return null;
  }

  const companion = statistics[rule.minimumCompanion.statistic];
  return isUsableCount(companion) && companion >= rule.minimumCompanion.minimum;
};

const validateRuleSet = (ruleSet: ScoringRuleSet): void => {
  if (ruleSet.version.trim().length === 0) {
    throw new Error('A scoring rule set must have a non-empty version.');
  }

  const seen = new Set<ScoringMetric>();
  for (const rule of ruleSet.rules) {
    if (seen.has(rule.metric)) {
      throw new Error(`Duplicate scoring metric: ${rule.metric}`);
    }
    seen.add(rule.metric);

    if (rule.cap !== undefined && (!Number.isFinite(rule.cap) || rule.cap < 0)) {
      throw new Error(`Invalid cap for scoring metric: ${rule.metric}`);
    }
    if (
      (rule.calculation === 'threshold' || rule.calculation === 'steps') &&
      (rule.threshold === undefined || rule.threshold <= 0)
    ) {
      throw new Error(`A positive threshold is required for: ${rule.metric}`);
    }
  }
};

export const calculatePlayerMatchScore = (
  input: PlayerMatchScoreInput,
  ruleSet: ScoringRuleSet = DEFAULT_SCORING_RULE_SET
): PlayerMatchScore => {
  validateRuleSet(ruleSet);

  const breakdown: ScoreBreakdownItem[] = [];
  const availableMetrics: ScoringMetric[] = [];
  const missingMetrics: ScoringMetric[] = [];

  for (const rule of ruleSet.rules) {
    const unitPoints = rule.weights[input.position];
    // A zero position weight means the metric is intentionally not applicable.
    if (unitPoints === 0) {
      continue;
    }

    const resolved = resolveMetricValue(rule, input.statistics);
    if (!resolved.available) {
      missingMetrics.push(rule.metric);
      continue;
    }
    availableMetrics.push(rule.metric);

    const companionMet = companionRequirementMet(rule, input.statistics);
    const cap = rule.cap ?? null;
    const threshold = rule.threshold ?? null;
    const cappedSource =
      cap === null ? resolved.numericValue : Math.min(resolved.numericValue, cap);
    const capApplied = cap !== null && resolved.numericValue > cap;

    let appliedValue = 0;
    let thresholdMet: boolean | null = null;
    if (companionMet !== false) {
      switch (rule.calculation) {
        case 'boolean':
          appliedValue = cappedSource > 0 ? 1 : 0;
          break;
        case 'count':
          appliedValue = cappedSource;
          break;
        case 'threshold':
          thresholdMet = cappedSource >= (threshold ?? Number.POSITIVE_INFINITY);
          appliedValue = thresholdMet ? 1 : 0;
          break;
        case 'steps':
          thresholdMet = cappedSource >= (threshold ?? Number.POSITIVE_INFINITY);
          appliedValue = thresholdMet ? Math.floor(cappedSource / (threshold ?? 1)) : 0;
          break;
      }
    } else if (rule.calculation === 'threshold' || rule.calculation === 'steps') {
      thresholdMet = false;
    }

    const points = roundToTwo(appliedValue * unitPoints);
    if (points === 0) {
      continue;
    }

    breakdown.push({
      metric: rule.metric,
      label: rule.label,
      sourceStatistic: rule.sourceStatistic,
      sourceValue: resolved.displayValue,
      source: resolved.source,
      calculation: rule.calculation,
      appliedValue,
      unitPoints,
      points,
      cap,
      capApplied,
      threshold,
      thresholdMet,
      companionRequirementMet: companionMet
    });
  }

  return {
    position: input.position,
    ruleVersion: ruleSet.version,
    total: roundToTwo(breakdown.reduce((total, item) => total + item.points, 0)),
    breakdown,
    availableMetrics,
    missingMetrics
  };
};

/** Convenience signature for callers that already keep position separately. */
export const scorePlayerMatch = (
  statistics: FixturePlayerStatistics,
  position: PlayerPosition,
  ruleSet: ScoringRuleSet = DEFAULT_SCORING_RULE_SET
): PlayerMatchScore => calculatePlayerMatchScore({ position, statistics }, ruleSet);
