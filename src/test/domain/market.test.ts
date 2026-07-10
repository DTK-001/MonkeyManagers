import { describe, expect, it } from 'vitest';

import {
  acceptTransfer,
  assertUniqueActiveOwnerships,
  getClubBalance,
  purchaseFreeAgent,
  releasePlayer,
  type ActiveOwnership,
  type MarketState,
  type TransferOffer
} from '../../domain/market';

const now = '2026-07-10T12:00:00.000Z';

function stateWithBudget(
  budgetA = 10_000,
  budgetB = 10_000,
  ownerships: readonly ActiveOwnership[] = []
): MarketState {
  return {
    leagueId: 'league-1',
    marketStatus: 'open',
    releasePercentageBps: 9_000,
    accounts: [
      {
        leagueId: 'league-1',
        clubId: 'club-a',
        ledger: [
          {
            id: 'initial-a',
            leagueId: 'league-1',
            clubId: 'club-a',
            amountMinor: budgetA,
            reason: 'initial_budget',
            operationId: 'initial-a',
            createdAt: now
          }
        ]
      },
      {
        leagueId: 'league-1',
        clubId: 'club-b',
        ledger: [
          {
            id: 'initial-b',
            leagueId: 'league-1',
            clubId: 'club-b',
            amountMinor: budgetB,
            reason: 'initial_budget',
            operationId: 'initial-b',
            createdAt: now
          }
        ]
      }
    ],
    activeOwnerships: ownerships,
    ownershipHistory: [],
    completedOperations: []
  };
}

function ownership(playerId: string, clubId: string): ActiveOwnership {
  return {
    id: `ownership-${playerId}`,
    leagueId: 'league-1',
    playerId,
    clubId,
    acquiredAt: now,
    acquiredPriceMinor: 1_000,
    operationId: `acquire-${playerId}`
  };
}

describe('free-agent market operations', () => {
  it('purchases a player and atomically records ownership, history and ledger', () => {
    const original = stateWithBudget();
    const result = purchaseFreeAgent(original, {
      clubId: 'club-a',
      playerId: 'player-1',
      priceMinor: 2_500,
      purchasedAt: now,
      idempotencyKey: 'buy-1'
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    expect(getClubBalance(result.state, 'club-a')).toBe(7_500);
    expect(result.state.activeOwnerships).toHaveLength(1);
    expect(result.state.activeOwnerships[0]?.clubId).toBe('club-a');
    expect(result.state.ownershipHistory[0]?.eventType).toBe('purchased');
    expect(result.state.accounts[0]?.ledger).toHaveLength(2);
    expect(original.activeOwnerships).toHaveLength(0);
  });

  it('allows exactly one winner when two clubs race for the same player', () => {
    const first = purchaseFreeAgent(stateWithBudget(), {
      clubId: 'club-a',
      playerId: 'contested-player',
      priceMinor: 1_000,
      purchasedAt: now,
      idempotencyKey: 'race-a'
    });
    if (!first.ok) throw new Error(first.error.message);

    const second = purchaseFreeAgent(first.state, {
      clubId: 'club-b',
      playerId: 'contested-player',
      priceMinor: 1_000,
      purchasedAt: now,
      idempotencyKey: 'race-b'
    });

    expect(second.ok).toBe(false);
    if (second.ok) throw new Error('the second purchase unexpectedly succeeded');
    expect(second.error.code).toBe('PLAYER_ALREADY_OWNED');
    expect(second.error.message).toMatch(/just been purchased/i);
    expect(second.state.activeOwnerships).toHaveLength(1);
    expect(getClubBalance(second.state, 'club-b')).toBe(10_000);
  });

  it('fails without mutating anything when funds are insufficient', () => {
    const state = stateWithBudget(999);
    const result = purchaseFreeAgent(state, {
      clubId: 'club-a',
      playerId: 'expensive-player',
      priceMinor: 1_000,
      purchasedAt: now,
      idempotencyKey: 'too-expensive'
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('purchase unexpectedly succeeded');
    expect(result.error.code).toBe('INSUFFICIENT_FUNDS');
    expect(result.state).toBe(state);
    expect(state.accounts[0]?.ledger).toHaveLength(1);
  });

  it('replays the same idempotency key without duplicating records', () => {
    const first = purchaseFreeAgent(stateWithBudget(), {
      clubId: 'club-a',
      playerId: 'player-1',
      priceMinor: 2_500,
      purchasedAt: now,
      idempotencyKey: 'stable-buy'
    });
    if (!first.ok) throw new Error(first.error.message);

    const replay = purchaseFreeAgent(first.state, {
      clubId: 'club-a',
      playerId: 'player-1',
      priceMinor: 2_500,
      purchasedAt: '2026-07-10T12:00:01.000Z',
      idempotencyKey: 'stable-buy'
    });

    expect(replay.ok).toBe(true);
    if (!replay.ok) throw new Error(replay.error.message);
    expect(replay.replayed).toBe(true);
    expect(replay.state.activeOwnerships).toHaveLength(1);
    expect(replay.state.accounts[0]?.ledger).toHaveLength(2);
  });

  it('releases a player for the configured exact percentage', () => {
    const state = stateWithBudget(10_000, 10_000, [ownership('player-1', 'club-a')]);
    const result = releasePlayer(state, {
      clubId: 'club-a',
      playerId: 'player-1',
      currentValueMinor: 3_333,
      releasedAt: now,
      idempotencyKey: 'release-1'
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.receipt.proceedsMinor).toBe(2_999);
    expect(getClubBalance(result.state, 'club-a')).toBe(12_999);
    expect(result.state.activeOwnerships).toHaveLength(0);
    expect(result.state.ownershipHistory[0]).toMatchObject({
      eventType: 'released',
      fromClubId: 'club-a',
      toClubId: null
    });
  });
});

describe('manager transfers and ownership integrity', () => {
  const offer: TransferOffer = {
    id: 'offer-1',
    leagueId: 'league-1',
    status: 'pending',
    expiresAt: '2026-07-11T12:00:00.000Z',
    playerMoves: [
      {
        playerId: 'player-a',
        fromClubId: 'club-a',
        toClubId: 'club-b'
      }
    ],
    cashPayments: [{ fromClubId: 'club-b', toClubId: 'club-a', amountMinor: 2_500 }]
  };

  it('accepts a one-player-plus-cash offer as one atomic operation', () => {
    const result = acceptTransfer(
      stateWithBudget(10_000, 5_000, [ownership('player-a', 'club-a')]),
      { offer, acceptedAt: now, idempotencyKey: 'accept-1' }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state.activeOwnerships[0]?.clubId).toBe('club-b');
    expect(getClubBalance(result.state, 'club-a')).toBe(12_500);
    expect(getClubBalance(result.state, 'club-b')).toBe(2_500);
    expect(result.state.ownershipHistory[0]?.eventType).toBe('transferred');
  });

  it('rejects changed ownership and insufficient funds without a partial write', () => {
    const changedState = stateWithBudget(10_000, 5_000, [ownership('player-a', 'club-b')]);
    const changed = acceptTransfer(changedState, {
      offer,
      acceptedAt: now,
      idempotencyKey: 'changed-owner'
    });
    expect(changed.ok).toBe(false);
    if (changed.ok) throw new Error('transfer unexpectedly succeeded');
    expect(changed.error.code).toBe('OWNERSHIP_CHANGED');
    expect(changed.state).toBe(changedState);

    const poorState = stateWithBudget(10_000, 2_499, [ownership('player-a', 'club-a')]);
    const poor = acceptTransfer(poorState, {
      offer,
      acceptedAt: now,
      idempotencyKey: 'not-enough-cash'
    });
    expect(poor.ok).toBe(false);
    if (poor.ok) throw new Error('transfer unexpectedly succeeded');
    expect(poor.error.code).toBe('INSUFFICIENT_FUNDS');
    expect(poor.state).toBe(poorState);
    expect(getClubBalance(poorState, 'club-a')).toBe(10_000);
  });

  it('detects duplicate active owners within a league', () => {
    expect(() =>
      assertUniqueActiveOwnerships([
        ownership('player-a', 'club-a'),
        { ...ownership('player-a', 'club-b'), id: 'duplicate' }
      ])
    ).toThrow(/multiple active owners/);

    expect(() =>
      assertUniqueActiveOwnerships([
        ownership('player-a', 'club-a'),
        {
          ...ownership('player-a', 'club-b'),
          id: 'other-league-owner',
          leagueId: 'league-2'
        }
      ])
    ).not.toThrow();
  });
});
