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
import { extractResumeLocation, explainMatch, extractSkills, requiredSkillsCoverage, requiredSkillsMatched, type RequirementInput } from "./_requirement-match-helpers";
import { extractResumeDetail, redactResumeDetailForLock, coarsenLockedCity } from "./_resume-detail-helpers";
import { later } from "./_employer-dashboard-helpers";
import { runMatching, logRequirementActivity } from "./employer-requirements";
import {
  fetchKeyset,
  loadGradedSessions,
  keepSessionsForRole,
  computeTrustedSessionStats,
  buildCandidatePoolRow,
  parsePagination,
  paginate,
  loadRankedVisibleMatches,
  nextUnlockBatchQuote,
  scrubLockedResume,
  maskedCandidateName,
  checkEmployerAllowance,
  suspendedAllowance,
  requirementNeedsRematch,
  NO_REMATCH_DETAIL,
  chunk,
  inList,
  LOCKED_MASKED_FIELDS,
  contactWithheldReason,
  previousStatusOf,
  parseRestoreMatches,
  RESTORABLE_CANDIDATE_STATUSES,
  type RejectedMatchRecord,
  type Allowance,
  type EmployerGateRow,
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
  MIN_DESCRIPTION_LENGTH,
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

type EmployerEmbed = EmployerGateRow | null | undefined;
const isSuspendedEmployer = (e: EmployerEmbed): boolean => !!e?.suspended_at;
const EMPLOYER_EMBED = "employers(suspended_at,verification_tier,website)";

/** Turns a refused allowance (suspended / tier limit / unreadable count) into
 *  the response, with `Retry-After` on rate-style refusals. */
function denyResponse(allowance: Extract<Allowance, { ok: false }>, headers: Record<string, string>): Response {
  const out: Record<string, string> = { ...headers };
  if (allowance.retryAfterSeconds) out["Retry-After"] = String(allowance.retryAfterSeconds);
  return new Response(JSON.stringify(allowance.body), { status: allowance.status, headers: out });
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

    type MatchRow = {
      id: string; candidate_user_id: string; match_score: number; roster_score: number; unlocked: boolean; unlocked_at: string | null;
      candidate_status: string; candidate_status_note: string | null; interview_scheduled_at: string | null;
      candidate_status_updated_at: string | null; created_at: string | null;
      candidate_response?: string | null;
      llm_score?: number | null;
    };
    // Light columns only, keyset-paginated: the heavy profile/session reads
    // below run for the requested page, not the whole shortlist.
    const MATCH_COLUMNS = "id,candidate_user_id,match_score,roster_score,unlocked,unlocked_at,candidate_status,candidate_status_note,interview_scheduled_at,candidate_status_updated_at,created_at";
    const readMatches = (columns: string) => fetchKeyset<MatchRow & Record<string, unknown>>({
      baseUrl: `${SUPABASE_URL}/rest/v1/requirement_matches?requirement_id=eq.${encodeURIComponent(requirementId)}&select=${columns}`,
      headers: serviceHeaders(), keyField: "id", pageSize: 1000, maxRows: 5000,
    });
    // candidate_response ships in its own migration: if it is not applied yet
    // the read fails, so retry without it and report the response as unknown
    // (null) rather than failing the whole page.
    // llm_score (migration 0048) is the model's opinion behind the stored
    // score, needed for the breakdown to reproduce it; it degrades the same way.
    let matchesRead = await readMatches(`${MATCH_COLUMNS},candidate_response,llm_score`);
    let responseKnown = true;
    if (matchesRead.failed) {
      matchesRead = await readMatches(`${MATCH_COLUMNS},candidate_response`);
    }
    if (matchesRead.failed) {
      responseKnown = false;
      matchesRead = await readMatches(MATCH_COLUMNS);
    }
    if (matchesRead.failed) throw new Error("matches read failed");
    const allMatches: MatchRow[] = matchesRead.rows;

    /* Consent: a candidate who blocked this employer is gone entirely; one who
       switched employer visibility off disappears while locked, but an
       already-paid-for (unlocked) row stays — the employer bought that
       snapshot. Evidence rule: rankAndCap already excludes no-evidence
       candidates at match time, but older or employer-"touched" rows can
       linger, so it is re-applied at read time. The unlock order uses the
       same ranked list (loadRankedVisibleMatches) so rank positions and the
       batch price shown here are exactly what gets charged. Fail closed. */
    const gated = await loadRankedVisibleMatches(SUPABASE_URL, serviceHeaders(), auth.userId, allMatches);
    if (!gated) throw new Error("candidate consent read failed");
    const { ranked: visibleMatches, optedOut } = gated;
    const nextUnlockBatch = nextUnlockBatchQuote(visibleMatches);

    const pageParams = parsePagination(new URL(req.url).searchParams);
    const paged = paginate(visibleMatches, pageParams);
    const pageMatches = paged.items;
    const candidateIds = pageMatches.map((m) => m.candidate_user_id);

    const profileById = new Map<string, { name: string; email: string; target_role: string; resume_data: unknown; practice_timestamps: string[]; portfolio_links: unknown }>();
    for (const batch of chunk(candidateIds, 100)) {
      const profilesRes = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?id=in.(${inList(batch)})&select=id,name,email,target_role,resume_data,practice_timestamps,portfolio_links`,
        { headers: serviceHeaders() },
      );
      if (profilesRes.ok) {
        const rows = (await profilesRes.json().catch(() => [])) as Array<{
          id: string; name: string; email: string; target_role: string; resume_data: unknown; practice_timestamps: string[]; portfolio_links: unknown;
        }>;
        for (const r of rows) profileById.set(r.id, r);
      }
    }

    // Server-graded sessions only (report_generated_at set): a client-relayed
    // session row is not evidence an employer should see counted.
    const sessionCounts = new Map<string, number>();
    // The same role-matched, trusted stats scoring used, per candidate, so the
    // "why this score" breakdown is computed from identical inputs.
    const sessionRowsByUser = new Map<string, Awaited<ReturnType<typeof loadGradedSessions>>>();
    if (candidateIds.length > 0) {
      const graded = await loadGradedSessions(SUPABASE_URL, serviceHeaders(), candidateIds, !!(requirement.min_readiness_band || requirement.min_star_completeness));
      for (const r of graded) {
        sessionCounts.set(r.user_id, (sessionCounts.get(r.user_id) || 0) + 1);
        sessionRowsByUser.set(r.user_id, [...(sessionRowsByUser.get(r.user_id) ?? []), r]);
      }
    }
    const scoringInput: RequirementInput = {
      title: requirement.title, location: requirement.location, description: requirement.description || "",
      skills: requirement.skills ?? [], customSkills: requirement.custom_skill_sets ?? [], workMode: requirement.work_mode,
      experienceMin: requirement.experience_min, experienceMax: requirement.experience_max,
      minReadinessBand: asBoundedReadinessBand(requirement.min_readiness_band),
      minStarCompleteness: requirement.min_star_completeness,
      employmentType: requirement.employment_type, durationWeeks: requirement.duration_weeks, hoursPerWeek: requirement.hours_per_week,
    };
    const nowMs = Date.now();

    /* Which unlocked candidates have an original resume file on record, so the
       table only offers a download that will work. Best-effort: on a failed read
       the flag stays false and the row links to the profile instead. */
    const withResumeFile = new Set<string>();
    const unlockedIds = pageMatches.filter((m) => m.unlocked).map((m) => m.candidate_user_id);
    for (const batch of chunk(unlockedIds, 100)) {
      const filesRes = await fetch(
        `${SUPABASE_URL}/rest/v1/resume_versions?select=resumes!inner(user_id)&resumes.user_id=in.(${inList(batch)})&file_path=not.is.null&limit=1000`,
        { headers: serviceHeaders() },
      ).catch(() => null);
      if (!filesRes || !filesRes.ok) continue;
      const fileRows = (await filesRes.json().catch(() => [])) as Array<{ resumes?: { user_id?: string } | null }>;
      for (const r of fileRows) if (r.resumes?.user_id) withResumeFile.add(r.resumes.user_id);
    }

    /* Matches whose paid unlock was already refunded as account credit: the
       employer got their money back, so the contact details stop being theirs
       to export. Best-effort — the ledger is an optional table. */
    const refundedMatchIds = new Set<string>();
    const unlockedMatchIds = pageMatches.filter((m) => m.unlocked).map((m) => m.id);
    for (const batch of chunk(unlockedMatchIds, 100)) {
      const ledgerRes = await fetch(
        `${SUPABASE_URL}/rest/v1/employer_credit_ledger?employer_id=eq.${encodeURIComponent(auth.userId)}&kind=eq.refund&match_id=in.(${inList(batch)})&select=match_id`,
        { headers: serviceHeaders() },
      ).catch(() => null);
      if (!ledgerRes || !ledgerRes.ok) continue;
      const ledgerRows = (await ledgerRes.json().catch(() => [])) as Array<{ match_id: string | null }>;
      for (const r of ledgerRows) if (r.match_id) refundedMatchIds.add(r.match_id);
    }

    const candidates = pageMatches.map((m) => {
      const profile = profileById.get(m.candidate_user_id);
      const timestamps = Array.isArray(profile?.practice_timestamps) ? profile!.practice_timestamps : [];
      const lastActive = timestamps.length ? timestamps[timestamps.length - 1] : null;
      const lastActiveDaysAgo = lastActive ? Math.max(0, Math.round((Date.now() - new Date(lastActive).getTime()) / 86_400_000)) : -1;
      const resumeDetail = extractResumeDetail(profile?.resume_data);
      const stats = computeTrustedSessionStats(keepSessionsForRole(sessionRowsByUser.get(m.candidate_user_id) ?? [], requirement.title));
      const pool = profile
        ? buildCandidatePoolRow({
            id: m.candidate_user_id, name: profile.name, target_role: profile.target_role, industry: null,
            resume_data: profile.resume_data, practice_timestamps: profile.practice_timestamps,
          }, stats, nowMs)
        : undefined;
      const matchBreakdown = explainMatch(
        { target_role: profile?.target_role ?? null, resume_data: profile?.resume_data ?? null },
        scoringInput,
        { pool, llmScore: m.llm_score ?? null },
      );

      const skillCoverage = profile
        ? requiredSkillsCoverage({ target_role: profile.target_role, resume_data: profile.resume_data }, requirement.skills ?? [])
        : { met: 0, total: 0 };
      const unlocked = m.unlocked;
      const candidateWithdrew = unlocked && optedOut.has(m.candidate_user_id);
      const candidateResponse = responseKnown ? (m.candidate_response ?? "none") : null;
      const withheldReason = contactWithheldReason({ unlocked, candidateWithdrew, candidateResponse });
      const reachable = unlocked && !withheldReason;
      /* Name and contact details must never leave the server for a Locked
         match; masking only in the client is cosmetic. Employer and school
         names are withheld too (see redactResumeDetailForLock). */
      const name = unlocked ? profile?.name || "Candidate" : maskedCandidateName(m.id);
      // For a paid match the resume body stays (it is the paid snapshot) but
      // its own phone, LinkedIn and any email/number/link written into its
      // free text are contact details too, so they go with the rest.
      const resume = unlocked
        ? reachable ? resumeDetail : scrubLockedResume({ ...resumeDetail, phone: null, linkedin: null })
        : scrubLockedResume(redactResumeDetailForLock(resumeDetail, profile?.name || ""));

      return {
        id: m.id,
        name,
        targetRole: profile?.target_role || "Not specified",
        city: (unlocked ? extractResumeLocation(profile?.resume_data) : coarsenLockedCity(extractResumeLocation(profile?.resume_data))) || "Not specified",
        matchScore: m.match_score,
        rosterScore: m.roster_score,
        matchBreakdown,
        // null when the job lists no skills or the profile could not be read. 0 is
        // a real answer: the candidate is reviewable but covers none of them.
        requiredSkillsMet: skillCoverage.total > 0 ? skillCoverage.met : null,
        requiredSkillsTotal: skillCoverage.total > 0 ? skillCoverage.total : null,
        requiredSkillsMatched: profile ? requiredSkillsMatched({ target_role: profile.target_role, resume_data: profile.resume_data }, requirement.skills ?? []) : null,
        sessionsCompleted: sessionCounts.get(m.candidate_user_id) || 0,
        lastActiveDaysAgo,
        skills: extractSkills(profile?.resume_data).slice(0, 8),
        unlocked,
        contact: reachable && profile ? { email: profile.email, phone: resumeDetail.phone || undefined } : undefined,
        /* A personal site/GitHub link lets an employer identify or reach a
           candidate outside HireStepX without paying to unlock, so it's
           withheld entirely, not just scrubbed, for a locked match and for a
           candidate who withdrew or declined contact after being unlocked. */
        portfolioLinks: reachable ? extractPortfolioLinks(profile?.portfolio_links) : [],
        hasResumeFile: reachable && withResumeFile.has(m.candidate_user_id),
        resume,
        candidateStatus: m.candidate_status,
        candidateStatusNote: m.candidate_status_note,
        candidateResponse,
        interviewScheduledAt: m.interview_scheduled_at,
        creditRefunded: refundedMatchIds.has(m.id),
        waitingSince: later(later(m.candidate_status_updated_at, m.unlocked_at), m.created_at),
        // Additive: what was withheld for a locked match, and whether a paid
        // candidate has since withdrawn employer visibility.
        maskedFields: unlocked ? [] : [...LOCKED_MASKED_FIELDS],
        candidateWithdrew,
        // Set when a paid match's email, phone and links were held back; the UI
        // shows an explicit "no longer reachable" state instead of empty contact.
        contactWithheld: withheldReason !== null,
        contactWithheldReason: withheldReason,
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
        // Pagination (additive): `candidates` is now one page of the shortlist.
        page: paged.page,
        limit: paged.limit,
        total: paged.total,
        nextUnlockBatch: nextUnlockBatch
          ? { start: nextUnlockBatch.start, end: nextUnlockBatch.end, count: nextUnlockBatch.count, amountPaise: nextUnlockBatch.amountPaise, lockedRemaining: nextUnlockBatch.lockedRemaining }
          : null,
        nextPage: paged.nextPage,
        pagination: { page: paged.page, limit: paged.limit, total: paged.total, nextPage: paged.nextPage },
        // True pre-cap matched-pool size (see rankAndCap's totalMatched in
        // _requirement-match-helpers.ts) — floored at candidates.length so a
        // requirement matched before this column existed (defaults to 0)
        // never reports fewer matched than it has actual candidates.
        totalMatched: Math.max(requirement.matched_pool_size ?? 0, paged.total),
      }),
      { status: 200, headers },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    slog.error("employer-requirement-detail GET threw", { code: "employer_requirement_detail_unexpected_error", error: msg.slice(0, 200), userId: auth.userId, requirementId });
    return new Response(JSON.stringify({ error: "Failed to load requirement" }), { status: 500, headers });
  }
}

/** Rejects every still-active match on an archived requirement and returns
 *  what it changed. Reads the rows first and writes by id, so the returned
 *  record is exactly the set that was rejected even if a row moves between
 *  the read and the write (the write re-checks the active statuses). A failure
 *  is logged and yields an empty record: the archive itself already succeeded. */
async function rejectRemainingMatches(requirementId: string, userId: string): Promise<RejectedMatchRecord[]> {
  const activeStatuses = RESTORABLE_CANDIDATE_STATUSES.map((s) => `"${s}"`).join(",");
  // Also catches rows with a null candidate_status (legacy rows from before
  // the column's not-null default was added): those are still "active"
  // candidates an employer expects reject_remaining to cover.
  const activeFilter = `or=(candidate_status.in.(${activeStatuses}),candidate_status.is.null)`;
  const readRes = await fetch(
    `${SUPABASE_URL}/rest/v1/requirement_matches?requirement_id=eq.${encodeURIComponent(requirementId)}&${activeFilter}&select=id,candidate_status&limit=5000`,
    { headers: serviceHeaders() },
  ).catch(() => null);
  const rows = readRes?.ok ? ((await readRes.json().catch(() => null)) as Array<{ id: string; candidate_status: string | null }> | null) : null;
  if (!Array.isArray(rows)) {
    slog.error("employer-requirement-detail archive bulk-reject read failed", { code: "employer_requirement_archive_bulk_reject_failed", httpStatus: readRes?.status ?? 0, userId, requirementId });
    return [];
  }
  const done: RejectedMatchRecord[] = [];
  const byId = new Map(rows.map((r) => [r.id, previousStatusOf(r.candidate_status)]));
  for (const batch of chunk(Array.from(byId.keys()), 100)) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/requirement_matches?requirement_id=eq.${encodeURIComponent(requirementId)}&id=in.(${inList(batch)})&${activeFilter}`,
      {
        method: "PATCH",
        headers: { ...serviceHeaders(), "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({ candidate_status: "rejected", candidate_status_updated_at: new Date().toISOString() }),
      },
    ).catch(() => null);
    if (!res?.ok) {
      const t = await res?.text().catch(() => "");
      slog.error("employer-requirement-detail archive bulk-reject failed", { code: "employer_requirement_archive_bulk_reject_failed", httpStatus: res?.status ?? 0, body: (t ?? "").slice(0, 200), userId, requirementId });
      continue;
    }
    // Prefer the rows the write reports; fall back to the batch when it
    // reports none (return=minimal proxies), since the filter matched.
    const returned = (await res.json().catch(() => null)) as Array<{ id: string }> | null;
    const ids = Array.isArray(returned) && returned.length > 0 ? returned.map((r) => r.id) : batch;
    for (const id of ids) {
      const previousStatus = byId.get(id);
      if (previousStatus) done.push({ id, previousStatus });
    }
  }
  return done;
}

/** Undo for "archive and reject remaining": puts the recorded matches back to
 *  the status they held. Scoped to this employer's requirement and to rows
 *  still "rejected", so it can never overwrite a status set since. */
async function handleRestoreAction(requirementId: string, userId: string, rawMatches: unknown, headers: Record<string, string>): Promise<Response> {
  const matches = parseRestoreMatches(rawMatches);
  if (!matches) return new Response(JSON.stringify({ error: "Invalid matches to restore" }), { status: 400, headers });
  try {
    const existingRes = await fetch(
      `${SUPABASE_URL}/rest/v1/employer_requirements?id=eq.${encodeURIComponent(requirementId)}&employer_id=eq.${encodeURIComponent(userId)}&select=id,${EMPLOYER_EMBED}`,
      { headers: serviceHeaders() },
    );
    const rows = (await existingRes.json().catch(() => [])) as Array<{ id: string; employers?: EmployerEmbed }>;
    if (!existingRes.ok || !rows[0]) return new Response(JSON.stringify({ error: "Requirement not found" }), { status: 404, headers });
    if (isSuspendedEmployer(rows[0].employers)) return denyResponse(suspendedAllowance(), headers);

    const byStatus = new Map<string, string[]>();
    for (const m of matches) byStatus.set(m.previousStatus, [...(byStatus.get(m.previousStatus) ?? []), m.id]);
    let restored = 0;
    for (const [status, ids] of byStatus) {
      for (const batch of chunk(ids, 100)) {
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/requirement_matches?requirement_id=eq.${encodeURIComponent(requirementId)}&id=in.(${inList(batch)})&candidate_status=eq.rejected`,
          {
            method: "PATCH",
            headers: { ...serviceHeaders(), "Content-Type": "application/json", Prefer: "return=representation" },
            body: JSON.stringify({ candidate_status: status, candidate_status_updated_at: new Date().toISOString() }),
          },
        );
        if (!res.ok) {
          slog.error("employer-requirement-detail restore failed", { code: "employer_requirement_restore_failed", httpStatus: res.status, userId, requirementId });
          return new Response(JSON.stringify({ error: "Failed to restore candidates" }), { status: 500, headers });
        }
        const changed = (await res.json().catch(() => [])) as unknown[];
        restored += Array.isArray(changed) ? changed.length : 0;
      }
    }
    await logRequirementActivity(requirementId, userId, "updated");
    return new Response(JSON.stringify({ id: requirementId, restored }), { status: 200, headers });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    slog.error("employer-requirement-detail restore threw", { code: "employer_requirement_restore_unexpected_error", error: msg.slice(0, 200), userId, requirementId });
    return new Response(JSON.stringify({ error: "Failed to restore candidates" }), { status: 500, headers });
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
      `${SUPABASE_URL}/rest/v1/employer_requirements?id=eq.${encodeURIComponent(requirementId)}&employer_id=eq.${encodeURIComponent(userId)}&select=id,status,title,location,description,skills,custom_skill_sets,work_mode,experience_min,experience_max,min_readiness_band,min_star_completeness,employment_type,duration_weeks,hours_per_week,${EMPLOYER_EMBED}`,
      { headers: serviceHeaders() },
    );
    const existingRows = (await existingRes.json().catch(() => [])) as Array<{ id: string; employers?: EmployerEmbed; status: string; title: string; location: string; description: string | null; skills: string[] | null; custom_skill_sets: string[] | null; work_mode: string | null; experience_min: number | null; experience_max: number | null; min_readiness_band: string | null; min_star_completeness: number | null; employment_type: string | null; duration_weeks: number | null; hours_per_week: number | null }>;
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
    // Archiving is always allowed (it only reduces exposure, even for a
    // suspended employer). Reopening re-enters matching, so it is gated like a
    // create: not suspended, a free open-requirement slot, and rematch budget —
    // checked before anything is written.
    if (action === "reopen") {
      const allowance = await checkEmployerAllowance({
        supabaseUrl: SUPABASE_URL, headers: serviceHeaders(), employerId: userId, employer: current.employers,
        needsOpenSlot: true, needsRematch: true,
      });
      if (!allowance.ok) return denyResponse(allowance, headers);
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
    // The read above can be stale by the time we write: two quick archive or
    // reopen clicks, or an archive racing a reopen, would both pass it. The
    // status filter makes the transition itself the guard; zero rows back
    // means someone else already made it.
    const statusGuard = action === "archive" ? "status=neq.closed" : "status=eq.closed";
    const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/employer_requirements?id=eq.${encodeURIComponent(requirementId)}&employer_id=eq.${encodeURIComponent(userId)}&${statusGuard}`, {
      method: "PATCH",
      headers: { ...serviceHeaders(), "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(patchBody),
    });
    if (!patchRes.ok) {
      const t = await patchRes.text().catch(() => "");
      slog.error("employer-requirement-detail status action failed", { code: "employer_requirement_status_action_failed", httpStatus: patchRes.status, body: t.slice(0, 200), userId, requirementId, action });
      return new Response(JSON.stringify({ error: "Failed to update requirement" }), { status: 500, headers });
    }
    const updated = (await patchRes.json().catch(() => [])) as Array<{ id: string; status: string }>;
    if (!Array.isArray(updated) || updated.length === 0) {
      return new Response(
        JSON.stringify({ error: action === "archive" ? "Already archived" : "Requirement isn't archived" }),
        { status: 409, headers },
      );
    }
    await logRequirementActivity(requirementId, userId, action === "archive" ? "archived" : "reopened");

    // Recorded so the client can offer undo: the ids and the status each row
    // held, taken before the bulk write so the record is what was replaced.
    let rejectedMatches: RejectedMatchRecord[] | undefined;
    if (action === "archive" && archiveDisposition === "reject_remaining") {
      rejectedMatches = await rejectRemainingMatches(requirementId, userId);
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
          customSkills: current.custom_skill_sets ?? [],
          workMode: current.work_mode,
        },
        userId,
      );
    }

    return new Response(
      JSON.stringify({
        id: requirementId,
        status: finalStatus,
        ...(rejectedMatches ? { rejectedMatchIds: rejectedMatches.map((m) => m.id), rejectedMatches } : {}),
      }),
      { status: 200, headers },
    );
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
      `${SUPABASE_URL}/rest/v1/employer_requirements?id=eq.${encodeURIComponent(requirementId)}&employer_id=eq.${encodeURIComponent(userId)}&select=id,stage,status,employers(suspended_at)`,
      { headers: serviceHeaders() },
    );
    const existingRows = (await existingRes.json().catch(() => [])) as Array<{ id: string; stage: RequirementStage; status: string; employers?: EmployerEmbed }>;
    if (!existingRes.ok || !existingRows[0]) {
      return new Response(JSON.stringify({ error: "Requirement not found" }), { status: 404, headers });
    }
    // A suspended employer is read-only: no pipeline moves either.
    if (isSuspendedEmployer(existingRows[0].employers)) return denyResponse(suspendedAllowance(), headers);
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

    // Guarded on the stage and status we validated against: an archive, or a
    // matching run that auto-advanced the stage, between the read above and
    // this write must not be overwritten by a move that was legal a moment ago.
    const patchRes = await fetch(
      `${SUPABASE_URL}/rest/v1/employer_requirements?id=eq.${encodeURIComponent(requirementId)}&employer_id=eq.${encodeURIComponent(userId)}&stage=eq.${encodeURIComponent(currentStage)}&status=neq.closed`,
      {
        method: "PATCH",
        headers: { ...serviceHeaders(), "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({ stage }),
      },
    );
    if (!patchRes.ok) {
      const t = await patchRes.text().catch(() => "");
      slog.error("employer-requirement-detail stage action failed", { code: "employer_requirement_stage_action_failed", httpStatus: patchRes.status, body: t.slice(0, 200), userId, requirementId, stage });
      return new Response(JSON.stringify({ error: "Failed to update requirement" }), { status: 500, headers });
    }
    const updated = (await patchRes.json().catch(() => [])) as Array<{ id: string; stage: string }>;
    if (!Array.isArray(updated) || updated.length === 0) {
      return new Response(
        JSON.stringify({ error: "This requirement changed while you were updating it. Refresh and try again." }),
        { status: 409, headers },
      );
    }
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
    matches?: unknown;
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

  if (body.action === "restore") {
    return handleRestoreAction(requirementId, userId, body.matches, headers);
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
      `${SUPABASE_URL}/rest/v1/employer_requirements?id=eq.${encodeURIComponent(requirementId)}&employer_id=eq.${encodeURIComponent(userId)}&select=*,${EMPLOYER_EMBED}`,
      { headers: serviceHeaders() },
    );
    const existingRows = (await existingRes.json().catch(() => [])) as Array<RequirementRow & { description: string | null; employers?: EmployerEmbed }>;
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
    const stageFrozen = existing.stage === "interviewing" || existing.stage === "hired";
    // Re-running matching also costs rematch budget and flips the status to
    // "generating", so only do it when the edit changed something matching
    // reads (or the last run never finished). A due-date extension, a perk,
    // a budget fix or a department rename leaves every score as it was.
    const needsRematch = !stageFrozen && requirementNeedsRematch(
      {
        title: existing.title, description: existing.description, skills: existing.skills,
        customSkillSets: existing.custom_skill_sets, locations: existing.locations, workMode: existing.work_mode,
        experienceMin: existing.experience_min, experienceMax: existing.experience_max,
        minReadinessBand: existing.min_readiness_band, minStarCompleteness: existing.min_star_completeness,
        employmentType: existing.employment_type,
        durationWeeks: existing.duration_weeks, hoursPerWeek: existing.hours_per_week,
      },
      {
        title, description, skills, customSkillSets, locations, workMode, experienceMin, experienceMax,
        minReadinessBand, minStarCompleteness, employmentType, durationWeeks, hoursPerWeek,
      },
      existing.status,
    );

    if (!isValidRequirementInput(title, locations, description)) {
      return new Response(JSON.stringify({ error: `title, at least one location, and a role description (min ${MIN_DESCRIPTION_LENGTH} characters) are required` }), { status: 400, headers });
    }
    if (!isValidRange(experienceMin, experienceMax)) {
      return new Response(JSON.stringify({ error: "Minimum experience can't be greater than maximum experience" }), { status: 400, headers });
    }
    if (!isValidRange(budgetMin, budgetMax)) {
      return new Response(JSON.stringify({ error: "Minimum budget can't be greater than maximum budget" }), { status: 400, headers });
    }
    if (dueDate !== existing.due_date && !isFutureDueDate(dueDate)) {
      return new Response(JSON.stringify({ error: "Due date can't be in the past" }), { status: 400, headers });
    }

    // Gates run before any write. Suspended = read-only even for a no-rematch
    // edit; otherwise an edit that re-runs matching spends rematch budget.
    if (isSuspendedEmployer(existing.employers)) return denyResponse(suspendedAllowance(), headers);
    if (needsRematch) {
      const allowance = await checkEmployerAllowance({
        supabaseUrl: SUPABASE_URL, headers: serviceHeaders(), employerId: userId, employer: existing.employers,
        needsOpenSlot: false, needsRematch: true,
      });
      if (!allowance.ok) return denyResponse(allowance, headers);
    }

    // status=neq.closed: an archive that landed since the read above wins
    // instead of being overwritten by this edit.
    const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/employer_requirements?id=eq.${encodeURIComponent(requirementId)}&employer_id=eq.${encodeURIComponent(userId)}&status=neq.closed`, {
      method: "PATCH",
      headers: { ...serviceHeaders(), "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({
        title, location, department, notice_period_pref: noticePeriodPref, description,
        ...(needsRematch ? { status: "generating" } : {}),
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
    if (!requirement) {
      return new Response(JSON.stringify({ error: "Closed requirements can't be edited" }), { status: 409, headers });
    }

    const finalStatus = needsRematch
      ? await runMatching(
          requirementId,
          {
            title, location, description, skills, experienceMin, experienceMax, minReadinessBand, minStarCompleteness,
            employmentType, durationWeeks, hoursPerWeek, customSkills: customSkillSets, workMode,
          },
          userId,
        )
      : existing.status;
    await logRequirementActivity(requirementId, userId, "updated", needsRematch ? undefined : NO_REMATCH_DETAIL);

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
