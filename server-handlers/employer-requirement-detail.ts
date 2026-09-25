/* Vercel Edge Function — Employer Requirement Detail
 *
 * GET /api/employer-requirement-detail?id=<requirementId>
 *
 * Returns one requirement owned by the caller plus its scored candidate
 * shortlist. Contact info (email/phone) is only included once the match's
 * `unlocked` DB flag is set (paid via employer-create-unlock-order.ts +
 * employer-verify-unlock-payment.ts) AND the candidate still has
 * `is_discoverable_to_employers = true` at read time — a candidate who
 * revokes discoverability after being unlocked stops surfacing contact
 * info immediately, even though the employer already paid for that match.
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
 */

export const config = { runtime: "edge" };

import { withAuthAndRateLimit, corsHeaders, withRequestId, slog } from "./_shared";
import { extractResumeLocation, explainMatch } from "./_requirement-match-helpers";
import { extractResumeDetail } from "./_resume-detail-helpers";
import { runMatching } from "./employer-requirements";
import {
  asBoundedString,
  asBoundedStringArray,
  asBoundedExperience,
  asBoundedDueDate,
  asBoundedBudget,
  asBoundedOpenPositions,
  asBoundedWorkMode,
  isValidRequirementInput,
  type RequirementRow,
} from "./_employer-requirements-helpers";

declare const process: { env: Record<string, string | undefined> };
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function serviceHeaders(): Record<string, string> {
  return { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` };
}

function extractSkills(resumeData: unknown): string[] {
  if (!resumeData || typeof resumeData !== "object") return [];
  const skills = (resumeData as Record<string, unknown>).skills;
  return Array.isArray(skills) ? skills.filter((s): s is string => typeof s === "string").slice(0, 8) : [];
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
      `${SUPABASE_URL}/rest/v1/employer_requirements?id=eq.${encodeURIComponent(requirementId)}&employer_id=eq.${encodeURIComponent(auth.userId)}&select=id,title,location,notice_period_pref,description,status,experience_min,experience_max,due_date,budget_min,budget_max,locations,open_positions,work_mode,skills,responsibilities,nice_to_have,preferred_industry,preferred_colleges,target_companies,perks_and_benefits,created_at`,
      { headers: serviceHeaders() },
    );
    if (!reqRes.ok) throw new Error(`requirement read failed: ${reqRes.status}`);
    const reqRows = (await reqRes.json().catch(() => [])) as Array<{
      id: string; title: string; location: string; notice_period_pref: string; description: string | null; status: string;
      experience_min: number | null; experience_max: number | null; due_date: string | null;
      budget_min: number | null; budget_max: number | null;
      locations: string[] | null; open_positions: number | null; work_mode: string | null; skills: string[] | null;
      responsibilities: string | null; nice_to_have: string | null; preferred_industry: string | null;
      preferred_colleges: string[] | null; target_companies: string[] | null; perks_and_benefits: string[] | null;
      created_at: string;
    }>;
    const requirement = reqRows[0];
    if (!requirement) {
      return new Response(JSON.stringify({ error: "Requirement not found" }), { status: 404, headers });
    }

    const matchesRes = await fetch(
      `${SUPABASE_URL}/rest/v1/requirement_matches?requirement_id=eq.${encodeURIComponent(requirementId)}&select=id,candidate_user_id,match_score,roster_score,unlocked,unlocked_at&order=match_score.desc`,
      { headers: serviceHeaders() },
    );
    if (!matchesRes.ok) throw new Error(`matches read failed: ${matchesRes.status}`);
    const matches = (await matchesRes.json().catch(() => [])) as Array<{
      id: string; candidate_user_id: string; match_score: number; roster_score: number; unlocked: boolean; unlocked_at: string | null;
    }>;

    const candidateIds = matches.map((m) => m.candidate_user_id);
    const profileById = new Map<string, { name: string; email: string; target_role: string; resume_data: unknown; practice_timestamps: string[]; is_discoverable_to_employers: boolean }>();
    if (candidateIds.length > 0) {
      const idParam = candidateIds.map((id) => encodeURIComponent(id)).join(",");
      const profilesRes = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?id=in.(${idParam})&select=id,name,email,target_role,resume_data,practice_timestamps,is_discoverable_to_employers`,
        { headers: serviceHeaders() },
      );
      if (profilesRes.ok) {
        const rows = (await profilesRes.json().catch(() => [])) as Array<{
          id: string; name: string; email: string; target_role: string; resume_data: unknown; practice_timestamps: string[]; is_discoverable_to_employers: boolean;
        }>;
        for (const r of rows) profileById.set(r.id, r);
      }
    }

    const sessionCounts = new Map<string, number>();
    if (candidateIds.length > 0) {
      const idParam = candidateIds.map((id) => encodeURIComponent(id)).join(",");
      const sessionsRes = await fetch(
        `${SUPABASE_URL}/rest/v1/sessions?user_id=in.(${idParam})&select=user_id`,
        { headers: serviceHeaders() },
      );
      if (sessionsRes.ok) {
        const rows = (await sessionsRes.json().catch(() => [])) as Array<{ user_id: string }>;
        for (const r of rows) sessionCounts.set(r.user_id, (sessionCounts.get(r.user_id) || 0) + 1);
      }
    }

    const candidates = matches.map((m) => {
      const profile = profileById.get(m.candidate_user_id);
      const timestamps = Array.isArray(profile?.practice_timestamps) ? profile!.practice_timestamps : [];
      const lastActive = timestamps.length ? timestamps[timestamps.length - 1] : null;
      const lastActiveDaysAgo = lastActive ? Math.max(0, Math.round((Date.now() - new Date(lastActive).getTime()) / 86_400_000)) : -1;
      const resumeDetail = extractResumeDetail(profile?.resume_data);
      const matchBreakdown = explainMatch(
        { target_role: profile?.target_role ?? null, resume_data: profile?.resume_data ?? null },
        { title: requirement.title, location: requirement.location, description: requirement.description || "" },
      );

      const discoverable = profile?.is_discoverable_to_employers === true;
      const unlocked = m.unlocked && discoverable;

      return {
        id: m.id,
        name: profile?.name || "Candidate",
        targetRole: profile?.target_role || "Not specified",
        city: extractResumeLocation(profile?.resume_data) || "Not specified",
        matchScore: m.match_score,
        rosterScore: m.roster_score,
        matchBreakdown,
        sessionsCompleted: sessionCounts.get(m.candidate_user_id) || 0,
        lastActiveDaysAgo,
        skills: extractSkills(profile?.resume_data),
        unlocked,
        contact: unlocked && profile ? { email: profile.email, phone: resumeDetail.phone || undefined } : undefined,
        resume: resumeDetail,
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
        experienceMin: requirement.experience_min,
        experienceMax: requirement.experience_max,
        dueDate: requirement.due_date ? requirement.due_date.slice(0, 10) : null,
        budgetMin: requirement.budget_min,
        budgetMax: requirement.budget_max,
        locations: requirement.locations ?? [],
        openPositions: requirement.open_positions,
        workMode: requirement.work_mode,
        skills: requirement.skills ?? [],
        responsibilities: requirement.responsibilities || "",
        niceToHave: requirement.nice_to_have || "",
        preferredIndustry: requirement.preferred_industry || "",
        preferredColleges: requirement.preferred_colleges ?? [],
        targetCompanies: requirement.target_companies ?? [],
        perksAndBenefits: requirement.perks_and_benefits ?? [],
        createdAt: requirement.created_at.slice(0, 10),
        candidates,
      }),
      { status: 200, headers },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    slog.error("employer-requirement-detail GET threw", { code: "employer_requirement_detail_unexpected_error", error: msg.slice(0, 200), userId: auth.userId, requirementId });
    return new Response(JSON.stringify({ error: "Failed to load requirement" }), { status: 500, headers });
  }
}

async function handlePatch(req: Request, requirementId: string, userId: string, headers: Record<string, string>): Promise<Response> {
  let body: {
    title?: unknown; noticePeriodPref?: unknown; description?: unknown;
    experienceMin?: unknown; experienceMax?: unknown; dueDate?: unknown;
    budgetMin?: unknown; budgetMax?: unknown;
    locations?: unknown; openPositions?: unknown; workMode?: unknown; skills?: unknown;
    responsibilities?: unknown; niceToHave?: unknown; preferredIndustry?: unknown;
    preferredColleges?: unknown; targetCompanies?: unknown; perksAndBenefits?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers });
  }

  const title = asBoundedString(body.title, 200);
  const noticePeriodPref = asBoundedString(body.noticePeriodPref, 60) || "Any";
  const description = asBoundedString(body.description, 5000);
  const experienceMin = asBoundedExperience(body.experienceMin);
  const experienceMax = asBoundedExperience(body.experienceMax);
  const dueDate = asBoundedDueDate(body.dueDate);
  const budgetMin = asBoundedBudget(body.budgetMin);
  const budgetMax = asBoundedBudget(body.budgetMax);
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
  const location = locations.join(", ");

  if (!isValidRequirementInput(title, locations, description)) {
    return new Response(JSON.stringify({ error: "title, at least one location, and a role description (min 20 characters) are required" }), { status: 400, headers });
  }

  try {
    const existingRes = await fetch(
      `${SUPABASE_URL}/rest/v1/employer_requirements?id=eq.${encodeURIComponent(requirementId)}&employer_id=eq.${encodeURIComponent(userId)}&select=id,status`,
      { headers: serviceHeaders() },
    );
    const existingRows = (await existingRes.json().catch(() => [])) as Array<{ id: string; status: string }>;
    if (!existingRes.ok || !existingRows[0]) {
      return new Response(JSON.stringify({ error: "Requirement not found" }), { status: 404, headers });
    }
    if (existingRows[0].status === "closed") {
      return new Response(JSON.stringify({ error: "Closed requirements can't be edited" }), { status: 409, headers });
    }

    const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/employer_requirements?id=eq.${encodeURIComponent(requirementId)}`, {
      method: "PATCH",
      headers: { ...serviceHeaders(), "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({
        title, location, notice_period_pref: noticePeriodPref, description, status: "generating",
        experience_min: experienceMin, experience_max: experienceMax, due_date: dueDate,
        budget_min: budgetMin, budget_max: budgetMax,
        locations, open_positions: openPositions, work_mode: workMode, skills,
        responsibilities, nice_to_have: niceToHave, preferred_industry: preferredIndustry,
        preferred_colleges: preferredColleges, target_companies: targetCompanies,
        perks_and_benefits: perksAndBenefits,
      }),
    });
    if (!patchRes.ok) {
      const t = await patchRes.text().catch(() => "");
      slog.error("employer-requirement-detail PATCH failed", { code: "employer_requirement_patch_failed", httpStatus: patchRes.status, body: t.slice(0, 200), userId, requirementId });
      return new Response(JSON.stringify({ error: "Failed to update requirement" }), { status: 500, headers });
    }
    const updated = (await patchRes.json()) as RequirementRow[];
    const requirement = updated[0];

    const finalStatus = await runMatching(requirementId, { title, location, description }, userId);

    return new Response(
      JSON.stringify({
        id: requirement.id,
        title: requirement.title,
        location: requirement.location,
        noticePeriodPref: requirement.notice_period_pref,
        status: finalStatus,
        experienceMin: requirement.experience_min ?? null,
        experienceMax: requirement.experience_max ?? null,
        dueDate: requirement.due_date ?? null,
        budgetMin: requirement.budget_min ?? null,
        budgetMax: requirement.budget_max ?? null,
        locations: requirement.locations ?? [],
        openPositions: requirement.open_positions ?? null,
        workMode: requirement.work_mode ?? null,
        skills: requirement.skills ?? [],
        responsibilities: requirement.responsibilities ?? "",
        niceToHave: requirement.nice_to_have ?? "",
        preferredIndustry: requirement.preferred_industry ?? "",
        preferredColleges: requirement.preferred_colleges ?? [],
        targetCompanies: requirement.target_companies ?? [],
        perksAndBenefits: requirement.perks_and_benefits ?? [],
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
