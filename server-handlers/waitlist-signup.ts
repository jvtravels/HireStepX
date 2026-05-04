/* Vercel Edge Function — Waitlist Signup
 *
 * Server-side path for the ComingSoon waitlist form. The form previously
 * called supabase-js directly from the browser, which depends on the
 * waitlist table having permissive anon-INSERT RLS — and we kept hitting
 * "table doesn't accept this insert" errors when the deployed schema
 * didn't match what the form sent.
 *
 * This endpoint uses the service role key, which bypasses RLS entirely.
 * Failure modes are captured server-side and surfaced as actionable
 * messages to the client (so the user sees "this email is already on
 * the list" instead of a generic "couldn't save").
 *
 * POST /api/waitlist-signup { email, source?, referrer?, utm_source? ... }
 */

export const config = { runtime: "edge" };

import { corsHeaders, withRequestId, isRateLimited, getClientIp, checkBodySize, tooLargeResponse, rateLimitResponse } from "./_shared";

declare const process: { env: Record<string, string | undefined> };
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

interface SignupBody {
  email?: unknown;
  source?: unknown;
  referrer?: unknown;
  utm_source?: unknown;
  utm_medium?: unknown;
  utm_campaign?: unknown;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function asString(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v.slice(0, max).trim();
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

  /* This endpoint is intentionally UNAUTHENTICATED — anyone can submit
     their email. We can't use withAuthAndRateLimit (it requires auth).
     Manual preamble: body size cap + IP rate limit. Bot abuse is also
     mitigated by the client-side honeypot + min-time heuristic in
     ComingSoon.tsx, and the table itself dedupes on email. */
  const headers = withRequestId(corsHeaders(req));
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }
  if (checkBodySize(req, 2_000)) return tooLargeResponse(headers);
  const ip = getClientIp(req);
  if (await isRateLimited(ip, "waitlist-signup", 10, 60_000)) {
    return rateLimitResponse(headers);
  }

  let body: SignupBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers });
  }

  const email = asString(body.email, 254).toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    return new Response(JSON.stringify({ error: "Please enter a valid email address." }), { status: 400, headers });
  }

  const payload: Record<string, string> = {
    email,
    source: asString(body.source, 50) || "coming_soon",
    referrer: asString(body.referrer, 200),
    utm_source: asString(body.utm_source, 100),
    utm_medium: asString(body.utm_medium, 100),
    utm_campaign: asString(body.utm_campaign, 100),
  };

  /* Upsert via PostgREST so a duplicate email returns ok (idempotent
     re-signup). on_conflict requires the email column to be UNIQUE or
     PRIMARY KEY in the schema — see supabase-schema.sql. The
     return=minimal Prefer header avoids fetching the row back. */
  try {
    const url = `${SUPABASE_URL}/rest/v1/waitlist?on_conflict=email`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(`[waitlist-signup] supabase ${res.status}: ${errText.slice(0, 300)}`);

      /* Surface specific failure modes the user can act on. PostgREST
         returns the column name in the error message for missing-column
         cases, so we pattern-match. */
      if (/relation .* does not exist|table .* not found/i.test(errText)) {
        return new Response(JSON.stringify({
          error: "Waitlist isn't set up yet — please email hello@hirestepx.com to get on the list.",
        }), { status: 503, headers });
      }
      if (/column .* does not exist|not-null constraint|violates/i.test(errText)) {
        /* Schema mismatch — the columns we send don't match what the
           table expects. Retry with just the bare-minimum email column
           so a partially-migrated environment still captures the email. */
        const retryRes = await fetch(url, {
          method: "POST",
          headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            "Content-Type": "application/json",
            Prefer: "resolution=merge-duplicates,return=minimal",
          },
          body: JSON.stringify({ email }),
        });
        if (retryRes.ok) {
          return new Response(JSON.stringify({ ok: true, schemaMigrationPending: true }), { status: 200, headers });
        }
        const retryText = await retryRes.text().catch(() => "");
        console.error(`[waitlist-signup] minimal retry also failed: ${retryText.slice(0, 200)}`);
      }

      return new Response(JSON.stringify({
        error: "We couldn't save your email. Please try again — or email hello@hirestepx.com.",
      }), { status: 500, headers });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[waitlist-signup] threw: ${msg.slice(0, 200)}`);
    return new Response(JSON.stringify({
      error: "We couldn't save your email. Please try again — or email hello@hirestepx.com.",
    }), { status: 500, headers });
  }
}
