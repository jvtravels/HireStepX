/* Vercel Edge Function — Update Session Score
 *
 * Narrow PATCH-equivalent companion to save-session.ts. Exists for one
 * case: an end-of-session evaluation call failed (network error / LLM
 * outage), the candidate got the heuristic fallback score, and the
 * client queued a retry (see `_evaluation-flow.ts`). When that retry
 * later succeeds with a real LLM score, this endpoint patches ONLY
 * score / ai_feedback / skill_scores on the already-saved row.
 *
 * save-session.ts can't be reused for this: it rebuilds and overwrites
 * every column on every call (transcript, job_description, jd_analysis,
 * target_role/company, negotiation_metrics, resume_version_id, ...), so
 * resending it with just the retried score would require reconstructing
 * the full original payload or silently NULL out everything else. The
 * retry queue only carries the scoring inputs, not the full session
 * record — a dedicated score-only patch avoids that data loss.
 */

export const config = { runtime: "edge" };

import { withAuthAndRateLimit } from "./_shared";

declare const process: { env: Record<string, string | undefined> };
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function asString(v: unknown, max = 20000): string {
  if (typeof v !== "string") return "";
  return v.slice(0, max);
}

function asFiniteScore(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.min(100, Math.max(0, n));
}

interface UpdateBody {
  id?: string;
  score?: number;
  ai_feedback?: string;
  skill_scores?: Record<string, unknown> | null;
}

export default async function handler(req: Request): Promise<Response> {
  const pre = await withAuthAndRateLimit(req, {
    endpoint: "update-session-score",
    ipLimit: 20,
    userLimit: 10,
    maxBytes: 40_000,
  });
  if (pre instanceof Response) return pre;
  const { headers, auth } = pre;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return new Response(JSON.stringify({ error: "Service unavailable" }), { status: 503, headers });
  }

  let body: UpdateBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers });
  }

  const id = asString(body.id, 64);
  const score = asFiniteScore(body.score);
  if (!id || score === null) {
    return new Response(JSON.stringify({ error: "Missing id or score" }), { status: 400, headers });
  }

  // Ownership guard — the row must already belong to the caller. This is a
  // patch of an existing session, never a create, so a missing row is a
  // no-op rather than an error (the original save may have failed too, or
  // the user already deleted the session).
  const ownerRes = await fetch(
    `${SUPABASE_URL}/rest/v1/sessions?id=eq.${encodeURIComponent(id)}&select=user_id`,
    { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } },
  );
  if (!ownerRes.ok) {
    return new Response(JSON.stringify({ error: "Service unavailable" }), { status: 503, headers });
  }
  const ownerRows = await ownerRes.json().catch(() => []);
  const ownerRow = Array.isArray(ownerRows) ? ownerRows[0] : null;
  if (!ownerRow) {
    return new Response(JSON.stringify({ ok: true, found: false }), { status: 200, headers });
  }
  if (ownerRow.user_id !== auth.userId) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers });
  }

  const patch: Record<string, unknown> = { score };
  if (typeof body.ai_feedback === "string") patch.ai_feedback = asString(body.ai_feedback);
  if (body.skill_scores && typeof body.skill_scores === "object") patch.skill_scores = body.skill_scores;

  const patchRes = await fetch(
    `${SUPABASE_URL}/rest/v1/sessions?id=eq.${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify(patch),
    },
  );
  if (!patchRes.ok) {
    const errText = await patchRes.text().catch(() => "");
    console.error(`[update-session-score] patch failed HTTP ${patchRes.status}: ${errText.slice(0, 200)}`);
    return new Response(JSON.stringify({ error: "Could not update session score" }), { status: 502, headers });
  }

  return new Response(JSON.stringify({ ok: true, found: true }), { status: 200, headers });
}
