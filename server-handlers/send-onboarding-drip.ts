/* Vercel Cron — Post-upgrade onboarding drip emails
 *
 * Fires daily at 12:30 UTC (6:00 PM IST). Targets users who recently
 * upgraded to starter or pro and sends two timed emails:
 *
 *   Day 2  (1–3 days after subscription_start): "Here's what you unlocked"
 *   Day 5  (4–7 days after subscription_start): "Have you tried this yet?"
 *
 * Idempotency is handled via Upstash Redis keys:
 *   onboarding:day2:<userId>  — set on send, TTL 30 days
 *   onboarding:day5:<userId>  — set on send, TTL 30 days
 *
 * This avoids schema migrations while being safe under cron retries
 * and duplicate runs. */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { escapeHtml } from "./_shared";
import { emailShell, title, para, b, button, dataCard } from "./_email-theme";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const RESEND_API_KEY = (process.env.RESEND_API_KEY || "").trim();
const FROM_EMAIL = process.env.FROM_EMAIL || "HireStepX <noreply@hirestepx.com>";
const CRON_SECRET = (process.env.CRON_SECRET || "").trim();
const APP_URL = (process.env.APP_URL || "https://hirestepx.com").replace(/\/$/, "");
const UPSTASH_URL = (process.env.UPSTASH_REDIS_REST_URL || "").trim();
const UPSTASH_TOKEN = (process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();

const TTL_SECONDS = 30 * 24 * 3600; // 30 days

interface ProfileRow {
  id: string;
  name: string | null;
  email: string;
  subscription_tier: string;
  subscription_start: string;
  target_role: string | null;
}

type DripStep = "day2" | "day5";

async function redisGet(key: string): Promise<string | null> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return null;
  try {
    const res = await fetch(`${UPSTASH_URL}/GET/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.result as string | null;
  } catch { return null; }
}

async function redisSet(key: string, value: string): Promise<void> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return;
  try {
    await fetch(`${UPSTASH_URL}/SET/${encodeURIComponent(key)}/${encodeURIComponent(value)}/EX/${TTL_SECONDS}`, {
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
      signal: AbortSignal.timeout(5_000),
    });
  } catch { /* best effort */ }
}

function getDripStep(daysSinceStart: number): DripStep | null {
  if (daysSinceStart >= 1 && daysSinceStart <= 3) return "day2";
  if (daysSinceStart >= 4 && daysSinceStart <= 7) return "day5";
  return null;
}

function buildDay2Email(
  name: string,
  tier: string,
  role: string | null,
): { subject: string; html: string } {
  const safeName = escapeHtml(name.split(" ")[0] || "there");
  const safeRole = escapeHtml(role || "your target role");
  const isPro = tier === "pro";
  const sessionUrl = `${APP_URL}/session/new`;
  const salaryUrl = `${APP_URL}/interview?type=salary-negotiation`;

  return {
    subject: `What's unlocked on your ${isPro ? "Pro" : "Starter"} plan`,
    html: emailShell({
      preview: `Your ${isPro ? "Pro" : "Starter"} plan is active. Here's the fastest way to get value from it.`,
      body:
        title("You're in.", { accentWord: "Here's what that means." }) +
        para(`Hi ${safeName}, your plan is active. Here is the fastest way to get value from it before your ${safeRole} prep window closes.`) +
        dataCard(`What's unlocked`, [
          ["Sessions", isPro ? "Unlimited, every day" : "5 per Sprint Pack"],
          ["Question types", "Behavioral, Technical, Case Study, HR"],
          ...(isPro ? [["Salary negotiation", "Practice your offer conversation with AI"] as [string, string]] : []),
          ["Resume tailoring", "Questions matched to your uploaded resume"],
          ["Coaching feedback", "STAR breakdown + model answer after every session"],
        ]) +
        para(`${b("Start with one session now.")} Pick ${b(safeRole)} as your focus and do a 10-minute behavioral round. The AI will tell you your weakest dimension — that becomes your practice target for the week.`) +
        button("Start your first session", sessionUrl) +
        (isPro
          ? para(`${b("Pro tip:")} The salary negotiation mode is the most underused feature. If you have an offer coming, practice the conversation before it happens. Most candidates leave 10–20% on the table.`) +
            button("Try salary negotiation mode", salaryUrl)
          : "") +
        para("Reply to this email if you have a specific company or role in mind — we can suggest the best session type to start with.", { small: true, muted: true }),
    }),
  };
}

function buildDay5Email(
  name: string,
  tier: string,
  role: string | null,
): { subject: string; html: string } {
  const safeName = escapeHtml(name.split(" ")[0] || "there");
  const safeRole = escapeHtml(role || "your target role");
  const isPro = tier === "pro";
  const sessionUrl = `${APP_URL}/session/new`;
  const reportUrl = `${APP_URL}/dashboard`;

  return {
    subject: `${safeName}, a quick check-in on your ${safeRole} prep`,
    html: emailShell({
      preview: "Three things worth knowing after your first week on the plan.",
      body:
        title("Five days", { accentWord: "in." }) +
        para(`Hi ${safeName}, five days into your plan. A few things that will make the next few weeks materially better:`) +
        dataCard("Tips from high-scorers", [
          ["Practice aloud", "Not in your head. Aloud. Scoring is 22 pts higher on average."],
          ["3 sessions per week", "Consistency beats marathon cramming every time."],
          ["Coach Notes tab", "After every session — the tab most users skip."],
          ...(isPro ? [["Salary negotiation", "Do at least one session before any offer call"] as [string, string]] : []),
        ]) +
        para(`${b("The Coach Notes tab")} inside your session report is the most important feature nobody uses. After every session the AI writes a specific, personalised list of what to change in your next session. It takes 2 minutes to read and it's why candidates who use it consistently see noticeably sharper answers within a few sessions.`) +
        button("Start a session and read your Coach Notes", sessionUrl) +
        para(`Your ${b(safeRole)} sessions and all past reports are in your dashboard whenever you need them.`) +
        button("View my dashboard", reportUrl) +
        para(`${isPro ? "Unlimited sessions" : "5 sessions per Sprint Pack"} — your plan covers you through placement season.`, { small: true, muted: true }),
    }),
  };
}

async function sendEmail(to: string, subject: string, html: string, idempotencyKey: string): Promise<boolean> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!CRON_SECRET || req.headers.authorization !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !RESEND_API_KEY) {
    return res.status(503).json({ error: "Not configured" });
  }

  // Find all paid users whose subscription started 1–7 days ago
  const cutoffFar = new Date(Date.now() - 7 * 86400_000).toISOString();
  const cutoffNear = new Date(Date.now() - 1 * 86400_000).toISOString();

  const profilesRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles` +
    `?subscription_tier=in.(starter,pro)` +
    `&subscription_start=gte.${encodeURIComponent(cutoffFar)}` +
    `&subscription_start=lte.${encodeURIComponent(cutoffNear)}` +
    `&select=id,name,email,subscription_tier,subscription_start,target_role` +
    `&limit=200`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      signal: AbortSignal.timeout(10_000),
    },
  );

  if (!profilesRes.ok) {
    return res.status(500).json({ error: "Failed to query profiles" });
  }

  const profiles: ProfileRow[] = await profilesRes.json();
  if (!Array.isArray(profiles) || profiles.length === 0) {
    return res.status(200).json({ sent: 0, skipped: 0, message: "No candidates" });
  }

  let sent = 0;
  let skipped = 0;

  for (const user of profiles) {
    if (!user.email || !user.subscription_start) { skipped++; continue; }

    const daysSince = Math.floor((Date.now() - new Date(user.subscription_start).getTime()) / 86400_000);
    const step = getDripStep(daysSince);
    if (!step) { skipped++; continue; }

    const redisKey = `onboarding:${step}:${user.id}`;
    const alreadySent = await redisGet(redisKey);
    if (alreadySent) { skipped++; continue; }

    const { subject, html } =
      step === "day2"
        ? buildDay2Email(user.name || "", user.subscription_tier, user.target_role)
        : buildDay5Email(user.name || "", user.subscription_tier, user.target_role);

    const idempotencyKey = `onboarding-${step}-${user.id}`;
    const ok = await sendEmail(user.email, subject, html, idempotencyKey);

    if (ok) {
      await redisSet(redisKey, new Date().toISOString());
      sent++;
    } else {
      skipped++;
    }
  }

  return res.status(200).json({ sent, skipped, total: profiles.length });
}
