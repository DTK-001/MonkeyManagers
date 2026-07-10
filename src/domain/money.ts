/**
 * Exact-money helpers. All monetary values are integer minor units (pence for GBP).
 * No function in this module accepts a fractional or unsafe integer.
 */

export type MinorUnits = number;

export const BASIS_POINTS_PER_UNIT = 10_000;

export type LedgerReason =
  | 'initial_budget'
  | 'free_agent_purchase'
  | 'player_release'
  | 'manager_transfer'
  | 'transfer_refund'
  | 'administrator_adjustment'
  | 'competition_prize';

export interface LedgerEntry {
  readonly id: string;
  readonly leagueId: string;
  readonly clubId: string;
  /** Positive values are credits; negative values are debits. */
  readonly amountMinor: MinorUnits;
  readonly reason: LedgerReason;
  readonly operationId: string;
  readonly createdAt: string;
  readonly referenceId?: string;
  readonly note?: string;
}

export interface OwnedPlayerValue {
  readonly playerId: string;
  readonly clubId: string;
  readonly currentValueMinor: MinorUnits;
}

export interface ClubFinances {
  readonly availableBalanceMinor: MinorUnits;
  readonly squadBookValueMinor: MinorUnits;
  readonly totalClubValueMinor: MinorUnits;
}

export function assertMinorUnits(
  value: number,
  label = 'money value'
): asserts value is MinorUnits {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${label} must be an integer minor-unit value`);
  }
}

export function assertNonNegativeMinorUnits(
  value: number,
  label = 'money value'
): asserts value is MinorUnits {
  assertMinorUnits(value, label);
  if (value < 0) {
    throw new RangeError(`${label} cannot be negative`);
  }
}

export function addMinorUnits(...amounts: readonly MinorUnits[]): MinorUnits {
  let total = 0;
  for (const amount of amounts) {
    assertMinorUnits(amount);
    total += amount;
    assertMinorUnits(total, 'money total');
  }
  return total;
}

/** Applies an integer basis-point rate using an explicit rounding policy. */
export function applyBasisPoints(
  amountMinor: MinorUnits,
  basisPoints: number,
  rounding: 'floor' | 'round' | 'ceil' = 'floor'
): MinorUnits {
  assertNonNegativeMinorUnits(amountMinor, 'amount');
  if (!Number.isInteger(basisPoints) || basisPoints < 0) {
    throw new RangeError('basisPoints must be a non-negative integer');
  }

  const raw = (amountMinor * basisPoints) / BASIS_POINTS_PER_UNIT;
  if (!Number.isSafeInteger(amountMinor * basisPoints)) {
    throw new RangeError('basis-point calculation exceeds safe integer range');
  }

  const rounded =
    rounding === 'ceil' ? Math.ceil(raw) : rounding === 'round' ? Math.round(raw) : Math.floor(raw);
  assertMinorUnits(rounded, 'basis-point result');
  return rounded;
}

export function balanceFromLedger(entries: readonly LedgerEntry[], clubId?: string): MinorUnits {
  return entries.reduce((balance, entry) => {
    if (clubId !== undefined && entry.clubId !== clubId) {
      return balance;
    }
    assertMinorUnits(entry.amountMinor, 'ledger amount');
    return addMinorUnits(balance, entry.amountMinor);
  }, 0);
}

/**
 * Adds a ledger entry without mutating the source. An operation may create at
 * most one entry for a given club, making command retries replay-safe.
 */
export function appendLedgerEntry(
  entries: readonly LedgerEntry[],
  entry: LedgerEntry
): readonly LedgerEntry[] {
  assertMinorUnits(entry.amountMinor, 'ledger amount');
  if (entry.amountMinor === 0) {
    throw new RangeError('zero-value ledger entries are not permitted');
  }
  if (entries.some((candidate) => candidate.id === entry.id)) {
    throw new Error(`ledger entry ${entry.id} already exists`);
  }
  if (
    entries.some(
      (candidate) =>
        candidate.clubId === entry.clubId && candidate.operationId === entry.operationId
    )
  ) {
    throw new Error(
      `operation ${entry.operationId} already has a ledger entry for club ${entry.clubId}`
    );
  }
  return [...entries, Object.freeze({ ...entry })];
}

export function calculateClubFinances(
  clubId: string,
  ledgerEntries: readonly LedgerEntry[],
  ownedPlayers: readonly OwnedPlayerValue[]
): ClubFinances {
  const availableBalanceMinor = balanceFromLedger(ledgerEntries, clubId);
  const squadBookValueMinor = ownedPlayers.reduce((total, player) => {
    if (player.clubId !== clubId) {
      return total;
    }
    assertNonNegativeMinorUnits(player.currentValueMinor, 'player value');
    return addMinorUnits(total, player.currentValueMinor);
  }, 0);

  return {
    availableBalanceMinor,
    squadBookValueMinor,
    totalClubValueMinor: addMinorUnits(availableBalanceMinor, squadBookValueMinor)
  };
}

export function formatMinorUnits(
  amountMinor: MinorUnits,
  currency = 'GBP',
  locale = 'en-GB'
): string {
  assertMinorUnits(amountMinor);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amountMinor / 100);
}
