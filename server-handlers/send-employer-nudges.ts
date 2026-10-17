/* Vercel Cron — employer nudges
 *
 * Runs daily. Two nudges, one email per employer per run, each requirement
 * nudged at most once per kind (Redis key employer_nudge:<kind>:<reqId>, 30d):
 *   - matches_waiting: job is 3-10 days old, has matches, zero unlocks
 *   - stale_job:       job is 14-45 days old, zero unlocks
 * Marketing-category mail: respects the employer_notifications opt-out and
 * carries a one-click unsubscribe (see _unsubscribe.ts).
 *
 * Auth: CRON_SECRET in the Authorization header — fail closed when unset. */

export const config = { runtime: "nodejs" };

import { slog, supabaseUrl, supabaseServiceHeaders, redisGet, redisSetEx } from "./_shared";
import { filterSuppressed, marketingEmailParts, preferenceDepsFromEnv } from "./_unsubscribe";
import { isSuspended } from "./_employer-trust";
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
const MAX_REQUIREMENTS = 500;
const MAX_SENDS_PER_RUN = 150;
const CHUNK = 80;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

async function getRows<T>(base: string, path: string): Promise<T[] | null> {
  try {
    const res = await fetch(`${base}/rest/v1/${path}`, { headers: supabaseServiceHeaders(), signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    const rows = await res.json().catch(() => []);
    return Array.isArray(rows) ? (rows as T[]) : [];
  } catch {
    return null;
  }
}

async function chunkedRows<T>(base: string, ids: readonly string[], build: (list: string) => string): Promise<T[] | null> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    const rows = await getRows<T>(base, build(ids.slice(i, i + CHUNK).join(",")));
    if (!rows) return null;
    out.push(...rows);
  }
  return out;
}

export default async function handler(req: Request): Promise<Response> {
  const cronSecret = (process.env.CRON_SECRET || "").trim();
  if (!cronSecret || (req.headers.get("authorization") || "") !== `Bearer ${cronSecret}`) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }
  const base = supabaseUrl();
  if (!base) return jsonResponse({ error: "Not configured" }, 503);
  if (!(process.env.RESEND_API_KEY || "").trim()) return jsonResponse({ error: "Email not configured" }, 503);

  const t0 = Date.now();
  try {
    const now = Date.now();
    const oldest = new Date(now - STALE_MAX_AGE_DAYS * 86_400_000).toISOString();
    const newest = new Date(now - MATCHES_WAITING_MIN_AGE_DAYS * 86_400_000).toISOString();
    const reqs = await getRows<NudgeRequirement>(
      base,
      `employer_requirements?status=in.(ready,partial,zero)&created_at=gte.${encodeURIComponent(oldest)}&created_at=lte.${encodeURIComponent(newest)}&select=id,employer_id,title,created_at,status&order=created_at.desc&limit=${MAX_REQUIREMENTS}`,
    );
    if (!reqs) return jsonResponse({ error: "Requirement query failed" }, 502);
    if (reqs.length === 0) return jsonResponse({ ok: true, sent: 0, skipped: 0, considered: 0, duration_ms: Date.now() - t0 });

    const matchRows = await chunkedRows<{ requirement_id: string; unlocked: boolean | null }>(
      base, reqs.map((r) => r.id),
      (list) => `requirement_matches?requirement_id=in.(${list})&select=requirement_id,unlocked&limit=5000`,
    );
    if (!matchRows) return jsonResponse({ error: "Match query failed" }, 502);
    const stats: Record<string, MatchStat> = {};
    for (const m of matchRows) {
      const s = (stats[m.requirement_id] ??= { total: 0, unlocked: 0 });
      s.total++;
      if (m.unlocked) s.unlocked++;
    }

    const candidates = selectNudges(reqs, stats, now);
    if (candidates.length === 0) return jsonResponse({ ok: true, sent: 0, skipped: 0, considered: reqs.length, duration_ms: Date.now() - t0 });

    const employerIds = [...new Set(candidates.map((c) => c.requirement.employer_id))];
    const employers = (await chunkedRows<{ id: string; suspended_at: string | null }>(
      base, employerIds, (list) => `employers?id=in.(${list})&select=id,suspended_at`,
    )) ?? [];
    const active = new Set(employers.filter((e) => !isSuspended(e)).map((e) => e.id));
    const profiles = (await chunkedRows<{ id: string; email: string | null }>(
      base, employerIds, (list) => `profiles?id=in.(${list})&select=id,email`,
    )) ?? [];
    const emailById = new Map(profiles.filter((p) => !!p.email).map((p) => [p.id, p.email as string]));

    const eligible = candidates.filter((c) => active.has(c.requirement.employer_id) && emailById.has(c.requirement.employer_id));
    const allowedIds = new Set(
      (await filterSuppressed(preferenceDepsFromEnv(), [...new Set(eligible.map((c) => c.requirement.employer_id))].map((id) => ({ id })), "employer_notifications")).map((r) => r.id),
    );

    let sent = 0;
    let skipped = candidates.length - eligible.length;
    for (const c of eligible) {
      if (sent >= MAX_SENDS_PER_RUN) { skipped++; continue; }
      const employerId = c.requirement.employer_id;
      if (!allowedIds.has(employerId)) { skipped++; continue; }
      const dedupe = nudgeDedupeKey(c);
      if (await redisGet(dedupe)) { skipped++; continue; }

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
        skipped++;
      }
    }
    return jsonResponse({ ok: true, sent, skipped, considered: reqs.length, duration_ms: Date.now() - t0 });
  } catch (err) {
    slog.error("employer nudges failed", { code: "employer_nudges_failed", err: err instanceof Error ? err.message : String(err) });
    return jsonResponse({ error: "Nudge run failed" }, 500);
  }
}
