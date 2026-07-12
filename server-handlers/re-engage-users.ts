/* Vercel Cron Function — Re-engage inactive users */
/* Runs daily at 10 AM UTC (3:30 PM IST). Sends tiered re-engagement emails:
 *   Day 1 after last session: "Your personalized session is waiting"
 *   Day 3: "Your skills are fading — here's what to practice"
 *   Day 7: "Last chance" with a discount/urgency nudge
 * Only targets free-tier users who have at least 1 session but haven't returned. */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { escapeHtml } from "./_shared";
import { emailShell, title, para, b, button, dataCard } from "./_email-theme";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const RESEND_API_KEY = (process.env.RESEND_API_KEY || "").trim();
const FROM_EMAIL = process.env.FROM_EMAIL || "HireStepX <noreply@hirestepx.com>";
const CRON_SECRET = (process.env.CRON_SECRET || "").trim();
const APP_URL = (process.env.APP_URL || "https://hirestepx.vercel.app").replace(/\/$/, "");

interface UserRow {
  id: string;
  name: string | null;
  email: string;
  subscription_tier: string;
  practice_timestamps: string[] | null;
  target_role: string | null;
  re_engage_sent: string | null; // ISO date of last re-engagement email
}

interface SessionRow {
  score: number;
  skill_scores: Record<string, number> | null;
  created_at: string;
}

type EmailTier = "day1" | "day3" | "day7" | "paid14" | "paid30";

function getEmailTier(daysSinceLastSession: number, lastEmailSent: string | null, isPaid = false): EmailTier | null {
  const lastSentDays = lastEmailSent
    ? Math.floor((Date.now() - new Date(lastEmailSent).getTime()) / 86400000)
    : Infinity;

  if (isPaid) {
    // Paid users get at most one email every 10 days
    if (lastSentDays < 10) return null;
    if (daysSinceLastSession >= 30 && daysSinceLastSession < 42) return "paid30";
    if (daysSinceLastSession >= 14 && daysSinceLastSession < 30) return "paid14";
    return null;
  }

  // Free: at most one email every 2 days
  if (lastSentDays < 2) return null;
  if (daysSinceLastSession >= 7 && daysSinceLastSession < 14) return "day7";
  if (daysSinceLastSession >= 3 && daysSinceLastSession < 7) return "day3";
  if (daysSinceLastSession >= 1 && daysSinceLastSession < 3) return "day1";
  return null;
}

function getWeakestSkill(skillScores: Record<string, number> | null): string | null {
  if (!skillScores) return null;
  const entries = Object.entries(skillScores);
  if (entries.length === 0) return null;
  return entries.sort(([, a], [, b]) => a - b)[0][0];
}

function buildEmail(
  user: UserRow,
  tier: EmailTier,
  lastSession: SessionRow | null,
): { subject: string; html: string } {
  const name = escapeHtml(user.name?.split(" ")[0] || "there");
  const role = escapeHtml(user.target_role || "your target role");
  const weakest = lastSession ? getWeakestSkill(lastSession.skill_scores) : null;
  const score = lastSession?.score ?? null;
  const dashUrl = `${APP_URL}/dashboard`;
  const sessionUrl = `${APP_URL}/session/new`;

  const safeWeakest = weakest ? escapeHtml(weakest) : null;

  const subjects: Record<EmailTier, string> = {
    day1: `${user.name?.split(" ")[0] || "Hey"}, your next practice session is ready`,
    day3: `Your ${weakest || "interview"} skills need a refresh`,
    day7: "Your practice sessions are still here",
    paid14: "Two weeks since your last Pro session",
    paid30: "Your Pro plan is active and ready when you are",
  };

  const titles: Record<EmailTier, string> = {
    day1: "Pick up",
    day3: "Worth a",
    day7: "Still",
    paid14: "Two weeks,",
    paid30: "Right here,",
  };
  const accents: Record<EmailTier, string> = {
    day1: "where you left off.",
    day3: "ten minutes.",
    day7: "right here.",
    paid14: "still unlimited.",
    paid30: "whenever you are.",
  };

  const heroText: Record<EmailTier, string> = {
    day1: `Hi ${name}, your personalised ${role} session is ready and waiting. Pick up exactly where you left off, your resume-tailored questions are already lined up.`,
    day3: safeWeakest
      ? `Hi ${name}, your ${b(safeWeakest)} score has room to grow. A focused 10-minute session can lift it by 15 points or more, and that is often the difference in a real interview.`
      : `Hi ${name}, most candidates see a 15-point lift with just one more session. Ten focused minutes keeps your momentum from fading.`,
    day7: score
      ? `Hi ${name}, you scored ${b(`${score}/100`)} last time. That is a solid start, and skills stay sharp with practice. One short session is all it takes to keep your edge.`
      : `Hi ${name}, interview skills fade quietly without practice. A quick 10-minute session keeps your edge sharp and your answers ready.`,
    paid14: `Hi ${name}, it has been two weeks since your last Pro session. Your plan includes unlimited practice, and a 10-minute drill today rebuilds the muscle memory that got you this far.`,
    paid30: `Hi ${name}, it has been about a month. Your ${role} skills are still in there, and your Pro plan is ready when you are. A focused 15-minute drill brings it all back.`,
  };

  const ctaText: Record<EmailTier, string> = {
    day1: "Continue practising",
    day3: weakest ? `Practise ${weakest}` : "Start a session",
    day7: "Practise now",
    paid14: "Start a quick session",
    paid30: "Start a focused drill",
  };

  const footerText: Record<EmailTier, string> = {
    day1: "You still have free sessions remaining, no card needed.",
    day3: "Ten minutes is all it takes. Your resume-personalised questions are waiting.",
    day7: "This is our last reminder. We will stop emailing, and your practice sessions will always be here when you are ready.",
    paid14: "You are on the Pro plan, unlimited sessions every day.",
    paid30: "Pause or cancel anytime from your settings. We want you practising only when it helps.",
  };

  const ctaUrl = tier === "day1" || tier === "paid14" || tier === "paid30" ? sessionUrl : dashUrl;

  const showCard = score && tier !== "day7";
  const cardRows: [string, string][] = [["Last score", `${score}/100`]];
  if (showCard && weakest) cardRows.push(["Focus area", escapeHtml(weakest)]);

  const html = emailShell({
    preview: footerText[tier],
    body:
      title(titles[tier], { accentWord: accents[tier] }) +
      para(heroText[tier]) +
      (showCard ? dataCard("Where you stand", cardRows) : "") +
      button(ctaText[tier], ctaUrl) +
      para(footerText[tier], { small: true, muted: true }),
  });

  return { subject: subjects[tier], html };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!CRON_SECRET || req.headers.authorization !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !RESEND_API_KEY) {
    return res.status(503).json({ error: "Not configured" });
  }

  try {
    // Find free-tier users with at least 1 practice session who haven't
    // been emailed in the last 2 days (rate-limit enforced below via
    // getEmailTier checking user.re_engage_sent).
    //
    // Target free AND paid users who haven't practiced recently. Paid users
    // get different copy (see buildEmail) since they need value-justification,
    // not upgrade prompts.
    const profilesRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?or=(subscription_tier.eq.free,subscription_tier.eq.starter,subscription_tier.eq.pro)&select=id,name,email,subscription_tier,practice_timestamps,target_role,re_engage_sent&limit=500`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      },
    );

    if (!profilesRes.ok) {
      return res.status(500).json({ error: "Failed to query profiles" });
    }

    const profiles: UserRow[] = await profilesRes.json();
    if (!Array.isArray(profiles) || profiles.length === 0) {
      return res.status(200).json({ sent: 0, message: "No users to re-engage" });
    }

    // Filter to users who have practiced but not recently.
    // Free tier: 1-14 day window. Paid tier: longer window (paid users have
    // higher tolerance; nag too early and they churn).
    const candidates = profiles.filter(p => {
      if (!p.email || !p.practice_timestamps || p.practice_timestamps.length === 0) return false;
      const lastPractice = new Date(p.practice_timestamps[p.practice_timestamps.length - 1]);
      const daysSince = Math.floor((Date.now() - lastPractice.getTime()) / 86400000);
      const isPaid = p.subscription_tier === "starter" || p.subscription_tier === "pro";
      if (isPaid) {
        // Paid: gently re-engage after 2 weeks idle, stop after 6 weeks
        return daysSince >= 14 && daysSince < 42;
      }
      return daysSince >= 1 && daysSince < 14;
    });

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    // Step 1 — compute tier for each candidate up-front; drop those that get no email
    type Eligible = { user: UserRow; tier: EmailTier };
    const eligible: Eligible[] = [];
    for (const user of candidates) {
      const lastPractice = new Date(user.practice_timestamps![user.practice_timestamps!.length - 1]);
      const daysSince = Math.floor((Date.now() - lastPractice.getTime()) / 86400000);
      const isPaid = user.subscription_tier === "starter" || user.subscription_tier === "pro";
      const tier = getEmailTier(daysSince, user.re_engage_sent, isPaid);
      if (!tier) { skipped++; continue; }
      eligible.push({ user, tier });
    }

    // Step 2 — batch-fetch the latest session per eligible user in ONE query.
    // This replaces an N+1 loop (N Supabase REST calls) with a single query using
    // `user_id=in.(a,b,c,…)`. We then reduce the result to the top-scoring recent
    // session per user in-memory. This cuts cron time from ~150s → <5s.
    const sessionByUser = new Map<string, SessionRow>();
    if (eligible.length > 0) {
      const userIds = eligible.map(e => e.user.id);
      try {
        const ids = userIds.map(id => encodeURIComponent(id)).join(",");
        const sessRes = await fetch(
          `${SUPABASE_URL}/rest/v1/sessions?user_id=in.(${ids})&order=created_at.desc&select=user_id,score,skill_scores,created_at`,
          {
            headers: {
              apikey: SUPABASE_SERVICE_ROLE_KEY,
              Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
          },
        );
        if (sessRes.ok) {
          const rows = await sessRes.json() as (SessionRow & { user_id: string })[];
          for (const row of rows) {
            // First row per user_id is most recent (order=created_at.desc)
            if (!sessionByUser.has(row.user_id)) sessionByUser.set(row.user_id, row);
          }
        }
      } catch (err) {
        console.warn("[re-engage] batch session fetch failed, proceeding without session data:", err);
      }
    }

    // Step 3 — send emails in parallel batches of 5 to respect Resend rate limits
    const now = new Date().toISOString();
    async function sendOne({ user, tier }: Eligible): Promise<"sent" | "failed"> {
      const lastSession = sessionByUser.get(user.id) || null;
      const { subject, html } = buildEmail(user, tier, lastSession);
      try {
        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: FROM_EMAIL, to: [user.email], subject, html }),
        });
        if (!emailRes.ok) {
          console.error(`Re-engage email failed for ${user.id.slice(0, 8)}...:`, emailRes.status);
          return "failed";
        }
        // Update re_engage_sent timestamp (best effort — email is already sent)
        fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}`, {
          method: "PATCH",
          headers: {
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({ re_engage_sent: now }),
        }).catch(err => console.warn(`[re-engage] re_engage_sent update failed for ${user.id.slice(0, 8)}:`, err?.message));
        return "sent";
      } catch (err) {
        console.error(`Re-engage email error for ${user.id.slice(0, 8)}...:`, err);
        return "failed";
      }
    }

    const BATCH_SIZE = 5;
    for (let i = 0; i < eligible.length; i += BATCH_SIZE) {
      const batch = eligible.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(batch.map(sendOne));
      for (const r of results) { if (r === "sent") sent++; else failed++; }
    }

    return res.status(200).json({
      sent,
      skipped,
      failed,
      candidates: candidates.length,
      total: profiles.length,
    });
  } catch (err) {
    console.error("Re-engage users error:", err);
    return res.status(500).json({ error: "Internal error" });
  }
}
