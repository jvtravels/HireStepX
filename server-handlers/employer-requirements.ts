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
  extractSkills,
  type CandidatePoolRow,
  type RequirementInput,
} from "./_requirement-match-helpers";
import { extractResumeDetail } from "./_resume-detail-helpers";
import { llmRerankCandidates, blendScore } from "./_requirement-match-llm";
import { notify } from "./_notify";
import { emailShell, title as emailTitle, para, button, dataCard, escapeHtml } from "./_email-theme";
import { pickRequirementsToRematch, type OpenRequirementForRematch } from "./_incremental-rematch-helpers";
import { isSuspended } from "./_employer-trust";
import {
  MAX_POOL_SCAN,
  POOL_PAGE_SIZE,
  SCAN_RESERVE_MS,
  chunk,
  inList,
  fetchKeyset,
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
  buildCandidatePoolRow,
  selectNewStrongMatches,
  strongMatchAlertBody,
  checkEmployerAllowance,
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
  type RequirementRow,
  type AiScreeningSummary,
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

    const reqTitle = opts.requirementTitle || "your requirement";
    const headline = strongMatchAlertBody(opts.matchCount, opts.topScore, reqTitle);
    const link = `${APP_URL}/employer/requirements/${opts.requirementId}`;
    const html = emailShell({
      preview: headline,
      body:
        emailTitle("New strong match", { accentWord: "found" }) +
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
        body: JSON.stringify({ from: FROM_EMAIL, to: [email], subject: "New strong match found — HireStepX", html }),
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

async function handleGet(userId: string, headers: Record<string, string>): Promise<Response> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/employer_requirements?employer_id=eq.${encodeURIComponent(userId)}&select=id,title,location,notice_period_pref,status,stage,department,archive_reason,archive_disposition,experience_min,experience_max,due_date,budget_min,budget_max,locations,open_positions,work_mode,skills,employment_type,salary_type,duration_weeks,hours_per_week,min_readiness_band,min_star_completeness,matched_pool_size,created_at&order=created_at.desc&limit=500`,
      { headers: serviceHeaders() },
    );
    if (!res.ok) throw new Error(`requirements read failed: ${res.status}`);
    const rows = (await res.json().catch(() => [])) as RequirementRow[];

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
        const detailsById = new Map<string, { name: string; yearsExperience: number | null; skills: string[] }>(
          topCandidateIds.map((id) => {
            const profile = profileById.get(id);
            return [id, { name: profile?.name ?? "", yearsExperience: extractResumeDetail(profile?.resume_data).yearsExperience, skills: extractSkills(profile?.resume_data) }];
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
}

/** Returned instead of a requirement status when the owner is suspended:
 *  nothing is matched, written or notified. */
export const SUSPENDED_MATCHING_STATUS = "suspended";

export async function runMatching(requirementId: string, req: RequirementInput, ownerUserId: string, opts: RunMatchingOptions = {}): Promise<string> {
  const timeoutMs = opts.timeoutMs ?? MATCHING_TIMEOUT_MS;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      runMatchingInner(requirementId, req, ownerUserId, Date.now() + timeoutMs - SCAN_RESERVE_MS),
      new Promise<string>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`matching timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    slog.error("employer-requirements matching threw", { code: "employer_requirements_matching_failed", error: msg.slice(0, 200), requirementId });
    await fetch(`${SUPABASE_URL}/rest/v1/employer_requirements?id=eq.${encodeURIComponent(requirementId)}`, {
      method: "PATCH",
      headers: { ...serviceHeaders(), "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ status: "failed" }),
    }).catch(() => {});
    return "failed";
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function deleteLockedMatches(ids: string[], requirementId: string): Promise<boolean> {
  let ok = true;
  for (const batch of chunk(ids, 100)) {
    // unlocked=eq.false is belt and braces: a paid-for (unlocked) row can
    // never be removed by a re-match even if a caller's id list is wrong.
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/requirement_matches?requirement_id=eq.${encodeURIComponent(requirementId)}&id=in.(${inList(batch)})&unlocked=eq.false`,
      { method: "DELETE", headers: serviceHeaders() },
    ).catch(() => null);
    if (!res || !res.ok) ok = false;
  }
  if (!ok) slog.error("requirement_matches cleanup failed", { code: "requirement_matches_cleanup_failed", requirementId });
  return ok;
}

async function runMatchingInner(requirementId: string, req: RequirementInput, ownerUserId: string, deadlineMs: number): Promise<string> {
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

  const existingRead = await fetchKeyset<ExistingMatchRow & Record<string, unknown>>({
    baseUrl: `${SUPABASE_URL}/rest/v1/requirement_matches?requirement_id=eq.${encodeURIComponent(requirementId)}&select=id,candidate_user_id,match_score,unlocked,candidate_status,candidate_status_note,interview_scheduled_at`,
    headers, keyField: "id", pageSize: 1000, maxRows: 5000,
  });
  if (existingRead.failed) throw new Error("existing matches read failed");
  const existing: ExistingMatchRow[] = existingRead.rows;
  // Captured before anything is written so a candidate who just crossed
  // STRONG_MATCH_THRESHOLD on *this* pass can be told apart from one who has
  // been a strong match all along.
  const previousScoreByCandidate = new Map(existing.map((m) => [m.candidate_user_id, m.match_score]));

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
  if (plan.removeIneligibleIds.length > 0) await deleteLockedMatches(plan.removeIneligibleIds, requirementId);

  // Touched rows keep their pipeline state and are excluded from re-scoring,
  // so they must not reappear as fresh candidates in the pool either.
  const preservedCandidateIds = new Set(plan.preserved.map((m) => m.candidate_user_id));
  const ctx = { ownerUserId, blockedCandidateIds: blocked, excludedCandidateIds: preservedCandidateIds };

  // Stream the pool in keyset pages (profiles are big; resume_data) and keep
  // only profiles that are eligible AND clear the role/skill relevance floor,
  // so session reads below touch a small subset instead of the whole table.
  const relevant: PoolProfile[] = [];
  const scan = await fetchKeyset<PoolProfile & Record<string, unknown>>({
    baseUrl:
      `${SUPABASE_URL}/rest/v1/profiles?id=neq.${encodeURIComponent(ownerUserId)}&employer_visibility=neq.off` +
      `&select=id,name,target_role,industry,resume_data,practice_timestamps,employer_visibility`,
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
  const stats = computeTrustedSessionStats(sessionRows);

  const nowMs = Date.now();
  const candidateRows: CandidatePoolRow[] = pool.map((p) => buildCandidatePoolRow(p, stats, nowMs));

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
  // Re-applies MIN_MATCH_SCORE_FLOOR after blending: blendScore can pull a
  // candidate who just cleared that floor back below it (or vice versa).
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
    // merge-duplicates: two concurrent runMatching passes for the same
    // requirement can both reach this insert for the same candidate — the
    // unique (requirement_id, candidate_user_id) constraint would otherwise
    // 409 the second one. The upsert keeps existing row ids, so an untouched
    // row that stays shortlisted is updated in place rather than recreated.
    const insertMatchesRes = await fetch(`${SUPABASE_URL}/rest/v1/requirement_matches?on_conflict=requirement_id,candidate_user_id`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(rows),
    });
    if (!insertMatchesRes.ok) throw new Error(`requirement_matches insert failed: ${insertMatchesRes.status}`);
  }

  // Stale cleanup runs AFTER the upsert, so a failure mid-pass leaves the old
  // shortlist in place instead of an empty one. Locked rows only.
  const rankedIds = new Set(ranked.map((m) => m.candidateId));
  const staleIds = planStaleRemovals(plan.untouched, rankedIds, scanComplete);
  if (staleIds.length > 0) await deleteLockedMatches(staleIds, requirementId);
  const removedStale = new Set(staleIds);
  // Untouched rows a partial scan couldn't re-evaluate stay on the list.
  const retained = plan.untouched.filter((m) => !rankedIds.has(m.candidate_user_id) && !removedStale.has(m.id));

  // "New strong match" ping: strong NOW, not strong on the previous pass.
  // One notification + one email per run, never per candidate; capped; counts
  // and a score only — no name or candidate-derived label, because nothing
  // here has been unlocked. Awaited with a swallowed rejection so a delivery
  // failure can neither fail the pass nor be dropped when the isolate exits.
  const newStrongMatches = selectNewStrongMatches(ranked, previousScoreByCandidate, STRONG_MATCH_THRESHOLD);
  if (newStrongMatches.length > 0) {
    const title = req.title || "your requirement";
    const topScore = Math.max(...newStrongMatches.map((m) => m.matchScore));
    await Promise.all([
      notify({
        userId: ownerUserId,
        type: "strong_match_found",
        title: "New strong match found",
        body: strongMatchAlertBody(newStrongMatches.length, topScore, title),
        link: `/employer/requirements/${requirementId}`,
      }).catch(() => {}),
      sendStrongMatchEmail({
        ownerUserId,
        requirementId,
        requirementTitle: title,
        matchCount: newStrongMatches.length,
        topScore,
      }).catch(() => {}),
    ]);
  }

  const finalStatus = classifyRequirementStatus([
    ...plan.preserved.map((m) => ({ matchScore: m.match_score })),
    ...retained.map((m) => ({ matchScore: m.match_score })),
    ...ranked,
  ]);
  // Preserved and retained rows are real matched candidates too — they're
  // just not re-scored this pass — so they count toward the pool size.
  const matchedPoolSize = freshTotalMatched - droppedByFloorAfterBlend + plan.preserved.length + retained.length;
  // &status=neq.closed guards against a requirement archived while this
  // pass was in flight: without it this write would flip a closed posting
  // back open (and the stage-flip below could re-fire "matches ready").
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
    // Least-recently-matched first, suspended employers excluded server-side
    // (and again below, defensively), capped so one resume save can't read an
    // unbounded backlog.
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/employer_requirements?stage=in.(ai_matching,ready_for_review)&status=neq.closed` +
        `&select=id,employer_id,title,location,description,skills,experience_min,experience_max,min_readiness_band,min_star_completeness,employment_type,duration_weeks,hours_per_week,stage,status,last_matched_at,employers!inner(suspended_at)` +
        `&employers.suspended_at=is.null&order=last_matched_at.asc.nullsfirst&limit=100`,
      { headers: serviceHeaders() },
    );
    if (!res.ok) return;
    const rows = ((await res.json().catch(() => [])) as Array<OpenRequirementForRematch & { employers?: { suspended_at?: string | null } | null }>)
      .filter((r) => !isSuspended(r.employers));
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
