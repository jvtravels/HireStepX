/* Vercel Cron — Nightly Requirement Rematch Sweep
 *
 * Backstop for the incremental path fired from update-profile.ts
 * (rematchOpenRequirementsForNewResume in employer-requirements.ts), which
 * only re-scores a bounded burst of requirements per candidate resume save.
 * This cron re-runs `runMatching` for every open requirement (stage
 * ai_matching/ready_for_review, not closed) once a day, so:
 *   - requirements beyond the incremental path's per-call cap still get
 *     covered within 24h,
 *   - a requirement an employer never touches still picks up candidates who
 *     signed up without ever triggering a profile save afterward (e.g. a
 *     resume that was already complete at signup),
 *   - any incremental pass that failed mid-flight (edge function recycled,
 *     etc.) gets retried.
 *
 * Ordered by last_matched_at (stalest first, same rule as the incremental
 * path's pickRequirementsToRematch) and capped at MAX_REQUIREMENTS_PER_RUN
 * to bound the cron's own run time — any remainder rolls to the next night
 * since "stalest first" means today's leftovers are tomorrow's first picks.
 *
 * Auth: CRON_SECRET in the Authorization header (Vercel sets it
 * automatically for /api/cron/* paths).
 */

export const config = { runtime: "nodejs" };

import { runMatching } from "./employer-requirements";
import { pickRequirementsToRematch, type OpenRequirementForRematch } from "./_incremental-rematch-helpers";

declare const process: { env: Record<string, string | undefined> };
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const CRON_SECRET = process.env.CRON_SECRET || "";
const MAX_REQUIREMENTS_PER_RUN = 150;
/** Fixed-size concurrency so a 150-requirement backlog doesn't run fully
    sequentially (slow) or fully in parallel (an unbounded burst of
    Supabase/LLM calls) — see runMatchingInBatches in employer-requirements.ts
    for the same pattern on the incremental path. */
const BATCH_SIZE = 5;

function serviceHeaders(): Record<string, string> {
  return { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export default async function handler(req: Request): Promise<Response> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return jsonResponse({ error: "Server misconfigured" }, 503);
  }
  if (CRON_SECRET) {
    const auth = req.headers.get("authorization") || "";
    if (auth !== `Bearer ${CRON_SECRET}`) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
  }

  const t0 = Date.now();
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/employer_requirements?stage=in.(ai_matching,ready_for_review)&status=neq.closed` +
      `&select=id,employer_id,title,location,description,skills,experience_min,experience_max,min_readiness_band,min_star_completeness,employment_type,duration_weeks,hours_per_week,stage,status,last_matched_at&limit=2000`,
    { headers: serviceHeaders() },
  );
  if (!res.ok) {
    return jsonResponse({ error: "Failed to load open requirements" }, 502);
  }
  const rows = (await res.json().catch(() => [])) as OpenRequirementForRematch[];
  const due = pickRequirementsToRematch(rows, MAX_REQUIREMENTS_PER_RUN);

  let matched = 0;
  let failed = 0;
  for (let i = 0; i < due.length; i += BATCH_SIZE) {
    const batch = due.slice(i, i + BATCH_SIZE);
    const statuses = await Promise.all(
      batch.map((r) =>
        runMatching(
          r.id,
          {
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
          },
          r.employer_id,
        ),
      ),
    );
    for (const status of statuses) {
      if (status === "failed") failed += 1;
      else matched += 1;
    }
  }

  return jsonResponse({
    ok: true,
    open_requirements: rows.length,
    processed: due.length,
    matched,
    failed,
    duration_ms: Date.now() - t0,
  });
}
