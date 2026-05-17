/* Vercel Edge Function — Credibility-callout dispute
 *
 * Records a candidate's "this flag is wrong" signal on a single
 * Wave-9 credibility callout item. One row per (user, session, flag);
 * latest reason wins via upsert. The blind-spot loop in
 * analyze-sessions-cron uses the per-flag dispute rate (visible in
 * PostHog as `credibility_flag_disputed`) to gauge analyzer
 * false-positive rate per flag, per company tier.
 *
 * Mirrors question-feedback.ts in shape — same auth preamble, same
 * REST upsert pattern, same fire-and-forget contract on persist
 * failure. Schema lives in `credibility_disputes` (supabase-schema.sql).
 *
 * POST /api/credibility-dispute
 *   { sessionId, flag, analyzerVersion?, reason? }
 */

export const config = { runtime: "edge" };

import { withAuthAndRateLimit, corsHeaders, withRequestId } from "./_shared";
import { CREDIBILITY_FLAGS } from "../src/_credibilityCallout";

declare const process: { env: Record<string, string | undefined> };
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

/* Allow-list the dispute target to known credibility flag codes only.
   Keeps a typo / scripted abuse from polluting the dispute table with
   arbitrary strings — the false-positive dashboard groups on `flag`
   and a garbage key in there poisons the rollup. */
const VALID_FLAGS = new Set<string>(CREDIBILITY_FLAGS);

interface DisputeBody {
  sessionId?: unknown;
  flag?: unknown;
  analyzerVersion?: unknown;
  reason?: unknown;
}

function asString(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v.slice(0, max);
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 503, headers: withRequestId(corsHeaders(req)),
    });
  }

  /* Per-user limit ~6 — a session has at most 6 credibility flags so
     a single report rendering can fire at most 6 disputes. IP limit
     guards against scripted noise. Lower than question-feedback's 40
     because dispute volume per session is bounded. */
  const pre = await withAuthAndRateLimit(req, {
    endpoint: "credibility-dispute",
    ipLimit: 30,
    userLimit: 12,
    maxBytes: 4_000,
    checkQuota: false,
  });
  if (pre instanceof Response) return pre;
  const { headers, auth } = pre;

  if (!auth.userId || typeof auth.userId !== "string") {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
  }

  let body: DisputeBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers });
  }

  const sessionId = asString(body.sessionId, 64);
  const flag = asString(body.flag, 80);
  const analyzerVersion = asString(body.analyzerVersion, 40);
  const reason = asString(body.reason, 500);

  if (!sessionId || !VALID_FLAGS.has(flag)) {
    return new Response(JSON.stringify({
      error: "Required: sessionId, flag (must be a known credibility flag code)",
    }), { status: 400, headers });
  }

  try {
    const url = `${SUPABASE_URL}/rest/v1/credibility_disputes?on_conflict=user_id,session_id,flag`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        user_id: auth.userId,
        session_id: sessionId,
        flag,
        analyzer_version: analyzerVersion,
        reason,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(`[credibility-dispute] supabase error: HTTP ${res.status}: ${errText.slice(0, 200)}`);
      /* Soft-fail like question-feedback — the user's optimistic UI
         flip is the source of truth client-side; we'll recover the
         signal on retry. Returning 500 here would surface a scary
         toast for a fire-and-forget action. */
      return new Response(JSON.stringify({ ok: false, persisted: false }), { status: 200, headers });
    }

    return new Response(JSON.stringify({ ok: true, persisted: true }), { status: 200, headers });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[credibility-dispute] threw: ${msg.slice(0, 200)}`);
    return new Response(JSON.stringify({ ok: false, persisted: false, error: msg }), { status: 200, headers });
  }
}
