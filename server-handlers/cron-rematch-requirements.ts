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

import { runMatching, SUSPENDED_MATCHING_STATUS } from "./employer-requirements";
import { pickRequirementsToRematch, type OpenRequirementForRematch } from "./_incremental-rematch-helpers";
import { canStartBatch } from "./_employer-matching-helpers";
import { isSuspended } from "./_employer-trust";
import { slog } from "./_shared";

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
/** maxDuration is 240s; stop starting new batches well before that so the
    response (and the in-flight batch) always completes. */
export const CRON_TIME_BUDGET_MS = 200_000;
/** Each requirement gets a longer matching budget than the 20s interactive
    default: the pool scan is bounded but runs many sequential pages. */
export const CRON_MATCH_TIMEOUT_MS = 45_000;
/** Read cap on the open-requirement backlog. Ordered stalest-first, so a
    backlog bigger than this simply rolls over to the next night. */
const MAX_OPEN_REQUIREMENTS_READ = 1000;

function serviceHeaders(): Record<string, string> {
  return { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

type CronRow = OpenRequirementForRematch & { employers?: { suspended_at?: string | null } | null };

export default async function handler(req: Request): Promise<Response> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return jsonResponse({ error: "Server misconfigured" }, 503);
  }
  // Fail closed: with CRON_SECRET unset this endpoint used to be open to the
  // internet and re-ran matching (a service-role write sweep) for anyone.
  if (!CRON_SECRET || (req.headers.get("authorization") || "") !== `Bearer ${CRON_SECRET}`) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const t0 = Date.now();
  // Suspended employers are excluded in the query (inner-join embed) AND again
  // below; stalest first so a capped/timed-out run resumes where it left off.
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/employer_requirements?stage=in.(ai_matching,ready_for_review)&status=neq.closed` +
      `&select=id,employer_id,title,location,description,skills,experience_min,experience_max,min_readiness_band,min_star_completeness,employment_type,duration_weeks,hours_per_week,stage,status,last_matched_at,employers!inner(suspended_at)` +
      `&employers.suspended_at=is.null&order=last_matched_at.asc.nullsfirst&limit=${MAX_OPEN_REQUIREMENTS_READ}`,
    { headers: { ...serviceHeaders(), Prefer: "count=exact" } },
  );
  if (!res.ok) {
    return jsonResponse({ error: "Failed to load open requirements" }, 502);
  }
  const allRows = (await res.json().catch(() => [])) as CronRow[];
  const totalOpen = Number(res.headers.get("content-range")?.split("/")[1]);
  const rows = allRows.filter((r) => !isSuspended(r.employers));
  const due = pickRequirementsToRematch(rows, MAX_REQUIREMENTS_PER_RUN);

  let matched = 0;
  let failed = 0;
  let skippedSuspended = 0;
  let attempted = 0;
  let budgetExhausted = false;
  let slowestBatchMs = 0;
  for (let i = 0; i < due.length; i += BATCH_SIZE) {
    if (!canStartBatch(Date.now() - t0, CRON_TIME_BUDGET_MS, slowestBatchMs)) {
      budgetExhausted = true;
      break;
    }
    const batchStart = Date.now();
    const batch = due.slice(i, i + BATCH_SIZE);
    // Per-requirement isolation: one requirement throwing (runMatching already
    // converts most failures to "failed", this covers anything it doesn't)
    // can never abort the rest of the sweep.
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
          { timeoutMs: CRON_MATCH_TIMEOUT_MS },
        ).catch((err: unknown) => {
          slog.error("cron rematch requirement threw", { code: "cron_rematch_requirement_failed", requirementId: r.id, error: (err instanceof Error ? err.message : String(err)).slice(0, 200) });
          return "failed";
        }),
      ),
    );
    attempted += batch.length;
    for (const status of statuses) {
      if (status === "failed") failed += 1;
      else if (status === SUSPENDED_MATCHING_STATUS) skippedSuspended += 1;
      else matched += 1;
    }
    slowestBatchMs = Math.max(slowestBatchMs, Date.now() - batchStart);
  }

  return jsonResponse({
    ok: true,
    open_requirements: Number.isFinite(totalOpen) ? totalOpen : rows.length,
    processed: attempted,
    matched,
    failed,
    skipped_suspended: skippedSuspended,
    deferred: due.length - attempted,
    budget_exhausted: budgetExhausted,
    duration_ms: Date.now() - t0,
  });
}
