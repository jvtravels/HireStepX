/* Vercel Edge Function — Employer Requirement Detail
 *
 * GET /api/employer-requirement-detail?id=<requirementId>
 *
 * Returns one requirement owned by the caller plus its scored candidate
 * shortlist. Contact info (email/phone) is only included once the match's
 * `unlocked` DB flag is set (paid via employer-create-unlock-order.ts +
 * employer-verify-unlock-payment.ts).
 *
 * Candidate fields are limited to what the real schema actually backs:
 * target role, resume-derived city/skills, session count, and last-active
 * recency, plus a normalized `resume` detail block (see
 * _resume-detail-helpers.ts) — summary, employment history, education,
 * and any self-reported notice period / CTC the candidate's own resume
 * text stated. Those last two are exactly what the resume said, not a
 * verified figure, so the UI must label them as self-reported. The
 * mocked-data pass additionally showed an "exclusive to you" flag with no
 * real backing — that one stays dropped rather than fabricated.
 *
 * PATCH /api/employer-requirement-detail?id=<requirementId>
 * Same body shape as POST /api/employer-requirements. Updates the
 * requirement in place, flips it back to "generating", and re-runs
 * `runMatching` (employer-requirements.ts) against the current candidate
 * pool. Already-unlocked matches (real payments) are preserved untouched;
 * every other match is rescored fresh so the shortlist reflects the edit.
 *
 * PATCH /api/employer-requirement-detail?id=<requirementId>
 * { action: "archive" | "reopen" }
 * Lightweight status-only transition used by the Jobs table's row menu —
 * doesn't require the full edit-form body. "archive" sets status to
 * "closed" (blocking further edits, per the isValidRequirementInput guard
 * below); "reopen" flips a closed requirement back to "generating" and
 * re-runs matching, same as a normal edit. Both are logged to
 * employer_requirement_activity for the "History" menu item.
 */

export const config = { runtime: "edge" };

import { withAuthAndRateLimit, corsHeaders, withRequestId, slog } from "./_shared";
import { extractResumeLocation, explainMatch, extractSkills } from "./_requirement-match-helpers";
import { extractResumeDetail, redactResumeDetailForLock } from "./_resume-detail-helpers";
import { runMatching, logRequirementActivity } from "./employer-requirements";
import {
  asBoundedString,
  asBoundedStringArray,
  asBoundedExperience,
  asBoundedDueDate,
  asBoundedBudget,
  asBoundedOpenPositions,
  asBoundedWorkMode,
  asBoundedEmploymentType,
  asBoundedSalaryType,
  asBoundedBoolean,
  asBoundedStage,
  asBoundedDurationWeeks,
  asBoundedHoursPerWeek,
  asBoundedReadinessBand,
  asBoundedStarCompleteness,
  asArchiveDisposition,
  isValidRequirementInput,
  isValidRange,
  isFutureDueDate,
  canManuallyTransitionStage,
  type RequirementRow,
  type RequirementStage,
} from "./_employer-requirements-helpers";

declare const process: { env: Record<string, string | undefined> };
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function serviceHeaders(): Record<string, string> {
  return { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` };
}

interface PortfolioLink {
  title: string;
  url: string;
}

/** Narrows profiles.portfolio_links (jsonb, default '[]') to a clean
 *  { title, url } array, dropping any malformed entry rather than
 *  propagating garbage to the client. */
function extractPortfolioLinks(raw: unknown): PortfolioLink[] {
  if (!Array.isArray(raw)) return [];
  const out: PortfolioLink[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const title = (entry as { title?: unknown }).title;
    const url = (entry as { url?: unknown }).url;
    if (typeof title === "string" && title.trim() && typeof url === "string" && url.trim()) {
      out.push({ title: title.trim(), url: url.trim() });
    }
  }
  return out;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req, { allowGet: true, allowPatch: true }) });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 503, headers: withRequestId(corsHeaders(req, { allowGet: true, allowPatch: true })),
    });
  }

  const pre = await withAuthAndRateLimit(req, {
    endpoint: "employer-requirement-detail",
    ipLimit: 40,
    userLimit: 20,
    maxBytes: req.method === "PATCH" ? 20_000 : 0,
    checkQuota: false,
    allowGet: true,
    allowPatch: true,
  });
  if (pre instanceof Response) return pre;
  const { auth } = pre;
  const headers = { ...pre.headers, ...corsHeaders(req, { allowGet: true, allowPatch: true }) };

  if (!auth.userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
  }

  const requirementId = new URL(req.url).searchParams.get("id") || "";
  if (!requirementId) {
    return new Response(JSON.stringify({ error: "id is required" }), { status: 400, headers });
  }

  if (req.method === "PATCH") return handlePatch(req, requirementId, auth.userId, headers);
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }

  try {
    const reqRes = await fetch(
      `${SUPABASE_URL}/rest/v1/employer_requirements?id=eq.${encodeURIComponent(requirementId)}&employer_id=eq.${encodeURIComponent(auth.userId)}&select=id,title,location,notice_period_pref,description,status,stage,department,archive_reason,archive_disposition,experience_min,experience_max,due_date,budget_min,budget_max,locations,open_positions,work_mode,skills,responsibilities,nice_to_have,preferred_industry,preferred_colleges,target_companies,perks_and_benefits,employment_type,salary_type,duration_weeks,hours_per_week,preferred_domain,work_schedule,availability,relevant_experience,portfolio_required,custom_skill_sets,min_readiness_band,min_star_completeness,matched_pool_size,created_at,last_matched_at`,
      { headers: serviceHeaders() },
    );
    if (!reqRes.ok) throw new Error(`requirement read failed: ${reqRes.status}`);
    const reqRows = (await reqRes.json().catch(() => [])) as Array<{
      id: string; title: string; location: string; notice_period_pref: string; description: string | null; status: string; stage: string;
      department: string | null; archive_reason: string | null; archive_disposition: string | null;
      experience_min: number | null; experience_max: number | null; due_date: string | null;
      budget_min: number | null; budget_max: number | null;
      locations: string[] | null; open_positions: number | null; work_mode: string | null; skills: string[] | null;
      responsibilities: string | null; nice_to_have: string | null; preferred_industry: string | null;
      preferred_colleges: string[] | null; target_companies: string[] | null; perks_and_benefits: string[] | null;
      employment_type: string | null;
      salary_type: string | null; preferred_domain: string | null; work_schedule: string | null;
      availability: string | null; relevant_experience: string | null; portfolio_required: boolean | null;
      custom_skill_sets: string[] | null;
      duration_weeks: number | null; hours_per_week: number | null;
      min_readiness_band: string | null; min_star_completeness: number | null;
      matched_pool_size: number | null;
      created_at: string;
      last_matched_at: string | null;
    }>;
    const requirement = reqRows[0];
    if (!requirement) {
      return new Response(JSON.stringify({ error: "Requirement not found" }), { status: 404, headers });
    }

    const matchesRes = await fetch(
      `${SUPABASE_URL}/rest/v1/requirement_matches?requirement_id=eq.${encodeURIComponent(requirementId)}&select=id,candidate_user_id,match_score,roster_score,unlocked,unlocked_at,candidate_status,candidate_status_note,interview_scheduled_at&order=match_score.desc,id.asc`,
      { headers: serviceHeaders() },
    );
    if (!matchesRes.ok) throw new Error(`matches read failed: ${matchesRes.status}`);
    const matches = (await matchesRes.json().catch(() => [])) as Array<{
      id: string; candidate_user_id: string; match_score: number; roster_score: number; unlocked: boolean; unlocked_at: string | null;
      candidate_status: string; candidate_status_note: string | null; interview_scheduled_at: string | null;
    }>;

    const candidateIds = matches.map((m) => m.candidate_user_id);
    const profileById = new Map<string, { name: string; email: string; target_role: string; resume_data: unknown; practice_timestamps: string[]; portfolio_links: unknown }>();
    if (candidateIds.length > 0) {
      const idParam = candidateIds.map((id) => encodeURIComponent(id)).join(",");
      const profilesRes = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?id=in.(${idParam})&select=id,name,email,target_role,resume_data,practice_timestamps,portfolio_links`,
        { headers: serviceHeaders() },
      );
      if (profilesRes.ok) {
        const rows = (await profilesRes.json().catch(() => [])) as Array<{
          id: string; name: string; email: string; target_role: string; resume_data: unknown; practice_timestamps: string[]; portfolio_links: unknown;
        }>;
        for (const r of rows) profileById.set(r.id, r);
      }
    }

    const sessionCounts = new Map<string, number>();
    if (candidateIds.length > 0) {
      const idParam = candidateIds.map((id) => encodeURIComponent(id)).join(",");
      const sessionsRes = await fetch(
        `${SUPABASE_URL}/rest/v1/sessions?user_id=in.(${idParam})&select=user_id&limit=20000`,
        { headers: serviceHeaders() },
      );
      if (sessionsRes.ok) {
        const rows = (await sessionsRes.json().catch(() => [])) as Array<{ user_id: string }>;
        for (const r of rows) sessionCounts.set(r.user_id, (sessionCounts.get(r.user_id) || 0) + 1);
      }
    }

    /* Defense in depth against stale rows: rankAndCap (_requirement-match-helpers.ts)
       already excludes no-resume/no-session candidates when a requirement is
       created or re-matched, but a row written before that filter existed — or
       one "touched" by the employer (unlocked/status-changed/noted/scheduled),
       which runMatching's preserve-on-edit logic carries over without
       re-scoring — never gets cleaned up by re-running matching alone. Re-apply
       the same evidence rule here at read time so it can't resurface, while
       never hiding a row the employer has actually interacted with. */
    const isTouchedMatch = (m: (typeof matches)[number]) =>
      m.unlocked || m.candidate_status !== "shortlisted" || !!m.candidate_status_note || !!m.interview_scheduled_at;
    const hasEvidence = (m: (typeof matches)[number]) =>
      profileById.get(m.candidate_user_id)?.resume_data != null || (sessionCounts.get(m.candidate_user_id) || 0) > 0;

    const candidates = matches.filter((m) => isTouchedMatch(m) || hasEvidence(m)).map((m) => {
      const profile = profileById.get(m.candidate_user_id);
      const timestamps = Array.isArray(profile?.practice_timestamps) ? profile!.practice_timestamps : [];
      const lastActive = timestamps.length ? timestamps[timestamps.length - 1] : null;
      const lastActiveDaysAgo = lastActive ? Math.max(0, Math.round((Date.now() - new Date(lastActive).getTime()) / 86_400_000)) : -1;
      const resumeDetail = extractResumeDetail(profile?.resume_data);
      const matchBreakdown = explainMatch(
        { target_role: profile?.target_role ?? null, resume_data: profile?.resume_data ?? null },
        { title: requirement.title, location: requirement.location, description: requirement.description || "" },
      );

      const unlocked = m.unlocked;
      /* Identity must never leave the server for a Locked match — masking
         only in the client (candidate.unlocked ? name : "Candidate #...")
         is cosmetic; anyone reading the network response sees the real
         name/phone/LinkedIn regardless. Redact here, not just on render. */
      const name = unlocked ? profile?.name || "Candidate" : `Candidate #${m.id.slice(0, 6)}`;
      const resume = unlocked ? resumeDetail : redactResumeDetailForLock(resumeDetail, profile?.name || "");

      return {
        id: m.id,
        name,
        targetRole: profile?.target_role || "Not specified",
        city: extractResumeLocation(profile?.resume_data) || "Not specified",
        matchScore: m.match_score,
        rosterScore: m.roster_score,
        matchBreakdown,
        sessionsCompleted: sessionCounts.get(m.candidate_user_id) || 0,
        lastActiveDaysAgo,
        skills: extractSkills(profile?.resume_data).slice(0, 8),
        unlocked,
        contact: unlocked && profile ? { email: profile.email, phone: resumeDetail.phone || undefined } : undefined,
        /* Same identity-leak rule as contact/resume above: a personal
           site/GitHub link lets an employer identify or reach a candidate
           outside HireStepX without paying to unlock, so it's withheld
           entirely — not just scrubbed — for a locked match. */
        portfolioLinks: unlocked ? extractPortfolioLinks(profile?.portfolio_links) : [],
        resume,
        candidateStatus: m.candidate_status,
        candidateStatusNote: m.candidate_status_note,
        interviewScheduledAt: m.interview_scheduled_at,
      };
    });

    return new Response(
      JSON.stringify({
        id: requirement.id,
        title: requirement.title,
        location: requirement.location,
        noticePeriodPref: requirement.notice_period_pref,
        description: requirement.description || "",
        status: requirement.status,
        stage: requirement.stage,
        department: requirement.department,
        archiveReason: requirement.archive_reason,
        archiveDisposition: requirement.archive_disposition,
        experienceMin: requirement.experience_min,
        experienceMax: requirement.experience_max,
        dueDate: requirement.due_date ? requirement.due_date.slice(0, 10) : null,
        budgetMin: requirement.budget_min,
        budgetMax: requirement.budget_max,
        locations: requirement.locations ?? [],
        openPositions: requirement.open_positions,
        workMode: requirement.work_mode,
        skills: requirement.skills ?? [],
        customSkillSets: requirement.custom_skill_sets ?? [],
        responsibilities: requirement.responsibilities || "",
        niceToHave: requirement.nice_to_have || "",
        preferredIndustry: requirement.preferred_industry || "",
        preferredDomain: requirement.preferred_domain || "",
        workSchedule: requirement.work_schedule || "",
        availability: requirement.availability || "",
        relevantExperience: requirement.relevant_experience || "",
        portfolioRequired: requirement.portfolio_required ?? false,
        preferredColleges: requirement.preferred_colleges ?? [],
        targetCompanies: requirement.target_companies ?? [],
        perksAndBenefits: requirement.perks_and_benefits ?? [],
        employmentType: requirement.employment_type,
        salaryType: requirement.salary_type,
        durationWeeks: requirement.duration_weeks,
        hoursPerWeek: requirement.hours_per_week,
        minReadinessBand: asBoundedReadinessBand(requirement.min_readiness_band),
        minStarCompleteness: requirement.min_star_completeness,
        createdAt: requirement.created_at.slice(0, 10),
        lastMatchedAt: requirement.last_matched_at,
        candidates,
        // True pre-cap matched-pool size (see rankAndCap's totalMatched in
        // _requirement-match-helpers.ts) — floored at candidates.length so a
        // requirement matched before this column existed (defaults to 0)
        // never reports fewer matched than it has actual candidates.
        totalMatched: Math.max(requirement.matched_pool_size ?? 0, candidates.length),
      }),
      { status: 200, headers },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    slog.error("employer-requirement-detail GET threw", { code: "employer_requirement_detail_unexpected_error", error: msg.slice(0, 200), userId: auth.userId, requirementId });
    return new Response(JSON.stringify({ error: "Failed to load requirement" }), { status: 500, headers });
  }
}

async function handleStatusAction(
  requirementId: string,
  userId: string,
  action: "archive" | "reopen",
  headers: Record<string, string>,
  archiveReason: string | null,
  archiveDisposition: "keep_candidates" | "reject_remaining" | null,
): Promise<Response> {
  try {
    const existingRes = await fetch(
      `${SUPABASE_URL}/rest/v1/employer_requirements?id=eq.${encodeURIComponent(requirementId)}&employer_id=eq.${encodeURIComponent(userId)}&select=id,status,title,location,description,skills,experience_min,experience_max,min_readiness_band,min_star_completeness,employment_type,duration_weeks,hours_per_week`,
      { headers: serviceHeaders() },
    );
    const existingRows = (await existingRes.json().catch(() => [])) as Array<{ id: string; status: string; title: string; location: string; description: string | null; skills: string[] | null; experience_min: number | null; experience_max: number | null; min_readiness_band: string | null; min_star_completeness: number | null; employment_type: string | null; duration_weeks: number | null; hours_per_week: number | null }>;
    if (!existingRes.ok || !existingRows[0]) {
      return new Response(JSON.stringify({ error: "Requirement not found" }), { status: 404, headers });
    }
    const current = existingRows[0];
    if (action === "archive" && current.status === "closed") {
      return new Response(JSON.stringify({ error: "Already archived" }), { status: 409, headers });
    }
    if (action === "reopen" && current.status !== "closed") {
      return new Response(JSON.stringify({ error: "Requirement isn't archived" }), { status: 409, headers });
    }

    const nextStatus = action === "archive" ? "closed" : "generating";
    const patchBody: Record<string, unknown> = { status: nextStatus };
    if (action === "archive") {
      patchBody.archive_reason = archiveReason;
      patchBody.archive_disposition = archiveDisposition;
    } else {
      // Reopening clears the archive breadcrumbs so a later re-archive starts fresh.
      patchBody.archive_reason = null;
      patchBody.archive_disposition = null;
      // A requirement archived while at stage "interviewing" or "hired"
      // would otherwise stay stuck there after reopening, which also blocks
      // runMatching's auto-advance-to-ready_for_review below (gated on
      // stage=eq.ai_matching) from ever firing on the re-score that follows.
      patchBody.stage = "ai_matching";
    }
    const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/employer_requirements?id=eq.${encodeURIComponent(requirementId)}`, {
      method: "PATCH",
      headers: { ...serviceHeaders(), "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(patchBody),
    });
    if (!patchRes.ok) {
      const t = await patchRes.text().catch(() => "");
      slog.error("employer-requirement-detail status action failed", { code: "employer_requirement_status_action_failed", httpStatus: patchRes.status, body: t.slice(0, 200), userId, requirementId, action });
      return new Response(JSON.stringify({ error: "Failed to update requirement" }), { status: 500, headers });
    }
    const updated = (await patchRes.json()) as Array<{ id: string; status: string }>;
    await logRequirementActivity(requirementId, userId, action === "archive" ? "archived" : "reopened");

    if (action === "archive" && archiveDisposition === "reject_remaining") {
      const activeStatuses = ["shortlisted", "interview_invited", "interviewing"].map((s) => `"${s}"`).join(",");
      // Also catches rows with a null candidate_status (legacy rows from
      // before the column's not-null default was added) — those are still
      // "active" candidates an employer expects reject_remaining to cover.
      const bulkRejectRes = await fetch(
        `${SUPABASE_URL}/rest/v1/requirement_matches?requirement_id=eq.${encodeURIComponent(requirementId)}&or=(candidate_status.in.(${activeStatuses}),candidate_status.is.null)`,
        {
          method: "PATCH",
          headers: { ...serviceHeaders(), "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ candidate_status: "rejected", candidate_status_updated_at: new Date().toISOString() }),
        },
      );
      if (!bulkRejectRes.ok) {
        const t = await bulkRejectRes.text().catch(() => "");
        slog.error("employer-requirement-detail archive bulk-reject failed", { code: "employer_requirement_archive_bulk_reject_failed", httpStatus: bulkRejectRes.status, body: t.slice(0, 200), userId, requirementId });
        // Archive itself already succeeded — surface the partial failure via
        // logs only, rather than rolling back a status change the employer
        // already asked for.
      }
    }

    let finalStatus = updated[0]?.status ?? nextStatus;
    if (action === "reopen") {
      finalStatus = await runMatching(
        requirementId,
        {
          title: current.title,
          location: current.location,
          description: current.description || "",
          skills: current.skills ?? [],
          experienceMin: current.experience_min,
          experienceMax: current.experience_max,
          minReadinessBand: asBoundedReadinessBand(current.min_readiness_band),
          minStarCompleteness: asBoundedStarCompleteness(current.min_star_completeness),
          employmentType: current.employment_type,
          durationWeeks: current.duration_weeks,
          hoursPerWeek: current.hours_per_week,
        },
        userId,
      );
    }

    return new Response(JSON.stringify({ id: requirementId, status: finalStatus }), { status: 200, headers });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    slog.error("employer-requirement-detail status action threw", { code: "employer_requirement_status_action_unexpected_error", error: msg.slice(0, 200), userId, requirementId, action });
    return new Response(JSON.stringify({ error: "Failed to update requirement" }), { status: 500, headers });
  }
}

async function handleStageAction(
  requirementId: string,
  userId: string,
  stage: RequirementStage,
  headers: Record<string, string>,
): Promise<Response> {
  try {
    const existingRes = await fetch(
      `${SUPABASE_URL}/rest/v1/employer_requirements?id=eq.${encodeURIComponent(requirementId)}&employer_id=eq.${encodeURIComponent(userId)}&select=id,stage,status`,
      { headers: serviceHeaders() },
    );
    const existingRows = (await existingRes.json().catch(() => [])) as Array<{ id: string; stage: RequirementStage; status: string }>;
    if (!existingRes.ok || !existingRows[0]) {
      return new Response(JSON.stringify({ error: "Requirement not found" }), { status: 404, headers });
    }
    const currentStage = existingRows[0].stage;

    // Defense in depth: the UI already disables stage controls once a
    // requirement is closed, but nothing stopped a direct API call from
    // moving the stage of an archived requirement — mirrors the same
    // closed-status check employer-candidate-status.ts enforces server-side.
    if (existingRows[0].status === "closed") {
      return new Response(
        JSON.stringify({ error: "This requirement is closed and can no longer be updated" }),
        { status: 409, headers },
      );
    }

    // STAGE_TRANSITIONS (_employer-requirements-helpers.ts) is the single
    // source of truth for legal manual moves — it's the same table the
    // stage dropdown renders its options from, so a request this endpoint
    // rejects is never one the UI could have produced by a normal click.
    // This is what actually keeps `ai_matching` (system-owned, set only by
    // runMatching) from ever being reachable from here, rather than a
    // one-off `stage !== "ai_matching"` special case.
    if (!canManuallyTransitionStage(currentStage, stage)) {
      return new Response(
        JSON.stringify({ error: `Can't move a requirement from "${currentStage}" to "${stage}"` }),
        { status: 409, headers },
      );
    }

    const countRes = await fetch(
      `${SUPABASE_URL}/rest/v1/requirement_matches?requirement_id=eq.${encodeURIComponent(requirementId)}&select=id`,
      { headers: { ...serviceHeaders(), Prefer: "count=exact", Range: "0-0" } },
    );
    const evaluated = Number(countRes.headers.get("content-range")?.split("/")[1] ?? "0");
    if (!countRes.ok || !evaluated) {
      return new Response(
        JSON.stringify({ error: "Can't move to this stage until at least one candidate has been evaluated" }),
        { status: 409, headers },
      );
    }

    const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/employer_requirements?id=eq.${encodeURIComponent(requirementId)}`, {
      method: "PATCH",
      headers: { ...serviceHeaders(), "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({ stage }),
    });
    if (!patchRes.ok) {
      const t = await patchRes.text().catch(() => "");
      slog.error("employer-requirement-detail stage action failed", { code: "employer_requirement_stage_action_failed", httpStatus: patchRes.status, body: t.slice(0, 200), userId, requirementId, stage });
      return new Response(JSON.stringify({ error: "Failed to update requirement" }), { status: 500, headers });
    }
    const updated = (await patchRes.json()) as Array<{ id: string; stage: string }>;
    await logRequirementActivity(requirementId, userId, "stage_changed");

    return new Response(JSON.stringify({ id: requirementId, stage: updated[0]?.stage ?? stage }), { status: 200, headers });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    slog.error("employer-requirement-detail stage action threw", { code: "employer_requirement_stage_action_unexpected_error", error: msg.slice(0, 200), userId, requirementId, stage });
    return new Response(JSON.stringify({ error: "Failed to update requirement" }), { status: 500, headers });
  }
}

async function handlePatch(req: Request, requirementId: string, userId: string, headers: Record<string, string>): Promise<Response> {
  let body: {
    action?: unknown;
    stage?: unknown;
    archiveReason?: unknown;
    archiveDisposition?: unknown;
    title?: unknown; department?: unknown; noticePeriodPref?: unknown; description?: unknown;
    experienceMin?: unknown; experienceMax?: unknown; dueDate?: unknown;
    budgetMin?: unknown; budgetMax?: unknown;
    locations?: unknown; openPositions?: unknown; workMode?: unknown; skills?: unknown;
    responsibilities?: unknown; niceToHave?: unknown; preferredIndustry?: unknown;
    preferredColleges?: unknown; targetCompanies?: unknown; perksAndBenefits?: unknown;
    employmentType?: unknown;
    salaryType?: unknown; preferredDomain?: unknown; workSchedule?: unknown;
    availability?: unknown; relevantExperience?: unknown; portfolioRequired?: unknown;
    customSkillSets?: unknown;
    durationWeeks?: unknown; hoursPerWeek?: unknown;
    minReadinessBand?: unknown; minStarCompleteness?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers });
  }

  if (body.action === "archive" || body.action === "reopen") {
    const archiveReason = asBoundedString(body.archiveReason, 200) || null;
    const archiveDisposition = asArchiveDisposition(body.archiveDisposition);
    return handleStatusAction(requirementId, userId, body.action, headers, archiveReason, archiveDisposition);
  }

  if (body.action === "set_stage") {
    const stage = asBoundedStage(body.stage);
    if (!stage) {
      return new Response(JSON.stringify({ error: "Invalid stage" }), { status: 400, headers });
    }
    return handleStageAction(requirementId, userId, stage, headers);
  }

  try {
    const existingRes = await fetch(
      `${SUPABASE_URL}/rest/v1/employer_requirements?id=eq.${encodeURIComponent(requirementId)}&employer_id=eq.${encodeURIComponent(userId)}&select=*`,
      { headers: serviceHeaders() },
    );
    const existingRows = (await existingRes.json().catch(() => [])) as Array<RequirementRow & { description: string | null }>;
    if (!existingRes.ok || !existingRows[0]) {
      return new Response(JSON.stringify({ error: "Requirement not found" }), { status: 404, headers });
    }
    const existing = existingRows[0];
    if (existing.status === "closed") {
      return new Response(JSON.stringify({ error: "Closed requirements can't be edited" }), { status: 409, headers });
    }

    // A caller (e.g. the "extend deadline" modal, which only sends dueDate
    // plus the required trio) legitimately omits fields it isn't changing —
    // that must mean "leave as-is", not "reset to a hardcoded default" (C8:
    // a partial PATCH was silently wiping department, salaryType, and the
    // other optional fields to null/defaults on every unrelated edit).
    const title = body.title !== undefined ? asBoundedString(body.title, 200) : existing.title;
    const department = body.department !== undefined ? asBoundedString(body.department, 120) || null : existing.department;
    const noticePeriodPref = body.noticePeriodPref !== undefined ? asBoundedString(body.noticePeriodPref, 60) || "Any" : existing.notice_period_pref;
    const description = body.description !== undefined ? asBoundedString(body.description, 5000) : existing.description || "";
    const experienceMin = body.experienceMin !== undefined ? asBoundedExperience(body.experienceMin) : existing.experience_min;
    const experienceMax = body.experienceMax !== undefined ? asBoundedExperience(body.experienceMax) : existing.experience_max;
    const dueDate = body.dueDate !== undefined ? asBoundedDueDate(body.dueDate) : existing.due_date;
    const existingSalaryType = asBoundedSalaryType(existing.salary_type) || "per-annum";
    const salaryType = (body.salaryType !== undefined ? asBoundedSalaryType(body.salaryType) : existingSalaryType) || "per-annum";
    // budgetMin/budgetMax are unit-dependent on salaryType (whole lakhs for
    // per-annum, raw rupees otherwise). If salaryType changes in a partial
    // PATCH that doesn't resubmit the budget fields, carrying the existing
    // numbers forward unchanged would leave a value in the OLD unit tagged
    // with the NEW salaryType (e.g. a raw-rupee 1800000 displayed as "LPA").
    // Clear them instead of guessing a conversion — the caller re-enters
    // budget when changing pay type.
    const salaryTypeChanged = salaryType !== existingSalaryType;
    const budgetMin = body.budgetMin !== undefined ? asBoundedBudget(body.budgetMin, salaryType) : salaryTypeChanged ? null : existing.budget_min;
    const budgetMax = body.budgetMax !== undefined ? asBoundedBudget(body.budgetMax, salaryType) : salaryTypeChanged ? null : existing.budget_max;
    const locations = body.locations !== undefined ? asBoundedStringArray(body.locations, 20, 100) : existing.locations;
    const openPositions = body.openPositions !== undefined ? asBoundedOpenPositions(body.openPositions) : existing.open_positions;
    const workMode = body.workMode !== undefined ? asBoundedWorkMode(body.workMode) : existing.work_mode;
    const skills = body.skills !== undefined ? asBoundedStringArray(body.skills, 40, 60) : existing.skills;
    const responsibilities = body.responsibilities !== undefined ? asBoundedString(body.responsibilities, 2000) : existing.responsibilities;
    const niceToHave = body.niceToHave !== undefined ? asBoundedString(body.niceToHave, 2000) : existing.nice_to_have;
    const preferredIndustry = body.preferredIndustry !== undefined ? asBoundedString(body.preferredIndustry, 120) : existing.preferred_industry;
    const preferredColleges = body.preferredColleges !== undefined ? asBoundedStringArray(body.preferredColleges, 20, 100) : existing.preferred_colleges;
    const targetCompanies = body.targetCompanies !== undefined ? asBoundedStringArray(body.targetCompanies, 20, 100) : existing.target_companies;
    const perksAndBenefits = body.perksAndBenefits !== undefined ? asBoundedStringArray(body.perksAndBenefits, 20, 100) : existing.perks_and_benefits;
    const employmentType = body.employmentType !== undefined ? asBoundedEmploymentType(body.employmentType) || "full-time" : existing.employment_type || "full-time";
    const preferredDomain = body.preferredDomain !== undefined ? asBoundedString(body.preferredDomain, 120) : existing.preferred_domain;
    const workSchedule = body.workSchedule !== undefined ? asBoundedString(body.workSchedule, 120) : existing.work_schedule;
    const availability = body.availability !== undefined ? asBoundedString(body.availability, 60) : existing.availability;
    const relevantExperience = body.relevantExperience !== undefined ? asBoundedString(body.relevantExperience, 120) : existing.relevant_experience;
    const portfolioRequired = body.portfolioRequired !== undefined ? asBoundedBoolean(body.portfolioRequired) : existing.portfolio_required;
    const customSkillSets = body.customSkillSets !== undefined ? asBoundedStringArray(body.customSkillSets, 40, 60) : existing.custom_skill_sets;
    const durationWeeks = body.durationWeeks !== undefined ? asBoundedDurationWeeks(body.durationWeeks) : existing.duration_weeks;
    const hoursPerWeek = body.hoursPerWeek !== undefined ? asBoundedHoursPerWeek(body.hoursPerWeek) : existing.hours_per_week;
    const minReadinessBand = body.minReadinessBand !== undefined ? asBoundedReadinessBand(body.minReadinessBand) : asBoundedReadinessBand(existing.min_readiness_band);
    const minStarCompleteness = body.minStarCompleteness !== undefined ? asBoundedStarCompleteness(body.minStarCompleteness) : existing.min_star_completeness;
    const location = locations.join(", ");
    // Once an employer has moved a requirement to "interviewing" or "hired",
    // a field edit (e.g. fixing a typo) shouldn't silently reset status back
    // to "generating" and rerun full candidate matching — that resets a
    // pipeline stage the employer deliberately advanced past, for no
    // benefit (the pipeline no longer needs fresh candidates at that point).
    const skipRematch = existing.stage === "interviewing" || existing.stage === "hired";

    if (!isValidRequirementInput(title, locations, description)) {
      return new Response(JSON.stringify({ error: "title, at least one location, and a role description (min 20 characters) are required" }), { status: 400, headers });
    }
    if (!isValidRange(experienceMin, experienceMax)) {
      return new Response(JSON.stringify({ error: "Minimum experience can't be greater than maximum experience" }), { status: 400, headers });
    }
    if (!isValidRange(budgetMin, budgetMax)) {
      return new Response(JSON.stringify({ error: "Minimum budget can't be greater than maximum budget" }), { status: 400, headers });
    }
    if (!isFutureDueDate(dueDate)) {
      return new Response(JSON.stringify({ error: "Due date can't be in the past" }), { status: 400, headers });
    }

    const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/employer_requirements?id=eq.${encodeURIComponent(requirementId)}`, {
      method: "PATCH",
      headers: { ...serviceHeaders(), "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({
        title, location, department, notice_period_pref: noticePeriodPref, description,
        ...(skipRematch ? {} : { status: "generating" }),
        experience_min: experienceMin, experience_max: experienceMax, due_date: dueDate,
        budget_min: budgetMin, budget_max: budgetMax,
        locations, open_positions: openPositions, work_mode: workMode, skills,
        responsibilities, nice_to_have: niceToHave, preferred_industry: preferredIndustry,
        preferred_colleges: preferredColleges, target_companies: targetCompanies,
        perks_and_benefits: perksAndBenefits, employment_type: employmentType,
        salary_type: salaryType, preferred_domain: preferredDomain, work_schedule: workSchedule,
        availability, relevant_experience: relevantExperience, portfolio_required: portfolioRequired,
        custom_skill_sets: customSkillSets,
        duration_weeks: durationWeeks, hours_per_week: hoursPerWeek,
        min_readiness_band: minReadinessBand, min_star_completeness: minStarCompleteness,
      }),
    });
    if (!patchRes.ok) {
      const t = await patchRes.text().catch(() => "");
      slog.error("employer-requirement-detail PATCH failed", { code: "employer_requirement_patch_failed", httpStatus: patchRes.status, body: t.slice(0, 200), userId, requirementId });
      return new Response(JSON.stringify({ error: "Failed to update requirement" }), { status: 500, headers });
    }
    const updated = (await patchRes.json()) as RequirementRow[];
    const requirement = updated[0];

    const finalStatus = skipRematch
      ? existing.status
      : await runMatching(
          requirementId,
          {
            title, location, description, skills, experienceMin, experienceMax, minReadinessBand, minStarCompleteness,
            employmentType, durationWeeks, hoursPerWeek,
          },
          userId,
        );
    await logRequirementActivity(requirementId, userId, "updated");

    return new Response(
      JSON.stringify({
        id: requirement.id,
        title: requirement.title,
        location: requirement.location,
        noticePeriodPref: requirement.notice_period_pref,
        status: finalStatus,
        department: requirement.department ?? null,
        experienceMin: requirement.experience_min ?? null,
        experienceMax: requirement.experience_max ?? null,
        dueDate: requirement.due_date ?? null,
        budgetMin: requirement.budget_min ?? null,
        budgetMax: requirement.budget_max ?? null,
        locations: requirement.locations ?? [],
        openPositions: requirement.open_positions ?? null,
        workMode: requirement.work_mode ?? null,
        skills: requirement.skills ?? [],
        customSkillSets: requirement.custom_skill_sets ?? [],
        responsibilities: requirement.responsibilities ?? "",
        niceToHave: requirement.nice_to_have ?? "",
        preferredIndustry: requirement.preferred_industry ?? "",
        preferredDomain: requirement.preferred_domain ?? "",
        workSchedule: requirement.work_schedule ?? "",
        availability: requirement.availability ?? "",
        relevantExperience: requirement.relevant_experience ?? "",
        portfolioRequired: requirement.portfolio_required ?? false,
        preferredColleges: requirement.preferred_colleges ?? [],
        targetCompanies: requirement.target_companies ?? [],
        perksAndBenefits: requirement.perks_and_benefits ?? [],
        employmentType: requirement.employment_type ?? null,
        salaryType: requirement.salary_type ?? null,
        durationWeeks: requirement.duration_weeks ?? null,
        hoursPerWeek: requirement.hours_per_week ?? null,
        minReadinessBand: requirement.min_readiness_band ?? null,
        minStarCompleteness: requirement.min_star_completeness ?? null,
        createdAt: requirement.created_at.slice(0, 10),
      }),
      { status: 200, headers },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    slog.error("employer-requirement-detail PATCH threw", { code: "employer_requirement_detail_patch_unexpected_error", error: msg.slice(0, 200), userId, requirementId });
    return new Response(JSON.stringify({ error: "Failed to update requirement" }), { status: 500, headers });
  }
}
