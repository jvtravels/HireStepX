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
  has_completed_onboarding: boolean;
  created_at: string;
}

interface SessionRow {
  score: number;
  skill_scores: Record<string, unknown> | null;
  created_at: string;
}

type EmailTier = "day1" | "day3" | "day7" | "paid14" | "paid30" | "winback" | "employer_interest";

// Below this many completed sessions, a candidate's evidence (skills,
// quotes, readiness forecast) is thin — the employer_interest tier nudges
// them to practice more specifically because an employer is already
// looking, not just because they've gone idle.
const LOW_SESSION_THRESHOLD = 3;

function getEmailTier(daysSinceLastSession: number, lastEmailSent: string | null, isPaid = false): EmailTier | null {
  const lastSentDays = lastEmailSent
    ? Math.floor((Date.now() - new Date(lastEmailSent).getTime()) / 86400000)
    : Infinity;

  if (isPaid) {
    // Paid users get at most one email every 10 days
    if (lastSentDays < 10) return null;
    if (daysSinceLastSession >= 60 && daysSinceLastSession < 90) return "winback";
    if (daysSinceLastSession >= 30 && daysSinceLastSession < 60) return "paid30";
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

/* skill_scores values can be a plain number or a legacy { score, reason } wrapper —
   mirrors src/sessionDetailHelpers.ts's extractScore for the same shape. */
function extractSkillScore(raw: unknown): number {
  if (typeof raw === "number") return raw;
  if (typeof raw === "object" && raw !== null && "score" in raw) return (raw as { score: number }).score;
  return 0;
}

function getWeakestSkill(skillScores: Record<string, unknown> | null): string | null {
  if (!skillScores) return null;
  const entries = Object.entries(skillScores);
  if (entries.length === 0) return null;
  return entries.sort(([, a], [, b]) => extractSkillScore(a) - extractSkillScore(b))[0][0];
}

const FREE_SESSION_LIMIT = 2;

function buildEmail(
  user: UserRow,
  tier: EmailTier,
  lastSession: SessionRow | null,
  employerInterest?: { count: number; roleTitle: string | null },
): { subject: string; html: string } {
  const name = escapeHtml(user.name?.split(" ")[0] || "there");
  const role = escapeHtml(user.target_role || "your target role");
  const weakest = lastSession ? getWeakestSkill(lastSession.skill_scores) : null;
  const score = lastSession?.score ?? null;
  const dashUrl = `${APP_URL}/dashboard`;
  const sessionUrl = `${APP_URL}/session/new`;
  const upgradeUrl = `${APP_URL}/dashboard?upgrade=1`;

  if (tier === "employer_interest" && employerInterest) {
    const interestedRole = employerInterest.roleTitle ? escapeHtml(employerInterest.roleTitle) : "a role";
    const subject = `Employers are checking you out, ${user.name?.split(" ")[0] || "there"} — here's how to stand out`;
    const hero =
      employerInterest.count === 1
        ? `Hi ${name}, an employer has shortlisted you for ${interestedRole}. Your profile is thin on evidence though, just ${b(`${user.practice_timestamps?.length ?? 0} session${(user.practice_timestamps?.length ?? 0) === 1 ? "" : "s"}`)} so far. A few more mock interviews sharpen the skill scores and sample answers employers see on your profile.`
        : `Hi ${name}, ${employerInterest.count} employers have shortlisted you, including one for ${interestedRole}. Your profile is thin on evidence though, just ${b(`${user.practice_timestamps?.length ?? 0} session${(user.practice_timestamps?.length ?? 0) === 1 ? "" : "s"}`)} so far. A few more mock interviews sharpen the skill scores and sample answers employers see on your profile.`;
    const footerLine = "More sessions, stronger evidence, better odds of an interview invite.";
    const html = emailShell({
      preview: footerLine,
      body:
        title("Employers are", { accentWord: "looking." }) +
        para(hero) +
        button("Practice now", sessionUrl) +
        para(footerLine, { small: true, muted: true }),
    });
    return { subject, html };
  }

  // employer_interest always returns above (guarded by `employerInterest`
  // being set whenever tier is computed as "employer_interest" in the
  // handler below) — narrow so the Records past this point don't need an
  // unused entry for it.
  const genericTier = tier as Exclude<EmailTier, "employer_interest">;

  const safeWeakest = weakest ? escapeHtml(weakest) : null;

  // Free users who've hit the limit should be directed to upgrade, not practice.
  const isFreeUser = user.subscription_tier === "free";
  const sessionsUsed = user.practice_timestamps?.length ?? 0;
  const hitFreeLimit = isFreeUser && sessionsUsed >= FREE_SESSION_LIMIT;

  const subjects: Record<Exclude<EmailTier, "employer_interest">, string> = {
    day1: `${user.name?.split(" ")[0] || "Hey"}, your next practice session is ready`,
    day3: `Your ${weakest || "interview"} skills need a refresh`,
    day7: "Your practice sessions are still here",
    paid14: "Two weeks since your last session",
    paid30: "Your Sprint Pack is active and ready when you are",
    winback: "We saved your progress — come back whenever you're ready",
  };

  const titles: Record<Exclude<EmailTier, "employer_interest">, string> = {
    day1: "Pick up",
    day3: "Worth a",
    day7: "Still",
    paid14: "Two weeks,",
    paid30: "Right here,",
    winback: "Still in",
  };
  const accents: Record<Exclude<EmailTier, "employer_interest">, string> = {
    day1: "where you left off.",
    day3: "ten minutes.",
    day7: "right here.",
    paid14: "still waiting.",
    paid30: "whenever you are.",
    winback: "your corner.",
  };

  const heroText: Record<Exclude<EmailTier, "employer_interest">, string> = {
    day1: `Hi ${name}, your personalised ${role} session is ready and waiting. Pick up exactly where you left off, your resume-tailored questions are already lined up.`,
    day3: safeWeakest
      ? `Hi ${name}, your ${b(safeWeakest)} score has room to grow. A focused 10-minute session can lift it by 15 points or more, and that is often the difference in a real interview.`
      : `Hi ${name}, most candidates see a 15-point lift with just one more session. Ten focused minutes keeps your momentum from fading.`,
    day7: score
      ? `Hi ${name}, you scored ${b(`${score}/100`)} last time. That is a solid start, and skills stay sharp with practice. One short session is all it takes to keep your edge.`
      : `Hi ${name}, interview skills fade quietly without practice. A quick 10-minute session keeps your edge sharp and your answers ready.`,
    paid14: `Hi ${name}, it has been two weeks since your last session. Your Sprint Pack still has sessions on it, and a 10-minute drill today rebuilds the muscle memory that got you this far.`,
    paid30: `Hi ${name}, it has been about a month. Your ${role} skills are still in there, and your Sprint Pack is ready when you are. A focused 15-minute drill brings it all back.`,
    winback: `Hi ${name}, it has been a while. Your resume, your target role, and everything you built is still saved exactly as you left it. Whenever you are ready to start again, we are here.`,
  };

  const ctaText: Record<Exclude<EmailTier, "employer_interest">, string> = {
    day1: hitFreeLimit ? "See upgrade options" : "Continue practising",
    day3: hitFreeLimit ? "Upgrade from ₹9" : (weakest ? `Practise ${weakest}` : "Start a session"),
    day7: "Practise now",
    paid14: "Start a quick session",
    paid30: "Start a focused drill",
    winback: "Pick up where you left off",
  };

  const footerText: Record<Exclude<EmailTier, "employer_interest">, string> = {
    day1: hitFreeLimit
      ? "You've used both free sessions. Plans start at ₹9 per session — no subscription required."
      : "You still have free sessions remaining, no card needed.",
    day3: hitFreeLimit
      ? "Plans start at ₹9 per session — less than a coffee, and your history stays intact."
      : "Ten minutes is all it takes. Your resume-personalised questions are waiting.",
    day7: "This is our last reminder. We will stop emailing, and your practice sessions will always be here when you are ready.",
    paid14: "You are on the Sprint Pack — check your dashboard for sessions remaining.",
    paid30: "Pause or cancel anytime from your settings. We want you practising only when it helps.",
    winback: "No pressure. Your practice history and resume are saved. Come back whenever it suits you.",
  };

  // Free-limit-hit users should go to upgrade, not the session-new page.
  const ctaUrl = hitFreeLimit && (tier === "day1" || tier === "day3")
    ? upgradeUrl
    : tier === "day1" || tier === "paid14" || tier === "paid30" || tier === "winback" ? sessionUrl : dashUrl;

  const showCard = score && tier !== "day7";
  const cardRows: [string, string][] = [["Last score", `${score}/100`]];
  if (showCard && weakest) cardRows.push(["Focus area", escapeHtml(weakest)]);

  // Onboarded but never started a single session — "continue where you left
  // off" copy is false for this segment (audit, 2026-09: this cron's
  // candidate query required practice_timestamps.length > 0, so these users
  // — onboarded, zero sessions — were never emailed at all). Swap in
  // first-session framing for the day1/day3/day7 cadence instead of adding
  // new tiers.
  const neverStarted = sessionsUsed === 0 && lastSession === null;
  if (neverStarted && (tier === "day1" || tier === "day3" || tier === "day7")) {
    const firstSessionSubjects: Record<"day1" | "day3" | "day7", string> = {
      day1: `${user.name?.split(" ")[0] || "Hey"}, your first practice session is ready`,
      day3: `Your ${role} questions are still waiting`,
      day7: "Your free sessions haven't been used yet",
    };
    const firstSessionHero: Record<"day1" | "day3" | "day7", string> = {
      day1: `Hi ${name}, you're all set up but haven't started a session yet. Your resume-tailored ${role} questions are ready whenever you are, it takes about 15 minutes.`,
      day3: `Hi ${name}, your first mock interview is still waiting. Most candidates see the value after just one 15-minute session.`,
      day7: `Hi ${name}, your ${b("2 free mock interviews")} haven't been used yet. No card needed, just pick a time and start.`,
    };
    const firstSessionFooter: Record<"day1" | "day3" | "day7", string> = {
      day1: "Two free sessions are waiting, no card needed.",
      day3: "Still free, still waiting, no card needed.",
      day7: "This is our last reminder. Your account and free sessions will always be here when you're ready.",
    };
    const html = emailShell({
      preview: firstSessionFooter[tier],
      body:
        title(titles[tier], { accentWord: accents[tier] }) +
        para(firstSessionHero[tier]) +
        button("Start my first session", sessionUrl) +
        para(firstSessionFooter[tier], { small: true, muted: true }),
    });
    return { subject: firstSessionSubjects[tier], html };
  }

  const html = emailShell({
    preview: footerText[genericTier],
    body:
      title(titles[genericTier], { accentWord: accents[genericTier] }) +
      para(heroText[genericTier]) +
      (showCard ? dataCard("Where you stand", cardRows) : "") +
      button(ctaText[genericTier], ctaUrl) +
      para(footerText[genericTier], { small: true, muted: true }),
  });

  return { subject: subjects[genericTier], html };
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
      `${SUPABASE_URL}/rest/v1/profiles?or=(subscription_tier.eq.free,subscription_tier.eq.starter)&select=id,name,email,subscription_tier,practice_timestamps,target_role,re_engage_sent,has_completed_onboarding,created_at&limit=500`,
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
    //
    // Also admit onboarded free-tier users who never started a single
    // session — the day1/day3/day7 cadence still applies, just measured
    // from signup (created_at) instead of last-practice date, since there
    // is no practice_timestamps entry to measure from. Paid users are
    // never in this bucket (you can't subscribe without starting first).
    const candidates = profiles.filter(p => {
      if (!p.email) return false;
      const neverStarted = !p.practice_timestamps || p.practice_timestamps.length === 0;
      if (neverStarted) {
        if (p.subscription_tier === "starter" || !p.has_completed_onboarding || !p.created_at) return false;
        const daysSince = Math.floor((Date.now() - new Date(p.created_at).getTime()) / 86400000);
        return daysSince >= 1 && daysSince < 14;
      }
      const lastPractice = new Date(p.practice_timestamps![p.practice_timestamps!.length - 1]);
      const daysSince = Math.floor((Date.now() - lastPractice.getTime()) / 86400000);
      const isPaid = p.subscription_tier === "starter";
      if (isPaid) {
        // Paid: re-engage 2–9 weeks idle; winback at 8–13 weeks
        return daysSince >= 14 && daysSince < 90;
      }
      return daysSince >= 1 && daysSince < 14;
    });

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    // Employer-interest signal: candidates any cron pass might otherwise send
    // a generic "come back" email to, but who actually have an employer
    // actively considering them right now (shortlisted/invited/interviewing).
    // Fetched for the whole candidate pool up front — cheap, one query — and
    // combined with a low session count below to pick a more motivating,
    // specific tier over the generic day1/day3/day7 copy.
    const interestByUser = new Map<string, { count: number; roleTitle: string | null }>();
    if (candidates.length > 0) {
      try {
        const ids = candidates.map(c => c.id).map(id => encodeURIComponent(id)).join(",");
        const interestRes = await fetch(
          `${SUPABASE_URL}/rest/v1/requirement_matches?candidate_user_id=in.(${ids})&candidate_status=in.(shortlisted,interview_invited,interviewing)` +
            `&select=candidate_user_id,employer_requirements(title)&limit=2000`,
          {
            headers: {
              apikey: SUPABASE_SERVICE_ROLE_KEY,
              Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
          },
        );
        if (interestRes.ok) {
          const rows = await interestRes.json() as Array<{ candidate_user_id: string; employer_requirements: { title: string } | null }>;
          for (const row of rows) {
            const existing = interestByUser.get(row.candidate_user_id);
            interestByUser.set(row.candidate_user_id, {
              count: (existing?.count ?? 0) + 1,
              roleTitle: existing?.roleTitle ?? row.employer_requirements?.title ?? null,
            });
          }
        }
      } catch (err) {
        console.warn("[re-engage] employer-interest fetch failed, proceeding without it:", err);
      }
    }

    // Step 1 — compute tier for each candidate up-front; drop those that get no email
    type Eligible = { user: UserRow; tier: EmailTier; employerInterest?: { count: number; roleTitle: string | null } };
    const eligible: Eligible[] = [];
    for (const user of candidates) {
      const neverStarted = !user.practice_timestamps || user.practice_timestamps.length === 0;
      const daysSince = neverStarted
        ? Math.floor((Date.now() - new Date(user.created_at).getTime()) / 86400000)
        : Math.floor((Date.now() - new Date(user.practice_timestamps![user.practice_timestamps!.length - 1]).getTime()) / 86400000);
      const isPaid = user.subscription_tier === "starter";

      const interest = interestByUser.get(user.id);
      const sessionsUsed = user.practice_timestamps?.length ?? 0;
      const lastSentDays = user.re_engage_sent
        ? Math.floor((Date.now() - new Date(user.re_engage_sent).getTime()) / 86400000)
        : Infinity;
      if (interest && sessionsUsed < LOW_SESSION_THRESHOLD && lastSentDays >= 2) {
        eligible.push({ user, tier: "employer_interest", employerInterest: interest });
        continue;
      }

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
    async function sendOne({ user, tier, employerInterest }: Eligible): Promise<"sent" | "failed"> {
      const lastSession = sessionByUser.get(user.id) || null;
      const { subject, html } = buildEmail(user, tier, lastSession, employerInterest);
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
