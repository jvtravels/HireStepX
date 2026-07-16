/* Vercel Cron — D+1 activation email for users who never started a session
 *
 * Runs daily at 11:30 UTC (5:00 PM IST). Targets users who signed up
 * 20–48 hours ago but have zero practice_timestamps (never completed a
 * session, not even the free ones). One email per user, ever —
 * idempotency via Upstash Redis key `activation_d1:<userId>` (TTL 14d).
 *
 * This is the single most important lifecycle email: a new user who
 * signs up and doesn't start within 48 hours almost never comes back. */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { escapeHtml } from "./_shared";
import { emailShell, title, para, button } from "./_email-theme";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const RESEND_API_KEY = (process.env.RESEND_API_KEY || "").trim();
const FROM_EMAIL = process.env.FROM_EMAIL || "HireStepX <noreply@hirestepx.com>";
const CRON_SECRET = (process.env.CRON_SECRET || "").trim();
const APP_URL = (process.env.APP_URL || "https://hirestepx.com").replace(/\/$/, "");
const UPSTASH_URL = (process.env.UPSTASH_REDIS_REST_URL || "").trim();
const UPSTASH_TOKEN = (process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();

const ACTIVATION_TTL_SECONDS = 14 * 24 * 3600;

interface ProfileRow {
  id: string;
  name: string | null;
  email: string;
  created_at: string;
  target_role: string | null;
  practice_timestamps: string[] | null;
}

async function redisGet(key: string): Promise<string | null> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return null;
  try {
    const res = await fetch(`${UPSTASH_URL}/GET/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return null;
    return ((await res.json()) as { result: string | null }).result;
  } catch { return null; }
}

async function redisSet(key: string, value: string): Promise<void> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return;
  try {
    await fetch(
      `${UPSTASH_URL}/SET/${encodeURIComponent(key)}/${encodeURIComponent(value)}/EX/${ACTIVATION_TTL_SECONDS}`,
      { headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }, signal: AbortSignal.timeout(5_000) },
    );
  } catch { /* best effort */ }
}

function buildActivationEmail(user: ProfileRow): { subject: string; html: string } {
  const safeName = escapeHtml(user.name?.split(" ")[0] || "there");
  const safeRole = escapeHtml(user.target_role || "your target role");
  const sessionUrl = `${APP_URL}/session/new`;

  const subject = `${safeName}, your 2 free sessions are waiting`;
  const body =
    title(`Ready when you are, ${safeName}`) +
    para(`You signed up for HireStepX yesterday — but haven't started your first session yet. That's fine. Interview prep is easy to put off.`) +
    para(`Here's the thing: ${safeRole.length > 1 ? `you picked <strong>${safeRole}</strong> as your target role.` : "you've already picked a target role."} Two free mock sessions are already unlocked on your account. No card, no payment, no catch.`) +
    para(`A session takes 15 minutes. You get scored on STAR delivery, technical accuracy, and communication — with a breakdown sent to your inbox right after.`) +
    button("Start your free session", sessionUrl) +
    para(`No pressure. But the longer you wait, the harder it gets to start.`);

  const html = emailShell({ preview: subject, body });

  return { subject, html };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Verify cron secret — Vercel injects Authorization: Bearer <CRON_SECRET>
  const authHeader = (req.headers.authorization || "").replace("Bearer ", "");
  if (CRON_SECRET && authHeader !== CRON_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(503).json({ error: "DB not configured" });
  }
  if (!RESEND_API_KEY) {
    return res.status(503).json({ error: "Email not configured" });
  }

  const dbHeaders = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  };

  const now = Date.now();
  const windowStart = new Date(now - 48 * 60 * 60 * 1000).toISOString();
  const windowEnd = new Date(now - 20 * 60 * 60 * 1000).toISOString();

  // Users who signed up in the 20–48h window and have no practice_timestamps.
  // practice_timestamps is an array; empty array or null both mean never practiced.
  const profileRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles` +
    `?created_at=gte.${encodeURIComponent(windowStart)}` +
    `&created_at=lte.${encodeURIComponent(windowEnd)}` +
    `&select=id,name,email,created_at,target_role,practice_timestamps` +
    `&limit=200`,
    { headers: dbHeaders, signal: AbortSignal.timeout(15_000) },
  );

  if (!profileRes.ok) {
    const errText = await profileRes.text().catch(() => "");
    return res.status(502).json({ error: "DB query failed", detail: errText.slice(0, 200) });
  }

  const allProfiles = (await profileRes.json().catch(() => [])) as ProfileRow[];

  // Filter to users with zero completed sessions
  const profiles = allProfiles.filter(p => {
    if (!p.email) return false;
    const ts = p.practice_timestamps;
    return !ts || ts.length === 0;
  });

  let sent = 0;
  let skipped = 0;

  for (const user of profiles) {
    const redisKey = `activation_d1:${user.id}`;
    const alreadySent = await redisGet(redisKey);
    if (alreadySent) { skipped++; continue; }

    const { subject, html } = buildActivationEmail(user);

    try {
      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `activation-d1-${user.id}`,
        },
        body: JSON.stringify({ from: FROM_EMAIL, to: [user.email], subject, html }),
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
  }

  return res.status(200).json({ sent, skipped, total: profiles.length });
}
