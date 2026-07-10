import { describe, expect, it } from 'vitest';

import {
  canonicalRecordString,
  fixturePlayerStatisticsSyncIdentity,
  mergeIdempotentRecords
} from '../../domain/sync';

interface TestStat {
  readonly provider: string;
  readonly fixtureProviderId: number;
  readonly playerProviderId: number;
  readonly points: number;
  readonly raw: Readonly<Record<string, unknown>>;
}

const identity = (record: TestStat) => fixturePlayerStatisticsSyncIdentity(record);

describe('nightly sync idempotency helpers', () => {
  it('running the same batch twice produces no duplicates or updates', () => {
    const incoming: readonly TestStat[] = [
      {
        provider: 'api-football',
        fixtureProviderId: 1,
        playerProviderId: 10,
        points: 7.5,
        raw: { goals: 1, assists: 0 }
      },
      {
        provider: 'api-football',
        fixtureProviderId: 1,
        playerProviderId: 11,
        points: 2,
        raw: { goals: 0, assists: 0 }
      }
    ];
    const first = mergeIdempotentRecords([], incoming, identity);
    const second = mergeIdempotentRecords(first.records, incoming, identity);

    expect(first).toMatchObject({ inserted: 2, updated: 0, unchanged: 0 });
    expect(second).toMatchObject({ inserted: 0, updated: 0, unchanged: 2 });
    expect(second.records).toHaveLength(2);
  });

  it('updates a provider correction in place using fixture and player identity', () => {
    const original: TestStat = {
      provider: 'api-football',
      fixtureProviderId: 1,
      playerProviderId: 10,
      points: 2,
      raw: { assists: 0 }
    };
    const correction: TestStat = {
      ...original,
      points: 5,
      raw: { assists: 1 }
    };
    const result = mergeIdempotentRecords([original], [correction], identity);
    expect(result).toMatchObject({ inserted: 0, updated: 1, unchanged: 0 });
    expect(result.records).toEqual([correction]);
  });

  it('deduplicates a response batch deterministically with last value winning', () => {
    const first: TestStat = {
      provider: 'api-football',
      fixtureProviderId: 1,
      playerProviderId: 10,
      points: 2,
      raw: {}
    };
    const last = { ...first, points: 4 };
    const result = mergeIdempotentRecords([], [first, last], identity);
    expect(result.duplicatesInBatch).toBe(1);
    expect(result.inserted).toBe(1);
    expect(result.records).toEqual([last]);
  });

  it('compares JSON-like records independently of object key order', () => {
    expect(canonicalRecordString({ b: 2, a: { d: 4, c: 3 } })).toBe(
      canonicalRecordString({ a: { c: 3, d: 4 }, b: 2 })
    );
  });
});
