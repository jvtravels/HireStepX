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
  STRONG_MATCH_THRESHOLD,
  MIN_MATCH_SCORE_FLOOR,
  capUnsupportedStrong,
  extractSkills,
  requirementCriteriaFingerprint,
  MATCH_SHORTLIST_CAP,
  LLM_RERANK_WINDOW,
  llmCriteriaFingerprint,
  llmProfileStamp,
  type CandidatePoolRow,
  type RequirementInput,
} from "./_requirement-match-helpers";
import { extractResumeDetail } from "./_resume-detail-helpers";
import { llmRerankCandidates, blendScore } from "./_requirement-match-llm";
import { notify } from "./_notify";
import { captureServerEvent } from "./_posthog";
import { emailShell, title as emailTitle, para, button, dataCard, escapeHtml } from "./_email-theme";
import { isSuppressed, marketingEmailParts, preferenceDepsFromEnv } from "./_unsubscribe";
import { pickRequirementsToRematch, fetchRematchBacklog, type OpenRequirementForRematch } from "./_incremental-rematch-helpers";
import { isSuspended } from "./_employer-trust";
import {
  MAX_POOL_SCAN,
  POOL_PAGE_SIZE,
  SCAN_RESERVE_MS,
  chunk,
  inList,
  fetchKeyset,
  fetchKeysetRotated,
  rotatedScanStart,
  loadBlockedCandidateIds,
  loadOptedOutCandidateIds,
  loadHiredElsewhere,
  loadGradedSessions,
  loadEvidenceFlags,
  planExistingMatches,
  planStaleRemovals,
  isEligiblePoolProfile,
  isRelevantProfile,
  computeTrustedSessionStats,
  keepSessionsForRole,
  buildCandidatePoolRow,
  selectNewStrongMatches,
  strongMatchAlertBody,
  llmBudgetMs,
  resolveLlmScores,
  isModelSourceFlip,
  isLiveMatch,
  isTouchedMatch,
  untouchedMatchFilter,
  checkEmployerAllowance,
  recheckOpenRequirementLimit,
  maskStrongMatches,
  type ExistingMatchRow,
  type PoolProfile,
} from "./_employer-matching-helpers";
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
  candidateTraits,
  type RequirementRow,
  type AiScreeningSummary,
  MIN_DESCRIPTION_LENGTH,
} from "./_employer-requirements-helpers";

declare const process: { env: Record<string, string | undefined> };
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const RESEND_API_KEY = (process.env.RESEND_API_KEY || "").trim();
const FROM_EMAIL = process.env.FROM_EMAIL || "HireStepX <noreply@hirestepx.com>";
const APP_URL = (process.env.APP_URL || "https://hirestepx.vercel.app").replace(/\/$/, "");

function serviceHeaders(): Record<string, string> {
  return { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` };
}

/** Best-effort transactional "new strong match" email — fires alongside the
 *  in-app notify() at the same call site. Never throws: a failure here must
 *  never fail the matching pass it's attached to. Looks up the employer's
 *  email via the Admin Users API since `employers` rows key off auth.users
 *  and carry no email column of their own (see admin-data.ts's ban-user case
 *  for the same lookup shape). */
async function sendStrongMatchEmail(opts: {
  ownerUserId: string;
  requirementId: string;
  requirementTitle: string;
  /** Count only — the email never names or labels a candidate. */
  matchCount: number;
  topScore: number;
}): Promise<void> {
  if (!RESEND_API_KEY) return;
  try {
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(opts.ownerUserId)}`, {
      headers: serviceHeaders(),
      signal: AbortSignal.timeout(5000),
    });
    if (!userRes.ok) return;
    const user = (await userRes.json()) as { email?: string };
    const email = user.email;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    // Honour the employer's alert opt-out (fails closed on a lookup error).
    if (await isSuppressed(preferenceDepsFromEnv(), opts.ownerUserId, "employer_notifications")) return;
    const parts = await marketingEmailParts(opts.ownerUserId, "employer_notifications");
    // Employers have no /settings page; their preferences live under /employer/settings.
    const footer = { ...parts.footer, manageUrl: `${APP_URL}/employer/settings` };

    const reqTitle = opts.requirementTitle || "your requirement";
    const headline = strongMatchAlertBody(opts.matchCount, opts.topScore, reqTitle);
    const link = `${APP_URL}/employer/requirements/${opts.requirementId}`;
    const html = emailShell({
      footer,
      preview: headline,
      body:
        emailTitle("Strong match", { accentWord: "updated" }) +
        para(escapeHtml(headline)) +
        dataCard("Requirement", [
          ["Role", escapeHtml(reqTitle)],
          ["Candidates", String(opts.matchCount)],
          ["Top score", `${opts.topScore}%`],
        ]) +
        button("View matches", link),
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: FROM_EMAIL, to: [email], subject: "Strong match update | HireStepX", html, ...parts.resend }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        slog.warn("[sendStrongMatchEmail] resend failed", { status: res.status, body: t.slice(0, 200) });
      }
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    slog.warn("[sendStrongMatchEmail] threw", { err: err instanceof Error ? err.message : String(err) });
  }
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

/** Most requirements one list response carries; `truncated` flags any beyond it. */
const REQUIREMENTS_LIST_LIMIT = 500;

async function handleGet(userId: string, headers: Record<string, string>): Promise<Response> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/employer_requirements?employer_id=eq.${encodeURIComponent(userId)}&select=id,title,location,notice_period_pref,status,stage,department,archive_reason,archive_disposition,experience_min,experience_max,due_date,budget_min,budget_max,locations,open_positions,work_mode,skills,employment_type,salary_type,duration_weeks,hours_per_week,min_readiness_band,min_star_completeness,matched_pool_size,created_at&order=created_at.desc&limit=${REQUIREMENTS_LIST_LIMIT}`,
      { headers: { ...serviceHeaders(), Prefer: "count=exact" } },
    );
    if (!res.ok) throw new Error(`requirements read failed: ${res.status}`);
    const rows = (await res.json().catch(() => [])) as RequirementRow[];
    // The list is capped; without the total a 501st requirement just vanished.
    const totalHeader = Number(res.headers.get("content-range")?.split("/")[1]);
    const total = Number.isFinite(totalHeader) ? totalHeader : rows.length;

    const ids = rows.map((r) => r.id);
    let countsByRequirement = new Map<string, number>();
    let aiScreeningByRequirement = new Map<string, AiScreeningSummary>();
    if (ids.length > 0) {
      // Bounded reads: requirement ids go in small batches and each batch is
      // keyset-paged, so no single request leans on a limit Supabase would
      // silently cap at its max-rows setting.
      const allMatches: Array<{ id: string; requirement_id: string; candidate_user_id: string; match_score: number; unlocked: boolean }> = [];
      let matchesOk = true;
      for (const batch of chunk(ids, 20)) {
        const r = await fetchKeyset<{ id: string; requirement_id: string; candidate_user_id: string; match_score: number; unlocked: boolean }>({
          baseUrl: `${SUPABASE_URL}/rest/v1/requirement_matches?requirement_id=in.(${inList(batch)})&select=id,requirement_id,candidate_user_id,match_score,unlocked`,
          headers: serviceHeaders(), keyField: "id", pageSize: 1000, maxRows: 5000,
        });
        if (r.failed) { matchesOk = false; break; }
        allMatches.push(...r.rows);
      }

      const candidateIds = Array.from(new Set(allMatches.map((m) => m.candidate_user_id)));
      // Consent: a locked match for a candidate who opted out of employer
      // visibility or blocked this employer must not show, even before the
      // next re-match deletes the row. An unreadable consent check hides
      // everything rather than risk showing someone who said no.
      const [blocked, optedOut] = matchesOk && candidateIds.length > 0
        ? await Promise.all([
            loadBlockedCandidateIds(SUPABASE_URL, serviceHeaders(), userId),
            loadOptedOutCandidateIds(SUPABASE_URL, serviceHeaders(), candidateIds),
          ])
        : [new Set<string>(), new Set<string>()];
      if (matchesOk && blocked && optedOut) {
        const matchRows = allMatches.filter((m) =>
          m.unlocked ? !blocked.has(m.candidate_user_id) : !blocked.has(m.candidate_user_id) && !optedOut.has(m.candidate_user_id),
        );
        const visibleCandidateIds = Array.from(new Set(matchRows.map((m) => m.candidate_user_id)));

        // Re-applies the same no-evidence rule the detail GET applies at read
        // time, with "evidence" meaning a parsed resume or a SERVER-GRADED
        // session, so this list's stats never disagree with the detail page.
        const hasEvidenceById = (visibleCandidateIds.length > 0
          ? await loadEvidenceFlags(SUPABASE_URL, serviceHeaders(), visibleCandidateIds)
          : new Map<string, boolean>()) ?? new Map<string, boolean>();

        countsByRequirement = countMatchesByRequirement(matchRows.filter((m) => hasEvidenceById.get(m.candidate_user_id) === true));

        const matchStats = computeMatchStats(matchRows, STRONG_MATCH_THRESHOLD, hasEvidenceById);
        const topCandidateIds = Array.from(new Set(Array.from(matchStats.values()).flatMap((s) => s.topCandidateIds)));
        const profileById = new Map<string, { name: string; resume_data: unknown }>();
        for (const batch of chunk(topCandidateIds, 100)) {
          const profilesRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=in.(${inList(batch)})&select=id,name,resume_data`, { headers: serviceHeaders() });
          if (!profilesRes.ok) continue;
          const profileRows = (await profilesRes.json().catch(() => [])) as Array<{ id: string; name: string; resume_data: unknown }>;
          for (const row of profileRows) profileById.set(row.id, row);
        }
        const detailsById = new Map<string, { name: string; yearsExperience: number | null; skills: string[]; traits: string[] }>(
          topCandidateIds.map((id) => {
            const profile = profileById.get(id);
            const detail = extractResumeDetail(profile?.resume_data);
            return [id, { name: profile?.name ?? "", yearsExperience: detail.yearsExperience, skills: extractSkills(profile?.resume_data), traits: candidateTraits(detail, profile?.name ?? "") }];
          }),
        );
        aiScreeningByRequirement = buildAiScreeningByRequirement(matchStats, detailsById);

        // Identity must not leave the server for a match the employer hasn't
        // unlocked: swap real names/initials on the strong-match chips for
        // the masked label (and the match id for the candidate's user id).
        const lookupByRequirement = new Map<string, Map<string, { matchId: string; unlocked: boolean }>>();
        for (const m of matchRows) {
          let inner = lookupByRequirement.get(m.requirement_id);
          if (!inner) { inner = new Map(); lookupByRequirement.set(m.requirement_id, inner); }
          inner.set(m.candidate_user_id, { matchId: m.id, unlocked: !!m.unlocked });
        }
        for (const [requirementId, summary] of aiScreeningByRequirement) {
          const masked = maskStrongMatches(summary.strongMatches, lookupByRequirement.get(requirementId) ?? new Map());
          aiScreeningByRequirement.set(requirementId, { ...summary, strongMatches: masked, strongMatchInitials: masked.map((c) => c.initials) });
        }
      }
    }

    const requirements = buildRequirementsListResponse(rows, countsByRequirement, aiScreeningByRequirement);

    return new Response(JSON.stringify({ requirements, total, truncated: total > rows.length }), { status: 200, headers });
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
    return new Response(JSON.stringify({ error: `title, at least one location, and a role description (min ${MIN_DESCRIPTION_LENGTH} characters) are required` }), { status: 400, headers });
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
      `${SUPABASE_URL}/rest/v1/employers?id=eq.${encodeURIComponent(userId)}&select=id,website,suspended_at,verification_tier`,
      { headers: serviceHeaders() },
    );
    const employerRows = (await employerRes.json().catch(() => [])) as Array<{ id: string; website?: string | null; suspended_at?: string | null; verification_tier?: string | null }>;
    if (!employerRes.ok || !employerRows[0]) {
      return new Response(JSON.stringify({ error: "Add your company profile before posting a requirement" }), { status: 403, headers });
    }

    // Suspended employers are read-only; tier caps bound open requirements
    // and matching re-runs per hour. Checked before the insert so a refused
    // request leaves nothing behind.
    const allowance = await checkEmployerAllowance({
      supabaseUrl: SUPABASE_URL,
      headers: serviceHeaders(),
      employerId: userId,
      employer: employerRows[0],
      needsOpenSlot: true,
      needsRematch: true,
    });
    if (!allowance.ok) {
      return new Response(JSON.stringify(allowance.body), {
        status: allowance.status,
        headers: allowance.retryAfterSeconds ? { ...headers, "Retry-After": String(allowance.retryAfterSeconds) } : headers,
      });
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

    // The count above ran before our insert, so two concurrent creates at the
    // limit both passed it. Re-count now and back this row out if over.
    const overLimit = await recheckOpenRequirementLimit({ supabaseUrl: SUPABASE_URL, headers: serviceHeaders(), employerId: userId, tier: allowance.tier });
    if (!overLimit.ok) {
      await fetch(`${SUPABASE_URL}/rest/v1/employer_requirements?id=eq.${encodeURIComponent(requirement.id)}&employer_id=eq.${encodeURIComponent(userId)}`, {
        method: "DELETE", headers: serviceHeaders(),
      }).catch(() => {});
      return new Response(JSON.stringify(overLimit.body), { status: overLimit.status, headers });
    }

    const finalStatus = await runMatching(
      requirement.id,
      {
        title, location, description, skills, experienceMin, experienceMax, minReadinessBand, minStarCompleteness,
        employmentType, durationWeeks, hoursPerWeek, customSkills: customSkillSets, workMode,
      },
      userId,
    );
    await logRequirementActivity(requirement.id, userId, "created");
    // Counts and enums only: nothing the employer typed (title, description,
    // skills) or any candidate identity leaves in an analytics event.
    await captureServerEvent("employer_requirement_created", userId, {
      skillsCount: skills.length,
      hasDescription: description.length > 0,
      workMode: workMode ?? null,
      matchedCount: await readMatchedPoolSize(requirement.id),
    }).catch(() => {});

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
// Edge functions get killed by the platform at its own execution-time limit
// with no chance for our own try/catch below to run — which left requirements
// stuck in "generating" forever on a slow pass. Racing an internal timeout
// against the real work means the existing catch block (which marks the
// requirement "failed") fires on OUR clock, well before the platform's.
const MATCHING_TIMEOUT_MS = 20_000;

export interface RunMatchingOptions {
  /** Overall wall-clock budget for this run. Interactive callers keep the
   *  edge-safe default; the node cron passes a larger one. */
  timeoutMs?: number;
  /** Called when the pass threw or timed out, even if the requirement kept its
   *  previous status because a usable shortlist already existed. */
  onFailure?: (err: Error) => void;
  /** Called when the pass wrote nothing because the requirement's criteria
   *  changed (or it was archived) mid-scan and a newer run owns the shortlist. */
  onStale?: () => void;
}

// Flipped once a PATCH proves migration 0044 is not applied, so each later run
// skips the doomed write instead of paying a 400 round trip.
let attemptColumnMissing = false;

// Which model-score columns the database has, lowered once a read or write
// proves a migration is missing: 2 = llm_score + provenance (0048 + 0050),
// 1 = llm_score only (no 0050), 0 = neither. A pass at a lower tier still runs;
// it just reuses fewer stored scores (a score with no provenance is never reused).
let llmColumnTier: 0 | 1 | 2 = 2;

function llmSelectColumns(tier: 0 | 1 | 2): string {
  if (tier === 2) return ",llm_score,llm_scored_at,llm_criteria_fingerprint,llm_profile_stamp";
  return tier === 1 ? ",llm_score,llm_scored_at" : "";
}

/** Returned (never persisted) when the requirement's criteria changed, or it
 *  was archived, while a pass was scanning: the pass writes nothing because the
 *  edit that changed them started a newer run that owns the shortlist. */
export const STALE_MATCHING_STATUS = "stale";

const CRITERIA_SELECT = "id,status,title,location,description,skills,custom_skill_sets,work_mode,experience_min,experience_max,min_readiness_band,min_star_completeness,employment_type,duration_weeks,hours_per_week";

interface CriteriaRow {
  status?: string;
  title?: unknown; location?: unknown; description?: unknown; skills?: unknown; custom_skill_sets?: unknown; work_mode?: unknown;
  experience_min?: unknown; experience_max?: unknown; min_readiness_band?: unknown; min_star_completeness?: unknown;
  employment_type?: unknown; duration_weeks?: unknown; hours_per_week?: unknown;
}

const strOrNull = (v: unknown): string | null => (typeof v === "string" ? v : null);
const numOrNull = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const strList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

/** Whether the stored criteria still match what this pass scored. An
 *  unreadable requirement is NOT treated as changed: the criteria race is
 *  rare, and refusing to write on a flaky read would fail healthy runs. */
async function criteriaChangedSince(requirementId: string, req: RequirementInput): Promise<boolean> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/employer_requirements?id=eq.${encodeURIComponent(requirementId)}&select=${CRITERIA_SELECT}`,
    { headers: serviceHeaders() },
  ).catch(() => null);
  if (!res?.ok) return false;
  const rows = (await res.json().catch(() => [])) as CriteriaRow[];
  const row = Array.isArray(rows) ? rows[0] : undefined;
  if (!row || typeof row.title !== "string") return false;
  if (row.status === "closed") return true;
  const stored: RequirementInput = {
    title: row.title,
    location: strOrNull(row.location) ?? "",
    description: strOrNull(row.description) ?? "",
    skills: strList(row.skills),
    customSkills: strList(row.custom_skill_sets),
    workMode: strOrNull(row.work_mode),
    experienceMin: numOrNull(row.experience_min),
    experienceMax: numOrNull(row.experience_max),
    minReadinessBand: asBoundedReadinessBand(row.min_readiness_band),
    minStarCompleteness: numOrNull(row.min_star_completeness),
    employmentType: strOrNull(row.employment_type),
    durationWeeks: numOrNull(row.duration_weeks),
    hoursPerWeek: numOrNull(row.hours_per_week),
  };
  return requirementCriteriaFingerprint(stored) !== requirementCriteriaFingerprint(req);
}

/** Matched-pool size the finished pass recorded, for analytics. 0 when it
 *  can't be read: an event with an unknown count is still worth sending. */
async function readMatchedPoolSize(requirementId: string): Promise<number> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/employer_requirements?id=eq.${encodeURIComponent(requirementId)}&select=matched_pool_size`,
    { headers: serviceHeaders() },
  ).catch(() => null);
  const rows = res?.ok ? ((await res.json().catch(() => [])) as Array<{ matched_pool_size?: unknown }>) : [];
  const n = Array.isArray(rows) ? rows[0]?.matched_pool_size : undefined;
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

/** Stamps the attempt time before matching starts. Best-effort and tolerant of
 *  the unapplied-migration case: it only feeds the sweeps' fair ordering. */
async function markRematchAttempt(requirementId: string): Promise<void> {
  if (attemptColumnMissing) return;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/employer_requirements?id=eq.${encodeURIComponent(requirementId)}`, {
    method: "PATCH",
    headers: { ...serviceHeaders(), "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ last_rematch_attempt_at: new Date().toISOString() }),
  }).catch(() => null);
  if (res && res.status === 400) attemptColumnMissing = true;
}

/** Status for a failed pass. A shortlist that is already on file is still
 *  valid (every write in the pass is upsert-then-cleanup), so flipping the
 *  requirement to "failed" would hide good candidates over a transient error,
 *  especially one from the nightly cron. Only a requirement with no shortlist
 *  (or an unreadable one) is marked failed. */
async function settleFailedRun(requirementId: string): Promise<string> {
  const headers = serviceHeaders();
  const base = `${SUPABASE_URL}/rest/v1/employer_requirements?id=eq.${encodeURIComponent(requirementId)}`;
  const scoresRes = await fetch(
    `${SUPABASE_URL}/rest/v1/requirement_matches?requirement_id=eq.${encodeURIComponent(requirementId)}&select=match_score&limit=1000`,
    { headers },
  ).catch(() => null);
  const scores = scoresRes?.ok ? ((await scoresRes.json().catch(() => null)) as Array<{ match_score: number }> | null) : null;
  if (Array.isArray(scores) && scores.length > 0) {
    const restored = classifyRequirementStatus(scores.map((m) => ({ matchScore: m.match_score })));
    // Only a requirement stuck mid-run ("generating") or already "failed" needs
    // its status put back; ready/partial ones are left exactly as they were.
    const res = await fetch(`${base}&status=in.(generating,failed)`, {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({ status: restored }),
    }).catch(() => null);
    const touched = res?.ok ? await res.json().catch(() => []) : [];
    if (Array.isArray(touched) && touched.length > 0) return restored;
    // Nothing was in a transient state: report the status it already has.
    const cur = await fetch(`${base}&select=status`, { headers }).catch(() => null);
    const rows = cur?.ok ? ((await cur.json().catch(() => [])) as Array<{ status: string }>) : [];
    return rows[0]?.status ?? restored;
  }
  // An empty shortlist that we READ successfully is a legitimate "zero" the
  // last completed pass may have reached: a transient error now must not
  // relabel it "failed" (which tells the employer their requirement broke).
  // Only a requirement whose first pass never finished is failed.
  if (Array.isArray(scores)) {
    const cur = await fetch(`${base}&select=status,last_matched_at`, { headers }).catch(() => null);
    const rows = cur?.ok ? ((await cur.json().catch(() => [])) as Array<{ status?: string; last_matched_at?: string | null }>) : [];
    const row = Array.isArray(rows) ? rows[0] : undefined;
    if (row?.status && row.status !== "generating") return row.status;
    if (row?.status === "generating" && row.last_matched_at) {
      const res = await fetch(`${base}&status=eq.generating`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ status: "zero" }),
      }).catch(() => null);
      if (res?.ok) return "zero";
    }
  }
  // status=neq.closed: an employer who archived the requirement while this
  // pass was running must not see it reopened as "failed".
  await fetch(`${base}&status=neq.closed`, {
    method: "PATCH",
    headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ status: "failed" }),
  }).catch(() => {});
  return "failed";
}

/** Returned instead of a requirement status when the owner is suspended:
 *  nothing is matched, written or notified. */
export const SUSPENDED_MATCHING_STATUS = "suspended";

export async function runMatching(requirementId: string, req: RequirementInput, ownerUserId: string, opts: RunMatchingOptions = {}): Promise<string> {
  const timeoutMs = opts.timeoutMs ?? MATCHING_TIMEOUT_MS;
  let timer: ReturnType<typeof setTimeout> | undefined;
  // The race alone only stops US waiting: the inner pass would carry on and
  // write shortlist rows, a status and notifications after we had already
  // reported "failed". The signal lets it notice and stop before each write.
  const controller = new AbortController();
  const hardDeadlineMs = Date.now() + timeoutMs;
  try {
    const status = await Promise.race([
      runMatchingInner(requirementId, req, ownerUserId, hardDeadlineMs - SCAN_RESERVE_MS, hardDeadlineMs, controller.signal),
      new Promise<string>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`matching timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
    if (status === STALE_MATCHING_STATUS) {
      opts.onStale?.();
      // Callers that surface a status (the edit/create response) show what the
      // requirement actually holds; the run that superseded this one settles it.
      const cur = await fetch(`${SUPABASE_URL}/rest/v1/employer_requirements?id=eq.${encodeURIComponent(requirementId)}&select=status`, { headers: serviceHeaders() }).catch(() => null);
      const rows = cur?.ok ? ((await cur.json().catch(() => [])) as Array<{ status?: string }>) : [];
      return (Array.isArray(rows) && rows[0]?.status) || "generating";
    }
    return status;
  } catch (err) {
    controller.abort();
    const msg = err instanceof Error ? err.message : String(err);
    slog.error("employer-requirements matching threw", { code: "employer_requirements_matching_failed", error: msg.slice(0, 200), requirementId });
    opts.onFailure?.(err instanceof Error ? err : new Error(msg));
    return await settleFailedRun(requirementId);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Best-effort: a failure only means the next pass may re-announce, never a failed run. */
async function recordMissedPasses(requirementId: string, misses: Array<{ id: string; missed: number }>): Promise<void> {
  const byCount = new Map<number, string[]>();
  for (const m of misses) byCount.set(m.missed, [...(byCount.get(m.missed) ?? []), m.id]);
  for (const [missed, ids] of byCount) {
    for (const batch of chunk(ids, 100)) {
      await fetch(
        `${SUPABASE_URL}/rest/v1/requirement_matches?requirement_id=eq.${encodeURIComponent(requirementId)}&id=in.(${inList(batch)})&unlocked=eq.false`,
        { method: "PATCH", headers: { ...serviceHeaders(), "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ missed_passes: missed }) },
      ).catch(() => {});
    }
  }
}

/** Claims the announcement before it is sent: the PATCH only touches rows whose
 *  strong_alerted_at is still null, so of two overlapping passes exactly one gets
 *  each candidate back and sends the alert. A failed claim returns nothing, so a
 *  candidate is announced at most once rather than twice. */
async function claimStrongAlerts(requirementId: string, candidateIds: string[]): Promise<string[]> {
  const claimed: string[] = [];
  for (const batch of chunk(candidateIds, 100)) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/requirement_matches?requirement_id=eq.${encodeURIComponent(requirementId)}&candidate_user_id=in.(${inList(batch)})&strong_alerted_at=is.null&select=candidate_user_id`,
      { method: "PATCH", headers: { ...serviceHeaders(), "Content-Type": "application/json", Prefer: "return=representation" }, body: JSON.stringify({ strong_alerted_at: new Date().toISOString() }) },
    ).catch(() => null);
    if (!res || !res.ok) continue;
    const rows = (await res.json().catch(() => [])) as Array<{ candidate_user_id?: string }>;
    if (Array.isArray(rows)) for (const row of rows) if (row.candidate_user_id) claimed.push(row.candidate_user_id);
  }
  return claimed;
}

async function deleteLockedMatches(ids: string[], requirementId: string, opts: { untouchedOnly?: boolean } = {}): Promise<boolean> {
  let ok = true;
  // The touched check happens when rows are read, and a scan runs for tens of
  // seconds: an employer can shortlist, note or advance a row in between. Stale
  // removal therefore re-asserts "untouched" in the DELETE itself.
  const guard = opts.untouchedOnly ? untouchedMatchFilter() : "";
  for (const batch of chunk(ids, 100)) {
    // unlocked=eq.false is belt and braces: a paid-for (unlocked) row can
    // never be removed by a re-match even if a caller's id list is wrong.
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/requirement_matches?requirement_id=eq.${encodeURIComponent(requirementId)}&id=in.(${inList(batch)})&unlocked=eq.false${guard}`,
      { method: "DELETE", headers: serviceHeaders() },
    ).catch(() => null);
    if (!res || !res.ok) ok = false;
  }
  if (!ok) slog.error("requirement_matches cleanup failed", { code: "requirement_matches_cleanup_failed", requirementId });
  return ok;
}

/** Thrown by the inner pass once runMatching has timed out or failed, so no
 *  further write happens on behalf of a run the caller already gave up on. */
function stopIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new Error("matching aborted");
}

async function runMatchingInner(requirementId: string, req: RequirementInput, ownerUserId: string, deadlineMs: number, hardDeadlineMs: number, signal: AbortSignal): Promise<string> {
  const headers = serviceHeaders();

  // A suspended employer is read-only: no matching, no writes, no alerts —
  // whichever path (edit, reopen, incremental, cron) got us here.
  const employerRes = await fetch(
    `${SUPABASE_URL}/rest/v1/employers?id=eq.${encodeURIComponent(ownerUserId)}&select=id,suspended_at`,
    { headers },
  );
  if (!employerRes.ok) throw new Error(`employer read failed: ${employerRes.status}`);
  const employerRows = (await employerRes.json().catch(() => [])) as Array<{ id: string; suspended_at?: string | null }>;
  if (isSuspended(employerRows[0])) return SUSPENDED_MATCHING_STATUS;

  // After the suspension check so a suspended employer's run stays write-free.
  await markRematchAttempt(requirementId);

  const readExisting = (tier: 0 | 1 | 2) => fetchKeyset<ExistingMatchRow & Record<string, unknown>>({
    baseUrl: `${SUPABASE_URL}/rest/v1/requirement_matches?requirement_id=eq.${encodeURIComponent(requirementId)}&select=id,candidate_user_id,match_score,unlocked,candidate_status,candidate_status_note,interview_scheduled_at,candidate_response,missed_passes,strong_alerted_at${llmSelectColumns(tier)}`,
    headers, keyField: "id", pageSize: 1000, maxRows: 5000,
  });
  let existingRead = await readExisting(llmColumnTier);
  // Migration 0048/0050 not applied: step down a tier at a time. Only a
  // successful retry proves the columns were the problem.
  for (let tier = llmColumnTier; existingRead.failed && tier > 0; tier--) {
    const retry = await readExisting((tier - 1) as 0 | 1);
    if (!retry.failed) llmColumnTier = (tier - 1) as 0 | 1;
    existingRead = retry;
  }
  if (existingRead.failed) throw new Error("existing matches read failed");
  const existing: ExistingMatchRow[] = existingRead.rows;
  // Captured before anything is written so a candidate who just crossed
  // STRONG_MATCH_THRESHOLD on *this* pass can be told apart from one who has
  // been a strong match all along.
  const previousScoreByCandidate = new Map(existing.map((m) => [m.candidate_user_id, m.match_score]));
  const alertedCandidateIds = new Set(existing.filter((m) => m.strong_alerted_at).map((m) => m.candidate_user_id));

  const blocked = await loadBlockedCandidateIds(SUPABASE_URL, headers, ownerUserId);
  if (!blocked) throw new Error("employer blocks read failed");

  // Consent sweep over rows we already hold: a LOCKED row whose candidate
  // opted out of employer visibility, blocked this employer, or no longer has
  // a profile is deleted now. Unlocked rows are paid-for and never touched.
  const lockedCandidateIds = Array.from(new Set(existing.filter((m) => !m.unlocked).map((m) => m.candidate_user_id)));
  const optedOut = lockedCandidateIds.length > 0 ? await loadOptedOutCandidateIds(SUPABASE_URL, headers, lockedCandidateIds) : new Set<string>();
  if (!optedOut) throw new Error("candidate visibility read failed");
  const ineligible = new Set<string>([...optedOut, ...lockedCandidateIds.filter((id) => blocked.has(id))]);
  const plan = planExistingMatches(existing, ineligible);
  if (plan.removeIneligibleIds.length > 0) {
    stopIfAborted(signal);
    await deleteLockedMatches(plan.removeIneligibleIds, requirementId);
  }

  // Touched rows keep their pipeline state and are excluded from re-scoring,
  // so they must not reappear as fresh candidates in the pool either.
  const preservedCandidateIds = new Set(plan.preserved.map((m) => m.candidate_user_id));
  const ctx = { ownerUserId, blockedCandidateIds: blocked, excludedCandidateIds: preservedCandidateIds };

  // Stream the pool in keyset pages (profiles are big; resume_data) and keep
  // only profiles that are eligible AND clear the role/skill relevance floor,
  // so session reads below touch a small subset instead of the whole table.
  const relevant: PoolProfile[] = [];
  // Rotated start (see rotatedScanStart): a fixed id order starves every
  // profile past the MAX_POOL_SCAN cap once the pool grows beyond it.
  const scan = await fetchKeysetRotated<PoolProfile & Record<string, unknown>>({
    startKey: rotatedScanStart(requirementId),
    baseUrl:
      `${SUPABASE_URL}/rest/v1/profiles?id=neq.${encodeURIComponent(ownerUserId)}&employer_visibility=neq.off&deleted_at=is.null` +
      `&select=id,name,target_role,industry,resume_data,practice_timestamps,employer_visibility,deleted_at`,
    headers, keyField: "id", pageSize: POOL_PAGE_SIZE, maxRows: MAX_POOL_SCAN, deadlineMs,
    onPage: (rows) => {
      for (const p of rows) if (isEligiblePoolProfile(p, ctx) && isRelevantProfile(p, req)) relevant.push(p);
    },
  });
  if (scan.failed && scan.seen === 0) throw new Error("candidate pool read failed");
  // A partial scan can't prove anyone fell out of the pool, so it never
  // removes stale rows (see planStaleRemovals).
  const scanComplete = !scan.truncated;

  // "Hired elsewhere" only matters for candidates who'd otherwise surface.
  const hiredElsewhereIds = await loadHiredElsewhere(SUPABASE_URL, headers, requirementId, relevant.map((p) => p.id));
  const pool = relevant.filter((p) => !hiredElsewhereIds.has(p.id));

  const needsReports = !!(req.minReadinessBand || req.minStarCompleteness);
  const sessionRows = pool.length > 0 ? await loadGradedSessions(SUPABASE_URL, headers, pool.map((p) => p.id), needsReports) : [];
  const stats = computeTrustedSessionStats(keepSessionsForRole(sessionRows, req.title));

  const nowMs = Date.now();
  const candidateRows: CandidatePoolRow[] = pool.map((p) => buildCandidatePoolRow(p, stats, nowMs));

  const scored = candidateRows.map((c) => scoreCandidateMatch(c, req));
  // The model re-ranks a wider window than is shown, so a candidate it rates
  // highly can climb in from just below the deterministic cut.
  const { ranked: deterministicRanked, totalMatched: freshTotalMatched } = rankAndCap(scored, LLM_RERANK_WINDOW);

  // LLM re-ranking augments only the already-capped shortlist (cheap: one
  // call per requirement create/edit, not one per candidate). Best-effort —
  // llmRerankCandidates returns an empty map on any failure, in which case
  // blendScore is a no-op and `ranked` is identical to the deterministic pass.
  const byId = new Map(candidateRows.map((c) => [c.id, c]));
  const shortlistCandidates = deterministicRanked
    .map((m) => byId.get(m.candidateId))
    .filter((c): c is CandidatePoolRow => !!c);
  // The scan can use most of the run's budget; whatever is left (minus a write
  // reserve) is all the model gets, and below LLM_MIN_REMAINING_MS it is
  // skipped. The deterministic result still persists either way.
  const llmBudget = llmBudgetMs(hardDeadlineMs - Date.now());
  const freshLlmScores = await llmRerankCandidates(req, shortlistCandidates, { userId: ownerUserId, budgetMs: llmBudget });
  // A candidate the model did not score this pass (skipped, failed, omitted)
  // keeps their last stored opinion while it is recent, so an outage does not
  // swing scores down and the recovery back up across the strong threshold.
  const llmCriteria = llmCriteriaFingerprint(req);
  const profileStamps = new Map(shortlistCandidates.map((c) => [c.id, llmProfileStamp(c)]));
  const llmScores = resolveLlmScores(
    shortlistCandidates.map((c) => c.id),
    freshLlmScores,
    new Map(existing.map((m) => [m.candidate_user_id, m])),
    Date.now(),
    { criteriaFingerprint: llmCriteria, profileStamps },
  );
  // Re-applies MIN_MATCH_SCORE_FLOOR after blending: blendScore can pull a
  // candidate who just cleared that floor back below it (or vice versa).
  const blended = deterministicRanked.map((m) => ({
    ...m,
    deterministicScore: m.matchScore,
    matchScore: capUnsupportedStrong(blendScore(m.matchScore, llmScores.get(m.candidateId)?.score), m.skillsSupportStrong),
  }));
  const aboveFloor = blended
    .filter((m) => m.matchScore >= MIN_MATCH_SCORE_FLOOR)
    .sort((a, b) => b.matchScore - a.matchScore || (a.candidateId < b.candidateId ? -1 : a.candidateId > b.candidateId ? 1 : 0));
  const ranked = aboveFloor.slice(0, MATCH_SHORTLIST_CAP);
  // Only the floor drop adjusts the pool size: candidates cut by the cap are
  // still part of the matched pool, as in the pre-window count.
  const droppedByFloorAfterBlend = blended.length - aboveFloor.length;

  stopIfAborted(signal);
  // The scan above can run for tens of seconds. If the employer edited the
  // criteria (or archived the requirement) meanwhile, these scores describe a
  // requirement that no longer exists and must not replace the shortlist the
  // edit's own run is building.
  if (await criteriaChangedSince(requirementId, req)) {
    slog.info("requirement matching skipped: criteria changed mid-scan", { code: "matching_stale_criteria", requirementId });
    return STALE_MATCHING_STATUS;
  }
  stopIfAborted(signal);
  if (ranked.length > 0) {
    const buildRows = (tier: 0 | 1 | 2) => ranked.map((m) => ({
      requirement_id: requirementId,
      candidate_user_id: m.candidateId,
      match_score: m.matchScore,
      roster_score: m.rosterScore,
      missed_passes: 0,
      // Every row carries the same keys (null when there is no opinion) so the
      // bulk upsert is uniform, and a stale opinion past its max age is cleared.
      ...(tier >= 1
        ? { llm_score: llmScores.get(m.candidateId)?.score ?? null, llm_scored_at: llmScores.get(m.candidateId)?.scoredAt ?? null }
        : {}),
      ...(tier === 2
        ? {
            llm_criteria_fingerprint: llmScores.has(m.candidateId) ? llmCriteria : null,
            llm_profile_stamp: llmScores.has(m.candidateId) ? profileStamps.get(m.candidateId) ?? null : null,
          }
        : {}),
    }));
    // merge-duplicates: two concurrent runMatching passes for the same
    // requirement can both reach this insert for the same candidate — the
    // unique (requirement_id, candidate_user_id) constraint would otherwise
    // 409 the second one. The upsert keeps existing row ids, so an untouched
    // row that stays shortlisted is updated in place rather than recreated.
    const upsert = (tier: 0 | 1 | 2) => fetch(`${SUPABASE_URL}/rest/v1/requirement_matches?on_conflict=requirement_id,candidate_user_id`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(buildRows(tier)),
    });
    let insertMatchesRes = await upsert(llmColumnTier);
    // Migration 0048/0050 not applied: persist with fewer model-score columns.
    for (let tier = llmColumnTier; !insertMatchesRes.ok && insertMatchesRes.status === 400 && tier > 0; tier--) {
      const retry = await upsert((tier - 1) as 0 | 1);
      if (retry.ok) llmColumnTier = (tier - 1) as 0 | 1;
      insertMatchesRes = retry;
    }
    if (!insertMatchesRes.ok) throw new Error(`requirement_matches insert failed: ${insertMatchesRes.status}`);
  }

  // Stale cleanup runs AFTER the upsert, so a failure mid-pass leaves the old
  // shortlist in place instead of an empty one. Locked rows only.
  const rankedIds = new Set(ranked.map((m) => m.candidateId));
  const { removeIds: staleIds, missIds } = planStaleRemovals(plan.untouched, rankedIds, scanComplete);
  stopIfAborted(signal);
  if (missIds.length > 0) await recordMissedPasses(requirementId, missIds);
  if (staleIds.length > 0) {
    slog.info("requirement matches removed after repeated misses", { code: "match_removed_stale", requirementId, count: staleIds.length, matchIds: staleIds.map((id) => id.slice(0, 8)) });
    await deleteLockedMatches(staleIds, requirementId, { untouchedOnly: true });
  }
  const removedStale = new Set(staleIds);
  // Untouched rows a partial scan couldn't re-evaluate stay on the list.
  const retained = plan.untouched.filter((m) => !rankedIds.has(m.candidate_user_id) && !removedStale.has(m.id));

  // "New strong match" ping: strong NOW, not strong on the previous pass.
  // One notification + one email per run, never per candidate; capped; counts
  // and a score only — no name or candidate-derived label, because nothing
  // here has been unlocked. Awaited with a swallowed rejection so a delivery
  // failure can neither fail the pass nor be dropped when the isolate exits.
  // A score that crossed the bar only because the model's opinion appeared or
  // vanished since the last pass is a source flip, not news: never announce it.
  const existingByCandidate = new Map(existing.map((m) => [m.candidate_user_id, m]));
  const sourceFlipIds = new Set<string>();
  if (llmColumnTier >= 1) {
    for (const m of ranked) {
      const prev = existingByCandidate.get(m.candidateId);
      if (!prev) continue;
      if (isModelSourceFlip({
        previousHadModelScore: prev.llm_score != null,
        nowHasModelScore: llmScores.has(m.candidateId),
        deterministicScore: m.deterministicScore,
        strongThreshold: STRONG_MATCH_THRESHOLD,
      })) sourceFlipIds.add(m.candidateId);
    }
  }
  const newStrongMatches = selectNewStrongMatches(ranked, previousScoreByCandidate, STRONG_MATCH_THRESHOLD, undefined, new Set([...alertedCandidateIds, ...sourceFlipIds]));
  stopIfAborted(signal);
  const claimedStrong = new Set(newStrongMatches.length > 0 ? await claimStrongAlerts(requirementId, newStrongMatches.map((m) => m.candidateId)) : []);
  const announceStrong = newStrongMatches.filter((m) => claimedStrong.has(m.candidateId));
  if (announceStrong.length > 0) {
    const title = req.title || "your requirement";
    const topScore = Math.max(...announceStrong.map((m) => m.matchScore));
    await Promise.all([
      notify({
        userId: ownerUserId,
        type: "strong_match_found",
        title: "Strong match update",
        body: strongMatchAlertBody(announceStrong.length, topScore, title),
        link: `/employer/requirements/${requirementId}`,
      }).catch(() => {}),
      sendStrongMatchEmail({
        ownerUserId,
        requirementId,
        requirementTitle: title,
        matchCount: announceStrong.length,
        topScore,
      }).catch(() => {}),
    ]);
  }

  // Only live rows count: a preserved row the employer rejected or the
  // candidate declined is pipeline history, not an open match, and letting it
  // count made a requirement read "ready" with nobody left to review.
  const livePreserved = plan.preserved.filter(isLiveMatch);
  const liveRetained = retained.filter(isLiveMatch);
  const finalStatus = classifyRequirementStatus([
    ...livePreserved.map((m) => ({ matchScore: m.match_score })),
    ...liveRetained.map((m) => ({ matchScore: m.match_score })),
    ...ranked,
  ]);
  // Preserved and retained rows are real matched candidates too — they're
  // just not re-scored this pass — so they count toward the pool size.
  const matchedPoolSize = freshTotalMatched - droppedByFloorAfterBlend + livePreserved.length + liveRetained.length;
  // &status=neq.closed guards against a requirement archived while this
  // pass was in flight: without it this write would flip a closed posting
  // back open (and the stage-flip below could re-fire "matches ready").
  stopIfAborted(signal);
  await fetch(`${SUPABASE_URL}/rest/v1/employer_requirements?id=eq.${encodeURIComponent(requirementId)}&status=neq.closed`, {
    method: "PATCH",
    headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ status: finalStatus, matched_pool_size: matchedPoolSize, last_matched_at: new Date().toISOString() }),
  });

  // Screening produced something worth looking at — auto-advance out of
  // "AI Matching". Conditioned on stage still being ai_matching (via the
  // PostgREST filter, not a separate read) so a requirement the employer
  // already moved forward manually is never dragged back; also guarded
  // against status=closed for the same in-flight-archive race as above.
  if (finalStatus === "ready" || finalStatus === "partial") {
    stopIfAborted(signal);
    const stageFlipRes = await fetch(
      `${SUPABASE_URL}/rest/v1/employer_requirements?id=eq.${encodeURIComponent(requirementId)}&stage=eq.ai_matching&status=neq.closed`,
      {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({ stage: "ready_for_review" }),
      },
    ).catch(() => null);
    // Only notify when THIS call actually flipped the stage (one row back).
    const stageFlipRows = stageFlipRes?.ok ? await stageFlipRes.json().catch(() => []) : [];
    if (Array.isArray(stageFlipRows) && stageFlipRows.length === 1) {
      await notify({
        userId: ownerUserId,
        type: "matches_ready",
        title: "Candidates ready to review",
        body: `${req.title || "Your requirement"} has matched candidates ready for review.`,
        link: `/employer/requirements/${requirementId}`,
      }).catch(() => {});
    }
  }
  return finalStatus;
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
const MAX_INCREMENTAL_REQUIREMENTS = 5;

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

/** Hard ceiling on requirements one resume save may score the candidate
 *  against. Scoring one profile is cheap, but the backlog read and the
 *  per-requirement writes are not free on a hot, rate-limited endpoint. */
const MAX_INCREMENTAL_CANDIDATE_REQUIREMENTS = 25;

function requirementInputFromRow(r: OpenRequirementForRematch): RequirementInput {
  return {
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
    customSkills: r.custom_skill_sets ?? [],
    workMode: r.work_mode,
  };
}

/** Scores ONE candidate against the open requirements and writes only that
 *  candidate's rows. A resume save changes one person, so re-scanning the
 *  whole pool per requirement (as the full pass does) was pure waste. The
 *  nightly cron remains the full, authoritative pass: this path only ever
 *  adds or refreshes this candidate's own untouched row, never removes. */
async function rematchSingleCandidate(candidateId: string): Promise<void> {
  const headers = serviceHeaders();
  const profileRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(candidateId)}&deleted_at=is.null&select=id,name,target_role,industry,resume_data,practice_timestamps,employer_visibility,deleted_at`,
    { headers },
  );
  if (!profileRes.ok) return;
  const profile = ((await profileRes.json().catch(() => [])) as PoolProfile[])[0];
  if (!profile || profile.employer_visibility === "off" || profile.deleted_at) return;

  const backlogRes = await fetchRematchBacklog({ supabaseUrl: SUPABASE_URL, headers, limit: 100 });
  if (!backlogRes) return;
  const rows = ((await backlogRes.json().catch(() => [])) as Array<OpenRequirementForRematch & { employers?: { suspended_at?: string | null } | null }>)
    .filter((r) => !isSuspended(r.employers) && r.employer_id !== candidateId);
  const candidates = pickRequirementsToRematch(rows, rows.length)
    .filter((r) => isRelevantProfile(profile, requirementInputFromRow(r)))
    .slice(0, MAX_INCREMENTAL_CANDIDATE_REQUIREMENTS);
  if (candidates.length === 0) return;

  const needsReports = candidates.some((r) => !!(r.min_readiness_band || r.min_star_completeness));
  const sessionRows = await loadGradedSessions(SUPABASE_URL, headers, [candidateId], needsReports);
  const blockedByEmployer = new Map<string, Set<string> | null>();

  for (const r of candidates) {
    try {
      if (!blockedByEmployer.has(r.employer_id)) blockedByEmployer.set(r.employer_id, await loadBlockedCandidateIds(SUPABASE_URL, headers, r.employer_id));
      const blocked = blockedByEmployer.get(r.employer_id);
      // Fail closed: an unreadable block list never lets a blocked person in.
      if (!blocked || blocked.has(candidateId)) continue;
      await rematchCandidateForRequirement(r, profile, sessionRows);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      slog.error("incremental candidate rematch failed", { code: "incremental_candidate_rematch_failed", error: msg.slice(0, 200), requirementId: r.id });
    }
  }
}

async function rematchCandidateForRequirement(
  r: OpenRequirementForRematch,
  profile: PoolProfile,
  sessionRows: Awaited<ReturnType<typeof loadGradedSessions>>,
): Promise<void> {
  const headers = serviceHeaders();
  const req = requirementInputFromRow(r);
  const hired = await loadHiredElsewhere(SUPABASE_URL, headers, r.id, [profile.id]);
  if (hired.has(profile.id)) return;

  const stats = computeTrustedSessionStats(keepSessionsForRole(sessionRows, req.title));
  const row = buildCandidatePoolRow(profile, stats, Date.now());
  const { ranked } = rankAndCap([scoreCandidateMatch(row, req)]);

  const readExisting = (tier: 0 | 1 | 2) => fetch(
    `${SUPABASE_URL}/rest/v1/requirement_matches?requirement_id=eq.${encodeURIComponent(r.id)}&candidate_user_id=eq.${encodeURIComponent(profile.id)}` +
      `&select=id,candidate_user_id,match_score,unlocked,candidate_status,candidate_status_note,interview_scheduled_at,candidate_response,strong_alerted_at${llmSelectColumns(tier)}`,
    { headers },
  );
  let existingRes = await readExisting(llmColumnTier);
  for (let tier = llmColumnTier; !existingRes.ok && tier > 0; tier--) {
    const retry = await readExisting((tier - 1) as 0 | 1);
    if (retry.ok) llmColumnTier = (tier - 1) as 0 | 1;
    existingRes = retry;
  }
  if (!existingRes.ok) return;
  const existing = ((await existingRes.json().catch(() => [])) as ExistingMatchRow[])[0];
  // Pipeline state is the employer's; a touched row is never re-scored here.
  if (existing && isTouchedMatch(existing)) return;

  if (ranked.length === 0) {
    // The candidate no longer clears relevance/evidence/floor on their own
    // profile (nothing about it depends on the rest of the pool), so a locked,
    // untouched row from an earlier resume is removed instead of lingering
    // with a score for a profile that no longer exists.
    if (existing && !existing.unlocked) await deleteLockedMatches([existing.id], r.id, { untouchedOnly: true });
    return;
  }

  // Stored opinion counts only if it was about this posting and this profile;
  // the resume that triggered this pass usually changes the stamp, so the row
  // is rescored deterministically and its stale model columns cleared below.
  const llmCriteria = llmCriteriaFingerprint(req);
  const llmStamp = llmProfileStamp(row);
  const llm = resolveLlmScores(
    [profile.id], new Map(), new Map(existing ? [[profile.id, existing]] : []), Date.now(),
    { criteriaFingerprint: llmCriteria, profileStamps: new Map([[profile.id, llmStamp]]) },
  ).get(profile.id);
  const match = ranked[0];
  const score = capUnsupportedStrong(blendScore(match.matchScore, llm?.score), match.skillsSupportStrong);
  if (score < MIN_MATCH_SCORE_FLOOR) return;

  if (await criteriaChangedSince(r.id, req)) return;
  const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/requirement_matches?on_conflict=requirement_id,candidate_user_id`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
    // A still-valid stored opinion is left as it is; one that no longer applies
    // is nulled so the old blend cannot outlive the profile or posting it described.
    body: JSON.stringify({
      requirement_id: r.id, candidate_user_id: profile.id, match_score: score, roster_score: match.rosterScore, missed_passes: 0,
      ...(llm || !existing || llmColumnTier === 0
        ? {}
        : { llm_score: null, llm_scored_at: null, ...(llmColumnTier === 2 ? { llm_criteria_fingerprint: null, llm_profile_stamp: null } : {}) }),
    }),
  });
  if (!upsertRes.ok) throw new Error(`requirement_matches upsert failed: ${upsertRes.status}`);

  // Status and size are derived from live rows, never carried over, so a
  // requirement can move zero -> partial/ready but is never knocked down here.
  const scoresRes = await fetch(
    `${SUPABASE_URL}/rest/v1/requirement_matches?requirement_id=eq.${encodeURIComponent(r.id)}&select=match_score,candidate_status,candidate_response&limit=1000`,
    { headers },
  ).catch(() => null);
  const liveRows = scoresRes?.ok ? ((await scoresRes.json().catch(() => null)) as Array<{ match_score: number; candidate_status: string | null; candidate_response: string | null }> | null) : null;
  if (Array.isArray(liveRows)) {
    const live = liveRows.filter(isLiveMatch);
    const status = classifyRequirementStatus(live.map((m) => ({ matchScore: m.match_score })));
    const sizeRes = await fetch(`${SUPABASE_URL}/rest/v1/employer_requirements?id=eq.${encodeURIComponent(r.id)}&select=matched_pool_size`, { headers }).catch(() => null);
    const sizeRows = sizeRes?.ok ? ((await sizeRes.json().catch(() => [])) as Array<{ matched_pool_size?: number | null }>) : [];
    const prevSize = typeof sizeRows[0]?.matched_pool_size === "number" ? sizeRows[0].matched_pool_size : 0;
    const poolSize = Math.max(live.length, prevSize + (existing ? 0 : 1));
    await fetch(`${SUPABASE_URL}/rest/v1/employer_requirements?id=eq.${encodeURIComponent(r.id)}&status=in.(zero,partial,ready)`, {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ status, matched_pool_size: poolSize, last_matched_at: new Date().toISOString() }),
    }).catch(() => {});
    if (status === "ready" || status === "partial") {
      const flip = await fetch(
        `${SUPABASE_URL}/rest/v1/employer_requirements?id=eq.${encodeURIComponent(r.id)}&stage=eq.ai_matching&status=neq.closed`,
        { method: "PATCH", headers: { ...headers, "Content-Type": "application/json", Prefer: "return=representation" }, body: JSON.stringify({ stage: "ready_for_review" }) },
      ).catch(() => null);
      const flipped = flip?.ok ? await flip.json().catch(() => []) : [];
      if (Array.isArray(flipped) && flipped.length === 1) {
        await notify({
          userId: r.employer_id, type: "matches_ready", title: "Candidates ready to review",
          body: `${r.title || "Your requirement"} has matched candidates ready for review.`, link: `/employer/requirements/${r.id}`,
        }).catch(() => {});
      }
    }
  }

  // One announcement per candidate per requirement, ever (strong_alerted_at).
  const wasStrong = (existing?.match_score ?? 0) >= STRONG_MATCH_THRESHOLD;
  if (score >= STRONG_MATCH_THRESHOLD && !wasStrong && !existing?.strong_alerted_at && (await claimStrongAlerts(r.id, [profile.id])).length === 1) {
    await Promise.all([
      notify({
        userId: r.employer_id, type: "strong_match_found", title: "Strong match update",
        body: strongMatchAlertBody(1, score, r.title || "your requirement"), link: `/employer/requirements/${r.id}`,
      }).catch(() => {}),
      sendStrongMatchEmail({ ownerUserId: r.employer_id, requirementId: r.id, requirementTitle: r.title || "your requirement", matchCount: 1, topScore: score }).catch(() => {}),
    ]);
  }
}

/** With a candidate id (the update-profile path) only that candidate is
 *  scored. Without one this falls back to the legacy bounded full rescans. */
export async function rematchOpenRequirementsForNewResume(candidateUserId?: string): Promise<void> {
  try {
    if (candidateUserId) {
      await rematchSingleCandidate(candidateUserId);
      return;
    }
    // Least-recently-attempted first, suspended employers and long-overdue
    // requirements excluded server-side (and again below, defensively), capped
    // so one resume save can't read an unbounded backlog.
    const res = await fetchRematchBacklog({ supabaseUrl: SUPABASE_URL, headers: serviceHeaders(), limit: 100 });
    if (!res) return;
    const rows = ((await res.json().catch(() => [])) as Array<OpenRequirementForRematch & { employers?: { suspended_at?: string | null } | null }>)
      .filter((r) => !isSuspended(r.employers));
    const due = pickRequirementsToRematch(rows, MAX_INCREMENTAL_REQUIREMENTS);
    await runMatchingInBatches(due, requirementInputFromRow);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    slog.error("incremental rematch sweep threw", { code: "incremental_rematch_failed", error: msg.slice(0, 200) });
  }
}
