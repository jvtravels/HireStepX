/* Employer win-back selection and copy. Pure (rows in, decisions out) so the
 * daily cron in send-employer-winback.ts stays thin and this file is unit-tested
 * (src/__tests__/employerWinback.test.ts).
 *
 * Two audiences, at most one email per employer per 30 days (Redis key
 * employer_winback:<employerId>):
 *   no_unlock - created a requirement 7-60 days ago and never unlocked anyone
 *   inactive  - has unlocked before, but no unlock or new requirement for 30-180 days
 * Marketing-category mail: the cron honours the employer_notifications opt-out. */

import { emailShell, title, para, button, escapeHtml, type EmailFooterOptions } from "./_email-theme";
import { isSuspended } from "./_employer-trust";

declare const process: { env: Record<string, string | undefined> };

const DAY_MS = 86_400_000;

export const NO_UNLOCK_MIN_AGE_DAYS = 7;
export const NO_UNLOCK_MAX_AGE_DAYS = 60;
export const INACTIVE_MIN_DAYS = 30;
export const INACTIVE_MAX_DAYS = 180;
export const WINBACK_COOLDOWN_SECONDS = 30 * 86_400;

export type WinbackKind = "no_unlock" | "inactive";

export interface RequirementActivityRow { employer_id: string; created_at: string }
export interface UnlockActivityRow { employer_id: string; unlocked_at: string }

export interface EmployerActivity {
  employerId: string;
  requirementCount: number;
  firstRequirementAt: number | null;
  lastRequirementAt: number | null;
  unlockCount: number;
  lastUnlockAt: number | null;
}

export interface WinbackCandidate {
  employerId: string;
  kind: WinbackKind;
  requirementCount: number;
  unlockCount: number;
}

function ts(iso: string): number | null {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : null;
}

/** Folds raw requirement and unlock rows into one activity record per employer. */
export function buildActivity(
  requirements: readonly RequirementActivityRow[],
  unlocks: readonly UnlockActivityRow[],
): EmployerActivity[] {
  const by = new Map<string, EmployerActivity>();
  const get = (id: string): EmployerActivity => {
    let a = by.get(id);
    if (!a) {
      a = { employerId: id, requirementCount: 0, firstRequirementAt: null, lastRequirementAt: null, unlockCount: 0, lastUnlockAt: null };
      by.set(id, a);
    }
    return a;
  };
  for (const r of requirements) {
    const t = ts(r.created_at);
    if (t === null || !r.employer_id) continue;
    const a = get(r.employer_id);
    a.requirementCount++;
    a.firstRequirementAt = a.firstRequirementAt === null ? t : Math.min(a.firstRequirementAt, t);
    a.lastRequirementAt = a.lastRequirementAt === null ? t : Math.max(a.lastRequirementAt, t);
  }
  for (const u of unlocks) {
    const t = ts(u.unlocked_at);
    if (t === null || !u.employer_id) continue;
    const a = get(u.employer_id);
    a.unlockCount++;
    a.lastUnlockAt = a.lastUnlockAt === null ? t : Math.max(a.lastUnlockAt, t);
  }
  return [...by.values()];
}

/** Pure. `allowNoUnlock` must be false when the unlock read was truncated: an
    employer whose unlocks fell outside the read would otherwise be told they
    "never unlocked anyone". */
export function selectWinbacks(
  activity: readonly EmployerActivity[],
  now: number,
  opts: { allowNoUnlock?: boolean } = {},
): WinbackCandidate[] {
  const allowNoUnlock = opts.allowNoUnlock ?? true;
  const out: WinbackCandidate[] = [];
  for (const a of activity) {
    if (a.unlockCount === 0) {
      if (!allowNoUnlock || a.firstRequirementAt === null) continue;
      const age = (now - a.firstRequirementAt) / DAY_MS;
      if (age >= NO_UNLOCK_MIN_AGE_DAYS && age < NO_UNLOCK_MAX_AGE_DAYS) {
        out.push({ employerId: a.employerId, kind: "no_unlock", requirementCount: a.requirementCount, unlockCount: 0 });
      }
      continue;
    }
    const last = Math.max(a.lastUnlockAt ?? 0, a.lastRequirementAt ?? 0);
    if (last === 0) continue;
    const idle = (now - last) / DAY_MS;
    if (idle >= INACTIVE_MIN_DAYS && idle < INACTIVE_MAX_DAYS) {
      out.push({ employerId: a.employerId, kind: "inactive", requirementCount: a.requirementCount, unlockCount: a.unlockCount });
    }
  }
  // Deterministic order so a capped run is repeatable; the dedupe key moves the rest to later days.
  return out.sort((x, y) => x.employerId.localeCompare(y.employerId));
}

/** An employer can be mailed only if active (not suspended or pending deletion) and has an address. */
export function isWinbackEligible(
  employer: { suspended_at?: string | null } | null | undefined,
  email: string | null | undefined,
): boolean {
  return !!employer && !isSuspended(employer) && typeof email === "string" && email.includes("@");
}

export const winbackDedupeKey = (employerId: string) => `employer_winback:${employerId}`;

/** Resend idempotency key, bucketed per 30 days so a retry inside the window is a no-op. */
export function winbackIdempotencyKey(employerId: string, now: number): string {
  return `employer-winback-${employerId}-${Math.floor(now / (WINBACK_COOLDOWN_SECONDS * 1000))}`;
}

export interface WinbackEmail { subject: string; html: string }

export function buildWinbackEmail(kind: WinbackKind, companyName: string, footer?: EmailFooterOptions): WinbackEmail {
  const appUrl = (process.env.APP_URL || "https://hirestepx.com").replace(/\/$/, "");
  const company = escapeHtml(companyName.trim().slice(0, 80) || "your company");
  if (kind === "no_unlock") {
    const subject = "Your HireStepX matches are still waiting";
    const body =
      title("Your candidates are waiting") +
      para(`You posted a role for <strong>${company}</strong> on HireStepX, but you have not unlocked a candidate yet.`) +
      para("Every match comes with interview evidence: how they scored and where they were strong or weak. You pay only when you unlock contact details, and you get the amount back as credit if a candidate declines or does not reply.") +
      button("Review your matches", `${appUrl}/employer`);
    return { subject, html: emailShell({ preview: subject, body, footer }) };
  }
  const subject = "New candidates are ready for your roles";
  const body =
    title("It has been a while") +
    para(`It has been over a month since <strong>${company}</strong> last hired through HireStepX.`) +
    para("New candidates finish mock interviews every day, and your open roles are matched against them each night. Take a look at who is new.") +
    button("See new matches", `${appUrl}/employer`);
  return { subject, html: emailShell({ preview: subject, body, footer }) };
}
