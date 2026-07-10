export const PRODUCT = {
  name: 'Monkey Managers',
  shortName: 'Managers',
  tagline: 'Build your club. Own the moment.',
  demoLeagueName: 'Friday Night Football',
  supportEmail: 'support@example.invalid'
} as const;

export const GAME_DEFAULTS = {
  startingBudgetMinor: 100_000_000_00,
  releasePercentage: 0.9,
  captainMultiplier: 1.5,
  timezone: 'Europe/London',
  nightlySyncTime: '03:30',
  minimumPriceMinor: 500_000_00,
  maximumPriceMinor: 25_000_000_00,
  maximumDailyMovement: 0.05
} as const;
