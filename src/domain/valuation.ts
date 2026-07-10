import type { PlayerPosition } from './scoring';

/** All monetary values are integer minor units (pence for GBP). */
export type MoneyMinor = number;

export type ValuationComponentName =
  | 'seasonPerformance'
  | 'recentForm'
  | 'playingTimeReliability'
  | 'availability';

export interface RecentAppearance {
  /** Population percentile, normally calculated from fantasy points per 90. */
  readonly performancePercentile: number | null;
  readonly minutes: number;
  readonly started?: boolean | null;
}

export interface AdministratorValuationOverride {
  readonly valueMinor: MoneyMinor;
  readonly reason: string;
  /** Explicitly permits a correction larger than the normal daily movement. */
  readonly bypassDailyCap?: boolean;
}

export interface ValuationInput {
  readonly position: PlayerPosition;
  readonly currentValueMinor?: MoneyMinor | null;
  readonly initialValueMinor?: MoneyMinor | null;
  readonly seasonPerformancePercentile: number | null;
  readonly seasonMinutes: number;
  /** Newest appearance first; only the first configured number are used. */
  readonly recentAppearances: readonly RecentAppearance[];
  /** 0..1. If absent, the engine attempts a conservative recent-starts derivation. */
  readonly playingTimeReliability: number | null;
  /** 0 means unavailable, 1 means fully available. Missing data is neutral. */
  readonly availability: number | null;
  readonly adminOverride?: AdministratorValuationOverride | null;
}

export interface ValuationComponentWeights {
  readonly seasonPerformance: number;
  readonly recentForm: number;
  readonly playingTimeReliability: number;
  readonly availability: number;
}

export interface PositionValueBaselines {
  readonly GK: MoneyMinor;
  readonly DEF: MoneyMinor;
  readonly MID: MoneyMinor;
  readonly FWD: MoneyMinor;
}

export interface ValuationRuleSet {
  readonly version: string;
  readonly minimumValueMinor: MoneyMinor;
  readonly maximumValueMinor: MoneyMinor;
  readonly positionBaselinesMinor: PositionValueBaselines;
  readonly componentWeights: ValuationComponentWeights;
  /** Newest-to-oldest weighting, normally five entries. */
  readonly recentAppearanceWeights: readonly number[];
  readonly minimumReliableSeasonMinutes: number;
  readonly minimumReliableRecentMinutes: number;
  /** Fraction of the target gap considered in one nightly update. */
  readonly targetConvergenceRate: number;
  readonly maximumDailyMovement: number;
  /** Deliberately disabled for a small private league. */
  readonly demandWeight: 0;
}

export interface WeightedRecentForm {
  readonly rawPercentile: number | null;
  readonly adjustedPercentile: number;
  readonly sampleMinutes: number;
  readonly sampleReliability: number;
  readonly appearancesUsed: number;
}

export interface ValuationComponentResult {
  readonly component: ValuationComponentName;
  readonly weight: number;
  readonly rawPercentile: number | null;
  readonly adjustedPercentile: number;
  readonly sampleMinutes: number | null;
  readonly sampleReliability: number;
  readonly source: 'provided' | 'derived' | 'neutral-fallback';
  /** Signed contribution to the position baseline. */
  readonly contributionMinor: MoneyMinor;
}

export type ValuationExplanationCode =
  | 'season-performance'
  | 'recent-form'
  | 'playing-time-reliability'
  | 'availability'
  | 'provisional-baseline'
  | 'daily-movement-cap'
  | 'administrator-override';

export interface ValuationExplanationItem {
  readonly code: ValuationExplanationCode;
  readonly component: ValuationComponentName | null;
  readonly direction: 'increase' | 'decrease' | 'neutral';
  /** Signed impact in minor units. */
  readonly impactMinor: MoneyMinor;
  readonly details: Readonly<Record<string, string | number | boolean | null>>;
}

export interface PlayerValuationResult {
  readonly ruleVersion: string;
  readonly position: PlayerPosition;
  readonly initialValueMinor: MoneyMinor;
  readonly previousValueMinor: MoneyMinor;
  readonly normalTargetValueMinor: MoneyMinor;
  readonly targetValueMinor: MoneyMinor;
  readonly currentValueMinor: MoneyMinor;
  readonly valueChangeAmountMinor: MoneyMinor;
  /** Percentage points: 5 means +5%, not +0.05%. */
  readonly valueChangePercentage: number;
  readonly provisional: boolean;
  readonly dailyCapApplied: boolean;
  readonly adminOverrideApplied: boolean;
  readonly components: readonly ValuationComponentResult[];
  readonly explanation: readonly ValuationExplanationItem[];
}

export const DEFAULT_VALUATION_RULE_SET: ValuationRuleSet = {
  version: 'default-2026.1',
  minimumValueMinor: 50_000_000, // GBP 0.5m
  maximumValueMinor: 2_500_000_000, // GBP 25m
  positionBaselinesMinor: {
    GK: 400_000_000,
    DEF: 500_000_000,
    MID: 600_000_000,
    FWD: 700_000_000
  },
  componentWeights: {
    seasonPerformance: 0.45,
    recentForm: 0.35,
    playingTimeReliability: 0.15,
    availability: 0.05
  },
  recentAppearanceWeights: [5, 4, 3, 2, 1],
  minimumReliableSeasonMinutes: 450,
  minimumReliableRecentMinutes: 450,
  targetConvergenceRate: 0.25,
  maximumDailyMovement: 0.05,
  demandWeight: 0
};

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

const clampPercentile = (value: number): number => clamp(value, 0, 1);

const roundMoney = (value: number): MoneyMinor => Math.round(value);

const roundPercentage = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

const normaliseMinutes = (minutes: number): number =>
  Number.isFinite(minutes) && minutes > 0 ? minutes : 0;

const sampleAdjustedPercentile = (
  rawPercentile: number | null,
  sampleMinutes: number,
  reliableMinutes: number
): { adjusted: number; reliability: number } => {
  if (rawPercentile === null) {
    return { adjusted: 0.5, reliability: 0 };
  }

  const reliability = clamp(sampleMinutes / reliableMinutes, 0, 1);
  // Blend small samples into neutral rather than extrapolating a tiny per-90.
  const adjusted = 0.5 + (clampPercentile(rawPercentile) - 0.5) * reliability;
  return { adjusted, reliability };
};

export const calculateWeightedRecentForm = (
  appearances: readonly RecentAppearance[],
  appearanceWeights: readonly number[] = DEFAULT_VALUATION_RULE_SET.recentAppearanceWeights,
  minimumReliableMinutes: number = DEFAULT_VALUATION_RULE_SET.minimumReliableRecentMinutes
): WeightedRecentForm => {
  if (appearanceWeights.length === 0 || appearanceWeights.some((weight) => weight <= 0)) {
    throw new Error('Recent-appearance weights must be positive and non-empty.');
  }
  if (!Number.isFinite(minimumReliableMinutes) || minimumReliableMinutes <= 0) {
    throw new Error('Minimum reliable recent minutes must be positive.');
  }

  let weightedPercentile = 0;
  let totalWeight = 0;
  let sampleMinutes = 0;
  let appearancesUsed = 0;
  const selectedAppearances = appearances.slice(0, appearanceWeights.length);

  selectedAppearances.forEach((appearance, index) => {
    const percentile = appearance.performancePercentile;
    if (percentile === null || !Number.isFinite(percentile)) {
      return;
    }

    const weight = appearanceWeights[index];
    if (weight === undefined) {
      return;
    }
    weightedPercentile += clampPercentile(percentile) * weight;
    totalWeight += weight;
    sampleMinutes += normaliseMinutes(appearance.minutes);
    appearancesUsed += 1;
  });

  const rawPercentile = totalWeight === 0 ? null : weightedPercentile / totalWeight;
  const adjusted = sampleAdjustedPercentile(rawPercentile, sampleMinutes, minimumReliableMinutes);

  return {
    rawPercentile,
    adjustedPercentile: adjusted.adjusted,
    sampleMinutes,
    sampleReliability: adjusted.reliability,
    appearancesUsed
  };
};

interface DerivedReliability {
  readonly percentile: number | null;
  readonly source: 'provided' | 'derived' | 'neutral-fallback';
}

const resolvePlayingTimeReliability = (
  provided: number | null,
  appearances: readonly RecentAppearance[],
  weights: readonly number[]
): DerivedReliability => {
  if (provided !== null && Number.isFinite(provided)) {
    return { percentile: clampPercentile(provided), source: 'provided' };
  }

  let weightedReliability = 0;
  let totalWeight = 0;
  appearances.slice(0, weights.length).forEach((appearance, index) => {
    if (typeof appearance.started !== 'boolean') {
      return;
    }
    const weight = weights[index];
    if (weight === undefined) {
      return;
    }

    const minutesShare = clamp(normaliseMinutes(appearance.minutes) / 90, 0, 1);
    const appearanceReliability = (appearance.started ? 0.5 : 0) + minutesShare * 0.5;
    weightedReliability += appearanceReliability * weight;
    totalWeight += weight;
  });

  if (totalWeight === 0) {
    return { percentile: null, source: 'neutral-fallback' };
  }
  return { percentile: weightedReliability / totalWeight, source: 'derived' };
};

const validateMoney = (value: number, label: string): MoneyMinor => {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a non-negative finite minor-unit value.`);
  }
  return roundMoney(value);
};

const validateRuleSet = (rules: ValuationRuleSet): void => {
  if (rules.version.trim().length === 0) {
    throw new Error('A valuation rule set must have a non-empty version.');
  }
  if (
    !Number.isSafeInteger(rules.minimumValueMinor) ||
    !Number.isSafeInteger(rules.maximumValueMinor) ||
    rules.minimumValueMinor <= 0 ||
    rules.maximumValueMinor <= rules.minimumValueMinor
  ) {
    throw new Error('Valuation minimum and maximum must be safe minor-unit integers.');
  }

  const componentWeightValues: readonly number[] = [
    rules.componentWeights.seasonPerformance,
    rules.componentWeights.recentForm,
    rules.componentWeights.playingTimeReliability,
    rules.componentWeights.availability
  ];
  const weightTotal = componentWeightValues.reduce((total, weight) => total + weight, 0);
  if (Math.abs(weightTotal - 1) > 0.000_001) {
    throw new Error('Valuation component weights must sum to 1.');
  }
  if (componentWeightValues.some((weight) => !Number.isFinite(weight) || weight < 0)) {
    throw new Error('Valuation component weights cannot be negative.');
  }
  if (
    !Number.isFinite(rules.maximumDailyMovement) ||
    rules.maximumDailyMovement <= 0 ||
    rules.maximumDailyMovement > 1
  ) {
    throw new Error('Maximum daily movement must be between 0 and 1.');
  }
  if (
    !Number.isFinite(rules.targetConvergenceRate) ||
    rules.targetConvergenceRate <= 0 ||
    rules.targetConvergenceRate > 1
  ) {
    throw new Error('Target convergence rate must be between 0 and 1.');
  }
  if (rules.minimumReliableSeasonMinutes <= 0 || rules.minimumReliableRecentMinutes <= 0) {
    throw new Error('Minimum reliable minute thresholds must be positive.');
  }
  if (
    rules.recentAppearanceWeights.length === 0 ||
    rules.recentAppearanceWeights.some((weight) => weight <= 0)
  ) {
    throw new Error('Recent-appearance weights must be positive and non-empty.');
  }

  const positionBaselines: readonly number[] = [
    rules.positionBaselinesMinor.GK,
    rules.positionBaselinesMinor.DEF,
    rules.positionBaselinesMinor.MID,
    rules.positionBaselinesMinor.FWD
  ];
  for (const baseline of positionBaselines) {
    if (
      !Number.isSafeInteger(baseline) ||
      baseline < rules.minimumValueMinor ||
      baseline > rules.maximumValueMinor
    ) {
      throw new Error('Every position baseline must be within the valuation bounds.');
    }
  }
};

const contributionForPercentile = (
  percentile: number,
  weight: number,
  baselineMinor: MoneyMinor,
  rules: ValuationRuleSet
): MoneyMinor => {
  const offsetFromNeutral = (percentile - 0.5) * 2;
  const availableRange =
    offsetFromNeutral >= 0
      ? rules.maximumValueMinor - baselineMinor
      : baselineMinor - rules.minimumValueMinor;
  return roundMoney(offsetFromNeutral * availableRange * weight);
};

const directionFor = (amount: number): 'increase' | 'decrease' | 'neutral' =>
  amount > 0 ? 'increase' : amount < 0 ? 'decrease' : 'neutral';

const explanationCode: Record<ValuationComponentName, ValuationExplanationCode> = {
  seasonPerformance: 'season-performance',
  recentForm: 'recent-form',
  playingTimeReliability: 'playing-time-reliability',
  availability: 'availability'
};

export const calculatePlayerValuation = (
  input: ValuationInput,
  rules: ValuationRuleSet = DEFAULT_VALUATION_RULE_SET
): PlayerValuationResult => {
  validateRuleSet(rules);

  const baselineMinor = rules.positionBaselinesMinor[input.position];
  const initialValueMinor =
    input.initialValueMinor === null || input.initialValueMinor === undefined
      ? baselineMinor
      : clamp(
          validateMoney(input.initialValueMinor, 'Initial value'),
          rules.minimumValueMinor,
          rules.maximumValueMinor
        );
  const previousValueMinor =
    input.currentValueMinor === null || input.currentValueMinor === undefined
      ? initialValueMinor
      : clamp(
          validateMoney(input.currentValueMinor, 'Current value'),
          rules.minimumValueMinor,
          rules.maximumValueMinor
        );
  const seasonMinutes = normaliseMinutes(input.seasonMinutes);

  const seasonRaw =
    input.seasonPerformancePercentile === null ||
    !Number.isFinite(input.seasonPerformancePercentile)
      ? null
      : clampPercentile(input.seasonPerformancePercentile);
  const seasonAdjusted = sampleAdjustedPercentile(
    seasonRaw,
    seasonMinutes,
    rules.minimumReliableSeasonMinutes
  );
  const recent = calculateWeightedRecentForm(
    input.recentAppearances,
    rules.recentAppearanceWeights,
    rules.minimumReliableRecentMinutes
  );
  const reliability = resolvePlayingTimeReliability(
    input.playingTimeReliability,
    input.recentAppearances,
    rules.recentAppearanceWeights
  );
  const reliabilityPercentile = reliability.percentile ?? 0.5;
  const availabilityRaw =
    input.availability === null || !Number.isFinite(input.availability)
      ? null
      : clampPercentile(input.availability);
  const availabilityPercentile = availabilityRaw ?? 0.5;

  const componentInputs: ReadonlyArray<{
    component: ValuationComponentName;
    weight: number;
    rawPercentile: number | null;
    adjustedPercentile: number;
    sampleMinutes: number | null;
    sampleReliability: number;
    source: 'provided' | 'derived' | 'neutral-fallback';
  }> = [
    {
      component: 'seasonPerformance',
      weight: rules.componentWeights.seasonPerformance,
      rawPercentile: seasonRaw,
      adjustedPercentile: seasonAdjusted.adjusted,
      sampleMinutes: seasonMinutes,
      sampleReliability: seasonAdjusted.reliability,
      source: seasonRaw === null ? 'neutral-fallback' : 'provided'
    },
    {
      component: 'recentForm',
      weight: rules.componentWeights.recentForm,
      rawPercentile: recent.rawPercentile,
      adjustedPercentile: recent.adjustedPercentile,
      sampleMinutes: recent.sampleMinutes,
      sampleReliability: recent.sampleReliability,
      source: recent.rawPercentile === null ? 'neutral-fallback' : 'derived'
    },
    {
      component: 'playingTimeReliability',
      weight: rules.componentWeights.playingTimeReliability,
      rawPercentile: reliability.percentile,
      adjustedPercentile: reliabilityPercentile,
      sampleMinutes: null,
      sampleReliability: reliability.percentile === null ? 0 : 1,
      source: reliability.source
    },
    {
      component: 'availability',
      weight: rules.componentWeights.availability,
      rawPercentile: availabilityRaw,
      adjustedPercentile: availabilityPercentile,
      sampleMinutes: null,
      sampleReliability: availabilityRaw === null ? 0 : 1,
      source: availabilityRaw === null ? 'neutral-fallback' : 'provided'
    }
  ];

  const components: ValuationComponentResult[] = componentInputs.map((component) => ({
    ...component,
    contributionMinor: contributionForPercentile(
      component.adjustedPercentile,
      component.weight,
      baselineMinor,
      rules
    )
  }));

  const normalTargetValueMinor = clamp(
    baselineMinor + components.reduce((total, component) => total + component.contributionMinor, 0),
    rules.minimumValueMinor,
    rules.maximumValueMinor
  );

  const explanation: ValuationExplanationItem[] = components.map((component) => ({
    code: explanationCode[component.component],
    component: component.component,
    direction: directionFor(component.contributionMinor),
    impactMinor: component.contributionMinor,
    details: {
      weight: component.weight,
      rawPercentile: component.rawPercentile,
      adjustedPercentile: component.adjustedPercentile,
      sampleMinutes: component.sampleMinutes,
      sampleReliability: component.sampleReliability,
      source: component.source
    }
  }));

  const provisional = seasonRaw === null || seasonMinutes < rules.minimumReliableSeasonMinutes;
  if (provisional) {
    explanation.push({
      code: 'provisional-baseline',
      component: null,
      direction: 'neutral',
      impactMinor: 0,
      details: {
        positionBaselineMinor: baselineMinor,
        observedSeasonMinutes: seasonMinutes,
        requiredSeasonMinutes: rules.minimumReliableSeasonMinutes
      }
    });
  }

  const override = input.adminOverride ?? null;
  if (override !== null && override.reason.trim().length === 0) {
    throw new Error('An administrator valuation override requires a reason.');
  }
  const targetValueMinor =
    override === null
      ? normalTargetValueMinor
      : clamp(
          validateMoney(override.valueMinor, 'Administrator override'),
          rules.minimumValueMinor,
          rules.maximumValueMinor
        );

  if (override !== null) {
    const overrideImpact = targetValueMinor - normalTargetValueMinor;
    explanation.push({
      code: 'administrator-override',
      component: null,
      direction: directionFor(overrideImpact),
      impactMinor: overrideImpact,
      details: {
        reason: override.reason,
        requestedValueMinor: override.valueMinor,
        appliedValueMinor: targetValueMinor,
        bypassDailyCap: override.bypassDailyCap === true
      }
    });
  }

  const bypassDailyCap = override?.bypassDailyCap === true;
  const targetGap = targetValueMinor - previousValueMinor;
  let proposedChange = bypassDailyCap
    ? targetGap
    : roundMoney(targetGap * rules.targetConvergenceRate);
  if (proposedChange === 0 && targetGap !== 0) {
    proposedChange = Math.sign(targetGap);
  }

  const maximumChangeMinor = Math.max(
    1,
    Math.floor(previousValueMinor * rules.maximumDailyMovement)
  );
  const cappedChange = bypassDailyCap
    ? proposedChange
    : clamp(proposedChange, -maximumChangeMinor, maximumChangeMinor);
  const dailyCapApplied = !bypassDailyCap && cappedChange !== proposedChange;
  let currentValueMinor = clamp(
    previousValueMinor + cappedChange,
    rules.minimumValueMinor,
    rules.maximumValueMinor
  );
  currentValueMinor = roundMoney(currentValueMinor);
  const valueChangeAmountMinor = currentValueMinor - previousValueMinor;

  if (dailyCapApplied) {
    explanation.push({
      code: 'daily-movement-cap',
      component: null,
      direction: directionFor(valueChangeAmountMinor),
      impactMinor: valueChangeAmountMinor - proposedChange,
      details: {
        maximumMovementRate: rules.maximumDailyMovement,
        maximumMovementMinor: maximumChangeMinor,
        proposedChangeMinor: proposedChange,
        appliedChangeMinor: valueChangeAmountMinor
      }
    });
  }

  return {
    ruleVersion: rules.version,
    position: input.position,
    initialValueMinor,
    previousValueMinor,
    normalTargetValueMinor,
    targetValueMinor,
    currentValueMinor,
    valueChangeAmountMinor,
    valueChangePercentage: roundPercentage((valueChangeAmountMinor / previousValueMinor) * 100),
    provisional,
    dailyCapApplied,
    adminOverrideApplied: override !== null,
    components,
    explanation
  };
};
