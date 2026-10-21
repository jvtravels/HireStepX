/* Vercel Edge Function — Candidate Hiring Activity
 *
 * GET /api/candidate-hiring-activity → lets a candidate see how many open
 * requirements they've been matched against, how many employers have
 * unlocked their contact details, and a short recent-activity list (role,
 * company, location, contacted or not).
 *
 * Reads via the service role (bypasses RLS, same pattern as employer-profile.ts
 * and credit-balance.ts) so a single PostgREST call can embed the parent
 * employer_requirements + employers rows through their foreign keys.
 */

export const config = { runtime: "edge" };

import { withAuthAndRateLimit, corsHeaders, withRequestId, slog } from "./_shared";
import { describeMatch, describeMatchFactors } from "./_requirement-match-helpers";
import { asBoundedSalaryType } from "./_employer-requirements-helpers";
import { isSuspended } from "./_employer-trust";
import { maskLockedPostingText, requestHeadline, type CandidateRequestRow } from "./_candidate-request-helpers";

declare const process: { env: Record<string, string | undefined> };
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const LOGO_BUCKET = "employer-logos";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function serviceHeaders(): Record<string, string> {
  return { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` };
}

// Mirrors employer-profile.ts's logoUrl() — logo_path is a storage-relative
// path, not a servable URL, so the Jobs tab's <img src> needs it turned into
// a full public-bucket URL exactly like the employer's own profile screen does.
// Candidates must not learn who the employer is until the employer has
// unlocked them (contacted) — otherwise they could bypass the platform and
// reach out directly. Redacted here, server-side, so the identity never
// reaches the browser for a merely "Matched" row.
export const CONFIDENTIAL_COMPANY_NAME = "Confidential company";

function logoUrl(logoPath: string | null): string | null {
  return logoPath ? `${SUPABASE_URL}/storage/v1/object/public/${LOGO_BUCKET}/${logoPath}` : null;
}

interface MatchRow {
  id: string;
  requirement_id: string | null;
  candidate_status: string | null;
  candidate_response: string | null;
  interview_scheduled_at: string | null;
  unlocked: boolean;
  unlocked_at: string | null;
  match_score: number;
  created_at: string;
  employer_requirements: {
    title: string;
    location: string;
    locations: string[] | null;
    status: string;
    work_mode: string | null;
    salary_type: string | null;
    budget_min: number | null;
    budget_max: number | null;
    experience_min: number | null;
    experience_max: number | null;
    skills: string[] | null;
    notice_period_pref: string | null;
    open_positions: number | null;
    description: string | null;
    responsibilities: string | null;
    nice_to_have: string | null;
    perks_and_benefits: string[] | null;
    preferred_industry: string | null;
    due_date: string | null;
    employment_type: string | null;
    department: string | null;
    duration_weeks: number | null;
    hours_per_week: number | null;
    availability: string | null;
    preferred_domain: string | null;
    portfolio_required: boolean | null;
    created_at: string | null;
    employers: { company_name: string; logo_path: string | null; website: string | null; suspended_at?: string | null } | null;
  } | null;
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
    endpoint: "candidate-hiring-activity",
    ipLimit: 30,
    userLimit: 20,
    maxBytes: 0,
    checkQuota: false,
    allowGet: true,
  });
  if (pre instanceof Response) return pre;
  const { auth } = pre;
  const headers = { ...pre.headers, ...corsHeaders(req, { allowGet: true }) };

  if (!auth.userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
  }

  try {
    // Independent reads — fetch concurrently so the endpoint costs one
    // database round trip of latency instead of two.
    const [profileRes, matchesRes] = await Promise.all([
      fetch(
        `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(auth.userId)}&select=target_role,resume_data`,
        { headers: serviceHeaders() },
      ),
      fetch(
        `${SUPABASE_URL}/rest/v1/requirement_matches?candidate_user_id=eq.${encodeURIComponent(auth.userId)}` +
          `&select=id,requirement_id,unlocked,unlocked_at,match_score,created_at,candidate_status,candidate_response,interview_scheduled_at,` +
          `employer_requirements(title,location,locations,status,work_mode,salary_type,budget_min,budget_max,experience_min,experience_max,skills,` +
          `notice_period_pref,open_positions,description,responsibilities,nice_to_have,perks_and_benefits,preferred_industry,due_date,employment_type,` +
          `department,duration_weeks,hours_per_week,availability,preferred_domain,portfolio_required,created_at,` +
          `employers(company_name,logo_path,website,suspended_at))` +
          `&order=created_at.desc`,
        { headers: serviceHeaders() },
      ),
    ]);
    if (!profileRes.ok) throw new Error(`profile read failed: ${profileRes.status}`);
    if (!matchesRes.ok) throw new Error(`matches read failed: ${matchesRes.status}`);
    const [profileRows, allMatches] = (await Promise.all([
      profileRes.json().catch(() => []),
      matchesRes.json().catch(() => []),
    ])) as [Array<{ target_role: string | null; resume_data: unknown }>, MatchRow[]];
    // Suspended and deletion-pending employers aren't hiring: drop them from the
    // counts and the list so a candidate never sees (or is shown the identity
    // of) an account that was removed. Their conversation history stays
    // readable through the messages endpoints.
    const matches = allMatches.filter((m) => !isSuspended(m.employer_requirements?.employers));
    const candidateProfile = { target_role: profileRows[0]?.target_role ?? null, resume_data: profileRows[0]?.resume_data ?? null };

    // A closed/failed requirement is no longer actually hiring — don't count or
    // list it as an active match. An unlock that already happened is a real
    // historical event (the employer has the contact info regardless), so it
    // still counts even if the requirement closes afterward.
    const isClosed = (m: MatchRow) => m.employer_requirements?.status === "closed" || m.employer_requirements?.status === "failed";
    const activeMatches = matches.filter((m) => m.unlocked || !isClosed(m));

    const shortlistedCount = activeMatches.length;
    const unlockedCount = matches.filter((m) => m.unlocked).length;

    // The dashboard widget only ever needs a short teaser (the Employer
    // Interest grid shows 4 cards); the dedicated Jobs tab wants the full
    // list plus the richer per-role fields. Both read from the same match
    // set — cap only what's returned as `recent`.
    const url = new URL(req.url);
    const full = url.searchParams.get("full") === "1";
    // A deep link (email, notification) can point at a role that has since closed;
    // `match` lets the detail page ask for that one row so it can say "closed"
    // instead of "not found". Counts and the list view stay unchanged.
    const wantedId = url.searchParams.get("match");
    const wantedClosed = full && wantedId && UUID_RE.test(wantedId)
      ? matches.find((m) => m.id === wantedId && !m.unlocked && isClosed(m))
      : undefined;
    const limited = full ? (wantedClosed ? [...activeMatches, wantedClosed] : activeMatches) : activeMatches.slice(0, 4);

    // Optional: the table arrives with migration 0040, so any failure just means "no requests".
    const pendingByMatch = new Map<string, CandidateRequestRow[]>();
    if (limited.length > 0) {
      const reqRes = await fetch(
        `${SUPABASE_URL}/rest/v1/candidate_requests?candidate_user_id=eq.${encodeURIComponent(auth.userId)}&status=eq.pending` +
          `&select=id,match_id,kind,topic,fields,note,status,response_note,created_at,resolved_at&order=created_at.desc&limit=200`,
        { headers: serviceHeaders(), signal: AbortSignal.timeout(4000) },
      ).catch(() => null);
      if (reqRes && reqRes.ok) {
        for (const r of (await reqRes.json().catch(() => [])) as CandidateRequestRow[]) {
          pendingByMatch.set(r.match_id, [...(pendingByMatch.get(r.match_id) ?? []), r]);
        }
      }
    }

    const recent = limited.map((m) => {
      const req = m.employer_requirements;
      const skills = req?.skills || [];
      const locations = req?.locations?.length ? req.locations : req?.location ? [req.location] : [];
      const mask = (v: string | null | undefined) => (m.unlocked ? v ?? null : maskLockedPostingText(v, req?.employers));
      const description = mask(req?.description);
      return {
        id: m.id,
        roleTitle: mask(req?.title) || "Open role",
        companyName: m.unlocked ? req?.employers?.company_name || "A HireStepX employer" : CONFIDENTIAL_COMPANY_NAME,
        companyLogoPath: m.unlocked ? logoUrl(req?.employers?.logo_path || null) : null,
        companyWebsite: m.unlocked ? req?.employers?.website || null : null,
        location: locations.join(" / "),
        workMode: req?.work_mode || null,
        salaryType: asBoundedSalaryType(req?.salary_type),
        budgetMin: req?.budget_min ?? null,
        budgetMax: req?.budget_max ?? null,
        experienceMin: req?.experience_min ?? null,
        experienceMax: req?.experience_max ?? null,
        // The dashboard teaser trims to 6 chips to stay compact; the full
        // Jobs tab shows every skill the employer listed.
        skills: full ? skills : skills.slice(0, 6),
        noticePeriodPref: req?.notice_period_pref || null,
        openPositions: req?.open_positions ?? null,
        description: description || null,
        responsibilities: mask(req?.responsibilities) || null,
        niceToHave: mask(req?.nice_to_have) || null,
        perksAndBenefits: (req?.perks_and_benefits || []).map((x) => mask(x) ?? ""),
        preferredIndustry: req?.preferred_industry || null,
        department: mask(req?.department) || null,
        durationWeeks: req?.duration_weeks ?? null,
        hoursPerWeek: req?.hours_per_week ?? null,
        availability: req?.availability || null,
        preferredDomain: mask(req?.preferred_domain) || null,
        portfolioPreferred: !!req?.portfolio_required,
        postedAt: req?.created_at || null,
        dueDate: req?.due_date || null,
        status: req?.status || null,
        employmentType: req?.employment_type || null,
        matchScore: m.match_score ?? 0,
        matchReason: req
          ? describeMatch(candidateProfile, { title: mask(req.title) || req.title, location: req.location, description: description || "" }, skills)
          : "Matched on your overall profile and practice history.",
        matchFactors: req
          ? describeMatchFactors(candidateProfile, {
              title: mask(req.title) || req.title, location: req.location, description: description || "",
              skills, experienceMin: req.experience_min, experienceMax: req.experience_max,
            }, skills)
          : null,
        unlocked: m.unlocked,
        requirementId: m.requirement_id,
        candidateStatus: m.candidate_status,
        candidateResponse: m.candidate_response,
        interviewScheduledAt: m.interview_scheduled_at,
        // Full ISO timestamp — callers that only need day-granularity (daysAgo)
        // still work fine off the full string; the dashboard teaser's
        // hour-granular relative time (hoursOrDaysAgo) needs the precision
        // a date-only slice throws away.
        matchedAt: m.created_at,
        unlockedAt: m.unlocked_at,
        requests: (pendingByMatch.get(m.id) ?? []).map((r) => ({
          id: r.id,
          kind: r.kind,
          headline: requestHeadline(r),
          topic: r.topic,
          fields: r.fields,
          note: r.note,
          createdAt: r.created_at,
        })),
      };
    });

    return new Response(
      JSON.stringify({ shortlistedCount, unlockedCount, recent }),
      { status: 200, headers },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    slog.error("candidate-hiring-activity GET threw", { code: "candidate_hiring_activity_get_unexpected_error", error: msg.slice(0, 200), userId: auth.userId });
    return new Response(JSON.stringify({ error: "Failed to load hiring activity" }), { status: 500, headers });
  }
}
