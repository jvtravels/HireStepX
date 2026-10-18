/* Vercel Cron — employer nudges
 *
 * Runs daily. Two nudges, one email per employer per run, each requirement
 * nudged at most once per kind (Redis key employer_nudge:<kind>:<reqId>, 30d):
 *   - matches_waiting: job is 3-10 days old, has matches, zero unlocks
 *   - stale_job:       job is 14-45 days old, zero unlocks
 * Marketing-category mail: respects the employer_notifications opt-out and
 * carries a one-click unsubscribe (see _unsubscribe.ts).
 *
 * Reads are paged and any read failure aborts the run (502, no heartbeat):
 * treating a failed lookup as "no rows" would silently drop nudges, and a
 * truncated match read would nudge employers who already unlocked someone.
 *
 * Auth: CRON_SECRET in the Authorization header — fail closed when unset. */

export const config = { runtime: "nodejs" };

import { verifyCronAuth } from "./_cron-auth";
import { slog, supabaseUrl, supabaseServiceHeaders, redisGet, redisSetEx, redisPipeline } from "./_shared";
import { claimMarketingCooldown, releaseMarketingCooldown } from "./_employer-marketing-cooldown";
import { filterSuppressed, marketingEmailParts, preferenceDepsFromEnv } from "./_unsubscribe";
import { isSuspended } from "./_employer-trust";
import { recordCronResult } from "./_cron-heartbeat";
import { readAllPages, readPage, type RestGet } from "./_paged-fetch";
import {
  buildNudgeEmail,
  nudgeDedupeKey,
  selectNudges,
  sendEmployerEmail,
  STALE_MAX_AGE_DAYS,
  MATCHES_WAITING_MIN_AGE_DAYS,
  type MatchStat,
  type NudgeRequirement,
} from "./_employer-emails";

declare const process: { env: Record<string, string | undefined> };

const NUDGE_TTL_SECONDS = 30 * 86_400;
const MAX_REQUIREMENTS = 5000;
const MAX_MATCH_ROWS = 50_000;
const MAX_SENDS_PER_RUN = 150;
const CHUNK = 80;
// Small so one chunk's match rows stay far below MAX_MATCH_ROWS.
const MATCH_CHUNK = 20;

class ReadFailure extends Error {
  readonly cause: unknown;
  constructor(message: string, cause: unknown) {
    super(message);
    this.cause = cause;
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

async function chunkedRows<T>(get: RestGet, ids: readonly string[], build: (list: string) => string, size = CHUNK): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += size) {
    out.push(...(await readPage<T>(get, build(ids.slice(i, i + size).join(",")))));
  }
  return out;
}

export default async function handler(req: Request): Promise<Response> {
  if (!verifyCronAuth(req)) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }
  const base = supabaseUrl();
  if (!base) return jsonResponse({ error: "Not configured" }, 503);
  if (!(process.env.RESEND_API_KEY || "").trim()) return jsonResponse({ error: "Email not configured" }, 503);

  const t0 = Date.now();
  const get: RestGet = (path) => fetch(`${base}/rest/v1/${path}`, { headers: supabaseServiceHeaders(), signal: AbortSignal.timeout(15_000) });
  const finish = async (body: { ok: boolean } & Record<string, unknown>, errors: number): Promise<Response> => {
    await recordCronResult("send-employer-nudges", { errors });
    return jsonResponse(body, body.ok ? 200 : 502);
  };
  try {
    const now = Date.now();
    const oldest = new Date(now - STALE_MAX_AGE_DAYS * 86_400_000).toISOString();
    const newest = new Date(now - MATCHES_WAITING_MIN_AGE_DAYS * 86_400_000).toISOString();
    const reqPage = await readAllPages<NudgeRequirement>(
      get,
      `employer_requirements?status=in.(ready,partial,zero)&created_at=gte.${encodeURIComponent(oldest)}&created_at=lte.${encodeURIComponent(newest)}&select=id,employer_id,title,created_at,status&order=created_at.desc,id.desc`,
      { maxRows: MAX_REQUIREMENTS },
    ).catch((err: unknown) => { throw new ReadFailure("Requirement query failed", err); });
    if (reqPage.truncated) slog.warn("employer nudges: requirement cap reached, oldest jobs skipped this run", { code: "employer_nudges_truncated", cap: MAX_REQUIREMENTS });
    const reqs = reqPage.rows;
    if (reqs.length === 0) return finish({ ok: true, sent: 0, skipped: 0, failed: 0, considered: 0, duration_ms: Date.now() - t0 }, 0);

    const stats: Record<string, MatchStat> = {};
    try {
      const ids = reqs.map((r) => r.id);
      for (let i = 0; i < ids.length; i += MATCH_CHUNK) {
        const list = ids.slice(i, i + MATCH_CHUNK).join(",");
        const page = await readAllPages<{ requirement_id: string; unlocked: boolean | null }>(
          get,
          `requirement_matches?requirement_id=in.(${list})&select=requirement_id,unlocked&order=id.asc`,
          { maxRows: MAX_MATCH_ROWS },
        );
        // A truncated read could miss an unlocked match and nudge someone who already bought.
        if (page.truncated) throw new Error("match rows exceeded the read cap");
        for (const m of page.rows) {
          const st = (stats[m.requirement_id] ??= { total: 0, unlocked: 0 });
          st.total++;
          if (m.unlocked) st.unlocked++;
        }
      }
    } catch (err) {
      throw new ReadFailure("Match query failed", err);
    }

    const candidates = selectNudges(reqs, stats, now);
    if (candidates.length === 0) return finish({ ok: true, sent: 0, skipped: 0, failed: 0, considered: reqs.length, duration_ms: Date.now() - t0 }, 0);

    const employerIds = [...new Set(candidates.map((c) => c.requirement.employer_id))];
    let employers: { id: string; suspended_at: string | null }[];
    let profiles: { id: string; email: string | null }[];
    try {
      employers = await chunkedRows(get, employerIds, (list) => `employers?id=in.(${list})&select=id,suspended_at`);
      profiles = await chunkedRows(get, employerIds, (list) => `profiles?id=in.(${list})&select=id,email`);
    } catch (err) {
      throw new ReadFailure("Employer lookup failed", err);
    }
    const active = new Set(employers.filter((e) => !isSuspended(e)).map((e) => e.id));
    const emailById = new Map(profiles.filter((p) => !!p.email).map((p) => [p.id, p.email as string]));

    const eligible = candidates.filter((c) => active.has(c.requirement.employer_id) && emailById.has(c.requirement.employer_id));
    const allowedIds = new Set(
      (await filterSuppressed(preferenceDepsFromEnv(), [...new Set(eligible.map((c) => c.requirement.employer_id))].map((id) => ({ id })), "employer_notifications")).map((r) => r.id),
    );

    let sent = 0;
    let failed = 0;
    let cooldownUnavailable = 0;
    let skipped = candidates.length - eligible.length;
    for (const c of eligible) {
      if (sent >= MAX_SENDS_PER_RUN) { skipped++; continue; }
      const employerId = c.requirement.employer_id;
      if (!allowedIds.has(employerId)) { skipped++; continue; }
      const dedupe = nudgeDedupeKey(c);
      if (await redisGet(dedupe)) { skipped++; continue; }
      // Shared with the win-back cron; fails closed (skips) when Redis is down.
      const slot = await claimMarketingCooldown(redisPipeline, employerId);
      if (slot !== "claimed") {
        if (slot === "unavailable") cooldownUnavailable++;
        skipped++;
        continue;
      }

      const parts = await marketingEmailParts(employerId, "employer_notifications");
      const mail = buildNudgeEmail(c, parts.footer);
      const ok = await sendEmployerEmail({
        to: emailById.get(employerId) as string,
        ...mail,
        idempotencyKey: `employer-nudge-${c.kind}-${c.requirement.id}`,
        extra: { ...parts.resend },
      });
      if (ok) {
        await redisSetEx(dedupe, NUDGE_TTL_SECONDS, new Date().toISOString());
        sent++;
      } else {
        await releaseMarketingCooldown(redisPipeline, employerId);
        failed++;
        skipped++;
      }
    }
    if (cooldownUnavailable > 0) slog.warn("employer nudges: Redis unavailable, sends skipped (fail closed)", { code: "employer_nudges_cooldown_unavailable", skipped: cooldownUnavailable });
    // One bad address must not page anyone, but every send failing means the provider is down.
    const errors = sent === 0 && failed > 0 ? failed : 0;
    if (errors > 0) slog.error("employer nudges: every send failed", { code: "employer_nudges_all_sends_failed", failed });
    return finish({ ok: errors === 0, sent, skipped, failed, considered: reqs.length, duration_ms: Date.now() - t0 }, errors);
  } catch (err) {
    if (err instanceof ReadFailure) {
      slog.error("employer nudges read failed", { code: "employer_nudges_read_failed", step: err.message, err: err.cause instanceof Error ? err.cause.message : String(err.cause) });
      return jsonResponse({ error: err.message }, 502);
    }
    slog.error("employer nudges failed", { code: "employer_nudges_failed", err: err instanceof Error ? err.message : String(err) });
    return jsonResponse({ error: "Nudge run failed" }, 500);
  }
}
