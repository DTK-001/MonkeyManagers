import {
  FootballDataProvider,
  ProviderFixtureQuery,
  ProviderQuota,
  QuotaExhaustedError,
  RequestLogger,
  asArray,
  asRecord,
  sha256,
} from "./provider.ts";

const API_FOOTBALL_BASE_URL = "https://v3.football.api-sports.io";
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

interface ApiFootballEnvelope {
  errors?: unknown;
  response?: unknown;
}

export interface ApiFootballProviderOptions {
  apiKey: string;
  alreadyUsedToday?: number;
  dailyStopAt?: number;
  requestLogger?: RequestLogger;
  fetchImplementation?: typeof fetch;
}

export class ApiFootballProvider implements FootballDataProvider {
  readonly name = "api-football";
  readonly quota: ProviderQuota;
  private readonly apiKey: string;
  private readonly requestLogger?: RequestLogger;
  private readonly fetchImplementation: typeof fetch;

  constructor(options: ApiFootballProviderOptions) {
    if (!options.apiKey.trim()) throw new Error("API_FOOTBALL_KEY is not configured.");
    this.apiKey = options.apiKey;
    this.requestLogger = options.requestLogger;
    this.fetchImplementation = options.fetchImplementation ?? fetch;
    this.quota = {
      used: Math.max(0, options.alreadyUsedToday ?? 0),
      stopAt: Math.min(99, Math.max(1, options.dailyStopAt ?? 90)),
      providerRemaining: null,
    };
  }

  status(): Promise<unknown[]> {
    // API-Football documents /status as quota-free.
    return this.request("/status", {}, false);
  }

  countries(): Promise<unknown[]> {
    return this.request("/countries", {});
  }

  competitions(country?: string): Promise<unknown[]> {
    return this.request("/leagues", country ? { country } : {});
  }

  teams(leagueExternalId: string, seasonExternalId: string): Promise<unknown[]> {
    return this.request("/teams", { league: leagueExternalId, season: seasonExternalId });
  }

  players(leagueExternalId: string, seasonExternalId: string, page = 1): Promise<unknown[]> {
    return this.request("/players", { league: leagueExternalId, season: seasonExternalId, page: String(page) });
  }

  fixtures(query: ProviderFixtureQuery): Promise<unknown[]> {
    return this.request("/fixtures", {
      league: query.leagueExternalId,
      season: query.seasonExternalId,
      from: query.from,
      to: query.to,
      timezone: query.timezone,
    });
  }

  fixtureLineups(fixtureExternalId: string): Promise<unknown[]> {
    return this.request("/fixtures/lineups", { fixture: fixtureExternalId });
  }

  fixtureEvents(fixtureExternalId: string): Promise<unknown[]> {
    return this.request("/fixtures/events", { fixture: fixtureExternalId });
  }

  fixturePlayerStatistics(fixtureExternalId: string): Promise<unknown[]> {
    return this.request("/fixtures/players", { fixture: fixtureExternalId });
  }

  injuries(leagueExternalId: string, seasonExternalId: string, date: string): Promise<unknown[]> {
    return this.request("/injuries", { league: leagueExternalId, season: seasonExternalId, date });
  }

  private async request(endpoint: string, parameters: Record<string, string>, countsAgainstQuota = true): Promise<unknown[]> {
    const url = new URL(API_FOOTBALL_BASE_URL + endpoint);
    for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value);
    const requestFingerprint = await sha256({ endpoint, parameters });
    let lastError: unknown;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      if (countsAgainstQuota && (this.quota.used >= this.quota.stopAt || this.quota.providerRemaining === 0)) {
        throw new QuotaExhaustedError();
      }
      if (countsAgainstQuota) this.quota.used += 1;
      const startedAt = performance.now();
      let status: number | null = null;
      try {
        const response = await this.fetchImplementation(url, {
          method: "GET",
          headers: { "x-apisports-key": this.apiKey },
          signal: AbortSignal.timeout(15_000),
        });
        status = response.status;
        const providerRemaining = parseQuotaHeader(response.headers);
        if (providerRemaining !== null) this.quota.providerRemaining = providerRemaining;
        if (response.status === 204) {
          await this.logRequest({ endpoint, requestFingerprint, httpStatus: status, attempt, startedAt });
          return [];
        }
        const body: unknown = await response.json();
        if (!response.ok) {
          const error = new Error(`Provider request returned HTTP ${response.status}.`);
          (error as Error & { retryAfter?: string | null }).retryAfter = response.headers.get("retry-after");
          throw error;
        }
        const envelope = asRecord(body) as ApiFootballEnvelope | null;
        if (!envelope) throw new Error("Provider returned a malformed response envelope.");
        const errors = envelope.errors;
        if ((Array.isArray(errors) && errors.length > 0) || (asRecord(errors) && Object.keys(asRecord(errors) ?? {}).length > 0)) {
          throw new Error("Provider returned an application error.");
        }
        const result = asArray(envelope.response);
        await this.logRequest({ endpoint, requestFingerprint, httpStatus: status, attempt, startedAt });
        return result;
      } catch (error) {
        lastError = error;
        const errorCode = error instanceof DOMException && error.name === "TimeoutError" ? "TIMEOUT" : "PROVIDER_ERROR";
        await this.logRequest({ endpoint, requestFingerprint, httpStatus: status, attempt, startedAt, errorCode });
        const shouldRetry = attempt < 3 && (status === null || RETRYABLE_STATUS.has(status));
        if (!shouldRetry) break;
        const retryAfter = error instanceof Error && "retryAfter" in error ? Number((error as Error & { retryAfter?: string }).retryAfter) : NaN;
        const delay = Number.isFinite(retryAfter) ? Math.min(5_000, retryAfter * 1000) : 250 * (2 ** (attempt - 1)) + Math.floor(Math.random() * 100);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    throw lastError instanceof Error ? lastError : new Error("Provider request failed.");
  }

  private async logRequest(input: {
    endpoint: string;
    requestFingerprint: string;
    httpStatus: number | null;
    attempt: number;
    startedAt: number;
    errorCode?: string;
  }): Promise<void> {
    if (!this.requestLogger) return;
    await this.requestLogger({
      endpoint: input.endpoint,
      requestFingerprint: input.requestFingerprint,
      httpStatus: input.httpStatus,
      attempt: input.attempt,
      quotaUsed: this.quota.used,
      quotaRemaining: this.quota.providerRemaining,
      durationMs: Math.max(0, Math.round(performance.now() - input.startedAt)),
      errorCode: input.errorCode,
    });
  }
}

function parseQuotaHeader(headers: Headers): number | null {
  const candidates = [
    headers.get("x-ratelimit-requests-remaining"),
    headers.get("x-ratelimit-remaining"),
  ];
  for (const candidate of candidates) {
    if (candidate !== null && Number.isFinite(Number(candidate))) return Math.max(0, Number(candidate));
  }
  return null;
}
