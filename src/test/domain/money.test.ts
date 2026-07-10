import { describe, expect, it } from 'vitest';

import {
  appendLedgerEntry,
  applyBasisPoints,
  balanceFromLedger,
  calculateClubFinances,
  type LedgerEntry
} from '../../domain/money';

const initialEntry: LedgerEntry = {
  id: 'ledger-initial-a',
  leagueId: 'league-1',
  clubId: 'club-a',
  amountMinor: 10_000_000_000,
  reason: 'initial_budget',
  operationId: 'initial-a',
  createdAt: '2026-07-01T00:00:00.000Z'
};

describe('exact money and immutable ledgers', () => {
  it('reproduces the available balance solely from immutable entries', () => {
    const afterPurchase = appendLedgerEntry([initialEntry], {
      id: 'purchase-1-ledger',
      leagueId: 'league-1',
      clubId: 'club-a',
      amountMinor: -1_250_000_00,
      reason: 'free_agent_purchase',
      operationId: 'purchase-1',
      createdAt: '2026-07-02T00:00:00.000Z',
      referenceId: 'player-1'
    });

    expect(balanceFromLedger(afterPurchase)).toBe(9_875_000_000);
    expect(initialEntry.amountMinor).toBe(10_000_000_000);
  });

  it('calculates balance, squad book value and total club value', () => {
    expect(
      calculateClubFinances(
        'club-a',
        [initialEntry],
        [
          {
            playerId: 'player-1',
            clubId: 'club-a',
            currentValueMinor: 550_000_000
          },
          {
            playerId: 'player-2',
            clubId: 'club-a',
            currentValueMinor: 325_000_000
          },
          {
            playerId: 'other-player',
            clubId: 'club-b',
            currentValueMinor: 999_000_000
          }
        ]
      )
    ).toEqual({
      availableBalanceMinor: 10_000_000_000,
      squadBookValueMinor: 875_000_000,
      totalClubValueMinor: 10_875_000_000
    });
  });

  it('uses explicit integer rounding for release percentages', () => {
    expect(applyBasisPoints(12_345, 9_000)).toBe(11_110);
    expect(applyBasisPoints(12_345, 9_000, 'round')).toBe(11_111);
  });

  it('rejects fractional money and duplicate financial operations', () => {
    expect(() =>
      appendLedgerEntry([], {
        ...initialEntry,
        amountMinor: 1.5
      })
    ).toThrow(/integer minor-unit/);

    expect(() =>
      appendLedgerEntry([initialEntry], {
        ...initialEntry,
        id: 'different-id'
      })
    ).toThrow(/already has a ledger entry/);
  });
});
