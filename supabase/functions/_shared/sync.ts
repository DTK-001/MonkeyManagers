import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ApiFootballProvider } from "./api-football.ts";
import {
  QuotaExhaustedError,
  asArray,
  asNumber,
  asRecord,
  asString,
  sha256,
} from "./provider.ts";
import { PublicError } from "./http.ts";

type TriggerType = "scheduled" | "manual" | "retry";
type Position = "GK" | "DEF" | "MID" | "FWD";

interface SyncTarget {
  leagueId: string;
  seasonId: string;
  timezone: string;
  startsOn: string;
  enabledCompetitions: EnabledCompetition[];
}

interface EnabledCompetition {
  id: string;
  providerSeasonId: string;
  coverage: Record<string, unknown>;
  competitionId: string;
  provider: string;
  externalId: string;
  name: string;
}

interface NormalizedFixture {
  externalId: string;
  competitionExternalId: string;
  seasonExternalId: string;
  roundName: string;
  kickoffAt: string;
  status: "scheduled" | "live" | "finished" | "postponed" | "abandoned" | "cancelled";
  elapsedMinutes: number | null;
  homeScore: number | null;
  awayScore: number | null;
  venueName: string | null;
  home: NormalizedTeam;
  away: NormalizedTeam;
  raw: Record<string, unknown>;
}

interface NormalizedTeam {
  externalId: string;
  name: string;
  country: string | null;
  raw: Record<string, unknown>;
}

export interface RunSyncInput {
  leagueId: string;
  seasonId: string;
  triggerType: TriggerType;
  requestedByProfileId?: string | null;
  idempotencyKey?: string;
}

export interface SyncResult {
  runId: string;
  status: string;
  alreadyProcessed?: boolean;
  report: Record<string, unknown>;
}

export function serviceClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) throw new Error("Supabase server environment is not configured.");
  return createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function listActiveSyncTargets(db: SupabaseClient): Promise<Array<{ leagueId: string; seasonId: string }>> {
  const { data, error } = await db.from("seasons").select("id,league_id").eq("status", "active");
  if (error) throw new Error("Could not load active seasons.");
  return (data ?? []).map((row) => ({ leagueId: String(row.league_id), seasonId: String(row.id) }));
}

export async function findActiveSeasonForLeague(db: SupabaseClient, leagueId: string): Promise<string> {
  const { data, error } = await db.from("seasons").select("id").eq("league_id", leagueId).eq("status", "active").maybeSingle();
  if (error || !data) throw new PublicError("NO_ACTIVE_SEASON", "This league has no active season.", 409);
  return String(data.id);
}

export async function assertLeagueAdmin(
  db: SupabaseClient,
  authUserId: string,
  leagueId: string,
): Promise<string> {
  const { data: profile, error: profileError } = await db.from("profiles").select("id").eq("auth_user_id", authUserId).maybeSingle();
  if (profileError || !profile) throw new PublicError("PROFILE_REQUIRED", "Complete your profile before synchronising.", 403);
  const { data: membership, error } = await db.from("league_memberships").select("id").eq("league_id", leagueId)
    .eq("profile_id", profile.id).eq("role", "admin").eq("status", "active").maybeSingle();
  if (error || !membership) throw new PublicError("ADMIN_REQUIRED", "Only a league administrator can run a manual sync.", 403);
  return String(profile.id);
}

export async function runSeasonSync(input: RunSyncInput): Promise<SyncResult> {
  const db = serviceClient();
  const target = await loadSyncTarget(db, input.leagueId, input.seasonId);
  const localDate = dateInTimezone(new Date(), target.timezone);
  const idempotencyKey = input.idempotencyKey ?? `${input.triggerType}:${input.seasonId}:${localDate}`;
  const dates = previousDates(localDate, 3);
  const { run, existed } = await createOrLoadRun(db, input, idempotencyKey, dates);
  if (existed) {
    return {
      runId: String(run.id),
      status: String(run.status),
      alreadyProcessed: true,
      report: asRecord(run.report) ?? {},
    };
  }

  const runId = String(run.id);
  const startedAt = new Date().toISOString();
  await db.from("data_synchronisation_runs").update({ status: "running", started_at: startedAt }).eq("id", runId);
  const apiKey = Deno.env.get("API_FOOTBALL_KEY");
  if (!apiKey) {
    await failRun(db, target, runId, "API_KEY_MISSING", "The server-side API-Football secret is not configured.");
    throw new PublicError("API_KEY_MISSING", "API-Football is not configured on the server.", 503);
  }

  const alreadyUsedToday = await countRequestsToday(db);
  const stopAt = parsePositiveInteger(Deno.env.get("API_DAILY_STOP_AT"), 90, 99);
  const provider = new ApiFootballProvider({
    apiKey,
    alreadyUsedToday,
    dailyStopAt: stopAt,
    requestLogger: async (entry) => {
      const { error } = await db.from("api_request_logs").insert({
        sync_run_id: runId,
        provider: "api-football",
        endpoint: entry.endpoint,
        request_fingerprint: entry.requestFingerprint,
        http_status: entry.httpStatus,
        attempt: entry.attempt,
        quota_used: entry.quotaUsed,
        quota_remaining: entry.quotaRemaining,
        duration_ms: entry.durationMs,
        error_code: entry.errorCode ?? null,
      });
      if (error) console.error("Could not persist an API request log.");
    },
  });

  const counters = {
    fixturesChecked: 0,
    fixturesImported: 0,
    statisticsImported: 0,
    lineupsImported: 0,
    eventsImported: 0,
    unchangedFixtures: 0,
  };
  const warnings: Array<{ code: string; competition?: string; fixture?: string }> = [];
  let quotaReached = false;

  try {
    competitionLoop:
    for (const enabled of target.enabledCompetitions) {
      if (enabled.provider !== "api-football") {
        warnings.push({ code: "UNSUPPORTED_PROVIDER", competition: enabled.name });
        continue;
      }
      if (!coverageSupports(enabled.coverage, "playerStatistics")) {
        warnings.push({ code: "PLAYER_STATISTICS_UNAVAILABLE", competition: enabled.name });
      }
      let providerFixtures: unknown[];
      try {
        providerFixtures = await provider.fixtures({
          leagueExternalId: enabled.externalId,
          seasonExternalId: enabled.providerSeasonId,
          from: dates[0],
          to: dates[dates.length - 1],
          timezone: target.timezone,
        });
      } catch (error) {
        if (error instanceof QuotaExhaustedError) {
          quotaReached = true;
          break competitionLoop;
        }
        warnings.push({ code: "FIXTURE_LIST_FAILED", competition: enabled.name });
        continue;
      }

      await persistRawPayload(db, {
        provider: provider.name,
        endpoint: "/fixtures",
        requestFingerprint: await sha256({ enabledCompetitionId: enabled.id, dates }),
        entityType: "fixture_collection",
        providerExternalId: enabled.externalId,
        payload: providerFixtures,
        runId,
      });

      for (const providerFixture of providerFixtures) {
        counters.fixturesChecked += 1;
        const normalized = normalizeFixture(providerFixture);
        if (!normalized || normalized.competitionExternalId !== enabled.externalId) {
          warnings.push({ code: "INVALID_FIXTURE", competition: enabled.name });
          continue;
        }
        if (normalized.status !== "finished") continue;
        try {
          const imported = await importFixture(db, enabled, normalized);
          counters.fixturesImported += imported.changed ? 1 : 0;
          counters.unchangedFixtures += imported.changed ? 0 : 1;
          await persistRawPayload(db, {
            provider: provider.name,
            endpoint: "/fixtures",
            requestFingerprint: await sha256({ fixture: normalized.externalId }),
            entityType: "fixture",
            providerExternalId: normalized.externalId,
            payload: normalized.raw,
            runId,
          });
          if (!imported.changed) continue;

          if (coverageSupports(enabled.coverage, "playerStatistics")) {
            const statistics = await provider.fixturePlayerStatistics(normalized.externalId);
            counters.statisticsImported += await importFixtureStatistics(
              db, imported.fixtureId, enabled, target.startsOn, statistics, runId,
            );
          }
          if (coverageSupports(enabled.coverage, "lineups")) {
            const lineups = await provider.fixtureLineups(normalized.externalId);
            counters.lineupsImported += await importFixtureLineups(db, imported.fixtureId, lineups, runId);
          }
          if (coverageSupports(enabled.coverage, "events")) {
            const events = await provider.fixtureEvents(normalized.externalId);
            counters.eventsImported += await importFixtureEvents(db, imported.fixtureId, events, runId);
          }
        } catch (error) {
          if (error instanceof QuotaExhaustedError) {
            quotaReached = true;
            break competitionLoop;
          }
          warnings.push({ code: "FIXTURE_IMPORT_FAILED", competition: enabled.name, fixture: normalized.externalId });
        }
      }
    }

    const status = quotaReached ? "skipped_quota" : warnings.length > 0 ? "partial" : "succeeded";
    const report = {
      provider: provider.name,
      range: { from: dates[0], to: dates[dates.length - 1], timezone: target.timezone },
      counters,
      warnings,
      quota: provider.quota,
      calculationState: "normalised_data_ready",
      note: "Point, standings and valuation workers can safely consume fixture fingerprints idempotently.",
    };
    const { error } = await db.from("data_synchronisation_runs").update({
      status,
      completed_at: new Date().toISOString(),
      fixtures_checked: counters.fixturesChecked,
      fixtures_imported: counters.fixturesImported,
      player_statistics_imported: counters.statisticsImported,
      api_requests_used: Math.max(0, provider.quota.used - alreadyUsedToday),
      api_requests_remaining: provider.quota.providerRemaining,
      report,
      errors: warnings,
    }).eq("id", runId);
    if (error) throw new Error("Could not finish the synchronisation report.");
    if (status !== "succeeded") await notifyLeagueAdmins(db, target.leagueId, status, warnings);
    return { runId, status, report };
  } catch (error) {
    await failRun(db, target, runId, "SYNC_FAILED", "The nightly import stopped before completion.");
    throw error;
  }
}

async function loadSyncTarget(db: SupabaseClient, leagueId: string, seasonId: string): Promise<SyncTarget> {
  const { data: season, error } = await db.from("seasons").select("id,league_id,timezone,starts_on,status")
    .eq("id", seasonId).eq("league_id", leagueId).maybeSingle();
  if (error || !season || season.status !== "active") throw new PublicError("SEASON_NOT_ACTIVE", "The selected season is not active.", 409);
  const { data: enabledRows, error: enabledError } = await db.from("enabled_competitions")
    .select("id,provider_season_id,coverage_snapshot,real_competition_id").eq("season_id", seasonId).eq("enabled", true);
  if (enabledError) throw new Error("Could not load enabled competitions.");
  const competitionIds = (enabledRows ?? []).map((row) => String(row.real_competition_id));
  const { data: competitions, error: competitionError } = competitionIds.length
    ? await db.from("real_competitions").select("id,provider,provider_external_id,name").in("id", competitionIds)
    : { data: [], error: null };
  if (competitionError) throw new Error("Could not load provider competition mappings.");
  const competitionMap = new Map((competitions ?? []).map((row) => [String(row.id), row]));
  const enabledCompetitions: EnabledCompetition[] = [];
  for (const row of enabledRows ?? []) {
    const competition = competitionMap.get(String(row.real_competition_id));
    if (!competition) continue;
    enabledCompetitions.push({
      id: String(row.id),
      providerSeasonId: String(row.provider_season_id),
      coverage: asRecord(row.coverage_snapshot) ?? {},
      competitionId: String(competition.id),
      provider: String(competition.provider),
      externalId: String(competition.provider_external_id),
      name: String(competition.name),
    });
  }
  return {
    leagueId,
    seasonId,
    timezone: String(season.timezone),
    startsOn: String(season.starts_on),
    enabledCompetitions,
  };
}

async function createOrLoadRun(
  db: SupabaseClient,
  input: RunSyncInput,
  idempotencyKey: string,
  dates: string[],
): Promise<{ run: Record<string, unknown>; existed: boolean }> {
  const { data, error } = await db.from("data_synchronisation_runs").insert({
    league_id: input.leagueId,
    season_id: input.seasonId,
    idempotency_key: idempotencyKey,
    trigger_type: input.triggerType,
    requested_by_profile_id: input.requestedByProfileId ?? null,
    status: "queued",
    relevant_dates: dates,
  }).select("id,status,report").single();
  if (!error && data) return { run: data as Record<string, unknown>, existed: false };
  if (error?.code !== "23505") throw new Error("Could not create a synchronisation run.");
  const { data: existing, error: existingError } = await db.from("data_synchronisation_runs")
    .select("id,status,report").eq("idempotency_key", idempotencyKey).single();
  if (existingError || !existing) throw new Error("Could not load the existing synchronisation run.");
  return { run: existing as Record<string, unknown>, existed: true };
}

async function countRequestsToday(db: SupabaseClient): Promise<number> {
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const { count, error } = await db.from("api_request_logs").select("id", { count: "exact", head: true })
    .eq("provider", "api-football").gte("created_at", dayStart.toISOString());
  if (error) return 0;
  return count ?? 0;
}

async function importFixture(
  db: SupabaseClient,
  enabled: EnabledCompetition,
  fixture: NormalizedFixture,
): Promise<{ fixtureId: string; changed: boolean }> {
  const fingerprint = await sha256(fixture.raw);
  const { data: existing } = await db.from("fixtures").select("id,source_fingerprint")
    .eq("provider", "api-football").eq("provider_external_id", fixture.externalId).maybeSingle();
  const homeId = await upsertTeam(db, fixture.home);
  const awayId = await upsertTeam(db, fixture.away);
  const row = {
    provider: "api-football",
    provider_external_id: fixture.externalId,
    real_competition_id: enabled.competitionId,
    provider_season_id: fixture.seasonExternalId,
    provider_round_name: fixture.roundName,
    home_team_id: homeId,
    away_team_id: awayId,
    kickoff_at: fixture.kickoffAt,
    status: fixture.status,
    elapsed_minutes: fixture.elapsedMinutes,
    home_score: fixture.homeScore,
    away_score: fixture.awayScore,
    venue_name: fixture.venueName,
    source_fingerprint: fingerprint,
    raw_payload: fixture.raw,
    last_synced_at: new Date().toISOString(),
  };
  const { data, error } = await db.from("fixtures").upsert(row, { onConflict: "provider,provider_external_id" }).select("id").single();
  if (error || !data) throw new Error("Could not store a fixture.");
  return { fixtureId: String(data.id), changed: !existing || existing.source_fingerprint !== fingerprint };
}

async function upsertTeam(db: SupabaseClient, team: NormalizedTeam): Promise<string> {
  const { data, error } = await db.from("real_teams").upsert({
    provider: "api-football",
    provider_external_id: team.externalId,
    name: team.name,
    country_name: team.country,
    raw_payload: team.raw,
    last_synced_at: new Date().toISOString(),
  }, { onConflict: "provider,provider_external_id" }).select("id").single();
  if (error || !data) throw new Error("Could not store a real team.");
  return String(data.id);
}

async function upsertPlayer(
  db: SupabaseClient,
  rawPlayer: Record<string, unknown>,
  position: Position,
): Promise<string> {
  const externalId = asString(rawPlayer.id);
  const displayName = asString(rawPlayer.name);
  if (!externalId || !displayName) throw new Error("Provider player is missing an identifier or name.");
  const { data, error } = await db.from("real_players").upsert({
    provider: "api-football",
    provider_external_id: externalId,
    display_name: displayName,
    first_name: asString(rawPlayer.firstname),
    last_name: asString(rawPlayer.lastname),
    birth_date: asRecord(rawPlayer.birth)?.date ?? null,
    nationality: asString(rawPlayer.nationality),
    position,
    raw_payload: rawPlayer,
    last_synced_at: new Date().toISOString(),
  }, { onConflict: "provider,provider_external_id" }).select("id").single();
  if (error || !data) throw new Error("Could not store a real player.");
  return String(data.id);
}

async function importFixtureStatistics(
  db: SupabaseClient,
  fixtureId: string,
  enabled: EnabledCompetition,
  seasonStartsOn: string,
  payload: unknown[],
  runId: string,
): Promise<number> {
  const rawId = await persistRawPayload(db, {
    provider: "api-football",
    endpoint: "/fixtures/players",
    requestFingerprint: await sha256({ fixtureId }),
    entityType: "fixture_player_statistics",
    providerExternalId: fixtureId,
    payload,
    runId,
  });
  let imported = 0;
  await db.from("fixture_player_statistics").update({ source_present: false }).eq("fixture_id", fixtureId);
  for (const teamEntryValue of payload) {
    const teamEntry = asRecord(teamEntryValue);
    const rawTeam = asRecord(teamEntry?.team);
    const team = normalizeTeam(rawTeam);
    if (!team) continue;
    const teamId = await upsertTeam(db, team);
    for (const playerEntryValue of asArray(teamEntry?.players)) {
      const playerEntry = asRecord(playerEntryValue);
      const rawPlayer = asRecord(playerEntry?.player);
      const statistics = asRecord(asArray(playerEntry?.statistics)[0]);
      const games = asRecord(statistics?.games);
      const position = normalizePosition(games?.position);
      if (!rawPlayer || !statistics || !position) continue;
      const playerId = await upsertPlayer(db, rawPlayer, position);
      const normalized = normalizeStatistics(statistics, position);
      const fingerprint = await sha256(playerEntry);
      const row = {
        fixture_id: fixtureId,
        real_player_id: playerId,
        real_team_id: teamId,
        position,
        ...normalized,
        source_payload_id: rawId,
        source_fingerprint: fingerprint,
        source_present: true,
        raw_payload: playerEntry,
        last_synced_at: new Date().toISOString(),
      };
      const { error } = await db.from("fixture_player_statistics").upsert(row, { onConflict: "fixture_id,real_player_id" });
      if (error) throw new Error("Could not store fixture-player statistics.");
      const { error: registrationError } = await db.from("player_team_season_registrations").upsert({
        real_player_id: playerId,
        real_team_id: teamId,
        real_competition_id: enabled.competitionId,
        provider_season_id: enabled.providerSeasonId,
        valid_from: seasonStartsOn,
        provider: "api-football",
        provider_external_id: `${enabled.externalId}:${enabled.providerSeasonId}:${asString(rawPlayer.id)}`,
        raw_payload: { team: rawTeam, player: rawPlayer },
        last_synced_at: new Date().toISOString(),
      }, { onConflict: "real_player_id,real_team_id,real_competition_id,provider_season_id,valid_from" });
      if (registrationError) throw new Error("Could not store a player registration.");
      imported += 1;
    }
  }
  return imported;
}

async function importFixtureLineups(
  db: SupabaseClient,
  fixtureId: string,
  payload: unknown[],
  runId: string,
): Promise<number> {
  await persistRawPayload(db, {
    provider: "api-football", endpoint: "/fixtures/lineups",
    requestFingerprint: await sha256({ fixtureId, kind: "lineups" }), entityType: "fixture_lineups",
    providerExternalId: fixtureId, payload, runId,
  });
  let imported = 0;
  const { error: clearError } = await db.from("fixture_lineups").delete().eq("fixture_id", fixtureId);
  if (clearError) throw new Error("Could not reconcile the corrected fixture lineup.");
  for (const teamLineupValue of payload) {
    const teamLineup = asRecord(teamLineupValue);
    const team = normalizeTeam(asRecord(teamLineup?.team));
    if (!team) continue;
    const teamId = await upsertTeam(db, team);
    for (const [starting, entries] of [[true, asArray(teamLineup?.startXI)], [false, asArray(teamLineup?.substitutes)]] as const) {
      for (const entryValue of entries) {
        const entry = asRecord(entryValue);
        const rawPlayer = asRecord(entry?.player);
        const position = normalizePosition(rawPlayer?.pos);
        if (!rawPlayer || !position) continue;
        const playerId = await upsertPlayer(db, rawPlayer, position);
        const { error } = await db.from("fixture_lineups").upsert({
          fixture_id: fixtureId,
          real_team_id: teamId,
          real_player_id: playerId,
          is_starting: starting,
          position,
          formation_grid: asString(rawPlayer.grid),
          shirt_number: asNumber(rawPlayer.number),
          raw_payload: entry,
          last_synced_at: new Date().toISOString(),
        }, { onConflict: "fixture_id,real_team_id,real_player_id" });
        if (error) throw new Error("Could not store a fixture lineup.");
        imported += 1;
      }
    }
  }
  return imported;
}

async function importFixtureEvents(
  db: SupabaseClient,
  fixtureId: string,
  payload: unknown[],
  runId: string,
): Promise<number> {
  await persistRawPayload(db, {
    provider: "api-football", endpoint: "/fixtures/events",
    requestFingerprint: await sha256({ fixtureId, kind: "events" }), entityType: "fixture_events",
    providerExternalId: fixtureId, payload, runId,
  });
  let imported = 0;
  const { error: clearError } = await db.from("fixture_events").delete().eq("fixture_id", fixtureId).eq("provider", "api-football");
  if (clearError) throw new Error("Could not reconcile corrected fixture events.");
  for (let index = 0; index < payload.length; index += 1) {
    const event = asRecord(payload[index]);
    if (!event) continue;
    const teamExternalId = asString(asRecord(event.team)?.id);
    const playerExternalId = asString(asRecord(event.player)?.id);
    const assistExternalId = asString(asRecord(event.assist)?.id);
    const teamId = teamExternalId ? await findExternalId(db, "real_teams", teamExternalId) : null;
    const playerId = playerExternalId ? await findExternalId(db, "real_players", playerExternalId) : null;
    const assistId = assistExternalId ? await findExternalId(db, "real_players", assistExternalId) : null;
    const externalId = await sha256({ fixtureId, index, event });
    const time = asRecord(event.time);
    const { error } = await db.from("fixture_events").upsert({
      fixture_id: fixtureId,
      provider: "api-football",
      provider_external_id: externalId,
      elapsed_minute: asNumber(time?.elapsed),
      extra_minute: asNumber(time?.extra),
      real_team_id: teamId,
      real_player_id: playerId,
      assist_player_id: assistId,
      event_type: asString(event.type) ?? "unknown",
      detail: asString(event.detail),
      comments: asString(event.comments),
      raw_payload: event,
      last_synced_at: new Date().toISOString(),
    }, { onConflict: "fixture_id,provider_external_id" });
    if (error) throw new Error("Could not store a fixture event.");
    imported += 1;
  }
  return imported;
}

async function findExternalId(db: SupabaseClient, table: "real_teams" | "real_players", externalId: string): Promise<string | null> {
  const { data } = await db.from(table).select("id").eq("provider", "api-football").eq("provider_external_id", externalId).maybeSingle();
  return data ? String(data.id) : null;
}

async function persistRawPayload(
  db: SupabaseClient,
  input: {
    provider: string;
    endpoint: string;
    requestFingerprint: string;
    entityType: string;
    providerExternalId?: string | null;
    payload: unknown;
    runId: string;
  },
): Promise<string | null> {
  const payloadHash = await sha256(input.payload);
  const row = {
    provider: input.provider,
    endpoint: input.endpoint,
    request_fingerprint: input.requestFingerprint,
    entity_type: input.entityType,
    provider_external_id: input.providerExternalId ?? null,
    payload_hash: payloadHash,
    http_status: 200,
    payload: input.payload,
    sync_run_id: input.runId,
  };
  const { data, error } = await db.from("raw_provider_payloads").insert(row).select("id").maybeSingle();
  if (!error && data) return String(data.id);
  if (error?.code !== "23505") throw new Error("Could not archive a provider payload.");
  const { data: existing } = await db.from("raw_provider_payloads").select("id")
    .eq("provider", input.provider).eq("request_fingerprint", input.requestFingerprint).eq("payload_hash", payloadHash).maybeSingle();
  return existing ? String(existing.id) : null;
}

function normalizeFixture(value: unknown): NormalizedFixture | null {
  const raw = asRecord(value);
  const fixture = asRecord(raw?.fixture);
  const league = asRecord(raw?.league);
  const teams = asRecord(raw?.teams);
  const goals = asRecord(raw?.goals);
  const status = asRecord(fixture?.status);
  const venue = asRecord(fixture?.venue);
  const home = normalizeTeam(asRecord(teams?.home));
  const away = normalizeTeam(asRecord(teams?.away));
  const externalId = asString(fixture?.id);
  const competitionExternalId = asString(league?.id);
  const seasonExternalId = asString(league?.season);
  const roundName = asString(league?.round);
  const kickoffAt = asString(fixture?.date);
  const mappedStatus = normalizeFixtureStatus(status?.short);
  if (!raw || !home || !away || !externalId || !competitionExternalId || !seasonExternalId || !roundName || !kickoffAt || !mappedStatus) return null;
  return {
    externalId,
    competitionExternalId,
    seasonExternalId,
    roundName,
    kickoffAt,
    status: mappedStatus,
    elapsedMinutes: asNumber(status?.elapsed),
    homeScore: asNumber(goals?.home),
    awayScore: asNumber(goals?.away),
    venueName: asString(venue?.name),
    home,
    away,
    raw,
  };
}

function normalizeTeam(raw: Record<string, unknown> | null): NormalizedTeam | null {
  const externalId = asString(raw?.id);
  const name = asString(raw?.name);
  if (!raw || !externalId || !name) return null;
  return { externalId, name, country: asString(raw.country), raw };
}

function normalizeFixtureStatus(value: unknown): NormalizedFixture["status"] | null {
  const status = asString(value)?.toUpperCase();
  if (!status) return null;
  if (["FT", "AET", "PEN"].includes(status)) return "finished";
  if (["PST"].includes(status)) return "postponed";
  if (["ABD"].includes(status)) return "abandoned";
  if (["CANC", "AWD", "WO"].includes(status)) return "cancelled";
  if (["1H", "HT", "2H", "ET", "BT", "P", "SUSP", "INT", "LIVE"].includes(status)) return "live";
  if (["TBD", "NS"].includes(status)) return "scheduled";
  return null;
}

function normalizePosition(value: unknown): Position | null {
  const position = asString(value)?.toUpperCase();
  if (!position) return null;
  if (["G", "GK", "GOALKEEPER"].includes(position)) return "GK";
  if (["D", "DEF", "DEFENDER"].includes(position)) return "DEF";
  if (["M", "MID", "MIDFIELDER"].includes(position)) return "MID";
  if (["F", "FWD", "ATTACKER", "FORWARD"].includes(position)) return "FWD";
  return null;
}

function normalizeStatistics(statistics: Record<string, unknown>, position: Position): Record<string, unknown> {
  const games = asRecord(statistics.games);
  const shots = asRecord(statistics.shots);
  const goals = asRecord(statistics.goals);
  const passes = asRecord(statistics.passes);
  const tackles = asRecord(statistics.tackles);
  const duels = asRecord(statistics.duels);
  const dribbles = asRecord(statistics.dribbles);
  const fouls = asRecord(statistics.fouls);
  const cards = asRecord(statistics.cards);
  const penalty = asRecord(statistics.penalty);
  const values: Record<string, unknown> = {
    started: typeof games?.substitute === "boolean" ? !games.substitute : null,
    minutes: asNumber(games?.minutes),
    rating: asNumber(games?.rating),
    goals: asNumber(goals?.total),
    assists: asNumber(goals?.assists),
    penalties_won: asNumber(penalty?.won),
    penalties_missed: asNumber(penalty?.missed),
    shots: asNumber(shots?.total),
    shots_on_target: asNumber(shots?.on),
    key_passes: asNumber(passes?.key),
    dribbles_attempted: asNumber(dribbles?.attempts),
    dribbles_successful: asNumber(dribbles?.success),
    fouls_drawn: asNumber(fouls?.drawn),
    passes_attempted: asNumber(passes?.total),
    pass_completion_percentage: parsePercentage(passes?.accuracy),
    tackles: asNumber(tackles?.total),
    interceptions: asNumber(tackles?.interceptions),
    blocks: asNumber(tackles?.blocks),
    duels_won: asNumber(duels?.won),
    saves: position === "GK" ? asNumber(goals?.saves) : null,
    penalty_saves: position === "GK" ? asNumber(penalty?.saved) : null,
    goals_conceded: position === "GK" ? asNumber(goals?.conceded) : null,
    fouls_committed: asNumber(fouls?.committed),
    yellow_cards: asNumber(cards?.yellow),
    second_yellow_cards: asNumber(cards?.yellowred),
    red_cards: asNumber(cards?.red),
    penalties_conceded: asNumber(penalty?.commited),
    raw_payload: statistics,
  };
  values.observed_metrics = Object.entries(values).filter(([key, value]) => key !== "raw_payload" && value !== null).map(([key]) => key);
  return values;
}

function parsePercentage(value: unknown): number | null {
  const number = asNumber(value);
  if (number !== null) return number;
  const text = asString(value);
  if (!text) return null;
  const parsed = Number(text.replace("%", ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function coverageSupports(coverage: Record<string, unknown>, metric: "playerStatistics" | "lineups" | "events"): boolean {
  if (typeof coverage[metric] === "boolean") return Boolean(coverage[metric]);
  const fixtures = asRecord(coverage.fixtures);
  const key = metric === "playerStatistics" ? "statistics_players" : metric;
  return Boolean(fixtures?.[key]);
}

function dateInTimezone(date: Date, timezone: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function previousDates(localDate: string, daysBack: number): string[] {
  const anchor = new Date(`${localDate}T12:00:00Z`);
  const dates: string[] = [];
  for (let offset = daysBack; offset >= 0; offset -= 1) {
    const value = new Date(anchor);
    value.setUTCDate(anchor.getUTCDate() - offset);
    dates.push(value.toISOString().slice(0, 10));
  }
  return dates;
}

function parsePositiveInteger(value: string | undefined, fallback: number, maximum: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

async function failRun(
  db: SupabaseClient,
  target: Pick<SyncTarget, "leagueId">,
  runId: string,
  code: string,
  message: string,
): Promise<void> {
  await db.from("data_synchronisation_runs").update({
    status: "failed",
    completed_at: new Date().toISOString(),
    errors: [{ code }],
    report: { message },
  }).eq("id", runId);
  await notifyLeagueAdmins(db, target.leagueId, "failed", [{ code }]);
}

async function notifyLeagueAdmins(
  db: SupabaseClient,
  leagueId: string,
  status: string,
  warnings: Array<{ code: string }>,
): Promise<void> {
  const { data: admins } = await db.from("league_memberships").select("profile_id")
    .eq("league_id", leagueId).eq("role", "admin").eq("status", "active");
  if (!admins?.length) return;
  await db.from("notifications").insert(admins.map((admin) => ({
    league_id: leagueId,
    recipient_profile_id: admin.profile_id,
    type: status === "failed" ? "sync_failed" : "sync_incomplete",
    title: status === "failed" ? "Data sync failed" : "Data sync needs attention",
    body: status === "failed"
      ? "The latest football data import failed. Open the sync report for details."
      : "The latest football data import completed with warnings.",
    payload: { status, warningCodes: warnings.map((warning) => warning.code) },
  })));
}
