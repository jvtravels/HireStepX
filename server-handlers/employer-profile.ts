/* Vercel Edge Function — Employer Profile
 *
 * GET  /api/employer-profile  → current employer row (or { status: "none" }
 *      if the authenticated user has never submitted one).
 * POST /api/employer-profile  { companyName, website, gstin? } → upserts a
 *      pending employer row (fresh submission or resubmission after
 *      rejection).
 *
 * Employers are a separate table keyed by auth.users id — see CLAUDE.md
 * scope note in app/(employer) and the schema comment in
 * supabase-schema.sql ("Employer talent-roster feature").
 *
 * Pending rows are reviewed by a human admin via the "Employers" tab in
 * the admin panel (server-handlers/admin-data.ts, actions "employers" /
 * "approve-employer" / "reject-employer") — this handler only ever reads
 * and writes a fresh "pending" row; it never mutates status itself.
 */

export const config = { runtime: "edge" };

import { withAuthAndRateLimit, corsHeaders, withRequestId, slog } from "./_shared";

declare const process: { env: Record<string, string | undefined> };
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function serviceHeaders(): Record<string, string> {
  return { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` };
}

interface EmployerRow {
  id: string;
  company_name: string;
  website: string;
  gstin: string;
  status: "pending" | "approved" | "rejected";
  submitted_at: string;
  approved_at: string | null;
}

interface SubmitBody {
  companyName?: unknown;
  website?: unknown;
  gstin?: unknown;
}

function asString(v: unknown, max: number): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req, { allowGet: true }) });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 503, headers: withRequestId(corsHeaders(req, { allowGet: true })),
    });
  }

  const pre = await withAuthAndRateLimit(req, {
    endpoint: "employer-profile",
    ipLimit: 30,
    userLimit: 20,
    maxBytes: 4_000,
    checkQuota: false,
    allowGet: true,
  });
  if (pre instanceof Response) return pre;
  const { auth } = pre;
  const headers = { ...pre.headers, ...corsHeaders(req, { allowGet: true }) };

  if (!auth.userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
  }

  if (req.method === "GET") {
    return handleGet(auth.userId, headers);
  }
  if (req.method === "POST") {
    return handlePost(req, auth.userId, headers);
  }
  return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
}

async function fetchEmployer(userId: string): Promise<EmployerRow | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/employers?id=eq.${encodeURIComponent(userId)}&select=id,company_name,website,gstin,status,submitted_at,approved_at`,
    { headers: serviceHeaders() },
  );
  if (!res.ok) throw new Error(`employer read failed: ${res.status}`);
  const rows = (await res.json().catch(() => [])) as EmployerRow[];
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

async function handleGet(userId: string, headers: Record<string, string>): Promise<Response> {
  try {
    const row = await fetchEmployer(userId);
    if (!row) {
      return new Response(JSON.stringify({ status: "none" }), { status: 200, headers });
    }

    return new Response(
      JSON.stringify({
        status: row.status,
        companyName: row.company_name,
        website: row.website,
        gstin: row.gstin,
      }),
      { status: 200, headers },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    slog.error("employer-profile GET threw", { code: "employer_profile_get_unexpected_error", error: msg.slice(0, 200), userId });
    return new Response(JSON.stringify({ error: "Failed to load employer profile" }), { status: 500, headers });
  }
}

async function handlePost(req: Request, userId: string, headers: Record<string, string>): Promise<Response> {
  let body: SubmitBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers });
  }

  const companyName = asString(body.companyName, 200);
  const website = asString(body.website, 300);
  const gstin = asString(body.gstin, 20);

  if (companyName.length < 2 || website.length < 3) {
    return new Response(JSON.stringify({ error: "companyName and website are required" }), { status: 400, headers });
  }

  try {
    const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/employers?on_conflict=id`, {
      method: "POST",
      headers: { ...serviceHeaders(), "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify([{
        id: userId,
        company_name: companyName,
        website,
        gstin,
        status: "pending",
        submitted_at: new Date().toISOString(),
        approved_at: null,
      }]),
    });

    if (!upsertRes.ok) {
      const t = await upsertRes.text().catch(() => "");
      slog.error("employer-profile upsert failed", { code: "employer_profile_upsert_failed", httpStatus: upsertRes.status, body: t.slice(0, 200), userId });
      return new Response(JSON.stringify({ error: "Failed to submit company profile" }), { status: 500, headers });
    }

    return new Response(JSON.stringify({ status: "pending", companyName, website, gstin }), { status: 200, headers });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    slog.error("employer-profile POST threw", { code: "employer_profile_post_unexpected_error", error: msg.slice(0, 200), userId });
    return new Response(JSON.stringify({ error: "Failed to submit company profile" }), { status: 500, headers });
  }
}
