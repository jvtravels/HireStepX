/* Vercel Cron — Payment Abandonment Recovery
 * Runs hourly. Finds payment intents created 1-24 hours ago where the user
 * never completed payment, sends a recovery email, then deletes the key.
 * Intent keys are created by create-order.ts and deleted by
 * verify-payment.ts on successful payment.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { escapeHtml } from "./_shared";
import { emailShell, title, para, b, button, dataCard, mono } from "./_email-theme";

const UPSTASH_URL = (process.env.UPSTASH_REDIS_REST_URL || "").trim();
const UPSTASH_TOKEN = (process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();
const RESEND_API_KEY = (process.env.RESEND_API_KEY || "").trim();
const FROM_EMAIL = process.env.FROM_EMAIL || "HireStepX <onboarding@resend.dev>";
const APP_URL = (process.env.APP_URL || "https://hirestepx.vercel.app").replace(/\/$/, "");
const CRON_SECRET = (process.env.CRON_SECRET || "").trim();

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

function buildEmail(intent: PaymentIntent): { subject: string; html: string } {
  const safePlan = escapeHtml(intent.planName);
  const amount = (intent.amount / 100).toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
  const pricingUrl = `${APP_URL}/pricing`;
  return {
    subject: "You're one step away from Pro",
    html: emailShell({
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
  const { subject, html } = buildEmail(intent);
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM_EMAIL, to: [intent.email], subject, html }),
    });
    return res.ok;
  } catch { return false; }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Require CRON_SECRET unconditionally. x-vercel-cron is NOT stripped by Vercel
  // on inbound external requests — any caller can spoof it, so it provides no auth.
  const authHeader = req.headers.authorization || "";
  const hasSecret = CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`;
  if (!hasSecret) {
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

  try {
    // Use SCAN to iterate over all pay_intent:* keys safely
    for (let i = 0; i < 50; i++) { // cap iterations to protect runtime
      const result = await redisScan(cursor, "pay_intent:*");
      if (!result) break;
      cursor = result[0];
      const keys = result[1] || [];
      for (const key of keys) {
        scanned++;
        const raw = await redisGet(key);
        if (!raw) continue;
        let intent: PaymentIntent;
        try { intent = JSON.parse(raw); } catch { await redisDel(key); continue; }
        const age = now - (intent.createdAt || 0);
        if (age < MIN_AGE_MS) { skipped++; continue; } // too fresh
        if (age > MAX_AGE_MS) { await redisDel(key); skipped++; continue; } // stale — forget
        if (!intent.email) { await redisDel(key); continue; }
        const ok = await sendEmail(intent);
        if (ok) { sent++; await redisDel(key); }
      }
      if (cursor === "0") break; // SCAN finished
    }
    return res.status(200).json({ sent, skipped, scanned });
  } catch (err) {
    console.error("[send-abandonment-emails] Error:", err);
    return res.status(500).json({ error: "Internal error", sent, scanned });
  }
}
