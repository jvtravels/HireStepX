/* Vercel Cron — Payment Abandonment Recovery
 * Runs hourly. Finds payment intents created 1-24 hours ago where the user
 * never completed payment, sends a recovery email, then deletes the key.
 * Intent keys are created by create-order.ts and deleted by
 * verify-payment.ts on successful payment.
 */

import { verifyCronAuth } from "./_cron-auth";
import { recordCronResult } from "./_cron-heartbeat";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { escapeHtml } from "./_shared";
import { mapPool, timeBudget } from "./_batch";
import { emailShell, title, para, b, button, dataCard, mono, type EmailFooterOptions } from "./_email-theme";
import { isSuppressed, marketingEmailParts, preferenceDepsFromEnv } from "./_unsubscribe";

const UPSTASH_URL = (process.env.UPSTASH_REDIS_REST_URL || "").trim();
const UPSTASH_TOKEN = (process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();
const RESEND_API_KEY = (process.env.RESEND_API_KEY || "").trim();
const FROM_EMAIL = process.env.FROM_EMAIL || "HireStepX <noreply@hirestepx.com>";
const APP_URL = (process.env.APP_URL || "https://hirestepx.vercel.app").replace(/\/$/, "");

const RUN_BUDGET_MS = 45_000;
const SEND_CONCURRENCY = 4;

interface PaymentIntent {
  userId: string;
  email: string;
  plan: string;
  amount: number;
  planName: string;
  createdAt: number;
}

async function redisScan(cursor: string, pattern: string): Promise<[string, string[]] | null> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return null;
  try {
    const res = await fetch(`${UPSTASH_URL}/SCAN/${cursor}/MATCH/${encodeURIComponent(pattern)}/COUNT/100`, {
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.result as [string, string[]];
  } catch { return null; }
}

async function redisGet(key: string): Promise<string | null> {
  try {
    const res = await fetch(`${UPSTASH_URL}/GET/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.result as string | null;
  } catch { return null; }
}

async function redisDel(key: string): Promise<void> {
  try {
    await fetch(`${UPSTASH_URL}/DEL/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
    });
  } catch { /* best effort */ }
}

/* Claim before sending: SET NX so two overlapping cron runs can't both email the same intent.
   The claim outlives a run (10 min) and is released when the send fails so the next run retries. */
const CLAIM_TTL_SECONDS = 600;
async function redisClaim(key: string): Promise<boolean> {
  try {
    const res = await fetch(`${UPSTASH_URL}/SET/${encodeURIComponent(`claim:${key}`)}/1/NX/EX/${CLAIM_TTL_SECONDS}`, {
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data.result === "OK";
  } catch { return false; }
}

function buildEmail(intent: PaymentIntent, footer?: EmailFooterOptions): { subject: string; html: string } {
  const safePlan = escapeHtml(intent.planName);
  const amount = (intent.amount / 100).toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
  const pricingUrl = `${APP_URL}/pricing`;
  return {
    subject: "You're one step away from Pro",
    html: emailShell({
      footer,
      preview: "Your checkout is still open. Finish whenever you're ready.",
      body:
        title("One step", { accentWord: "away." }) +
        para(`You started checkout for ${b(safePlan)} and didn't quite finish. No rush, your plan is still waiting and you can pick it back up whenever it suits you.`) +
        dataCard("Your plan", [
          ["Plan", safePlan],
          ["Amount", mono(amount)],
        ]) +
        button("Complete your purchase", pricingUrl) +
        para(`No pressure at all, the free tier stays open too. This is the only reminder we'll send about this.`, { small: true, muted: true }),
    }),
  };
}

async function sendEmail(intent: PaymentIntent): Promise<boolean> {
  if (!RESEND_API_KEY) return false;
  const parts = await marketingEmailParts(intent.userId, "marketing");
  const { subject, html } = buildEmail(intent, parts.footer);
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM_EMAIL, to: [intent.email], subject, html, ...parts.resend }),
    });
    return res.ok;
  } catch { return false; }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!verifyCronAuth(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    return res.status(503).json({ error: "Redis not configured" });
  }

  const now = Date.now();
  const MIN_AGE_MS = 60 * 60 * 1000;     // email after 1h
  const MAX_AGE_MS = 24 * 60 * 60 * 1000; // don't email if > 24h (stale)

  let sent = 0, skipped = 0, scanned = 0;
  let cursor = "0";
  let truncated = false;
  const budget = timeBudget(RUN_BUDGET_MS);

  const processKey = async (key: string) => {
    scanned++;
    const raw = await redisGet(key);
    if (!raw) return;
    let intent: PaymentIntent;
    try { intent = JSON.parse(raw); } catch { await redisDel(key); return; }
    const age = now - (intent.createdAt || 0);
    if (age < MIN_AGE_MS) { skipped++; return; } // too fresh
    if (age > MAX_AGE_MS) { await redisDel(key); skipped++; return; } // stale — forget
    if (!intent.email) { await redisDel(key); return; }
    // Left in place (not deleted) when suppressed: a transient lookup failure must not lose the intent.
    if (await isSuppressed(preferenceDepsFromEnv(), intent.userId, "marketing")) { skipped++; return; }
    if (!(await redisClaim(key))) { skipped++; return; }
    const ok = await sendEmail(intent);
    if (ok) { sent++; await redisDel(key); } else { await redisDel(`claim:${key}`); }
  };

  try {
    // SCAN until finished or the time budget runs out; a truncated run is reported, not silent.
    for (;;) {
      const result = await redisScan(cursor, "pay_intent:*");
      if (!result) break;
      cursor = result[0];
      await mapPool(result[1] || [], SEND_CONCURRENCY, processKey);
      if (cursor === "0") break; // SCAN finished
      if (budget.expired()) { truncated = true; break; }
    }
    if (truncated) console.error(`[send-abandonment-emails] time budget hit before SCAN finished (scanned=${scanned}, sent=${sent}); remaining intents are picked up next run`);
    await recordCronResult("send-abandonment-emails", { errors: 0 });
    return res.status(200).json({ sent, skipped, scanned, truncated });
  } catch (err) {
    console.error("[send-abandonment-emails] Error:", err);
    return res.status(500).json({ error: "Internal error", sent, scanned });
  }
}
