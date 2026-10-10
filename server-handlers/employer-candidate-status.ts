/* Vercel Edge Function — Employer Candidate Status
 *
 * PATCH /api/employer-candidate-status
 * { matchId: string, candidateStatus: CandidateStatus, note?: string, interviewScheduledAt?: string }
 *
 * Moves one candidate (a requirement_matches row) through the per-candidate
 * hiring pipeline — shortlisted through hired/rejected — independent of the
 * requirement-level `stage` in employer-requirement-detail.ts, which tracks
 * the posting as a whole rather than any one candidate.
 *
 * Ownership is never taken on trust from the client: the match's parent
 * employer_requirements row is looked up and its employer_id compared
 * against the authenticated caller before any write happens.
 *
 * Reused by the outcome-feedback page (app/(employer)/employer/
 * requirements/[id]/outcome/page.tsx) to persist the final hiring outcome
 * that page collects — "Hired" -> hired, "Interviewing" -> interviewing,
 * "Not a fit" -> not_a_fit, "No response yet" -> no_response, with the
 * employer's notes going to `note`.
 */

export const config = { runtime: "edge" };

import { withAuthAndRateLimit, corsHeaders, withRequestId, slog } from "./_shared";
import {
  asCandidateStatus,
  asCandidateStatusNote,
  asInterviewScheduledAt,
  isValidCandidateStatusTransition,
  type RequirementMatchRow,
} from "./_employer-candidate-status-helpers";
import { notify } from "./_notify";
import { findOrCreateConversationId, postSystemMessage } from "./_messages-helpers";
import { emailShell, title as emailTitle, para, b, button, escapeHtml } from "./_email-theme";
import { loadEmployerMatchAccess, loadAuthIdentity, DENIED_STATUS } from "./_entitlements";

/** Statuses that put the employer in direct contact with the candidate — only
 *  reachable after paying to unlock (rejecting/closing out a match is free). */
const CONTACT_STATUSES = new Set(["interview_invited", "interviewing", "hired"]);

const RESEND_API_KEY = (process.env.RESEND_API_KEY || "").trim();
const FROM_EMAIL = process.env.FROM_EMAIL || "HireStepX <noreply@hirestepx.com>";
const APP_URL = (process.env.APP_URL || "https://hirestepx.vercel.app").replace(/\/$/, "");

const STATUS_NOTIFICATION_TEXT: Record<string, { title: string; body: string }> = {
  interview_invited: { title: "You've been invited to interview!", body: "An employer wants to move forward with you — check your dashboard for details." },
  interviewing: { title: "Interview in progress", body: "An employer has marked your interview as in progress." },
  hired: { title: "Congratulations — you got the offer!", body: "An employer has marked you as hired. Great work!" },
  rejected: { title: "Application update", body: "An employer has made a decision on your application." },
  not_a_fit: { title: "Application update", body: "An employer has made a decision on your application." },
};

/** Composes the system-message body posted into the thread when a status
 *  change happens — the thread becomes the record of the hiring decision,
 *  not just a side notification. Returns null for statuses with nothing
 *  worth announcing in-thread (e.g. a same-status note-only update). */
function systemMessageFor(candidateStatus: string, note: string | null, interviewScheduledAt: string | null): string | null {
  switch (candidateStatus) {
    case "interview_invited": {
      const when = interviewScheduledAt ? ` for ${new Date(interviewScheduledAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}` : "";
      return `📅 Interview invite sent${when}.${note ? ` "${note}"` : ""}`;
    }
    case "interviewing":
      return "🗣️ Candidate marked as interviewing.";
    case "hired":
      return `🎉 Candidate marked as hired.${note ? ` "${note}"` : ""}`;
    case "rejected":
      return `Application status updated: Rejected.${note ? ` "${note}"` : ""}`;
    case "not_a_fit":
      return `Application status updated: Not a fit.${note ? ` "${note}"` : ""}`;
    case "no_response":
      return "Application status updated: No response.";
    default:
      return null;
  }
}

declare const process: { env: Record<string, string | undefined> };
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function serviceHeaders(): Record<string, string> {
  return { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` };
}

/** Best-effort "you've been invited to interview" email — the candidate-side
 *  counterpart to sendStrongMatchEmail in employer-requirements.ts. Fires
 *  alongside the in-app notify() only for the interview_invited transition,
 *  since that's the one status change a candidate would actually want to
 *  know about the moment it happens (hired/rejected still land in-app only
 *  for now). Never throws: a failure here must never fail the status
 *  update it's attached to. */
async function sendInterviewInviteEmail(opts: {
  candidateUserId: string;
  roleTitle: string;
  companyName: string;
  interviewScheduledAt: string | null;
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
    const when = opts.interviewScheduledAt
      ? new Date(opts.interviewScheduledAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
      : null;
    const headline = `${company} wants to move forward with you for ${role}.`;
    const link = `${APP_URL}/jobs`;
    const html = emailShell({
      preview: headline,
      body:
        emailTitle("You're invited to", { accentWord: "interview" }) +
        para(`Hi ${firstName}, ${headline}`) +
        (when ? para(`They've suggested ${b(when)} — check your dashboard to confirm or message them directly.`) : para("Check your dashboard for next steps and to message them directly.")) +
        button("View invite", link),
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: FROM_EMAIL, to: [email], subject: `You've been invited to interview — ${opts.roleTitle}`, html }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        slog.warn("[sendInterviewInviteEmail] resend failed", { status: res.status, body: t.slice(0, 200) });
      }
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    slog.warn("[sendInterviewInviteEmail] threw", { err: err instanceof Error ? err.message : String(err) });
  }
}

function toResponseShape(row: RequirementMatchRow) {
  return {
    id: row.id,
    requirementId: row.requirement_id,
    candidateStatus: row.candidate_status,
    candidateStatusNote: row.candidate_status_note,
    candidateStatusUpdatedAt: row.candidate_status_updated_at,
    interviewScheduledAt: row.interview_scheduled_at,
  };
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req, { allowPatch: true }) });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 503, headers: withRequestId(corsHeaders(req, { allowPatch: true })),
    });
  }

  const pre = await withAuthAndRateLimit(req, {
    endpoint: "employer-candidate-status",
    ipLimit: 40,
    userLimit: 20,
    maxBytes: 10_000,
    checkQuota: false,
    allowPatch: true,
  });
  if (pre instanceof Response) return pre;
  const { auth } = pre;
  const headers = { ...pre.headers, ...corsHeaders(req, { allowPatch: true }) };

  if (!auth.userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
  }
  if (req.method !== "PATCH") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }

  let body: { matchId?: unknown; candidateStatus?: unknown; note?: unknown; interviewScheduledAt?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers });
  }

  const matchId = typeof body.matchId === "string" ? body.matchId : "";
  const candidateStatus = asCandidateStatus(body.candidateStatus);
  const note = asCandidateStatusNote(body.note);
  const interviewScheduledAt = asInterviewScheduledAt(body.interviewScheduledAt);

  if (!matchId) {
    return new Response(JSON.stringify({ error: "matchId is required" }), { status: 400, headers });
  }
  if (!candidateStatus) {
    return new Response(JSON.stringify({ error: "Invalid candidateStatus" }), { status: 400, headers });
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
        return new Response(JSON.stringify({ error: "Failed to update candidate status" }), { status: 502, headers });
      }
      const d = DENIED_STATUS[decision.reason];
      return new Response(JSON.stringify({ error: d.error }), { status: d.status, headers });
    }
    const { match: accessMatch, unlocked } = decision.access;
    const matchRows = [{ id: accessMatch.id, requirement_id: accessMatch.requirement_id, candidate_status: accessMatch.candidate_status, candidate_user_id: accessMatch.candidate_user_id }];
    const requirementId = accessMatch.requirement_id;
    const currentStatus = asCandidateStatus(accessMatch.candidate_status);
    const reqRows = [{
      id: requirementId,
      status: accessMatch.employer_requirements?.status ?? "open",
      title: accessMatch.employer_requirements?.title ?? null,
      employers: accessMatch.employer_requirements?.employers ?? null,
    }];

    if (CONTACT_STATUSES.has(candidateStatus) && !unlocked) {
      return new Response(
        JSON.stringify({ error: "Unlock this candidate before inviting or hiring them.", code: "unlock_required" }),
        { status: 402, headers },
      );
    }
    if (candidateStatus === "interview_invited" && accessMatch.candidate_response === "declined") {
      return new Response(JSON.stringify({ error: "This candidate has declined contact for this role." }), { status: 409, headers });
    }

    // A closed/archived requirement is done being worked — the "archive"
    // action already resolved outstanding candidates (see
    // handleStatusAction's reject_remaining path in
    // employer-requirement-detail.ts). Reopening it is the only way back in.
    if (reqRows[0].status === "closed") {
      return new Response(JSON.stringify({ error: "This requirement is closed" }), { status: 409, headers });
    }
    // Guard against skipping stages, going backwards, or resurrecting a
    // terminal outcome (hired/rejected/not_a_fit/no_response) — the pipeline
    // only moves forward one step at a time, matching what the employer UI
    // actually exposes.
    if (!currentStatus || !isValidCandidateStatusTransition(currentStatus, candidateStatus)) {
      return new Response(
        JSON.stringify({ error: `Can't move a candidate from "${currentStatus ?? matchRows[0].candidate_status}" to "${candidateStatus}"` }),
        { status: 409, headers },
      );
    }

    const patchBody: Record<string, unknown> = {
      candidate_status: candidateStatus,
      candidate_status_updated_at: new Date().toISOString(),
    };
    if (note !== null) patchBody.candidate_status_note = note;
    if (interviewScheduledAt !== null) patchBody.interview_scheduled_at = interviewScheduledAt;

    // Compare-and-swap on candidate_status: two concurrent transition
    // requests for the same match (e.g. two employer tabs, or a double
    // click) would otherwise both pass the isValidCandidateStatusTransition
    // check above against the same stale currentStatus and both write,
    // silently clobbering each other and firing contradictory notifications.
    // Filtering the PATCH on the status this request actually read means
    // only the first writer's PATCH matches any row — the loser gets back
    // zero rows and is told to retry against the new state.
    const patchRes = await fetch(
      `${SUPABASE_URL}/rest/v1/requirement_matches?id=eq.${encodeURIComponent(matchId)}&candidate_status=eq.${encodeURIComponent(currentStatus)}`,
      {
        method: "PATCH",
        headers: { ...serviceHeaders(), "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify(patchBody),
      },
    );
    if (!patchRes.ok) {
      const t = await patchRes.text().catch(() => "");
      slog.error("employer-candidate-status PATCH failed", { code: "employer_candidate_status_patch_failed", httpStatus: patchRes.status, body: t.slice(0, 200), userId: auth.userId, matchId });
      return new Response(JSON.stringify({ error: "Failed to update candidate status" }), { status: 500, headers });
    }
    const updated = (await patchRes.json().catch(() => [])) as RequirementMatchRow[];
    const row = updated[0];
    if (!row) {
      return new Response(
        JSON.stringify({ error: "This candidate's status was just changed by someone else — refresh and try again" }),
        { status: 409, headers },
      );
    }

    // Append-only pipeline audit trail (employer-visible timeline + candidate
    // history). Best-effort: the status write above already succeeded.
    await fetch(`${SUPABASE_URL}/rest/v1/match_status_events`, {
      method: "POST",
      headers: { ...serviceHeaders(), "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({
        match_id: matchId,
        requirement_id: requirementId,
        employer_id: auth.userId,
        candidate_user_id: matchRows[0].candidate_user_id,
        from_status: currentStatus,
        to_status: candidateStatus,
        actor: "employer",
        note,
      }),
    }).catch((err) => slog.warn("employer-candidate-status: event insert failed", { error: (err as Error).message }));

    const notifText = STATUS_NOTIFICATION_TEXT[candidateStatus];
    if (notifText) {
      await notify({
        userId: matchRows[0].candidate_user_id,
        type: "candidate_status_change",
        title: notifText.title,
        body: notifText.body,
        link: "/jobs",
      }).catch(() => {});
    }

    if (candidateStatus === "interview_invited") {
      await sendInterviewInviteEmail({
        candidateUserId: matchRows[0].candidate_user_id,
        roleTitle: reqRows[0].title || "a role",
        companyName: reqRows[0].employers?.company_name || "An employer",
        interviewScheduledAt: row.interview_scheduled_at ?? interviewScheduledAt,
      });
    }

    const systemBody = systemMessageFor(candidateStatus, note, row.interview_scheduled_at ?? interviewScheduledAt);
    if (systemBody) {
      await (async () => {
        const conversationId = await findOrCreateConversationId(SUPABASE_URL, serviceHeaders(), {
          matchId,
          requirementId,
          employerId: auth.userId as string,
          candidateUserId: matchRows[0].candidate_user_id,
        });
        if (conversationId) {
          await postSystemMessage(SUPABASE_URL, serviceHeaders(), {
            conversationId,
            employerId: auth.userId as string,
            candidateUserId: matchRows[0].candidate_user_id,
            senderId: auth.userId as string,
            body: systemBody,
          });
        }
      })().catch((err) => slog.warn("employer-candidate-status: system message failed", { error: (err as Error).message }));
    }

    return new Response(JSON.stringify(toResponseShape(row)), { status: 200, headers });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    slog.error("employer-candidate-status threw", { code: "employer_candidate_status_unexpected_error", error: msg.slice(0, 200), userId: auth.userId, matchId });
    return new Response(JSON.stringify({ error: "Failed to update candidate status" }), { status: 500, headers });
  }
}
