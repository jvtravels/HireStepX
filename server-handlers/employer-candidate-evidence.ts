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
 * Ownership, suspension, candidate opt-out and candidate blocks are all
 * resolved by loadEmployerMatchAccess (_entitlements.ts) before any session
 * data is read. Only server-graded sessions (report_generated_at set by
 * /api/evaluate-session) count as evidence — client-written scores never do.
 */

export const config = { runtime: "edge" };

import { withAuthAndRateLimit, corsHeaders, withRequestId, slog } from "./_shared";
import {
  extractEvidenceSkills,
  extractEvidenceQuotes,
  extractReadinessForecast,
  extractStarCompleteness,
  extractSessionTrend,
  latestSessionByUser,
  computeVerifiedCapabilitiesForCandidate,
  claimProfileView,
  type SessionRow,
} from "./_employer-candidate-evidence-helpers";
import { notify } from "./_notify";
import { emailShell, title as emailTitle, para, button, escapeHtml } from "./_email-theme";
import { loadEmployerMatchAccess, loadAuthIdentity, DENIED_STATUS } from "./_entitlements";

declare const process: { env: Record<string, string | undefined> };
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const RESEND_API_KEY = (process.env.RESEND_API_KEY || "").trim();
const FROM_EMAIL = process.env.FROM_EMAIL || "HireStepX <noreply@hirestepx.com>";
const APP_URL = (process.env.APP_URL || "https://hirestepx.vercel.app").replace(/\/$/, "");

function serviceHeaders(): Record<string, string> {
  return { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` };
}

/** Best-effort "an employer viewed your profile" email — fires alongside the
 *  in-app notify() the first time an employer opens a given match's evidence
 *  panel (gated upstream by claimProfileView). Deliberately generic: it never
 *  names the company or role, so the notification can't be used to learn who
 *  is looking (or to harass the candidate) before the employer has paid to
 *  unlock. Never throws: a failure here must never fail the evidence read. */
async function sendProfileViewedEmail(opts: { candidateUserId: string }): Promise<void> {
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
    const headline = "An employer looked at your practice evidence.";
    const link = `${APP_URL}/jobs`;
    const html = emailShell({
      preview: headline,
      body:
        emailTitle("An employer viewed", { accentWord: "your profile" }) +
        para(`Hi ${firstName}, ${headline} Your name and contact details stay hidden unless you choose to respond. You can switch employer visibility off any time in Settings.`) +
        button("View your matches", link),
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
    const identity = await loadAuthIdentity(SUPABASE_URL, serviceHeaders(), auth.userId);
    const decision = await loadEmployerMatchAccess({
      supabaseUrl: SUPABASE_URL,
      headers: serviceHeaders(),
      employerId: auth.userId,
      matchId,
      authEmail: identity.email,
      emailConfirmed: identity.emailConfirmed,
    });
    if (!decision.ok) {
      if (decision.reason === "error") {
        return new Response(JSON.stringify({ error: "Failed to load evidence" }), { status: 502, headers });
      }
      const d = DENIED_STATUS[decision.reason];
      return new Response(JSON.stringify({ error: d.error }), { status: d.status, headers });
    }
    const { match, unlocked } = decision.access;
    const candidateUserId = match.candidate_user_id;

    if (await claimProfileView(SUPABASE_URL, serviceHeaders(), matchId, new Date().toISOString())) {
      await Promise.all([
        notify({
          userId: candidateUserId,
          type: "employer_viewed_profile",
          title: "An employer viewed your profile",
          body: "An employer looked at your practice evidence. Your identity stays hidden until you respond.",
          link: "/jobs",
        }).catch(() => {}),
        sendProfileViewedEmail({ candidateUserId }),
      ]);
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
      `${SUPABASE_URL}/rest/v1/sessions?user_id=eq.${encodeURIComponent(candidateUserId)}&select=user_id,created_at,report_json,type,skill_scores,score,focus&report_generated_at=not.is.null&order=created_at.desc&limit=50`,
      { headers: serviceHeaders() },
    );
    const sessionRows = (await sessionsRes.json().catch(() => [])) as SessionRow[];
    const latest = latestSessionByUser(sessionRows).get(candidateUserId);

    let resumeFile: { fileName: string } | null = null;
    if (unlocked) {
      const fileRes = await fetch(
        `${SUPABASE_URL}/rest/v1/resume_versions?select=file_name,file_path,resumes!inner(user_id)&resumes.user_id=eq.${encodeURIComponent(candidateUserId)}&file_path=not.is.null&order=created_at.desc&limit=1`,
        { headers: serviceHeaders() },
      ).catch(() => null);
      const fileRows = fileRes && fileRes.ok ? ((await fileRes.json().catch(() => [])) as Array<{ file_name: string | null }>) : [];
      if (fileRows[0]) resumeFile = { fileName: fileRows[0].file_name || "resume" };
    }

    return new Response(
      JSON.stringify({
        matchId,
        sessionTrend: extractSessionTrend(sessionRows),
        resumeFile,
        skills: latest ? extractEvidenceSkills(latest.report_json) : [],
        // Verbatim answers often name past employers/colleagues, so they stay
        // locked until the employer has paid to unlock this candidate.
        quotes: unlocked && latest ? extractEvidenceQuotes(latest.report_json) : [],
        quotesLocked: !unlocked,
        unlocked,
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
