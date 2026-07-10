/** Generic deterministic/idempotent merge helpers for nightly imports. */

export interface IdempotentMergeResult<T> {
  readonly records: readonly T[];
  readonly inserted: number;
  readonly updated: number;
  readonly unchanged: number;
  readonly duplicatesInBatch: number;
}

function canonicalize(value: unknown, ancestors: readonly object[] = []): unknown {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'number' && !Number.isFinite(value)) return String(value);
    if (typeof value === 'undefined') return '__undefined__';
    return value;
  }
  if (ancestors.includes(value)) {
    throw new TypeError('sync records must not contain circular references');
  }
  const nextAncestors = [...ancestors, value];
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item, nextAncestors));
  }
  const record = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(record).sort()) {
    result[key] = canonicalize(record[key], nextAncestors);
  }
  return result;
}

export function canonicalRecordString(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function fixtureSyncIdentity(provider: string, fixtureProviderId: string | number): string {
  return `${provider}:${fixtureProviderId}`;
}

export function fixturePlayerStatisticsSyncIdentity(record: {
  readonly provider: string;
  readonly fixtureProviderId: string | number;
  readonly playerProviderId: string | number;
}): string {
  return `${record.provider}:${record.fixtureProviderId}:${record.playerProviderId}`;
}

/**
 * Upserts by a stable external identity. The last duplicate in an import batch
 * wins, existing order is retained, and new identities append deterministically.
 */
export function mergeIdempotentRecords<T>(
  existing: readonly T[],
  incoming: readonly T[],
  identity: (record: T) => string,
  equal: (left: T, right: T) => boolean = (left, right) =>
    canonicalRecordString(left) === canonicalRecordString(right)
): IdempotentMergeResult<T> {
  const indexes = new Map<string, number>();
  const result = [...existing];
  result.forEach((record, index) => {
    const key = identity(record);
    if (indexes.has(key)) {
      throw new Error(`existing sync records contain duplicate identity ${key}`);
    }
    indexes.set(key, index);
  });

  const incomingByIdentity = new Map<string, T>();
  let duplicatesInBatch = 0;
  for (const record of incoming) {
    const key = identity(record);
    if (incomingByIdentity.has(key)) duplicatesInBatch += 1;
    incomingByIdentity.set(key, record);
  }

  let inserted = 0;
  let updated = 0;
  let unchanged = 0;
  for (const [key, record] of incomingByIdentity) {
    const existingIndex = indexes.get(key);
    if (existingIndex === undefined) {
      indexes.set(key, result.length);
      result.push(record);
      inserted += 1;
      continue;
    }
    const current = result[existingIndex];
    if (current === undefined) {
      throw new Error(`sync index for ${key} is invalid`);
    }
    if (equal(current, record)) {
      unchanged += 1;
    } else {
      result[existingIndex] = record;
      updated += 1;
    }
  }

  return { records: result, inserted, updated, unchanged, duplicatesInBatch };
}
