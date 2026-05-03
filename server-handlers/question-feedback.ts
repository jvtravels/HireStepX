/* Vercel Edge Function — Per-question feedback (active-learning loop)
 *
 * Captures the user's signal on individual generated questions:
 *   thumbs="up"   → realistic, well-targeted question
 *   thumbs="down" → off-base, generic, or wrong difficulty
 *   thumbs="real" → the candidate marks "this matched my real interview"
 *                   (highest-value signal — drives curated bank updates)
 *
 * Lightweight upsert: a user can change their thumbs on a (session, question)
 * pair before submitting; we do an upsert keyed on (user_id, session_id,
 * question_index) so the latest signal wins without accumulating noise.
 *
 * Privacy: question_text is stored verbatim because the curation pipeline
 * needs it to identify which generated questions are landing well. The
 * candidate's *answer* is NOT stored here — see save-session for that.
 *
 * POST /api/question-feedback
 *   { sessionId, questionIndex, questionText, thumbs, company?, role?, focus?, comment? }
 */

export const config = { runtime: "edge" };

import { withAuthAndRateLimit, corsHeaders, withRequestId } from "./_shared";

declare const process: { env: Record<string, string | undefined> };
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

interface FeedbackBody {
  sessionId?: unknown;
  questionIndex?: unknown;
  questionText?: unknown;
  thumbs?: unknown;
  company?: unknown;
  role?: unknown;
  focus?: unknown;
  comment?: unknown;
}

const VALID_THUMBS = new Set(["up", "down", "real"]);

function asString(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v.slice(0, max);
}

function asInt(v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return -1;
  return Math.max(0, Math.floor(v));
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

  /* Per-user limit kept generous — a candidate may rate every question
     in their session (5-10 per typical session), and we don't want to
     throttle them mid-rating. IP limit guards against scripted abuse. */
  const pre = await withAuthAndRateLimit(req, {
    endpoint: "question-feedback",
    ipLimit: 60,
    userLimit: 40,
    maxBytes: 8_000,
    checkQuota: false,
  });
  if (pre instanceof Response) return pre;
  const { headers, auth } = pre;

  if (!auth.userId || typeof auth.userId !== "string") {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
  }

  let body: FeedbackBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers });
  }

  const sessionId = asString(body.sessionId, 64);
  const questionIndex = asInt(body.questionIndex);
  const questionText = asString(body.questionText, 1500);
  const thumbs = asString(body.thumbs, 16);
  const company = asString(body.company, 100);
  const role = asString(body.role, 100);
  const focus = asString(body.focus, 50);
  const comment = asString(body.comment, 500);

  if (!sessionId || questionIndex < 0 || !questionText || !VALID_THUMBS.has(thumbs)) {
    return new Response(JSON.stringify({
      error: "Required: sessionId, questionIndex (≥0), questionText, thumbs (up|down|real)",
    }), { status: 400, headers });
  }

  /* Upsert keyed on (user_id, session_id, question_index) — a user can
     change their mind before the session report is closed. We DON'T
     create a new row per change; latest thumbs wins. The conflict
     constraint is enforced by a partial unique index defined alongside
     this table in supabase-schema.sql. If no such index exists yet,
     this falls back to insert + duplicate handling on the client side. */
  try {
    const url = `${SUPABASE_URL}/rest/v1/question_feedback?on_conflict=user_id,session_id,question_index`;
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
        question_index: questionIndex,
        question_text: questionText,
        thumbs,
        company,
        role,
        focus,
        comment,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(`[question-feedback] supabase error: HTTP ${res.status}: ${errText.slice(0, 200)}`);
      /* Don't fail the user-facing request hard — feedback is fire-and-
         forget. Return 200 so the UI's optimistic update sticks; we'll
         recover the lost signal via client-side retry. */
      return new Response(JSON.stringify({ ok: false, persisted: false }), { status: 200, headers });
    }

    return new Response(JSON.stringify({ ok: true, persisted: true }), { status: 200, headers });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[question-feedback] threw: ${msg.slice(0, 200)}`);
    return new Response(JSON.stringify({ ok: false, persisted: false, error: msg }), { status: 200, headers });
  }
}
