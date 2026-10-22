/* Vercel Cron — employer win-back
 *
 * Runs daily. Emails employers who posted a role but never unlocked a
 * candidate (7-60 days on), and employers who unlocked before but have gone
 * quiet for 30-180 days; at most one email per employer per 30 days (Redis key
 * employer_winback:<employerId>). Selection lives in _employer-winback-helpers.ts.
 * Marketing-category mail: respects the employer_notifications opt-out and
 * carries a one-click unsubscribe (see _unsubscribe.ts).
 *
 * Reads are paged and any read failure aborts the run (502, no heartbeat).
 *
 * Auth: CRON_SECRET in the Authorization header — fail closed when unset. */

export const config = { runtime: "nodejs" };

import { verifyCronAuth } from "./_cron-auth";
import { slog, supabaseUrl, supabaseServiceHeaders, redisGet, redisSetEx, redisPipeline } from "./_shared";
import { claimMarketingCooldown, releaseMarketingCooldown } from "./_employer-marketing-cooldown";
import { filterSuppressed, marketingEmailParts, preferenceDepsFromEnv } from "./_unsubscribe";
import { sendEmployerEmail } from "./_employer-emails";
import { recordCronResult } from "./_cron-heartbeat";
import { readAllPages, readPage, type RestGet } from "./_paged-fetch";
import { captureServerEvent } from "./_posthog";
import {
  buildActivity,
  buildWinbackEmail,
  isWinbackEligible,
  selectWinbacks,
  winbackDedupeKey,
  winbackIdempotencyKey,
  INACTIVE_MAX_DAYS,
  WINBACK_COOLDOWN_SECONDS,
  type RequirementActivityRow,
  type UnlockActivityRow,
} from "./_employer-winback-helpers";

declare const process: { env: Record<string, string | undefined> };

const MAX_SENDS_PER_RUN = 100;
const MAX_ROWS = 50_000;
const CHUNK = 80;

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

interface UnlockRow { unlocked_at: string; employer_requirements: { employer_id: string } | { employer_id: string }[] | null }

function toUnlockActivity(rows: readonly UnlockRow[]): UnlockActivityRow[] {
  const out: UnlockActivityRow[] = [];
  for (const r of rows) {
    const req = Array.isArray(r.employer_requirements) ? r.employer_requirements[0] : r.employer_requirements;
    if (req?.employer_id && r.unlocked_at) out.push({ employer_id: req.employer_id, unlocked_at: r.unlocked_at });
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
    await recordCronResult("send-employer-winback", { errors });
    return jsonResponse(body, body.ok ? 200 : 502);
  };

  try {
    const now = Date.now();
    const since = encodeURIComponent(new Date(now - INACTIVE_MAX_DAYS * 86_400_000).toISOString());

    let requirements: RequirementActivityRow[];
    let unlockRows: UnlockRow[];
    let unlocksTruncated: boolean;
    try {
      requirements = (await readAllPages<RequirementActivityRow>(
        get,
        `employer_requirements?created_at=gte.${since}&select=employer_id,created_at&order=created_at.desc,id.desc`,
        { maxRows: MAX_ROWS },
      )).rows;
      const unlockPage = await readAllPages<UnlockRow>(
        get,
        `requirement_matches?unlocked=eq.true&unlocked_at=gte.${since}&select=unlocked_at,employer_requirements!inner(employer_id)&order=unlocked_at.desc,id.desc`,
        { maxRows: MAX_ROWS },
      );
      unlockRows = unlockPage.rows;
      unlocksTruncated = unlockPage.truncated;
    } catch (err) {
      throw new ReadFailure("Activity query failed", err);
    }
    // Unlocks are read for the same 180-day window as requirements (the longest look-back any audience needs), so "never unlocked" is only provable when the read was not capped.
    if (unlocksTruncated) slog.warn("employer winback: unlock read hit the cap, skipping no_unlock this run", { code: "employer_winback_truncated" });

    const candidates = selectWinbacks(buildActivity(requirements, toUnlockActivity(unlockRows)), now, { allowNoUnlock: !unlocksTruncated });
    if (candidates.length === 0) return finish({ ok: true, sent: 0, skipped: 0, failed: 0, considered: 0, duration_ms: Date.now() - t0 }, 0);

    const ids = candidates.map((c) => c.employerId);
    const employers = new Map<string, { id: string; suspended_at: string | null; company_name: string | null }>();
    const emails = new Map<string, string>();
    try {
      for (let i = 0; i < ids.length; i += CHUNK) {
        const list = ids.slice(i, i + CHUNK).map(encodeURIComponent).join(",");
        for (const e of await readPage<{ id: string; suspended_at: string | null; company_name: string | null }>(get, `employers?id=in.(${list})&select=id,suspended_at,company_name`)) employers.set(e.id, e);
        for (const p of await readPage<{ id: string; email: string | null }>(get, `profiles?id=in.(${list})&select=id,email`)) if (p.email) emails.set(p.id, p.email);
      }
    } catch (err) {
      throw new ReadFailure("Employer lookup failed", err);
    }

    const eligible = candidates.filter((c) => isWinbackEligible(employers.get(c.employerId), emails.get(c.employerId)));
    const allowed = new Set(
      (await filterSuppressed(preferenceDepsFromEnv(), eligible.map((c) => ({ id: c.employerId })), "employer_notifications")).map((r) => r.id),
    );

    let sent = 0;
    let failed = 0;
    let cooldownUnavailable = 0;
    let skipped = candidates.length - eligible.length;
    for (const c of eligible) {
      if (sent >= MAX_SENDS_PER_RUN || !allowed.has(c.employerId)) { skipped++; continue; }
      const dedupe = winbackDedupeKey(c.employerId);
      if (await redisGet(dedupe)) { skipped++; continue; }
      // Shared with the nudge cron; fails closed (skips) when Redis is down.
      const slot = await claimMarketingCooldown(redisPipeline, c.employerId);
      if (slot !== "claimed") {
        if (slot === "unavailable") cooldownUnavailable++;
        skipped++;
        continue;
      }

      const parts = await marketingEmailParts(c.employerId, "employer_notifications");
      const mail = buildWinbackEmail(c.kind, employers.get(c.employerId)?.company_name ?? "", parts.footer);
      const ok = await sendEmployerEmail({
        to: emails.get(c.employerId) as string,
        ...mail,
        idempotencyKey: winbackIdempotencyKey(c.employerId, now),
        extra: { ...parts.resend },
      });
      if (ok) {
        await redisSetEx(dedupe, WINBACK_COOLDOWN_SECONDS, new Date().toISOString());
        await captureServerEvent("employer_winback_sent", c.employerId, { kind: c.kind, requirement_count: c.requirementCount, unlock_count: c.unlockCount });
        sent++;
      } else {
        await releaseMarketingCooldown(redisPipeline, c.employerId);
        failed++;
        skipped++;
      }
    }
    if (cooldownUnavailable > 0) slog.warn("employer winback: Redis unavailable, sends skipped (fail closed)", { code: "employer_winback_cooldown_unavailable", skipped: cooldownUnavailable });
    // One bad address must not page anyone, but every send failing means the provider is down.
    const errors = sent === 0 && failed > 0 ? failed : 0;
    if (errors > 0) slog.error("employer winback: every send failed", { code: "employer_winback_all_sends_failed", failed });
    return finish({ ok: errors === 0, sent, skipped, failed, considered: candidates.length, duration_ms: Date.now() - t0 }, errors);
  } catch (err) {
    if (err instanceof ReadFailure) {
      slog.error("employer winback read failed", { code: "employer_winback_read_failed", step: err.message, err: err.cause instanceof Error ? err.cause.message : String(err.cause) });
      return jsonResponse({ error: err.message }, 502);
    }
    slog.error("employer winback failed", { code: "employer_winback_failed", err: err instanceof Error ? err.message : String(err) });
    return jsonResponse({ error: "Winback run failed" }, 500);
  }
}
