/* Vercel Cron — Win-back email for churned paid users
 *
 * Runs daily at 13:00 UTC (6:30 PM IST). Targets users whose paid
 * subscription expired 10–21 days ago (subscription_tier = 'free'
 * + subscription_end in that window). One email per user, ever —
 * idempotency via Upstash Redis key `winback:<userId>` (TTL 90d).
 *
 * Not a hard sell. The email acknowledges the gap, surfaces what they
 * built (their resume, sessions, score history), and offers a single
 * free session to come back with zero commitment. */

import { verifyCronAuth } from "./_cron-auth";
import { recordCronResult } from "./_cron-heartbeat";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { escapeHtml } from "./_shared";
import { fetchAllPages, mapPool, timeBudget } from "./_batch";
import { emailShell, title, para, b, button, dataCard, type EmailFooterOptions } from "./_email-theme";
import { filterSuppressed, marketingEmailParts, preferenceDepsFromEnv } from "./_unsubscribe";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const RESEND_API_KEY = (process.env.RESEND_API_KEY || "").trim();
const FROM_EMAIL = process.env.FROM_EMAIL || "HireStepX <noreply@hirestepx.com>";
const APP_URL = (process.env.APP_URL || "https://hirestepx.com").replace(/\/$/, "");
const UPSTASH_URL = (process.env.UPSTASH_REDIS_REST_URL || "").trim();
const UPSTASH_TOKEN = (process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();

const WINBACK_TTL_SECONDS = 90 * 24 * 3600;

interface ProfileRow {
  id: string;
  name: string | null;
  email: string;
  subscription_tier: string;
  subscription_end: string;
  target_role: string | null;
  session_credits: number | null;
}

interface SessionRow {
  score: number;
  created_at: string;
}

const PAGE_SIZE = 500;
const MAX_PAGES = 10;
const SESSION_CHUNK = 25;
const SEND_CONCURRENCY = 4;
const RUN_BUDGET_MS = 45_000;

/** Which of `keys` already exist. One round trip per chunk instead of one GET per user. */
async function redisExistingKeys(keys: string[]): Promise<Set<string>> {
  const found = new Set<string>();
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return found;
  for (let i = 0; i < keys.length; i += 100) {
    const chunk = keys.slice(i, i + 100);
    try {
      const res = await fetch(`${UPSTASH_URL}/mget/${chunk.map(encodeURIComponent).join("/")}`, {
        headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
        signal: AbortSignal.timeout(5_000),
      });
      if (!res.ok) continue;
      const { result } = (await res.json()) as { result: (string | null)[] };
      result.forEach((v, idx) => { if (v) found.add(chunk[idx]); });
    } catch { /* treat as unsent; Idempotency-Key still prevents a duplicate email */ }
  }
  return found;
}

async function redisSet(key: string, value: string): Promise<void> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return;
  try {
    await fetch(`${UPSTASH_URL}/SET/${encodeURIComponent(key)}/${encodeURIComponent(value)}/EX/${WINBACK_TTL_SECONDS}`, {
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
      signal: AbortSignal.timeout(5_000),
    });
  } catch { /* best effort */ }
}

function buildWinbackEmail(
  user: ProfileRow,
  bestScore: number | null,
  sessionCount: number,
  footer?: EmailFooterOptions,
): { subject: string; html: string } {
  const safeName = escapeHtml(user.name?.split(" ")[0] || "there");
  const safeRole = escapeHtml(user.target_role || "your target role");
  const pricingUrl = `${APP_URL}/pricing`;
  const sessionUrl = `${APP_URL}/session/new`;

  const cardRows: [string, string][] = [
    ["Target role", safeRole],
    ["Sessions completed", String(sessionCount)],
    ...(bestScore != null ? [["Best score", `${bestScore}/100`] as [string, string]] : []),
    ["Status", "Everything saved"],
  ];

  return {
    subject: `${safeName}, your HireStepX progress is still here`,
    html: emailShell({
      footer,
      preview: "Your resume, sessions, and score history are exactly as you left them.",
      body:
        title("Still here,", { accentWord: "waiting for you." }) +
        para(
          `Hi ${safeName}, your ${b(safeRole)} prep — your resume, your past sessions, your score history — is exactly as you left it. Nothing was deleted when your plan ended.`,
        ) +
        dataCard("Your account", cardRows) +
        para(
          `If the timing wasn't right, no problem. When you're ready to practice again, everything picks up from where you stopped.`,
        ) +
        button("Continue where I left off", sessionUrl) +
        para(
          `If you want to pick up a plan again, prices start at ₹9 for a single session — no commitment.`,
          { small: true, muted: true },
        ) +
        button("See plans", pricingUrl) +
        para(
          `If something wasn't working or the product didn't meet your expectations, reply and tell us — we read every response.`,
          { small: true, muted: true },
        ),
    }),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!verifyCronAuth(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !RESEND_API_KEY) {
    return res.status(503).json({ error: "Not configured" });
  }

  // Target: users who were paid, expired 10–21 days ago, now on free
  const now = Date.now();
  const windowStart = new Date(now - 21 * 86400_000).toISOString(); // 21 days ago
  const windowEnd = new Date(now - 10 * 86400_000).toISOString();   // 10 days ago

  const dbHeaders = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  };

  // Ordered + paginated: the window spans ~11 daily runs, so a fixed unordered slice would starve everyone past it.
  const profilesBase =
    `${SUPABASE_URL}/rest/v1/profiles` +
    `?subscription_tier=eq.free` +
    `&subscription_end=gte.${encodeURIComponent(windowStart)}` +
    `&subscription_end=lte.${encodeURIComponent(windowEnd)}` +
    `&select=id,name,email,subscription_tier,subscription_end,target_role,session_credits` +
    `&order=id`;
  let firstPageFailed = false;
  const { rows: allProfiles, complete: profilesComplete } = await fetchAllPages<ProfileRow>(async (offset, limit) => {
    const r = await fetch(`${profilesBase}&limit=${limit}&offset=${offset}`, { headers: dbHeaders, signal: AbortSignal.timeout(10_000) }).catch(() => null);
    if (!r || !r.ok) { if (offset === 0) firstPageFailed = true; return null; }
    const json = await r.json();
    return Array.isArray(json) ? json : null;
  }, PAGE_SIZE, MAX_PAGES);

  if (firstPageFailed) {
    return res.status(500).json({ error: "Failed to query profiles" });
  }
  if (!profilesComplete) console.error(`[send-winback] WARNING: candidate scan incomplete (${allProfiles.length} loaded)`);

  const suppressionFiltered = await filterSuppressed(preferenceDepsFromEnv(), allProfiles, "marketing");
  // Drop already-emailed users up front so the time budget is spent on new ones.
  const alreadySentKeys = await redisExistingKeys(suppressionFiltered.map(p => `winback:${p.id}`));
  const profiles = suppressionFiltered.filter(p => !alreadySentKeys.has(`winback:${p.id}`));
  if (profiles.length === 0) {
    await recordCronResult("send-winback-emails", { errors: 0 });
    return res.status(200).json({ sent: 0, skipped: allProfiles.length - profiles.length, message: "No candidates", complete: profilesComplete });
  }

  // Chunked: one giant in.(...) list exceeds URL limits, and a single response is row-capped.
  const sessionStatsByUser = new Map<string, { bestScore: number; count: number }>();
  for (let i = 0; i < profiles.length; i += SESSION_CHUNK) {
    const ids = profiles.slice(i, i + SESSION_CHUNK).map(p => encodeURIComponent(p.id)).join(",");
    try {
      const sessRes = await fetch(
        `${SUPABASE_URL}/rest/v1/sessions?user_id=in.(${ids})&select=user_id,score,created_at&order=score.desc`,
        { headers: dbHeaders, signal: AbortSignal.timeout(10_000) },
      );
      if (sessRes.ok) {
        const rows = await sessRes.json() as (SessionRow & { user_id: string })[];
        for (const row of rows) {
          const existing = sessionStatsByUser.get(row.user_id);
          if (!existing) {
            sessionStatsByUser.set(row.user_id, { bestScore: row.score, count: 1 });
          } else {
            existing.count++;
            if (row.score > existing.bestScore) existing.bestScore = row.score;
          }
        }
      }
    } catch { /* proceed without session data for this chunk */ }
  }

  let sent = 0;
  let skipped = allProfiles.length - profiles.length;
  let skippedForTime = 0;
  const budget = timeBudget(RUN_BUDGET_MS);

  await mapPool(profiles, SEND_CONCURRENCY, async (user) => {
    if (!user.email) { skipped++; return; }
    if (budget.expired()) { skippedForTime++; return; }

    const redisKey = `winback:${user.id}`;
    const stats = sessionStatsByUser.get(user.id);
    // Only send to users who actually practiced (had at least 1 session)
    if (!stats || stats.count === 0) { skipped++; return; }

    const parts = await marketingEmailParts(user.id, "marketing");
    const { subject, html } = buildWinbackEmail(user, stats.bestScore, stats.count, parts.footer);

    try {
      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `winback-${user.id}`,
        },
        body: JSON.stringify({ from: FROM_EMAIL, to: [user.email], subject, html, ...parts.resend }),
        signal: AbortSignal.timeout(10_000),
      });

      if (emailRes.ok) {
        await redisSet(redisKey, new Date().toISOString());
        sent++;
      } else {
        skipped++;
      }
    } catch {
      skipped++;
    }
  });

  if (skippedForTime > 0) console.error(`[send-winback] time budget hit; ${skippedForTime} users deferred to the next run`);
  await recordCronResult("send-winback-emails", { errors: 0 });
  return res.status(200).json({ sent, skipped, skippedForTime, total: allProfiles.length, complete: profilesComplete });
}
