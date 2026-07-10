export const corsHeaders = {
  "access-control-allow-origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "access-control-allow-headers": "authorization, apikey, content-type, x-client-info, x-cron-secret",
  "access-control-allow-methods": "POST, OPTIONS",
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json; charset=utf-8" },
  });
}

export function errorResponse(error: unknown, status = 500): Response {
  const message = error instanceof PublicError ? error.message : "The synchronisation could not be completed.";
  const code = error instanceof PublicError ? error.code : "SYNC_FAILED";
  return jsonResponse({ error: { code, message } }, error instanceof PublicError ? error.status : status);
}

export class PublicError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "PublicError";
  }
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new PublicError("INVALID_CONTENT_TYPE", "Send a JSON request body.", 415);
  }
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    throw new PublicError("INVALID_JSON", "The request body is not valid JSON.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new PublicError("INVALID_BODY", "The request body must be a JSON object.");
  }
  return value as Record<string, unknown>;
}

export function constantTimeEqual(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  let mismatch = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    mismatch |= (a[index % Math.max(1, a.length)] ?? 0) ^ (b[index % Math.max(1, b.length)] ?? 0);
  }
  return mismatch === 0;
}
