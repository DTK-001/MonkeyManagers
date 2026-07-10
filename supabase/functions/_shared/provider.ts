export interface ProviderQuota {
  used: number;
  stopAt: number;
  providerRemaining: number | null;
}

export interface ProviderRequestLog {
  endpoint: string;
  requestFingerprint: string;
  httpStatus: number | null;
  attempt: number;
  quotaUsed: number;
  quotaRemaining: number | null;
  durationMs: number;
  errorCode?: string;
}

export type RequestLogger = (entry: ProviderRequestLog) => Promise<void>;

export interface ProviderFixtureQuery {
  leagueExternalId: string;
  seasonExternalId: string;
  from: string;
  to: string;
  timezone: string;
}

export interface FootballDataProvider {
  readonly name: string;
  readonly quota: ProviderQuota;
  status(): Promise<unknown[]>;
  countries(): Promise<unknown[]>;
  competitions(country?: string): Promise<unknown[]>;
  teams(leagueExternalId: string, seasonExternalId: string): Promise<unknown[]>;
  players(leagueExternalId: string, seasonExternalId: string, page?: number): Promise<unknown[]>;
  fixtures(query: ProviderFixtureQuery): Promise<unknown[]>;
  fixtureLineups(fixtureExternalId: string): Promise<unknown[]>;
  fixtureEvents(fixtureExternalId: string): Promise<unknown[]>;
  fixturePlayerStatistics(fixtureExternalId: string): Promise<unknown[]>;
  injuries(leagueExternalId: string, seasonExternalId: string, date: string): Promise<unknown[]>;
}

export class QuotaExhaustedError extends Error {
  constructor() {
    super("The configured daily provider request budget has been reached.");
    this.name = "QuotaExhaustedError";
  }
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function asString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

export function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

export async function sha256(value: unknown): Promise<string> {
  const encoded = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest)).map((part) => part.toString(16).padStart(2, "0")).join("");
}
