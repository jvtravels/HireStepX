/* Employer lifecycle emails: welcome (first profile) and two cron nudges.
 * Pure builders + selection + a retry-once Resend sender, so the edge
 * employer-profile handler and the Node nudge cron share one small module.
 * Deliberately imports only _email-theme (no _shared) to keep edge bundles small. */

import { emailShell, title, para, button, escapeHtml, type EmailFooterOptions } from "./_email-theme";

declare const process: { env: Record<string, string | undefined> };

const DAY_MS = 86_400_000;

const appUrl = () => (process.env.APP_URL || "https://hirestepx.com").replace(/\/$/, "");

export interface BuiltEmail {
  subject: string;
  html: string;
}

/** Transactional (no unsubscribe): it confirms an account the person just created. */
export function buildEmployerWelcomeEmail(companyName: string): BuiltEmail {
  const plain = companyName.trim().slice(0, 80) || "your company";
  const company = escapeHtml(plain);
  const subject = `Welcome to HireStepX, ${plain}`;
  const body =
    title(`Welcome, ${company}`) +
    para("Your company profile is live. The fastest way to see what HireStepX does is to post your first role.") +
    para("Tell us the title, skills and experience you need. We match it against candidates who have completed real mock interviews, and rank them on evidence from those sessions, not a keyword-stuffed resume.") +
    para("Browsing matches is free. You pay only when you unlock a candidate's contact details, so there is nothing to commit to up front.") +
    button("Post your first role", `${appUrl()}/employer/requirements/new`);
  return { subject, html: emailShell({ preview: subject, body }) };
}

export interface NudgeRequirement {
  id: string;
  employer_id: string;
  title: string;
  created_at: string;
  status: string;
}

export interface MatchStat {
  total: number;
  unlocked: number;
}

export type NudgeKind = "matches_waiting" | "stale_job";

export interface NudgeCandidate {
  kind: NudgeKind;
  requirement: NudgeRequirement;
  matchCount: number;
}

/** Windows are ranges, not exact days, so a missed daily run still catches the
    requirement next time; the per-requirement Redis key stops repeats. */
export const MATCHES_WAITING_MIN_AGE_DAYS = 3;
export const MATCHES_WAITING_MAX_AGE_DAYS = 10;
export const STALE_MIN_AGE_DAYS = 14;
export const STALE_MAX_AGE_DAYS = 45;

/** Pure. At most one nudge per employer per run (matches-waiting wins), and
    nothing for closed/generating/failed jobs or jobs that already had an unlock. */
export function selectNudges(
  requirements: readonly NudgeRequirement[],
  stats: Readonly<Record<string, MatchStat | undefined>>,
  now: number,
): NudgeCandidate[] {
  const waiting: NudgeCandidate[] = [];
  const stale: NudgeCandidate[] = [];
  for (const r of requirements) {
    const created = new Date(r.created_at).getTime();
    if (!Number.isFinite(created)) continue;
    const ageDays = (now - created) / DAY_MS;
    const stat = stats[r.id] ?? { total: 0, unlocked: 0 };
    if (stat.unlocked > 0) continue;
    if ((r.status === "ready" || r.status === "partial") && stat.total > 0
      && ageDays >= MATCHES_WAITING_MIN_AGE_DAYS && ageDays < MATCHES_WAITING_MAX_AGE_DAYS) {
      waiting.push({ kind: "matches_waiting", requirement: r, matchCount: stat.total });
    } else if ((r.status === "ready" || r.status === "partial" || r.status === "zero")
      && ageDays >= STALE_MIN_AGE_DAYS && ageDays < STALE_MAX_AGE_DAYS) {
      stale.push({ kind: "stale_job", requirement: r, matchCount: stat.total });
    }
  }
  const seen = new Set<string>();
  const out: NudgeCandidate[] = [];
  for (const c of [...waiting, ...stale]) {
    if (seen.has(c.requirement.employer_id)) continue;
    seen.add(c.requirement.employer_id);
    out.push(c);
  }
  return out;
}

export const nudgeDedupeKey = (c: NudgeCandidate) => `employer_nudge:${c.kind}:${c.requirement.id}`;

export function buildNudgeEmail(c: NudgeCandidate, footer?: EmailFooterOptions): BuiltEmail {
  const role = escapeHtml(c.requirement.title.trim().slice(0, 100) || "your role");
  const link = `${appUrl()}/employer/requirements/${encodeURIComponent(c.requirement.id)}`;
  if (c.kind === "matches_waiting") {
    const n = c.matchCount;
    const subject = `${n} ${n === 1 ? "candidate is" : "candidates are"} waiting for your ${c.requirement.title.trim().slice(0, 60)} role`;
    const body =
      title(`${n} ${n === 1 ? "match is" : "matches are"} waiting`) +
      para(`We matched ${n} ${n === 1 ? "candidate" : "candidates"} to <strong>${role}</strong>, but you haven't unlocked anyone yet.`) +
      para("Open the matches to see each candidate's interview evidence and how they scored. You only pay when you unlock someone's contact details.") +
      button("Review your matches", link);
    return { subject, html: emailShell({ preview: subject, body, footer }) };
  }
  const subject = `Is your ${c.requirement.title.trim().slice(0, 60)} role still open?`;
  const body =
    title("Still hiring for this role?") +
    para(`<strong>${role}</strong> has been open for a couple of weeks without an unlock.`) +
    para("If you are still hiring, re-run matching or loosen a requirement to widen the pool. If you have filled it, close the role so we stop matching.") +
    button("Review the role", link);
  return { subject, html: emailShell({ preview: subject, body, footer }) };
}

export interface SendDeps {
  fetchImpl?: typeof fetch;
  apiKey?: string;
  from?: string;
  /** Test hook: replaces the backoff wait. */
  sleep?: (ms: number) => Promise<void>;
}

export interface SendInput {
  to: string;
  subject: string;
  html: string;
  idempotencyKey: string;
  /** Spread into the Resend body (reply_to, headers) for marketing mail. */
  extra?: Record<string, unknown>;
}

/** Sends via Resend, retrying once on a network error, 429 or 5xx. Other 4xx
    are permanent (bad address, bad key) and are not retried. Never throws. */
export async function sendEmployerEmail(input: SendInput, deps: SendDeps = {}): Promise<boolean> {
  const apiKey = deps.apiKey ?? (process.env.RESEND_API_KEY || "").trim();
  if (!apiKey || !input.to) return false;
  const from = deps.from ?? (process.env.FROM_EMAIL || "HireStepX <noreply@hirestepx.com>");
  const doFetch = deps.fetchImpl ?? fetch;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await doFetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": input.idempotencyKey },
        body: JSON.stringify({ from, to: [input.to], subject: input.subject, html: input.html, ...(input.extra ?? {}) }),
        signal: AbortSignal.timeout(8_000),
      });
      if (res.ok) return true;
      if (res.status !== 429 && res.status < 500) return false;
    } catch {
      /* network error or timeout: retry once */
    }
    if (attempt === 0) await sleep(800);
  }
  return false;
}
