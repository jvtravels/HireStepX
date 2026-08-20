/* Vercel Edge Function — Candidate Hiring Activity
 *
 * GET /api/candidate-hiring-activity → lets a candidate see the concrete
 * effect of opting into the employer talent roster (Settings → "Visible to
 * employers"): how many open requirements they've been matched against, how
 * many employers have unlocked their contact details, and a short recent-
 * activity list (role, company, location, contacted or not).
 *
 * Reads via the service role (bypasses RLS, same pattern as employer-profile.ts
 * and credit-balance.ts) so a single PostgREST call can embed the parent
 * employer_requirements + employers rows through their foreign keys.
 *
 * Returns { discoverable: false } without querying matches at all when the
 * candidate hasn't opted in — there's nothing to show, and no reason to let
 * a toggled-off candidate probe for match data.
 */

export const config = { runtime: "edge" };

import { withAuthAndRateLimit, corsHeaders, withRequestId, slog } from "./_shared";

declare const process: { env: Record<string, string | undefined> };
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function serviceHeaders(): Record<string, string> {
  return { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` };
}

interface MatchRow {
  id: string;
  unlocked: boolean;
  unlocked_at: string | null;
  match_score: number;
  created_at: string;
  employer_requirements: {
    title: string;
    location: string;
    status: string;
    work_mode: string | null;
    budget_min: number | null;
    budget_max: number | null;
    experience_min: number | null;
    experience_max: number | null;
    skills: string[] | null;
    notice_period_pref: string | null;
    open_positions: number | null;
    responsibilities: string | null;
    nice_to_have: string | null;
    perks_and_benefits: string[] | null;
    preferred_industry: string | null;
    employers: { company_name: string; logo_path: string | null; website: string | null } | null;
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
    const profileRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(auth.userId)}&select=is_discoverable_to_employers`,
      { headers: serviceHeaders() },
    );
    if (!profileRes.ok) throw new Error(`profile read failed: ${profileRes.status}`);
    const profileRows = (await profileRes.json().catch(() => [])) as Array<{ is_discoverable_to_employers: boolean }>;
    const discoverable = !!profileRows[0]?.is_discoverable_to_employers;

    if (!discoverable) {
      return new Response(JSON.stringify({ discoverable: false }), { status: 200, headers });
    }

    const matchesRes = await fetch(
      `${SUPABASE_URL}/rest/v1/requirement_matches?candidate_user_id=eq.${encodeURIComponent(auth.userId)}` +
        `&select=id,unlocked,unlocked_at,match_score,created_at,` +
        `employer_requirements(title,location,status,work_mode,budget_min,budget_max,experience_min,experience_max,skills,` +
        `notice_period_pref,open_positions,responsibilities,nice_to_have,perks_and_benefits,preferred_industry,` +
        `employers(company_name,logo_path,website))` +
        `&order=created_at.desc`,
      { headers: serviceHeaders() },
    );
    if (!matchesRes.ok) throw new Error(`matches read failed: ${matchesRes.status}`);
    const matches = (await matchesRes.json().catch(() => [])) as MatchRow[];

    // A closed/failed requirement is no longer actually hiring — don't count or
    // list it as an active match. An unlock that already happened is a real
    // historical event (the employer has the contact info regardless), so it
    // still counts even if the requirement closes afterward.
    const isClosed = (m: MatchRow) => m.employer_requirements?.status === "closed" || m.employer_requirements?.status === "failed";
    const activeMatches = matches.filter((m) => m.unlocked || !isClosed(m));

    const shortlistedCount = activeMatches.length;
    const unlockedCount = matches.filter((m) => m.unlocked).length;

    // The dashboard widget only ever needs a short teaser; the dedicated
    // Jobs tab wants the full list plus the richer per-role fields. Both
    // read from the same match set — cap only what's returned as `recent`.
    const url = new URL(req.url);
    const full = url.searchParams.get("full") === "1";
    const limited = full ? activeMatches : activeMatches.slice(0, 3);

    const recent = limited.map((m) => ({
      roleTitle: m.employer_requirements?.title || "Open role",
      companyName: m.employer_requirements?.employers?.company_name || "A HireStepX employer",
      companyLogoPath: m.employer_requirements?.employers?.logo_path || null,
      companyWebsite: m.employer_requirements?.employers?.website || null,
      location: m.employer_requirements?.location || "",
      workMode: m.employer_requirements?.work_mode || null,
      budgetMin: m.employer_requirements?.budget_min ?? null,
      budgetMax: m.employer_requirements?.budget_max ?? null,
      experienceMin: m.employer_requirements?.experience_min ?? null,
      experienceMax: m.employer_requirements?.experience_max ?? null,
      skills: (m.employer_requirements?.skills || []).slice(0, 6),
      noticePeriodPref: m.employer_requirements?.notice_period_pref || null,
      openPositions: m.employer_requirements?.open_positions ?? null,
      responsibilities: m.employer_requirements?.responsibilities || null,
      niceToHave: m.employer_requirements?.nice_to_have || null,
      perksAndBenefits: m.employer_requirements?.perks_and_benefits || [],
      preferredIndustry: m.employer_requirements?.preferred_industry || null,
      status: m.employer_requirements?.status || null,
      matchScore: m.match_score ?? 0,
      unlocked: m.unlocked,
      matchedAt: m.created_at.slice(0, 10),
      unlockedAt: m.unlocked_at ? m.unlocked_at.slice(0, 10) : null,
    }));

    return new Response(
      JSON.stringify({ discoverable: true, shortlistedCount, unlockedCount, recent }),
      { status: 200, headers },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    slog.error("candidate-hiring-activity GET threw", { code: "candidate_hiring_activity_get_unexpected_error", error: msg.slice(0, 200), userId: auth.userId });
    return new Response(JSON.stringify({ error: "Failed to load hiring activity" }), { status: 500, headers });
  }
}
