/* Vercel Edge Function — Employer Requirements
 *
 * GET  /api/employer-requirements → list of the caller's requirements
 *      (newest first), each with its matched-candidate count.
 * POST /api/employer-requirements { title, location, noticePeriodPref?,
 *      description? } → creates a requirement, then synchronously scores
 *      it against the full candidate pool using the deterministic
 *      heuristic in _requirement-match-helpers.ts, persists
 *      requirement_matches, and returns the requirement with its final
 *      status (ready/partial/zero/failed).
 *
 * PATCH /api/employer-requirement-detail?id=<id> reuses the same
 *      `runMatching` (exported below) to re-score in place after an edit —
 *      see employer-requirement-detail.ts.
 *
 * Requires an approved employer row — see employer-profile.ts.
 */

export const config = { runtime: "edge" };

import { withAuthAndRateLimit, corsHeaders, withRequestId, slog } from "./_shared";
import {
  scoreCandidateMatch,
  classifyRequirementStatus,
  rankAndCap,
  hasMatchSignal,
  STRONG_MATCH_THRESHOLD,
  MIN_MATCH_SCORE_FLOOR,
  extractSkills,
  type CandidatePoolRow,
  type RequirementInput,
} from "./_requirement-match-helpers";
import { extractResumeDetail } from "./_resume-detail-helpers";
import {
  extractReadinessForecast,
  extractStarCompleteness,
  latestSessionByUser,
  type SessionRow,
} from "./_employer-candidate-evidence-helpers";
import { llmRerankCandidates, blendScore } from "./_requirement-match-llm";
import { notify } from "./_notify";
import { pickRequirementsToRematch, type OpenRequirementForRematch } from "./_incremental-rematch-helpers";
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
  asBoundedDurationWeeks,
  asBoundedHoursPerWeek,
  asBoundedReadinessBand,
  asBoundedStarCompleteness,
  isValidRequirementInput,
  isValidRange,
  isFutureDueDate,
  buildRequirementsListResponse,
  countMatchesByRequirement,
  computeMatchStats,
  buildAiScreeningByRequirement,
  averageScoresByUser,
  daysSinceLastActive,
  type RequirementRow,
  type AiScreeningSummary,
} from "./_employer-requirements-helpers";

declare const process: { env: Record<string, string | undefined> };
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function serviceHeaders(): Record<string, string> {
  return { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` };
}

/** Appends one row to employer_requirement_activity — the "History" action
 *  on the Jobs table's per-row menu reads this back via
 *  employer-requirement-activity.ts. Best-effort: a logging failure never
 *  fails the create/edit/archive/reopen it's attached to. */
export async function logRequirementActivity(
  requirementId: string,
  employerId: string,
  action: "created" | "updated" | "archived" | "reopened" | "stage_changed",
  detail?: string,
): Promise<void> {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/employer_requirement_activity`, {
      method: "POST",
      headers: { ...serviceHeaders(), "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify([{ requirement_id: requirementId, employer_id: employerId, action, detail: detail ?? null }]),
    });
  } catch (err) {
    slog.error("requirement activity log failed", { code: "requirement_activity_log_failed", error: err instanceof Error ? err.message : String(err), requirementId, action });
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
    endpoint: "employer-requirements",
    ipLimit: 20,
    userLimit: 10,
    maxBytes: 20_000,
    checkQuota: false,
    allowGet: true,
  });
  if (pre instanceof Response) return pre;
  const { auth } = pre;
  const headers = { ...pre.headers, ...corsHeaders(req, { allowGet: true }) };

  if (!auth.userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
  }

  if (req.method === "GET") return handleGet(auth.userId, headers);
  if (req.method === "POST") return handlePost(req, auth.userId, headers);
  return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
}

async function handleGet(userId: string, headers: Record<string, string>): Promise<Response> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/employer_requirements?employer_id=eq.${encodeURIComponent(userId)}&select=id,title,location,notice_period_pref,status,stage,department,archive_reason,archive_disposition,experience_min,experience_max,due_date,budget_min,budget_max,locations,open_positions,work_mode,skills,employment_type,salary_type,duration_weeks,hours_per_week,min_readiness_band,min_star_completeness,matched_pool_size,created_at&order=created_at.desc`,
      { headers: serviceHeaders() },
    );
    if (!res.ok) throw new Error(`requirements read failed: ${res.status}`);
    const rows = (await res.json().catch(() => [])) as RequirementRow[];

    const ids = rows.map((r) => r.id);
    let countsByRequirement = new Map<string, number>();
    let aiScreeningByRequirement = new Map<string, AiScreeningSummary>();
    if (ids.length > 0) {
      const idParam = ids.map((id) => encodeURIComponent(id)).join(",");
      const matchesRes = await fetch(
        `${SUPABASE_URL}/rest/v1/requirement_matches?requirement_id=in.(${idParam})&select=requirement_id,candidate_user_id,match_score&limit=5000`,
        { headers: serviceHeaders() },
      );
      if (matchesRes.ok) {
        const matchRows = (await matchesRes.json().catch(() => [])) as Array<{
          requirement_id: string;
          candidate_user_id: string;
          match_score: number;
        }>;

        // Re-applies the same no-resume/no-session evidence rule
        // employer-requirement-detail.ts's GET handler applies at read time
        // (added in 3c83c1e3), so this list's evaluated/strong-match stats
        // never disagree with the detail page's over a stale
        // requirement_matches row. Needs resume_data + session counts for
        // every matched candidate, not just the strong-match subset, so
        // profiles are fetched up front for the full candidate_user_id set
        // and reused below for topCandidateIds' display detail too.
        const candidateIds = Array.from(new Set(matchRows.map((m) => m.candidate_user_id)));
        let profileById = new Map<string, { name: string; resume_data: unknown }>();
        let hasEvidenceById = new Map<string, boolean>();
        if (candidateIds.length > 0) {
          const idParamC = candidateIds.map((id) => encodeURIComponent(id)).join(",");
          const [profilesRes, sessionsRes] = await Promise.all([
            fetch(`${SUPABASE_URL}/rest/v1/profiles?id=in.(${idParamC})&select=id,name,resume_data`, { headers: serviceHeaders() }),
            fetch(`${SUPABASE_URL}/rest/v1/sessions?user_id=in.(${idParamC})&select=user_id`, { headers: serviceHeaders() }),
          ]);
          if (profilesRes.ok) {
            const profileRows = (await profilesRes.json().catch(() => [])) as Array<{ id: string; name: string; resume_data: unknown }>;
            profileById = new Map(profileRows.map((row) => [row.id, row]));
          }
          const sessionCounts = new Map<string, number>();
          if (sessionsRes.ok) {
            const sessionRows = (await sessionsRes.json().catch(() => [])) as Array<{ user_id: string }>;
            for (const s of sessionRows) sessionCounts.set(s.user_id, (sessionCounts.get(s.user_id) || 0) + 1);
          }
          hasEvidenceById = new Map(
            candidateIds.map((id) => [id, profileById.get(id)?.resume_data != null || (sessionCounts.get(id) || 0) > 0]),
          );
        }

        countsByRequirement = countMatchesByRequirement(matchRows.filter((m) => hasEvidenceById.get(m.candidate_user_id) === true));

        const matchStats = computeMatchStats(matchRows, STRONG_MATCH_THRESHOLD, hasEvidenceById);
        const topCandidateIds = Array.from(new Set(Array.from(matchStats.values()).flatMap((s) => s.topCandidateIds)));
        const detailsById = new Map<string, { name: string; yearsExperience: number | null; skills: string[] }>(
          topCandidateIds.map((id) => {
            const profile = profileById.get(id);
            return [id, { name: profile?.name ?? "", yearsExperience: extractResumeDetail(profile?.resume_data).yearsExperience, skills: extractSkills(profile?.resume_data) }];
          }),
        );
        aiScreeningByRequirement = buildAiScreeningByRequirement(matchStats, detailsById);
      }
    }

    const requirements = buildRequirementsListResponse(rows, countsByRequirement, aiScreeningByRequirement);

    return new Response(JSON.stringify({ requirements }), { status: 200, headers });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    slog.error("employer-requirements GET threw", { code: "employer_requirements_get_unexpected_error", error: msg.slice(0, 200), userId });
    return new Response(JSON.stringify({ error: "Failed to load requirements" }), { status: 500, headers });
  }
}

async function handlePost(req: Request, userId: string, headers: Record<string, string>): Promise<Response> {
  let body: {
    title?: unknown; location?: unknown; department?: unknown; noticePeriodPref?: unknown; description?: unknown;
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

  const title = asBoundedString(body.title, 200);
  const department = asBoundedString(body.department, 120) || null;
  const noticePeriodPref = asBoundedString(body.noticePeriodPref, 60) || "Any";
  const description = asBoundedString(body.description, 5000);
  const experienceMin = asBoundedExperience(body.experienceMin);
  const experienceMax = asBoundedExperience(body.experienceMax);
  const dueDate = asBoundedDueDate(body.dueDate);
  const salaryType = asBoundedSalaryType(body.salaryType) || "per-annum";
  const budgetMin = asBoundedBudget(body.budgetMin, salaryType);
  const budgetMax = asBoundedBudget(body.budgetMax, salaryType);
  const locations = asBoundedStringArray(body.locations, 20, 100);
  const openPositions = asBoundedOpenPositions(body.openPositions);
  const workMode = asBoundedWorkMode(body.workMode);
  const skills = asBoundedStringArray(body.skills, 40, 60);
  const responsibilities = asBoundedString(body.responsibilities, 2000);
  const niceToHave = asBoundedString(body.niceToHave, 2000);
  const preferredIndustry = asBoundedString(body.preferredIndustry, 120);
  const preferredColleges = asBoundedStringArray(body.preferredColleges, 20, 100);
  const targetCompanies = asBoundedStringArray(body.targetCompanies, 20, 100);
  const perksAndBenefits = asBoundedStringArray(body.perksAndBenefits, 20, 100);
  const employmentType = asBoundedEmploymentType(body.employmentType) || "full-time";
  const preferredDomain = asBoundedString(body.preferredDomain, 120);
  const workSchedule = asBoundedString(body.workSchedule, 120);
  const availability = asBoundedString(body.availability, 60);
  const relevantExperience = asBoundedString(body.relevantExperience, 120);
  const portfolioRequired = asBoundedBoolean(body.portfolioRequired);
  const customSkillSets = asBoundedStringArray(body.customSkillSets, 40, 60);
  const durationWeeks = asBoundedDurationWeeks(body.durationWeeks);
  const hoursPerWeek = asBoundedHoursPerWeek(body.hoursPerWeek);
  const minReadinessBand = asBoundedReadinessBand(body.minReadinessBand);
  const minStarCompleteness = asBoundedStarCompleteness(body.minStarCompleteness);
  const location = locations.join(", ");

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

  try {
    const employerRes = await fetch(
      `${SUPABASE_URL}/rest/v1/employers?id=eq.${encodeURIComponent(userId)}&select=status`,
      { headers: serviceHeaders() },
    );
    const employerRows = (await employerRes.json().catch(() => [])) as Array<{ status: string }>;
    if (!employerRes.ok || !employerRows[0] || employerRows[0].status !== "approved") {
      return new Response(JSON.stringify({ error: "Employer profile is not approved" }), { status: 403, headers });
    }

    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/employer_requirements`, {
      method: "POST",
      headers: { ...serviceHeaders(), "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify([{
        employer_id: userId, title, location, department, notice_period_pref: noticePeriodPref, description, status: "generating",
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
      }]),
    });
    if (!insertRes.ok) {
      const t = await insertRes.text().catch(() => "");
      slog.error("employer-requirements insert failed", { code: "employer_requirements_insert_failed", httpStatus: insertRes.status, body: t.slice(0, 200), userId });
      return new Response(JSON.stringify({ error: "Failed to create requirement" }), { status: 500, headers });
    }
    const inserted = (await insertRes.json()) as RequirementRow[];
    const requirement = inserted[0];

    const finalStatus = await runMatching(
      requirement.id,
      {
        title, location, description, skills, experienceMin, experienceMax, minReadinessBand, minStarCompleteness,
        employmentType, durationWeeks, hoursPerWeek,
      },
      userId,
    );
    await logRequirementActivity(requirement.id, userId, "created");

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
    slog.error("employer-requirements POST threw", { code: "employer_requirements_post_unexpected_error", error: msg.slice(0, 200), userId });
    return new Response(JSON.stringify({ error: "Failed to create requirement" }), { status: 500, headers });
  }
}

/** Scores the real candidate pool against a requirement (freshly created, or
    freshly edited), persists requirement_matches, and PATCHes the
    requirement's final status. Returns that status. Any failure here is
    caught and recorded as a "failed" requirement rather than left stuck on
    "generating".

    Also auto-advances `stage` from "ai_matching" to "ready_for_review" when
    screening finds at least one strong match ("ready"/"partial"), so the
    Jobs table's stage pill doesn't sit on "AI Matching" once there's
    something to review. Conditioned on the current stage still being
    ai_matching, so it never overrides a stage the employer already moved
    forward by hand.

    Edit-safe: an already-unlocked match represents a real payment
    (employer-verify-unlock-payment.ts), so it's never rescored or deleted
    just because the requirement changed — only never-unlocked matches are
    replaced with a fresh scoring pass. On first creation there are no
    existing matches, so this is just the create path. */
export async function runMatching(requirementId: string, req: RequirementInput, ownerUserId: string): Promise<string> {
  try {
    const existingRes = await fetch(
      `${SUPABASE_URL}/rest/v1/requirement_matches?requirement_id=eq.${encodeURIComponent(requirementId)}&select=id,candidate_user_id,match_score,unlocked,candidate_status,candidate_status_note,interview_scheduled_at`,
      { headers: serviceHeaders() },
    );
    const existing = (await existingRes.json().catch(() => [])) as Array<{
      id: string; candidate_user_id: string; match_score: number; unlocked: boolean;
      candidate_status: string | null; candidate_status_note: string | null; interview_scheduled_at: string | null;
    }>;
    // Captured before stale rows are deleted below, so a candidate who just
    // crossed STRONG_MATCH_THRESHOLD on *this* pass (and wasn't there last
    // pass) can be told apart from one who's been a strong match all along —
    // the "new strong match" notification fires only for the former.
    const previousScoreByCandidate = new Map(existing.map((m) => [m.candidate_user_id, m.match_score]));
    // A row the employer has already acted on — unlocked it, moved it off the
    // default "shortlisted" stage, left a note, or scheduled an interview —
    // is preserved as-is rather than deleted and re-inserted with a new id
    // on every edit/reopen. Re-running matching would otherwise silently
    // wipe pipeline state (status, note, interview date) an employer already
    // set, and break any open tab/checkout referencing the old match id (C2).
    const isTouched = (m: (typeof existing)[number]) =>
      m.unlocked || (!!m.candidate_status && m.candidate_status !== "shortlisted") || !!m.candidate_status_note || !!m.interview_scheduled_at;
    const preservedMatches = existing.filter(isTouched);
    const preservedCandidateIds = new Set(preservedMatches.map((m) => m.candidate_user_id));
    const staleMatchIds = existing.filter((m) => !isTouched(m)).map((m) => m.id);
    if (staleMatchIds.length > 0) {
      const idParam = staleMatchIds.map((id) => encodeURIComponent(id)).join(",");
      await fetch(`${SUPABASE_URL}/rest/v1/requirement_matches?id=in.(${idParam})`, {
        method: "DELETE",
        headers: serviceHeaders(),
      });
    }

    // A candidate already hired against a DIFFERENT requirement is off the
    // market — surfacing them as a fresh match elsewhere just leads an
    // employer to shortlist someone who can't actually join. Scoped to
    // "hired" only (not interviewing/shortlisted elsewhere), since those
    // candidates are still genuinely available.
    const hiredElsewhereRes = await fetch(
      `${SUPABASE_URL}/rest/v1/requirement_matches?candidate_status=eq.hired&requirement_id=neq.${encodeURIComponent(requirementId)}&select=candidate_user_id`,
      { headers: serviceHeaders() },
    );
    const hiredElsewhereRows = hiredElsewhereRes.ok ? ((await hiredElsewhereRes.json().catch(() => [])) as Array<{ candidate_user_id: string }>) : [];
    const hiredElsewhereIds = new Set(hiredElsewhereRows.map((r) => r.candidate_user_id));

    const poolRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=neq.${encodeURIComponent(ownerUserId)}&select=id,name,target_role,industry,resume_data,practice_timestamps&limit=5000`,
      { headers: serviceHeaders() },
    );
    if (!poolRes.ok) throw new Error(`candidate pool read failed: ${poolRes.status}`);
    const poolRows = (await poolRes.json().catch(() => [])) as Array<{
      id: string; name: string; target_role: string | null; industry: string | null;
      resume_data: unknown; practice_timestamps: string[] | null;
    }>;
    // Candidates already touched (unlocked, or with pipeline progress) keep
    // their existing match row untouched — they're excluded from re-scoring.
    // hasMatchSignal additionally drops zero-signal profiles (no target_role,
    // no resume_data) outright — see its doc comment in
    // _requirement-match-helpers.ts.
    const pool = poolRows.filter((p) => !preservedCandidateIds.has(p.id) && !hiredElsewhereIds.has(p.id) && hasMatchSignal(p));

    const scores = new Map<string, number>();
    const sessionCounts = new Map<string, number>();
    const readinessByUser = new Map<string, "strongHire" | "hire" | "leanHire">();
    const starByUser = new Map<string, number>();
    if (pool.length > 0) {
      const idParam = pool.map((p) => encodeURIComponent(p.id)).join(",");
      const sessionsRes = await fetch(
        `${SUPABASE_URL}/rest/v1/sessions?user_id=in.(${idParam})&select=user_id,score,created_at,report_json,type&order=created_at.desc`,
        { headers: serviceHeaders() },
      );
      if (sessionsRes.ok) {
        const sessionRows = (await sessionsRes.json().catch(() => [])) as Array<SessionRow & { score: number }>;
        for (const [uid, avg] of averageScoresByUser(sessionRows)) scores.set(uid, avg);
        for (const s of sessionRows) sessionCounts.set(s.user_id, (sessionCounts.get(s.user_id) || 0) + 1);

        // Reuses the same "most recent real interview-evidence session"
        // picker the employer evidence panel uses, so the quality bar is
        // judged on the same session an employer would actually be shown.
        for (const [uid, row] of latestSessionByUser(sessionRows)) {
          const readiness = extractReadinessForecast(row.report_json);
          if (readiness) readinessByUser.set(uid, readiness.band);
          const star = extractStarCompleteness(row.report_json);
          if (star) starByUser.set(uid, star.pct);
        }
      }
    }

    const candidateRows: CandidatePoolRow[] = pool.map((p) => {
      const timestamps = Array.isArray(p.practice_timestamps) ? p.practice_timestamps : [];
      return {
        id: p.id,
        name: p.name,
        target_role: p.target_role,
        industry: p.industry,
        resume_data: p.resume_data,
        avg_score: scores.get(p.id) ?? null,
        sessions_completed: sessionCounts.get(p.id) || 0,
        last_active_days_ago: daysSinceLastActive(timestamps, Date.now()),
        years_experience: extractResumeDetail(p.resume_data).yearsExperience,
        readiness_band: readinessByUser.get(p.id) ?? null,
        star_completeness_pct: starByUser.get(p.id) ?? null,
      };
    });

    const scored = candidateRows.map((c) => scoreCandidateMatch(c, req));
    const { ranked: deterministicRanked, totalMatched: freshTotalMatched } = rankAndCap(scored);

    // LLM re-ranking augments only the already-capped shortlist (cheap: one
    // call per requirement create/edit, not one per candidate). Best-effort —
    // llmRerankCandidates returns an empty map on any failure, in which case
    // blendScore is a no-op and `ranked` is identical to the deterministic pass.
    const byId = new Map(candidateRows.map((c) => [c.id, c]));
    const shortlistCandidates = deterministicRanked
      .map((m) => byId.get(m.candidateId))
      .filter((c): c is CandidatePoolRow => !!c);
    const llmScores = await llmRerankCandidates(req, shortlistCandidates, { userId: ownerUserId });
    // Re-applies MIN_MATCH_SCORE_FLOOR after blending: the deterministic pass
    // (rankAndCap, above) already filtered against it, but blendScore can
    // pull a candidate who just cleared that floor back below it (or vice
    // versa) — leaving the floor unchecked here let sub-floor noise back
    // into the shortlist whenever the LLM rerank disagreed with the
    // deterministic score.
    const blended = deterministicRanked.map((m) => ({
      ...m,
      matchScore: blendScore(m.matchScore, llmScores.get(m.candidateId)),
    }));
    const ranked = blended.filter((m) => m.matchScore >= MIN_MATCH_SCORE_FLOOR);
    const droppedByFloorAfterBlend = blended.length - ranked.length;

    if (ranked.length > 0) {
      const rows = ranked.map((m) => ({
        requirement_id: requirementId,
        candidate_user_id: m.candidateId,
        match_score: m.matchScore,
        roster_score: m.rosterScore,
      }));
      const insertMatchesRes = await fetch(`${SUPABASE_URL}/rest/v1/requirement_matches`, {
        method: "POST",
        headers: { ...serviceHeaders(), "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify(rows),
      });
      if (!insertMatchesRes.ok) throw new Error(`requirement_matches insert failed: ${insertMatchesRes.status}`);
    }

    // "New strong match" ping: a candidate who is a strong match NOW but
    // wasn't one on the previous pass (or wasn't matched at all) — using
    // previousScoreByCandidate (captured before this pass's rows were
    // deleted) rather than a persisted flag, so no schema change is needed
    // and a candidate doesn't get re-notified on every subsequent re-score.
    // Fired once per runMatching call (not once per candidate) to avoid
    // spamming the employer when a requirement's first pass surfaces
    // several strong matches at once.
    const newStrongMatches = ranked.filter(
      (m) => m.matchScore >= STRONG_MATCH_THRESHOLD && (previousScoreByCandidate.get(m.candidateId) ?? -1) < STRONG_MATCH_THRESHOLD,
    );
    if (newStrongMatches.length > 0) {
      const title = req.title || "your requirement";
      const body =
        newStrongMatches.length === 1
          ? `${byId.get(newStrongMatches[0].candidateId)?.name || "A candidate"} is a strong match (${newStrongMatches[0].matchScore}%) for ${title}.`
          : `${newStrongMatches.length} new strong matches found for ${title}.`;
      void notify({
        userId: ownerUserId,
        type: "strong_match_found",
        title: "New strong match found",
        body,
        link: `/employer/requirements/${requirementId}`,
      });
    }

    const finalStatus = classifyRequirementStatus([
      ...preservedMatches.map((m) => ({ matchScore: m.match_score })),
      ...ranked,
    ]);
    // Preserved (touched) matches are real matched candidates too — they're
    // just excluded from this pass's re-scoring (see isTouched above) — so
    // they count toward the true pool size alongside the freshly-scored ones.
    // freshTotalMatched comes from the pre-blend floor pass (rankAndCap); the
    // post-blend floor above can drop additional candidates, so that count
    // is subtracted here too — otherwise the reported pool size could include
    // candidates who didn't make it into `ranked` at all.
    const matchedPoolSize = freshTotalMatched - droppedByFloorAfterBlend + preservedMatches.length;
    await fetch(`${SUPABASE_URL}/rest/v1/employer_requirements?id=eq.${encodeURIComponent(requirementId)}`, {
      method: "PATCH",
      headers: { ...serviceHeaders(), "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ status: finalStatus, matched_pool_size: matchedPoolSize, last_matched_at: new Date().toISOString() }),
    });

    // Screening produced something worth looking at — auto-advance out of
    // "AI Matching" so the employer isn't left staring at a stale stage.
    // Conditioned on stage still being ai_matching (via the PostgREST filter,
    // not a separate read) so a requirement the employer already moved
    // forward manually — or re-scored after an edit — is never dragged back.
    if (finalStatus === "ready" || finalStatus === "partial") {
      const stageFlipRes = await fetch(
        `${SUPABASE_URL}/rest/v1/employer_requirements?id=eq.${encodeURIComponent(requirementId)}&stage=eq.ai_matching`,
        {
          method: "PATCH",
          headers: { ...serviceHeaders(), "Content-Type": "application/json", Prefer: "return=representation" },
          body: JSON.stringify({ stage: "ready_for_review" }),
        },
      ).catch(() => null);
      // Only notify when THIS call actually flipped the stage (one row back) —
      // the PostgREST filter makes the PATCH a no-op on a re-score after an
      // edit or a requirement the employer already moved forward manually,
      // and the employer shouldn't get a duplicate "ready to review" ping then.
      const stageFlipRows = stageFlipRes?.ok ? await stageFlipRes.json().catch(() => []) : [];
      if (Array.isArray(stageFlipRows) && stageFlipRows.length === 1) {
        void notify({
          userId: ownerUserId,
          type: "matches_ready",
          title: "Candidates ready to review",
          body: `${req.title || "Your requirement"} has matched candidates ready for review.`,
          link: `/employer/requirements/${requirementId}`,
        });
      }
    }
    return finalStatus;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    slog.error("employer-requirements matching threw", { code: "employer_requirements_matching_failed", error: msg.slice(0, 200), requirementId });
    await fetch(`${SUPABASE_URL}/rest/v1/employer_requirements?id=eq.${encodeURIComponent(requirementId)}`, {
      method: "PATCH",
      headers: { ...serviceHeaders(), "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ status: "failed" }),
    }).catch(() => {});
    return "failed";
  }
}

/** Incremental counterpart to the nightly rematch-requirements cron
 *  (server-handlers/cron-rematch-requirements.ts): fired fire-and-forget
 *  from update-profile.ts whenever a candidate's resume_data is freshly
 *  persisted, so a brand-new signup (or resume refresh) shows up against
 *  open requirements without waiting for the nightly sweep.
 *
 *  Bounded to MAX_INCREMENTAL_REQUIREMENTS per call — re-running the full
 *  pool-scan `runMatching` for every open requirement on every resume save
 *  would make this hot, rate-limited endpoint's tail latency unbounded.
 *  Requirements beyond the cap are left for the cron, which has no such
 *  bound and processes the full backlog each night ordered by the same
 *  staleness rule (pickRequirementsToRematch). Never awaited by its caller;
 *  any failure here is swallowed by runMatching's own try/catch per
 *  requirement, consistent with the best-effort `void notify(...)` pattern
 *  used across this codebase. */
const MAX_INCREMENTAL_REQUIREMENTS = 10;

/** Bounds how many requirements get re-scored concurrently in a single
    batch. Unbounded Promise.all across a whole backlog risks an edge
    isolate getting torn down or overwhelming Supabase with one burst of
    connections; fixed-size chunks give most of the wall-clock win of
    parallelism without that fan-out risk. */
const REMATCH_BATCH_SIZE = 5;

async function runMatchingInBatches(
  due: OpenRequirementForRematch[],
  toInput: (r: OpenRequirementForRematch) => RequirementInput,
): Promise<void> {
  for (let i = 0; i < due.length; i += REMATCH_BATCH_SIZE) {
    const batch = due.slice(i, i + REMATCH_BATCH_SIZE);
    await Promise.all(batch.map((r) => runMatching(r.id, toInput(r), r.employer_id)));
  }
}

export async function rematchOpenRequirementsForNewResume(): Promise<void> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/employer_requirements?stage=in.(ai_matching,ready_for_review)&status=neq.closed` +
        `&select=id,employer_id,title,location,description,skills,experience_min,experience_max,min_readiness_band,min_star_completeness,employment_type,duration_weeks,hours_per_week,stage,status,last_matched_at&limit=500`,
      { headers: serviceHeaders() },
    );
    if (!res.ok) return;
    const rows = (await res.json().catch(() => [])) as OpenRequirementForRematch[];
    const due = pickRequirementsToRematch(rows, MAX_INCREMENTAL_REQUIREMENTS);
    await runMatchingInBatches(due, (r) => ({
      title: r.title,
      location: r.location,
      description: r.description ?? "",
      skills: r.skills ?? [],
      experienceMin: r.experience_min,
      experienceMax: r.experience_max,
      minReadinessBand: r.min_readiness_band,
      minStarCompleteness: r.min_star_completeness,
      employmentType: r.employment_type,
      durationWeeks: r.duration_weeks,
      hoursPerWeek: r.hours_per_week,
    }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    slog.error("incremental rematch sweep threw", { code: "incremental_rematch_failed", error: msg.slice(0, 200) });
  }
}
