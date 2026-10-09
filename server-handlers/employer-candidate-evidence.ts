/* Vercel Edge Function — Employer Candidate Evidence
 *
 * GET /api/employer-candidate-evidence?matchId=...
 *
 * Surfaces a candidate's ACTUAL per-skill scores from their most recent
 * completed practice session — never fabricated role-specific dimensions.
 * Reuses the RISkill shape already persisted at sessions.report_json.skills
 * (see _readiness-core.ts / sessionReport/types.ts) rather than inventing a
 * new one; extraction lives in _employer-candidate-evidence-helpers.ts so
 * it's unit-tested against the real code.
 *
 * Also returns verifiedCapabilities: the same 4-capability, 2-session/70+
 * verification bar the candidate's own dashboard shows (computed by the
 * shared src/evidenceCapabilities.ts module), so what an employer sees as
 * "Verified" is never looser or stricter than what the candidate sees.
 *
 * Ownership is never taken on trust from the client: the match's parent
 * employer_requirements row is looked up and its employer_id compared
 * against the authenticated caller before any session data is read.
 */

export const config = { runtime: "edge" };

import { withAuthAndRateLimit, corsHeaders, withRequestId, slog } from "./_shared";
import {
  extractEvidenceSkills,
  extractEvidenceQuotes,
  extractReadinessForecast,
  extractStarCompleteness,
  latestSessionByUser,
  computeVerifiedCapabilitiesForCandidate,
  claimProfileView,
  type SessionRow,
} from "./_employer-candidate-evidence-helpers";
import { notify } from "./_notify";
import { emailShell, title as emailTitle, para, button, footer, escapeHtml } from "./_email-theme";

declare const process: { env: Record<string, string | undefined> };
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const RESEND_API_KEY = (process.env.RESEND_API_KEY || "").trim();
const FROM_EMAIL = process.env.FROM_EMAIL || "HireStepX <noreply@hirestepx.com>";
const APP_URL = (process.env.APP_URL || "https://hirestepx.vercel.app").replace(/\/$/, "");

function serviceHeaders(): Record<string, string> {
  return { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` };
}

/** Best-effort "an employer viewed your profile" email — fires immediately,
 *  alongside the in-app notify(), the first time an employer opens a given
 *  match's evidence panel (gated upstream by claimProfileView so a single
 *  view doesn't fire twice). Never throws: a failure here must never fail
 *  the evidence read it's attached to. */
async function sendProfileViewedEmail(opts: {
  candidateUserId: string;
  roleTitle: string;
  companyName: string;
}): Promise<void> {
  if (!RESEND_API_KEY) return;
  try {
    const profileRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(opts.candidateUserId)}&select=name,email`,
      { headers: serviceHeaders(), signal: AbortSignal.timeout(5000) },
    );
    if (!profileRes.ok) return;
    const rows = (await profileRes.json().catch(() => [])) as Array<{ name: string | null; email: string | null }>;
    const email = rows[0]?.email;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;

    const firstName = escapeHtml((rows[0]?.name || "there").split(" ")[0]);
    const role = escapeHtml(opts.roleTitle);
    const company = escapeHtml(opts.companyName);
    const headline = `${company} looked at your profile for ${role}.`;
    const link = `${APP_URL}/jobs`;
    const html = emailShell({
      preview: headline,
      body:
        emailTitle("An employer viewed", { accentWord: "your profile" }) +
        para(`Hi ${firstName}, ${headline} A strong practice score is what gets you from "viewed" to "invited" — keep your evidence sharp.`) +
        button("View your matches", link) +
        footer(),
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: FROM_EMAIL, to: [email], subject: "An employer viewed your profile — HireStepX", html }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        slog.warn("[sendProfileViewedEmail] resend failed", { status: res.status, body: t.slice(0, 200) });
      }
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    slog.warn("[sendProfileViewedEmail] threw", { err: err instanceof Error ? err.message : String(err) });
  }
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
    endpoint: "employer-candidate-evidence",
    ipLimit: 60,
    userLimit: 30,
    checkQuota: false,
    allowGet: true,
  });
  if (pre instanceof Response) return pre;
  const { auth } = pre;
  const headers = { ...pre.headers, ...corsHeaders(req, { allowGet: true }) };

  if (!auth.userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
  }
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }

  const url = new URL(req.url);
  const matchId = url.searchParams.get("matchId") || "";
  if (!matchId) {
    return new Response(JSON.stringify({ error: "matchId is required" }), { status: 400, headers });
  }

  try {
    const matchRes = await fetch(
      `${SUPABASE_URL}/rest/v1/requirement_matches?id=eq.${encodeURIComponent(matchId)}&select=id,requirement_id,candidate_user_id`,
      { headers: serviceHeaders() },
    );
    const matchRows = (await matchRes.json().catch(() => [])) as Array<{ id: string; requirement_id: string; candidate_user_id: string }>;
    if (!matchRes.ok || !matchRows[0]) {
      return new Response(JSON.stringify({ error: "Candidate match not found" }), { status: 404, headers });
    }
    const { requirement_id: requirementId, candidate_user_id: candidateUserId } = matchRows[0];

    const reqRes = await fetch(
      `${SUPABASE_URL}/rest/v1/employer_requirements?id=eq.${encodeURIComponent(requirementId)}&employer_id=eq.${encodeURIComponent(auth.userId)}` +
        `&select=id,title,employers(company_name)`,
      { headers: serviceHeaders() },
    );
    const reqRows = (await reqRes.json().catch(() => [])) as Array<{
      id: string; title: string; employers: { company_name: string } | null;
    }>;
    if (!reqRes.ok || !reqRows[0]) {
      return new Response(JSON.stringify({ error: "Candidate match not found" }), { status: 404, headers });
    }

    const roleTitle = reqRows[0].title || "a role";
    const companyName = reqRows[0].employers?.company_name || "An employer";
    if (await claimProfileView(SUPABASE_URL, serviceHeaders(), matchId, new Date().toISOString())) {
      void notify({
        userId: candidateUserId,
        type: "employer_viewed_profile",
        title: "An employer viewed your profile",
        body: `${companyName} looked at your evidence and details for ${roleTitle}.`,
        link: "/jobs",
      });
      void sendProfileViewedEmail({ candidateUserId, roleTitle, companyName });
    }

    /* limit=50, not 1: the most recent session overall is frequently a
       salary-negotiation practice run, which latestSessionByUser() skips.
       Fetching a batch lets it fall through to the most recent session
       that's actually interview evidence instead of returning none. The
       same batch also backs computeVerifiedCapabilitiesForCandidate() below
       — 50 gives it the same multi-session depth the candidate's own
       dashboard draws on, so a capability the candidate sees "Verified"
       doesn't come up unverified here purely from a shallower fetch. */
    const sessionsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/sessions?user_id=eq.${encodeURIComponent(candidateUserId)}&select=user_id,created_at,report_json,type,skill_scores,score,focus&order=created_at.desc&limit=50`,
      { headers: serviceHeaders() },
    );
    const sessionRows = (await sessionsRes.json().catch(() => [])) as SessionRow[];
    const latest = latestSessionByUser(sessionRows).get(candidateUserId);

    return new Response(
      JSON.stringify({
        matchId,
        skills: latest ? extractEvidenceSkills(latest.report_json) : [],
        quotes: latest ? extractEvidenceQuotes(latest.report_json) : [],
        readiness: latest ? extractReadinessForecast(latest.report_json) : null,
        starCompleteness: latest ? extractStarCompleteness(latest.report_json) : null,
        sessionDate: latest?.created_at ?? null,
        verifiedCapabilities: computeVerifiedCapabilitiesForCandidate(sessionRows, candidateUserId),
      }),
      { status: 200, headers },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    slog.error("employer-candidate-evidence threw", { code: "employer_candidate_evidence_unexpected_error", error: msg.slice(0, 200), userId: auth.userId, matchId });
    return new Response(JSON.stringify({ error: "Failed to load evidence" }), { status: 500, headers });
  }
}
