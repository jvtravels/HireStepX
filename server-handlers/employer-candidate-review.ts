/* Vercel Edge Function — Employer Candidate Review
 *
 * GET /api/employer-candidate-review?matchId=...
 * PATCH /api/employer-candidate-review  { matchId, rating: 1-4, reason }
 *
 * One independent review per teammate per candidate. Teammates' reviews are
 * blind: GET only returns them once the caller has submitted their own, so
 * nobody anchors on a colleague's verdict. The employer always comes from the
 * session, never the body, and the match is checked against it.
 */

export const config = { runtime: "edge" };

import { withAuthAndRateLimit, corsHeaders, withRequestId, slog } from "./_shared";
import { loadEmployerMatchAccess, loadAuthIdentity, DENIED_STATUS } from "./_entitlements";
import { requireEmployerPermission, writeAuditLog } from "./_employer-team-helpers";
import { asRating, asReason, toReviewView, visibleReviews, summarizeReviews, type ReviewRow, type ReviewView } from "./_review-helpers";

declare const process: { env: Record<string, string | undefined> };
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function serviceHeaders(): Record<string, string> {
  return { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` };
}

const SELECT = "reviewer_user_id,reviewer_email,rating,reason,updated_at";

async function loadReviews(matchId: string): Promise<ReviewView[] | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/match_reviews?match_id=eq.${encodeURIComponent(matchId)}&select=${SELECT}&order=updated_at.asc`,
    { headers: serviceHeaders(), signal: AbortSignal.timeout(8000) },
  );
  if (!res.ok) return null;
  const rows = (await res.json().catch(() => [])) as ReviewRow[];
  return rows.map(toReviewView).filter((r): r is ReviewView => r !== null);
}

function payload(all: ReviewView[], callerUserId: string) {
  const v = visibleReviews(all, callerUserId);
  return {
    mine: v.mine,
    others: v.others,
    revealed: v.revealed,
    hiddenCount: v.hiddenCount,
    summary: v.revealed ? summarizeReviews([...(v.mine ? [v.mine] : []), ...v.others]) : null,
  };
}

export default async function handler(req: Request): Promise<Response> {
  const cors = { allowGet: true, allowPatch: true } as const;
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req, cors) });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), { status: 503, headers: withRequestId(corsHeaders(req, cors)) });
  }

  const pre = await withAuthAndRateLimit(req, {
    endpoint: "employer-candidate-review",
    ipLimit: 60,
    userLimit: 30,
    maxBytes: 4_000,
    checkQuota: false,
    allowGet: true,
    allowPatch: true,
  });
  if (pre instanceof Response) return pre;
  const { auth } = pre;
  const headers = { ...pre.headers, ...corsHeaders(req, cors) };
  if (!auth.userId) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
  if (req.method !== "GET" && req.method !== "PATCH") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }

  let matchId = "";
  let rating: ReturnType<typeof asRating> = null;
  let reason: string | null = null;
  if (req.method === "GET") {
    matchId = new URL(req.url).searchParams.get("matchId") ?? "";
  } else {
    let body: { matchId?: unknown; rating?: unknown; reason?: unknown };
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers });
    }
    matchId = typeof body.matchId === "string" ? body.matchId : "";
    rating = asRating(body.rating);
    reason = asReason(body.reason);
  }
  if (!matchId) return new Response(JSON.stringify({ error: "matchId is required" }), { status: 400, headers });
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(matchId)) {
    return new Response(JSON.stringify({ error: "matchId is not valid" }), { status: 400, headers });
  }
  if (req.method === "PATCH") {
    if (!rating) return new Response(JSON.stringify({ error: "Pick a rating from 1 to 4" }), { status: 400, headers });
    if (!reason) return new Response(JSON.stringify({ error: "Add a short reason (up to 500 characters)" }), { status: 400, headers });
  }

  try {
    const gate = await requireEmployerPermission(SUPABASE_URL, serviceHeaders(), auth.userId, req.method === "GET" ? "candidates.read" : "candidates.manage");
    if (!gate.ok) return new Response(JSON.stringify({ error: gate.error }), { status: gate.status, headers });
    const employerId = gate.ctx.employerId;
    const identity = await loadAuthIdentity(SUPABASE_URL, serviceHeaders(), auth.userId);
    const decision = await loadEmployerMatchAccess({
      supabaseUrl: SUPABASE_URL, headers: serviceHeaders(), employerId, matchId,
      authEmail: identity.email, emailConfirmed: identity.emailConfirmed,
    });
    if (!decision.ok) {
      if (decision.reason === "error") return new Response(JSON.stringify({ error: "Failed to load reviews" }), { status: 502, headers });
      const d = DENIED_STATUS[decision.reason];
      return new Response(JSON.stringify({ error: d.error }), { status: d.status, headers });
    }

    if (req.method === "PATCH") {
      const now = new Date().toISOString();
      const res = await fetch(`${SUPABASE_URL}/rest/v1/match_reviews?on_conflict=match_id,reviewer_user_id`, {
        method: "POST",
        headers: { ...serviceHeaders(), "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({
          employer_id: employerId,
          requirement_id: decision.access.match.requirement_id,
          match_id: matchId,
          reviewer_user_id: auth.userId,
          reviewer_email: gate.ctx.email,
          rating,
          reason,
          updated_at: now,
        }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        slog.error("employer-candidate-review upsert failed", { code: "employer_candidate_review_upsert_failed", httpStatus: res.status, body: t.slice(0, 200), userId: auth.userId, matchId });
        return new Response(JSON.stringify({ error: "Failed to save review" }), { status: 500, headers });
      }
      await writeAuditLog(SUPABASE_URL, serviceHeaders(), {
        employerId, actorUserId: auth.userId, actorEmail: gate.ctx.email, action: "candidate.reviewed",
        entityType: "match", entityId: matchId,
        meta: {
          rating, jobTitle: decision.access.match.employer_requirements?.title ?? null,
          candidateName: decision.access.unlocked ? decision.access.match.profiles?.name ?? null : null,
        },
      });
    }

    const all = await loadReviews(matchId);
    if (!all) return new Response(JSON.stringify({ error: "Failed to load reviews" }), { status: 502, headers });
    return new Response(JSON.stringify(payload(all, auth.userId)), { status: 200, headers });
  } catch (err) {
    slog.error("employer-candidate-review threw", { code: "employer_candidate_review_unexpected_error", error: (err instanceof Error ? err.message : String(err)).slice(0, 200), userId: auth.userId, matchId });
    return new Response(JSON.stringify({ error: "Failed to load reviews" }), { status: 500, headers });
  }
}
