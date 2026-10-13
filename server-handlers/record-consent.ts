/* Vercel Edge Function — Record consent
 *
 * POST /api/record-consent { purpose: "terms_privacy", version }
 * Appends one row to user_consents (service role; the table has no client
 * insert policy) as the consent ledger required by DPDP Act 2023: who agreed
 * to what version, when, with a salted IP hash and the user agent. Idempotent
 * per (user, purpose, version).
 *
 * Deploys before the migration: if user_consents doesn't exist yet we answer
 * 202 { recorded: false, retry: true } instead of an error, and the client
 * keeps its pending flag and retries on the next session.
 */

export const config = { runtime: "edge" };

import { withAuthAndRateLimit, getClientIp, slog } from "./_shared";
import { buildConsentRow, hashIp, isMissingTableError, validateConsentBody } from "./_record-consent-helpers";

declare const process: { env: Record<string, string | undefined> };

export default async function handler(req: Request): Promise<Response> {
  const pre = await withAuthAndRateLimit(req, {
    endpoint: "record-consent",
    ipLimit: 30,
    userLimit: 10,
    maxBytes: 2_000,
  });
  if (pre instanceof Response) return pre;
  const { headers, auth } = pre;
  const json = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers });

  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!auth.userId) return json({ error: "unauthorized" }, 401);

  let raw: unknown;
  try { raw = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const parsed = validateConsentBody(raw);
  if (!parsed.ok) return json({ error: parsed.error }, 400);

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!supabaseUrl || !serviceKey) return json({ recorded: false, retry: true }, 202);

  const row = buildConsentRow({
    userId: auth.userId,
    purpose: parsed.purpose,
    version: parsed.version,
    ipHash: await hashIp(getClientIp(req), process.env.CONSENT_IP_HASH_SALT),
    userAgent: req.headers.get("user-agent"),
  });

  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/user_consents?on_conflict=user_id,purpose,version`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=ignore-duplicates,return=minimal",
      },
      body: JSON.stringify(row),
    });
    if (res.ok) return json({ recorded: true }, 200);
    const text = await res.text().catch(() => "");
    if (isMissingTableError(res.status, text)) return json({ recorded: false, retry: true }, 202);
    slog.error("record-consent insert failed", { code: "record_consent_insert_failed", httpStatus: res.status, userId: auth.userId });
    return json({ recorded: false, retry: true }, 202);
  } catch (err) {
    slog.error("record-consent threw", { code: "record_consent_error", error: (err instanceof Error ? err.message : String(err)).slice(0, 200) });
    return json({ recorded: false, retry: true }, 202);
  }
}
