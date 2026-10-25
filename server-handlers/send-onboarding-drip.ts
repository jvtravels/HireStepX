/* Vercel Cron — Post-upgrade onboarding drip emails
 *
 * Fires daily at 12:30 UTC (6:00 PM IST). Targets users who recently
 * upgraded to Starter (Sprint Pack) and sends two timed emails:
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

import { verifyCronAuth } from "./_cron-auth";
import { recordCronResult } from "./_cron-heartbeat";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { escapeHtml } from "./_shared";
import { emailShell, hero, actions, para, button, note, data, type EmailFooterOptions } from "./_email-theme";
import { filterSuppressed, marketingEmailParts, preferenceDepsFromEnv } from "./_unsubscribe";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const RESEND_API_KEY = (process.env.RESEND_API_KEY || "").trim();
const FROM_EMAIL = process.env.FROM_EMAIL || "HireStepX <noreply@hirestepx.com>";
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
  role: string | null,
  footer?: EmailFooterOptions,
): { subject: string; html: string } {
  const safeName = escapeHtml(name.split(" ")[0] || "there");
  const safeRole = escapeHtml(role || "your target role");
  const rolePhrase = escapeHtml(role || "target role");
  const sessionUrl = `${APP_URL}/session/new`;

  return {
    subject: `${safeName}, your Sprint Pack is ready to use`,
    html: emailShell({
      footer,
      preview: "Here is the fastest way to get value from your 5 sessions.",
      body:
        hero({
          tone: "success",
          eyebrow: "Your Sprint Pack",
          title: `You're in, ${safeName}`,
          lede: `Your Sprint Pack is active: 5 sessions over 30 days. Here's the fastest way to get value from it for your ${rolePhrase} prep.`,
        }) +
        data([
          ["Sessions", "5 per Sprint Pack"],
          ["Question types", "Behavioral, Technical, Case Study, HR"],
          ["Resume tailoring", "Matched to your uploaded resume"],
          ["Coaching feedback", "STAR breakdown and model answer"],
        ]) +
        para(`Start with one session now. Pick ${safeRole} as your focus and do a 10-minute behavioral round. The AI will show you your weakest dimension, and that becomes your target for the week.`) +
        button("Start my first session", sessionUrl) +
        note("Have a specific company or role in mind? Just reply and we'll suggest the best session to start with."),
    }),
  };
}

function buildDay5Email(
  name: string,
  role: string | null,
  footer?: EmailFooterOptions,
): { subject: string; html: string } {
  const safeName = escapeHtml(name.split(" ")[0] || "there");
  const rolePhrase = escapeHtml(role || "target role");
  const sessionUrl = `${APP_URL}/session/new`;
  const reportUrl = `${APP_URL}/dashboard`;

  return {
    subject: `${safeName}, how is your ${rolePhrase} prep going?`,
    html: emailShell({
      footer,
      preview: "Three habits that make the rest of your pack count.",
      body:
        hero({
          eyebrow: "Day 5",
          title: `A few days in, ${safeName}`,
          lede: "By now you have had a first taste of the AI interviewer. Here are three habits that help candidates get the most out of the rest of their Sprint Pack.",
        }) +
        data([
          ["Practice aloud", "Say your answers, don't just think them"],
          ["3 sessions a week", "Steady beats cramming"],
          ["Coach Notes tab", "The tab most people skip"],
        ]) +
        para("Coach Notes inside your report is the most useful feature nobody uses. After every session the AI writes a specific list of what to change next time. It takes about 2 minutes to read.") +
        actions([
          { label: "Start a session", href: sessionUrl },
          { label: "View my dashboard", href: reportUrl, ghost: true },
        ]),
    }),
  };
}

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  idempotencyKey: string,
  extra: { reply_to: string; headers: Record<string, string> },
): Promise<boolean> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html, ...extra }),
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!verifyCronAuth(req)) {
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
    `?subscription_tier=eq.starter` +
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

  const allProfiles: ProfileRow[] = await profilesRes.json();
  const profiles = Array.isArray(allProfiles)
    ? await filterSuppressed(preferenceDepsFromEnv(), allProfiles, "marketing")
    : [];
  if (profiles.length === 0) {
    await recordCronResult("send-onboarding-drip", { errors: 0 });
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

    const parts = await marketingEmailParts(user.id, "marketing");
    const { subject, html } =
      step === "day2"
        ? buildDay2Email(user.name || "", user.target_role, parts.footer)
        : buildDay5Email(user.name || "", user.target_role, parts.footer);

    const idempotencyKey = `onboarding-${step}-${user.id}`;
    const ok = await sendEmail(user.email, subject, html, idempotencyKey, parts.resend);

    if (ok) {
      await redisSet(redisKey, new Date().toISOString());
      sent++;
    } else {
      skipped++;
    }
  }

  await recordCronResult("send-onboarding-drip", { errors: 0 });
  return res.status(200).json({ sent, skipped, total: profiles.length });
}
