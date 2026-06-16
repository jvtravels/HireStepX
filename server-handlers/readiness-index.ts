/* Vercel Edge Function — Readiness Index analytics payload
 *
 * Authoritative read path for the candidate-facing Analytics surface. Reads
 * the caller's own session history (with cached report_json) + target profile
 * via the service-role key, folds them through the deterministic scoring core
 * (server-handlers/_readiness-core.ts), and returns the ReadinessPayload the
 * UI renders directly. No LLM, no writes — pure compute over already-evaluated
 * sessions, so it is cheap and idempotent.
 *
 * GET /api/readiness-index   (auth via Authorization header; no body)
 */

export const config = { runtime: "edge" };

import { withAuthAndRateLimit, corsHeaders, withRequestId } from "./_shared";
import { computeReadiness, type RawSession, type RIReport, type ReadinessProfile } from "./_readiness-core";

declare const process: { env: Record<string, string | undefined> };
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

/* Cap the history window we fold. A year of daily practice is well within
   this; beyond it the trajectory tail adds noise, not signal. */
const MAX_SESSIONS = 400;

interface SessionRow {
  id: string;
  created_at: string;
  focus: string | null;
  type: string | null;
  difficulty: string | null;
  duration: number | null;
  score: number | null;
  questions: number | null;
  target_company: string | null;
  negotiation_metrics: Record<string, unknown> | null;
  report_json: RIReport | null;
}

interface ProfileRow {
  target_role: string | null;
  target_company: string | null;
  experience_level: string | null;
  interview_date: string | null;
  practice_timestamps: string[] | null;
}

export default async function handler(req: Request): Promise<Response> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 503,
      headers: withRequestId(corsHeaders(req)),
    });
  }

  const pre = await withAuthAndRateLimit(req, {
    endpoint: "readiness-index",
    ipLimit: 60,
    userLimit: 30,
    allowGet: true,
  });
  if (pre instanceof Response) return pre;
  const { headers, auth } = pre;
  if (!auth.userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
  }

  const sbHeaders = { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, Accept: "application/json" };
  const uid = encodeURIComponent(auth.userId);

  // Order DESC so the cap keeps the MOST RECENT sessions; an ASC cap would
  // silently drop a heavy user's latest sessions and freeze their RI on stale
  // history. The core re-sorts ascending, and we reverse below to match.
  const sessionsQuery =
    `sessions?user_id=eq.${uid}` +
    `&select=id,created_at,focus,type,difficulty,duration,score,questions,target_company,negotiation_metrics,report_json` +
    `&order=created_at.desc&limit=${MAX_SESSIONS}`;
  const profileQuery =
    `profiles?id=eq.${uid}&select=target_role,target_company,experience_level,interview_date,practice_timestamps`;

  let sessionRows: SessionRow[] = [];
  let profileRow: ProfileRow | null = null;
  try {
    const [sRes, pRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/${sessionsQuery}`, { headers: sbHeaders }),
      fetch(`${SUPABASE_URL}/rest/v1/${profileQuery}`, { headers: sbHeaders }),
    ]);
    if (!sRes.ok) {
      const t = await sRes.text().catch(() => "");
      console.error(`[readiness-index] sessions fetch HTTP ${sRes.status}: ${t.slice(0, 200)}`);
      return new Response(JSON.stringify({ error: "Could not load sessions" }), { status: 502, headers });
    }
    const sJson: unknown = await sRes.json().catch(() => []);
    // Fetched newest-first; reverse to oldest-first for the core.
    sessionRows = Array.isArray(sJson) ? (sJson as SessionRow[]).reverse() : [];
    if (pRes.ok) {
      const pJson: unknown = await pRes.json().catch(() => []);
      profileRow = Array.isArray(pJson) && pJson.length ? (pJson[0] as ProfileRow) : null;
    }
  } catch (err) {
    console.error(`[readiness-index] read failed: ${err instanceof Error ? err.message : String(err)}`);
    return new Response(JSON.stringify({ error: "Could not load analytics" }), { status: 502, headers });
  }

  const sessions: RawSession[] = sessionRows.map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    focus: r.focus || undefined,
    type: r.type || undefined,
    difficulty: r.difficulty || undefined,
    duration: r.duration ?? undefined,
    score: r.score ?? undefined,
    questions: r.questions ?? undefined,
    company: r.target_company || undefined,
    negotiationMetrics: r.negotiation_metrics ?? null,
    report: r.report_json ?? null,
  }));

  const profile: ReadinessProfile = {
    targetRole: profileRow?.target_role || undefined,
    targetCompany: profileRow?.target_company || undefined,
    experienceLevel: profileRow?.experience_level || undefined,
    interviewDate: profileRow?.interview_date || undefined,
    practiceTimestamps: Array.isArray(profileRow?.practice_timestamps) ? profileRow!.practice_timestamps : [],
  };

  const payload = computeReadiness({ sessions, profile, nowMs: Date.now() });

  return new Response(
    JSON.stringify({ ok: true, payload, sessions: sessions.length, sparse: payload?.meta.sparse ?? true }),
    { status: 200, headers },
  );
}
