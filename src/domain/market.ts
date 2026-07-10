import {
  appendLedgerEntry,
  applyBasisPoints,
  assertNonNegativeMinorUnits,
  balanceFromLedger,
  type LedgerEntry,
  type MinorUnits
} from './money';

export type TransferMarketStatus = 'initial_open' | 'open' | 'paused' | 'closed';

export interface ClubAccount {
  readonly leagueId: string;
  readonly clubId: string;
  readonly ledger: readonly LedgerEntry[];
}

export interface ActiveOwnership {
  readonly id: string;
  readonly leagueId: string;
  readonly playerId: string;
  readonly clubId: string;
  readonly acquiredAt: string;
  readonly acquiredPriceMinor: MinorUnits;
  readonly operationId: string;
}

export type OwnershipEventType = 'purchased' | 'released' | 'transferred';

export interface OwnershipHistoryEvent {
  readonly id: string;
  readonly leagueId: string;
  readonly playerId: string;
  readonly fromClubId: string | null;
  readonly toClubId: string | null;
  readonly eventType: OwnershipEventType;
  readonly feeMinor: MinorUnits | null;
  readonly occurredAt: string;
  readonly operationId: string;
}

interface OperationReceiptBase {
  readonly operationId: string;
  readonly fingerprint: string;
  readonly balancesMinor: Readonly<Record<string, MinorUnits>>;
}

export interface PurchaseReceipt extends OperationReceiptBase {
  readonly kind: 'purchase';
  readonly playerId: string;
  readonly ownerClubId: string;
  readonly priceMinor: MinorUnits;
}

export interface ReleaseReceipt extends OperationReceiptBase {
  readonly kind: 'release';
  readonly playerId: string;
  readonly formerOwnerClubId: string;
  readonly proceedsMinor: MinorUnits;
}

export interface TransferReceipt extends OperationReceiptBase {
  readonly kind: 'transfer';
  readonly offerId: string;
  readonly movedPlayerIds: readonly string[];
}

export type MarketOperationReceipt = PurchaseReceipt | ReleaseReceipt | TransferReceipt;

export interface MarketState {
  readonly leagueId: string;
  readonly marketStatus: TransferMarketStatus;
  readonly releasePercentageBps: number;
  readonly accounts: readonly ClubAccount[];
  readonly activeOwnerships: readonly ActiveOwnership[];
  readonly ownershipHistory: readonly OwnershipHistoryEvent[];
  readonly completedOperations: readonly MarketOperationReceipt[];
}

export type MarketErrorCode =
  | 'CLUB_NOT_FOUND'
  | 'MARKET_CLOSED'
  | 'PLAYER_ALREADY_OWNED'
  | 'PLAYER_NOT_OWNED'
  | 'INSUFFICIENT_FUNDS'
  | 'OWNERSHIP_CHANGED'
  | 'OFFER_NOT_ACTIVE'
  | 'OFFER_EXPIRED'
  | 'INVALID_TRANSFER'
  | 'INVALID_INPUT'
  | 'IDEMPOTENCY_CONFLICT';

export interface MarketFailure {
  readonly ok: false;
  readonly state: MarketState;
  readonly error: {
    readonly code: MarketErrorCode;
    readonly message: string;
  };
}

export interface MarketSuccess<TReceipt extends MarketOperationReceipt> {
  readonly ok: true;
  readonly state: MarketState;
  readonly receipt: TReceipt;
  readonly replayed: boolean;
}

export type MarketResult<TReceipt extends MarketOperationReceipt> =
  | MarketSuccess<TReceipt>
  | MarketFailure;

export interface PurchaseFreeAgentInput {
  readonly clubId: string;
  readonly playerId: string;
  readonly priceMinor: MinorUnits;
  readonly purchasedAt: string;
  readonly idempotencyKey: string;
}

export interface ReleasePlayerInput {
  readonly clubId: string;
  readonly playerId: string;
  readonly currentValueMinor: MinorUnits;
  readonly releasedAt: string;
  readonly idempotencyKey: string;
}

export interface TransferPlayerMove {
  readonly playerId: string;
  readonly fromClubId: string;
  readonly toClubId: string;
}

export interface TransferCashPayment {
  readonly fromClubId: string;
  readonly toClubId: string;
  readonly amountMinor: MinorUnits;
}

export type TransferOfferStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'countered'
  | 'withdrawn'
  | 'expired';

export interface TransferOffer {
  readonly id: string;
  readonly leagueId: string;
  readonly status: TransferOfferStatus;
  readonly expiresAt: string | null;
  readonly playerMoves: readonly TransferPlayerMove[];
  readonly cashPayments: readonly TransferCashPayment[];
}

export interface AcceptTransferInput {
  readonly offer: TransferOffer;
  readonly acceptedAt: string;
  readonly idempotencyKey: string;
}

function failure(state: MarketState, code: MarketErrorCode, message: string): MarketFailure {
  return { ok: false, state, error: { code, message } };
}

function accountFor(state: MarketState, clubId: string): ClubAccount | undefined {
  return state.accounts.find((account) => account.clubId === clubId);
}

export function getClubBalance(state: MarketState, clubId: string): MinorUnits {
  const account = accountFor(state, clubId);
  if (account === undefined) {
    throw new Error(`club ${clubId} does not have an account`);
  }
  return balanceFromLedger(account.ledger);
}

export function findActiveOwner(state: MarketState, playerId: string): ActiveOwnership | undefined {
  return state.activeOwnerships.find(
    (ownership) => ownership.leagueId === state.leagueId && ownership.playerId === playerId
  );
}

export function assertUniqueActiveOwnerships(ownerships: readonly ActiveOwnership[]): void {
  const identities = new Set<string>();
  for (const ownership of ownerships) {
    const identity = `${ownership.leagueId}\u0000${ownership.playerId}`;
    if (identities.has(identity)) {
      throw new Error(
        `player ${ownership.playerId} has multiple active owners in league ${ownership.leagueId}`
      );
    }
    identities.add(identity);
  }
}

export function validateMarketState(state: MarketState): readonly string[] {
  const errors: string[] = [];
  try {
    assertUniqueActiveOwnerships(state.activeOwnerships);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  const clubIds = new Set<string>();
  for (const account of state.accounts) {
    if (account.leagueId !== state.leagueId) {
      errors.push(`club ${account.clubId} belongs to a different league`);
    }
    if (clubIds.has(account.clubId)) {
      errors.push(`club ${account.clubId} has multiple accounts`);
    }
    clubIds.add(account.clubId);
    if (balanceFromLedger(account.ledger) < 0) {
      errors.push(`club ${account.clubId} has a negative balance`);
    }
  }
  for (const ownership of state.activeOwnerships) {
    if (!clubIds.has(ownership.clubId)) {
      errors.push(`ownership ${ownership.id} refers to an unknown club`);
    }
    if (ownership.leagueId !== state.leagueId) {
      errors.push(`ownership ${ownership.id} belongs to a different league`);
    }
  }
  return errors;
}

function fingerprint(parts: readonly (string | number)[]): string {
  return parts.map((part) => encodeURIComponent(String(part))).join('|');
}

function existingOperation(
  state: MarketState,
  operationId: string
): MarketOperationReceipt | undefined {
  return state.completedOperations.find((operation) => operation.operationId === operationId);
}

function replaceAccount(
  accounts: readonly ClubAccount[],
  nextAccount: ClubAccount
): readonly ClubAccount[] {
  return accounts.map((account) => (account.clubId === nextAccount.clubId ? nextAccount : account));
}

function isoTimeIsValid(value: string): boolean {
  return value.trim().length > 0 && Number.isFinite(Date.parse(value));
}

export function purchaseFreeAgent(
  state: MarketState,
  input: PurchaseFreeAgentInput
): MarketResult<PurchaseReceipt> {
  const operationFingerprint = fingerprint([
    'purchase',
    state.leagueId,
    input.clubId,
    input.playerId,
    input.priceMinor
  ]);
  const prior = existingOperation(state, input.idempotencyKey);
  if (prior !== undefined) {
    if (prior.kind === 'purchase' && prior.fingerprint === operationFingerprint) {
      return { ok: true, state, receipt: prior, replayed: true };
    }
    return failure(
      state,
      'IDEMPOTENCY_CONFLICT',
      'That request identifier has already been used for a different operation.'
    );
  }

  try {
    assertNonNegativeMinorUnits(input.priceMinor, 'purchase price');
  } catch (error) {
    return failure(state, 'INVALID_INPUT', error instanceof Error ? error.message : String(error));
  }
  if (input.priceMinor === 0 || !isoTimeIsValid(input.purchasedAt)) {
    return failure(
      state,
      'INVALID_INPUT',
      'A purchase needs a positive price and valid timestamp.'
    );
  }
  if (state.marketStatus !== 'open' && state.marketStatus !== 'initial_open') {
    return failure(state, 'MARKET_CLOSED', 'The transfer market is not open right now.');
  }
  const account = accountFor(state, input.clubId);
  if (account === undefined) {
    return failure(state, 'CLUB_NOT_FOUND', 'Your club account could not be found.');
  }
  if (findActiveOwner(state, input.playerId) !== undefined) {
    return failure(
      state,
      'PLAYER_ALREADY_OWNED',
      'That player has just been purchased by another manager.'
    );
  }
  const currentBalance = balanceFromLedger(account.ledger);
  if (currentBalance < input.priceMinor) {
    return failure(
      state,
      'INSUFFICIENT_FUNDS',
      'Your club does not have enough available transfer funds.'
    );
  }

  const ledgerEntry: LedgerEntry = {
    id: `${input.idempotencyKey}:ledger:${input.clubId}`,
    leagueId: state.leagueId,
    clubId: input.clubId,
    amountMinor: -input.priceMinor,
    reason: 'free_agent_purchase',
    operationId: input.idempotencyKey,
    createdAt: input.purchasedAt,
    referenceId: input.playerId
  };
  const nextAccount: ClubAccount = {
    ...account,
    ledger: appendLedgerEntry(account.ledger, ledgerEntry)
  };
  const ownership: ActiveOwnership = {
    id: `${state.leagueId}:${input.playerId}:${input.idempotencyKey}`,
    leagueId: state.leagueId,
    playerId: input.playerId,
    clubId: input.clubId,
    acquiredAt: input.purchasedAt,
    acquiredPriceMinor: input.priceMinor,
    operationId: input.idempotencyKey
  };
  const history: OwnershipHistoryEvent = {
    id: `${input.idempotencyKey}:history:${input.playerId}`,
    leagueId: state.leagueId,
    playerId: input.playerId,
    fromClubId: null,
    toClubId: input.clubId,
    eventType: 'purchased',
    feeMinor: input.priceMinor,
    occurredAt: input.purchasedAt,
    operationId: input.idempotencyKey
  };
  const receipt: PurchaseReceipt = {
    kind: 'purchase',
    operationId: input.idempotencyKey,
    fingerprint: operationFingerprint,
    balancesMinor: { [input.clubId]: currentBalance - input.priceMinor },
    playerId: input.playerId,
    ownerClubId: input.clubId,
    priceMinor: input.priceMinor
  };
  const nextState: MarketState = {
    ...state,
    accounts: replaceAccount(state.accounts, nextAccount),
    activeOwnerships: [...state.activeOwnerships, ownership],
    ownershipHistory: [...state.ownershipHistory, history],
    completedOperations: [...state.completedOperations, receipt]
  };
  assertUniqueActiveOwnerships(nextState.activeOwnerships);
  return { ok: true, state: nextState, receipt, replayed: false };
}

export function releasePlayer(
  state: MarketState,
  input: ReleasePlayerInput
): MarketResult<ReleaseReceipt> {
  const operationFingerprint = fingerprint([
    'release',
    state.leagueId,
    input.clubId,
    input.playerId,
    input.currentValueMinor,
    state.releasePercentageBps
  ]);
  const prior = existingOperation(state, input.idempotencyKey);
  if (prior !== undefined) {
    if (prior.kind === 'release' && prior.fingerprint === operationFingerprint) {
      return { ok: true, state, receipt: prior, replayed: true };
    }
    return failure(
      state,
      'IDEMPOTENCY_CONFLICT',
      'That request identifier has already been used for a different operation.'
    );
  }

  try {
    assertNonNegativeMinorUnits(input.currentValueMinor, 'current player value');
  } catch (error) {
    return failure(state, 'INVALID_INPUT', error instanceof Error ? error.message : String(error));
  }
  if (
    input.currentValueMinor === 0 ||
    !Number.isInteger(state.releasePercentageBps) ||
    state.releasePercentageBps < 0 ||
    state.releasePercentageBps > 10_000 ||
    !isoTimeIsValid(input.releasedAt)
  ) {
    return failure(state, 'INVALID_INPUT', 'The release settings are invalid.');
  }
  if (state.marketStatus !== 'open' && state.marketStatus !== 'initial_open') {
    return failure(state, 'MARKET_CLOSED', 'The transfer market is not open right now.');
  }
  const account = accountFor(state, input.clubId);
  if (account === undefined) {
    return failure(state, 'CLUB_NOT_FOUND', 'Your club account could not be found.');
  }
  const ownership = findActiveOwner(state, input.playerId);
  if (ownership === undefined || ownership.clubId !== input.clubId) {
    return failure(state, 'PLAYER_NOT_OWNED', 'That player is no longer owned by your club.');
  }

  const proceedsMinor = applyBasisPoints(input.currentValueMinor, state.releasePercentageBps);
  const currentBalance = balanceFromLedger(account.ledger);
  const ledgerEntry: LedgerEntry = {
    id: `${input.idempotencyKey}:ledger:${input.clubId}`,
    leagueId: state.leagueId,
    clubId: input.clubId,
    amountMinor: proceedsMinor,
    reason: 'player_release',
    operationId: input.idempotencyKey,
    createdAt: input.releasedAt,
    referenceId: input.playerId
  };
  const nextAccount: ClubAccount = {
    ...account,
    ledger: appendLedgerEntry(account.ledger, ledgerEntry)
  };
  const history: OwnershipHistoryEvent = {
    id: `${input.idempotencyKey}:history:${input.playerId}`,
    leagueId: state.leagueId,
    playerId: input.playerId,
    fromClubId: input.clubId,
    toClubId: null,
    eventType: 'released',
    feeMinor: proceedsMinor,
    occurredAt: input.releasedAt,
    operationId: input.idempotencyKey
  };
  const receipt: ReleaseReceipt = {
    kind: 'release',
    operationId: input.idempotencyKey,
    fingerprint: operationFingerprint,
    balancesMinor: { [input.clubId]: currentBalance + proceedsMinor },
    playerId: input.playerId,
    formerOwnerClubId: input.clubId,
    proceedsMinor
  };
  const nextState: MarketState = {
    ...state,
    accounts: replaceAccount(state.accounts, nextAccount),
    activeOwnerships: state.activeOwnerships.filter((candidate) => candidate.id !== ownership.id),
    ownershipHistory: [...state.ownershipHistory, history],
    completedOperations: [...state.completedOperations, receipt]
  };
  return { ok: true, state: nextState, receipt, replayed: false };
}

export function acceptTransfer(
  state: MarketState,
  input: AcceptTransferInput
): MarketResult<TransferReceipt> {
  const offer = input.offer;
  const moveSignature = [...offer.playerMoves]
    .map((move) => `${move.playerId}:${move.fromClubId}>${move.toClubId}`)
    .sort()
    .join(',');
  const cashSignature = [...offer.cashPayments]
    .map((payment) => `${payment.fromClubId}>${payment.toClubId}:${payment.amountMinor}`)
    .sort()
    .join(',');
  const operationFingerprint = fingerprint([
    'transfer',
    state.leagueId,
    offer.id,
    moveSignature,
    cashSignature
  ]);
  const prior = existingOperation(state, input.idempotencyKey);
  if (prior !== undefined) {
    if (prior.kind === 'transfer' && prior.fingerprint === operationFingerprint) {
      return { ok: true, state, receipt: prior, replayed: true };
    }
    return failure(
      state,
      'IDEMPOTENCY_CONFLICT',
      'That request identifier has already been used for a different operation.'
    );
  }

  if (state.marketStatus !== 'open') {
    return failure(state, 'MARKET_CLOSED', 'Manager transfers are not open right now.');
  }
  if (offer.leagueId !== state.leagueId) {
    return failure(state, 'INVALID_TRANSFER', 'The offer belongs to another league.');
  }
  if (offer.status !== 'pending') {
    return failure(state, 'OFFER_NOT_ACTIVE', 'That transfer offer is no longer active.');
  }
  if (!isoTimeIsValid(input.acceptedAt)) {
    return failure(state, 'INVALID_INPUT', 'The acceptance time is invalid.');
  }
  if (
    offer.expiresAt !== null &&
    (!isoTimeIsValid(offer.expiresAt) ||
      Date.parse(input.acceptedAt) >= Date.parse(offer.expiresAt))
  ) {
    return failure(state, 'OFFER_EXPIRED', 'That transfer offer has expired.');
  }
  if (offer.playerMoves.length === 0 && offer.cashPayments.length === 0) {
    return failure(state, 'INVALID_TRANSFER', 'A transfer offer cannot be empty.');
  }

  const movedPlayers = new Set<string>();
  for (const move of offer.playerMoves) {
    if (
      move.fromClubId === move.toClubId ||
      movedPlayers.has(move.playerId) ||
      accountFor(state, move.fromClubId) === undefined ||
      accountFor(state, move.toClubId) === undefined
    ) {
      return failure(
        state,
        'INVALID_TRANSFER',
        'The offer contains an invalid or duplicate player movement.'
      );
    }
    movedPlayers.add(move.playerId);
    const owner = findActiveOwner(state, move.playerId);
    if (owner === undefined || owner.clubId !== move.fromClubId) {
      return failure(
        state,
        'OWNERSHIP_CHANGED',
        'A player in this offer has changed clubs. Please create a new offer.'
      );
    }
  }

  const balanceDeltas = new Map<string, number>();
  for (const payment of offer.cashPayments) {
    try {
      assertNonNegativeMinorUnits(payment.amountMinor, 'transfer payment');
    } catch (error) {
      return failure(
        state,
        'INVALID_TRANSFER',
        error instanceof Error ? error.message : String(error)
      );
    }
    if (
      payment.amountMinor === 0 ||
      payment.fromClubId === payment.toClubId ||
      accountFor(state, payment.fromClubId) === undefined ||
      accountFor(state, payment.toClubId) === undefined
    ) {
      return failure(state, 'INVALID_TRANSFER', 'The cash payment is invalid.');
    }
    balanceDeltas.set(
      payment.fromClubId,
      (balanceDeltas.get(payment.fromClubId) ?? 0) - payment.amountMinor
    );
    balanceDeltas.set(
      payment.toClubId,
      (balanceDeltas.get(payment.toClubId) ?? 0) + payment.amountMinor
    );
  }

  const balancesMinor: Record<string, MinorUnits> = {};
  for (const [clubId, delta] of balanceDeltas) {
    const balance = getClubBalance(state, clubId);
    if (!Number.isSafeInteger(delta) || balance + delta < 0) {
      return failure(
        state,
        'INSUFFICIENT_FUNDS',
        'A club no longer has enough funds to complete this offer.'
      );
    }
    balancesMinor[clubId] = balance + delta;
  }

  let nextAccounts = state.accounts;
  for (const [clubId, delta] of balanceDeltas) {
    if (delta === 0) {
      continue;
    }
    const account = accountFor({ ...state, accounts: nextAccounts }, clubId);
    if (account === undefined) {
      return failure(state, 'CLUB_NOT_FOUND', 'A club account could not be found.');
    }
    const ledgerEntry: LedgerEntry = {
      id: `${input.idempotencyKey}:ledger:${clubId}`,
      leagueId: state.leagueId,
      clubId,
      amountMinor: delta,
      reason: 'manager_transfer',
      operationId: input.idempotencyKey,
      createdAt: input.acceptedAt,
      referenceId: offer.id
    };
    nextAccounts = replaceAccount(nextAccounts, {
      ...account,
      ledger: appendLedgerEntry(account.ledger, ledgerEntry)
    });
  }

  const moveByPlayer = new Map(offer.playerMoves.map((move) => [move.playerId, move] as const));
  const nextOwnerships = state.activeOwnerships.map((ownership) => {
    const move = moveByPlayer.get(ownership.playerId);
    if (move === undefined || ownership.leagueId !== state.leagueId) {
      return ownership;
    }
    return {
      ...ownership,
      id: `${state.leagueId}:${move.playerId}:${input.idempotencyKey}`,
      clubId: move.toClubId,
      acquiredAt: input.acceptedAt,
      acquiredPriceMinor: 0,
      operationId: input.idempotencyKey
    };
  });
  assertUniqueActiveOwnerships(nextOwnerships);

  const historyEvents: readonly OwnershipHistoryEvent[] = offer.playerMoves.map((move) => ({
    id: `${input.idempotencyKey}:history:${move.playerId}`,
    leagueId: state.leagueId,
    playerId: move.playerId,
    fromClubId: move.fromClubId,
    toClubId: move.toClubId,
    eventType: 'transferred',
    feeMinor: null,
    occurredAt: input.acceptedAt,
    operationId: input.idempotencyKey
  }));
  const receipt: TransferReceipt = {
    kind: 'transfer',
    operationId: input.idempotencyKey,
    fingerprint: operationFingerprint,
    balancesMinor,
    offerId: offer.id,
    movedPlayerIds: offer.playerMoves.map((move) => move.playerId)
  };
  const nextState: MarketState = {
    ...state,
    accounts: nextAccounts,
    activeOwnerships: nextOwnerships,
    ownershipHistory: [...state.ownershipHistory, ...historyEvents],
    completedOperations: [...state.completedOperations, receipt]
  };
  return { ok: true, state: nextState, receipt, replayed: false };
}
