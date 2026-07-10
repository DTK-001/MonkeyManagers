import { errorResponse, isUuid, jsonResponse, readJsonObject } from "../_shared/http.ts";
import {
  assertLeagueAdmin,
  findActiveSeasonForLeague,
  runSeasonSync,
  serviceClient,
} from "../_shared/sync.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return jsonResponse({ ok: true });
  if (request.method !== "POST") return jsonResponse({ error: { code: "METHOD_NOT_ALLOWED", message: "Use POST." } }, 405);

  try {
    const body = await readJsonObject(request);
    const leagueId = body.leagueId;
    const requestedKey = body.idempotencyKey;
    if (!isUuid(leagueId)) return jsonResponse({ error: { code: "INVALID_LEAGUE", message: "A valid league ID is required." } }, 400);
    if (requestedKey !== undefined && !isUuid(requestedKey)) {
      return jsonResponse({ error: { code: "INVALID_IDEMPOTENCY_KEY", message: "The idempotency key must be a UUID." } }, 400);
    }

    const authorization = request.headers.get("authorization") ?? "";
    const token = authorization.replace(/^Bearer\s+/i, "");
    if (!token) return jsonResponse({ error: { code: "UNAUTHORISED", message: "Sign in before running a sync." } }, 401);
    const db = serviceClient();
    const { data, error } = await db.auth.getUser(token);
    if (error || !data.user) return jsonResponse({ error: { code: "UNAUTHORISED", message: "Your session is no longer valid." } }, 401);

    const profileId = await assertLeagueAdmin(db, data.user.id, leagueId);
    const seasonId = await findActiveSeasonForLeague(db, leagueId);
    const result = await runSeasonSync({
      leagueId,
      seasonId,
      triggerType: "manual",
      requestedByProfileId: profileId,
      idempotencyKey: `manual:${seasonId}:${requestedKey ?? crypto.randomUUID()}`,
    });
    return jsonResponse(result, result.alreadyProcessed ? 200 : 202);
  } catch (error) {
    return errorResponse(error);
  }
});
