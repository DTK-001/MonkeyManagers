import { constantTimeEqual, errorResponse, jsonResponse } from "../_shared/http.ts";
import { listActiveSyncTargets, runSeasonSync, serviceClient } from "../_shared/sync.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return jsonResponse({ ok: true });
  if (request.method !== "POST") return jsonResponse({ error: { code: "METHOD_NOT_ALLOWED", message: "Use POST." } }, 405);

  const configuredSecret = Deno.env.get("SYNC_CRON_SECRET") ?? "";
  const authorization = request.headers.get("authorization") ?? "";
  const suppliedSecret = request.headers.get("x-cron-secret") ?? authorization.replace(/^Bearer\s+/i, "");
  if (!configuredSecret || !suppliedSecret || !constantTimeEqual(configuredSecret, suppliedSecret)) {
    return jsonResponse({ error: { code: "UNAUTHORISED", message: "The scheduled request was not authorised." } }, 401);
  }

  try {
    const db = serviceClient();
    const targets = await listActiveSyncTargets(db);
    const results = [];
    for (const target of targets) {
      try {
        results.push(await runSeasonSync({ ...target, triggerType: "scheduled" }));
      } catch {
        results.push({ seasonId: target.seasonId, status: "failed" });
      }
    }
    return jsonResponse({ processed: results.length, results });
  } catch (error) {
    return errorResponse(error);
  }
});
