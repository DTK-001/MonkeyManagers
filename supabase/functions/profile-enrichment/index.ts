import { ApiFootballProvider } from "../_shared/api-football.ts";
import { errorResponse, isUuid, jsonResponse, readJsonObject, PublicError } from "../_shared/http.ts";
import { asArray, asRecord, asString, QuotaExhaustedError } from "../_shared/provider.ts";
import { assertLeagueAdmin, findActiveSeasonForLeague, serviceClient } from "../_shared/sync.ts";

type Position = "GK" | "DEF" | "MID" | "FWD";

interface CataloguePlayer {
  id: string;
  name: string;
  teamName: string;
  position: Position;
  valueMinor: number;
  previousValueMinor: number;
}

interface ProviderPlayer {
  id: string;
  name: string;
  teamName: string;
  position: Position;
  birthDate: string | null;
  nationality: string | null;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return jsonResponse({ ok: true });
  if (request.method !== "POST") {
    return jsonResponse({ error: { code: "METHOD_NOT_ALLOWED", message: "Use POST." } }, 405);
  }

  try {
    const body = await readJsonObject(request);
    const leagueId = body.leagueId;
    if (!isUuid(leagueId)) {
      throw new PublicError("INVALID_LEAGUE", "A valid league ID is required.", 400);
    }
    const cataloguePlayers = parseCataloguePlayers(body.cataloguePlayers);
    const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) throw new PublicError("UNAUTHORISED", "Sign in before refreshing player profiles.", 401);

    const db = serviceClient();
    const { data: userResult, error: userError } = await db.auth.getUser(token);
    if (userError || !userResult.user) {
      throw new PublicError("UNAUTHORISED", "Your session is no longer valid.", 401);
    }
    await assertLeagueAdmin(db, userResult.user.id, leagueId);
    const seasonId = await findActiveSeasonForLeague(db, leagueId);
    const providerSeasonId = await premierLeagueProviderSeason(db, seasonId);

    const cached = await readFreshCache(db, cataloguePlayers);
    if (cached) return jsonResponse({ status: "cached", ...cached });

    const apiKey = Deno.env.get("API_FOOTBALL_KEY");
    if (!apiKey) {
      throw new PublicError("API_KEY_MISSING", "API-Football is not configured on the server.", 503);
    }
    const alreadyUsedToday = await countRequestsToday(db);
    const provider = new ApiFootballProvider({
      apiKey,
      alreadyUsedToday,
      dailyStopAt: 90,
      requestLogger: async (entry) => {
        const { error } = await db.from("api_request_logs").insert({
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
        if (error) console.error("Could not persist profile-enrichment API usage.");
      },
    });
    const providerPlayers = await loadPremierLeaguePlayers(provider, providerSeasonId);
    const realPlayerIds = await persistProviderPlayers(db, providerPlayers);
    const rows = cataloguePlayers.map((player) => profileRow(player, providerPlayers, realPlayerIds));
    const { error: upsertError } = await db.from("player_catalogue_profiles").upsert(rows, {
      onConflict: "catalogue_player_id",
    });
    if (upsertError) throw new Error("Could not save cached player profiles.");
    await persistSeasonValues(db, seasonId, rows);

    const matched = rows.filter((row) => row.match_status === "matched").length;
    const ambiguous = rows.filter((row) => row.match_status === "ambiguous").length;
    return jsonResponse({
      status: "refreshed",
      matched,
      unmatched: rows.length - matched - ambiguous,
      ambiguous,
      providerRequests: provider.quota.used - alreadyUsedToday,
    });
  } catch (error) {
    if (error instanceof QuotaExhaustedError) {
      return jsonResponse({ error: { code: "QUOTA_RESERVED", message: "Profile refresh stopped to preserve the daily API request budget." } }, 429);
    }
    return errorResponse(error);
  }
});

function parseCataloguePlayers(value: unknown): CataloguePlayer[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 1_000) {
    throw new PublicError("INVALID_CATALOGUE", "Send between 1 and 1,000 catalogue players.", 400);
  }
  const ids = new Set<string>();
  const players: CataloguePlayer[] = [];
  for (const item of value) {
    const record = asRecord(item);
    const id = asString(record?.id);
    const name = asString(record?.name);
    const teamName = asString(record?.teamName);
    const position = asString(record?.position)?.toUpperCase();
    const valueMinor = typeof record?.valueMinor === "number" ? record.valueMinor : NaN;
    const previousValueMinor = typeof record?.previousValueMinor === "number" ? record.previousValueMinor : NaN;
    if (!id || !name || !teamName || !position || !["GK", "DEF", "MID", "FWD"].includes(position) || ids.has(id)
      || !Number.isSafeInteger(valueMinor) || valueMinor < 0 || !Number.isSafeInteger(previousValueMinor) || previousValueMinor < 0) {
      throw new PublicError("INVALID_CATALOGUE", "Each catalogue player needs a unique id, name, club, position and valid prices.", 400);
    }
    ids.add(id);
    players.push({ id, name, teamName, position: position as Position, valueMinor, previousValueMinor });
  }
  return players;
}

async function readFreshCache(db: ReturnType<typeof serviceClient>, players: CataloguePlayer[]) {
  const { data, error } = await db.from("player_catalogue_profiles")
    .select("catalogue_player_id,match_status,source_updated_at,real_player_id,current_value_minor")
    .in("catalogue_player_id", players.map((player) => player.id));
  if (error || !data || data.length !== players.length) return null;
  const staleBefore = Date.now() - 30 * 24 * 60 * 60 * 1_000;
  const fresh = data.every((row) =>
    new Date(String(row.source_updated_at)).getTime() >= staleBefore
    && (row.match_status !== "matched" || (row.real_player_id && row.current_value_minor !== null))
  );
  if (!fresh) return null;
  const matched = data.filter((row) => row.match_status === "matched").length;
  const ambiguous = data.filter((row) => row.match_status === "ambiguous").length;
  return { matched, unmatched: data.length - matched - ambiguous, ambiguous, providerRequests: 0 };
}

async function countRequestsToday(db: ReturnType<typeof serviceClient>): Promise<number> {
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const { count, error } = await db.from("api_request_logs").select("id", { count: "exact", head: true })
    .eq("provider", "api-football").gte("created_at", dayStart.toISOString());
  return error ? 0 : count ?? 0;
}

async function premierLeagueProviderSeason(db: ReturnType<typeof serviceClient>, seasonId: string): Promise<string> {
  const { data: competition, error: competitionError } = await db.from("real_competitions")
    .select("id").eq("provider", "api-football").eq("provider_external_id", "39").maybeSingle();
  if (competitionError || !competition) {
    throw new PublicError("PREMIER_LEAGUE_MISSING", "The Premier League competition has not been configured.", 409);
  }
  const { data: enabled, error: enabledError } = await db.from("enabled_competitions")
    .select("provider_season_id").eq("season_id", seasonId).eq("real_competition_id", competition.id).eq("enabled", true).maybeSingle();
  if (enabledError || !enabled) {
    throw new PublicError("PREMIER_LEAGUE_DISABLED", "The Premier League is not enabled for this private season.", 409);
  }
  return String(enabled.provider_season_id);
}

async function loadPremierLeaguePlayers(provider: ApiFootballProvider, providerSeasonId: string): Promise<ProviderPlayer[]> {
  const players: ProviderPlayer[] = [];
  for (let page = 1; page <= 60; page += 1) {
    const response = await provider.players("39", providerSeasonId, page);
    for (const item of response) {
      const parsed = parseProviderPlayer(item);
      if (parsed) players.push(parsed);
    }
    if (response.length < 20) break;
  }
  if (players.length === 0) throw new Error("API-Football returned no Premier League player profiles.");
  return players;
}

function parseProviderPlayer(value: unknown): ProviderPlayer | null {
  const record = asRecord(value);
  const player = asRecord(record?.player);
  const statistic = asRecord(asArray(record?.statistics)[0]);
  const team = asRecord(statistic?.team);
  const games = asRecord(statistic?.games);
  const id = asString(player?.id);
  const name = asString(player?.name);
  const teamName = asString(team?.name);
  const position = positionFromProvider(games?.position);
  if (!id || !name || !teamName || !position) return null;
  return {
    id,
    name,
    teamName,
    position,
    birthDate: asString(asRecord(player?.birth)?.date),
    nationality: asString(player?.nationality),
  };
}

async function persistProviderPlayers(db: ReturnType<typeof serviceClient>, providerPlayers: ProviderPlayer[]): Promise<Map<string, string>> {
  const uniquePlayers = [...new Map(providerPlayers.map((player) => [player.id, player])).values()];
  const { data, error } = await db.from("real_players").upsert(
    uniquePlayers.map((player) => ({
      provider: "api-football",
      provider_external_id: player.id,
      display_name: player.name,
      birth_date: player.birthDate,
      nationality: player.nationality,
      position: player.position,
      last_synced_at: new Date().toISOString(),
    })),
    { onConflict: "provider,provider_external_id" },
  ).select("id,provider_external_id");
  if (error || !data) throw new Error("Could not cache provider player profiles.");
  return new Map(data.map((player) => [String(player.provider_external_id), String(player.id)]));
}

async function persistSeasonValues(
  db: ReturnType<typeof serviceClient>,
  seasonId: string,
  rows: Array<{ real_player_id: string | null; current_value_minor: number; previous_value_minor: number }>,
) {
  const realPlayerIds = rows.flatMap((row) => row.real_player_id ? [row.real_player_id] : []);
  if (!realPlayerIds.length) return;
  const { data: existing, error: existingError } = await db.from("dynamic_player_values")
    .select("real_player_id,initial_value_minor").eq("season_id", seasonId).in("real_player_id", realPlayerIds);
  if (existingError) throw new Error("Could not load existing market values.");
  const initialValues = new Map((existing ?? []).map((value) => [String(value.real_player_id), Number(value.initial_value_minor)]));
  const now = new Date().toISOString();
  const { error } = await db.from("dynamic_player_values").upsert(
    rows.flatMap((row) => row.real_player_id ? [{
      season_id: seasonId,
      real_player_id: row.real_player_id,
      current_value_minor: row.current_value_minor,
      previous_value_minor: row.previous_value_minor,
      initial_value_minor: initialValues.get(row.real_player_id) ?? row.current_value_minor,
      target_value_minor: row.current_value_minor,
      explanation: [{ source: "fpl_catalogue" }],
      formula_version: "fpl-catalogue-v1",
      valued_at: now,
      updated_at: now,
    }] : []),
    { onConflict: "season_id,real_player_id" },
  );
  if (error) throw new Error("Could not save server market values.");
}

function profileRow(player: CataloguePlayer, providerPlayers: ProviderPlayer[], realPlayerIds: Map<string, string>) {
  const exact = providerPlayers.filter((candidate) =>
    normalise(candidate.name) === normalise(player.name)
    && canonicalClub(candidate.teamName) === canonicalClub(player.teamName)
    && candidate.position === player.position
  );
  const candidate = exact.length === 1 ? exact[0] : null;
  return {
    catalogue_player_id: player.id,
    api_football_player_id: candidate?.id ?? null,
    real_player_id: candidate ? realPlayerIds.get(candidate.id) ?? null : null,
    display_name: player.name,
    team_name: player.teamName,
    position: player.position,
    birth_date: candidate?.birthDate ?? null,
    nationality: candidate?.nationality ?? null,
    match_status: candidate ? "matched" : exact.length > 1 ? "ambiguous" : "unmatched",
    match_confidence: candidate ? 100 : 0,
    current_value_minor: player.valueMinor,
    previous_value_minor: player.previousValueMinor,
    source_updated_at: new Date().toISOString(),
  };
}

function positionFromProvider(value: unknown): Position | null {
  const position = asString(value)?.toUpperCase();
  if (["G", "GK", "GOALKEEPER"].includes(position ?? "")) return "GK";
  if (["D", "DEF", "DEFENDER"].includes(position ?? "")) return "DEF";
  if (["M", "MID", "MIDFIELDER"].includes(position ?? "")) return "MID";
  if (["F", "FWD", "ATTACKER", "FORWARD"].includes(position ?? "")) return "FWD";
  return null;
}

function normalise(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function canonicalClub(value: string): string {
  const aliases: Record<string, string> = {
    "man city": "manchester city",
    "man utd": "manchester united",
    "newcastle": "newcastle united",
    "nott m forest": "nottingham forest",
    "spurs": "tottenham",
    "wolves": "wolverhampton wanderers",
  };
  const club = normalise(value);
  return aliases[club] ?? club;
}
