/* Pure employer trust rules — verification tiers, per-tier limits, and the
 * free-mail check. No I/O: everything here is unit-tested directly
 * (src/__tests__/employerTrust.test.ts). Handlers load the employers row +
 * auth user and pass plain values in.
 *
 * Tiers gate DANGEROUS capabilities (buying contact details, messaging), not
 * signup — signup stays self-serve:
 *   basic          signed up with a free-mail address, no admin verification
 *   email_verified confirmed sign-in email on a company (non-free-mail) domain
 *   verified       email domain matches the employer's website, or an admin
 *                  verified them (employers.verification_tier = 'verified')
 */

export type EmployerTier = "basic" | "email_verified" | "verified";

const TIER_RANK: Record<EmployerTier, number> = { basic: 0, email_verified: 1, verified: 2 };

export const TIER_LIMITS: Record<EmployerTier, { unlocksPerDay: number; openRequirements: number; rematchesPerHour: number }> = {
  basic: { unlocksPerDay: 3, openRequirements: 3, rematchesPerHour: 5 },
  email_verified: { unlocksPerDay: 25, openRequirements: 15, rematchesPerHour: 20 },
  verified: { unlocksPerDay: 100, openRequirements: 50, rematchesPerHour: 40 },
};

/* Single shared list: the server (work_email_required gate, tier derivation)
 * and the onboarding pre-check both read it, so they can never disagree.
 * Exported so tests can assert every entry is rejected. */
export const FREE_MAIL_DOMAINS: ReadonlySet<string> = new Set([
  "gmail.com", "googlemail.com",
  "yahoo.com", "yahoo.in", "yahoo.co.in", "yahoo.co.uk", "ymail.com", "rocketmail.com",
  "yahoo.fr", "yahoo.de", "yahoo.es", "yahoo.it", "yahoo.ca", "yahoo.com.au", "yahoo.com.br", "yahoo.com.sg",
  "yahoo.com.ph", "yahoo.com.hk", "yahoo.com.mx", "yahoo.com.ar", "yahoo.co.jp", "yahoo.co.id", "yahoo.co.nz", "yahoo.ie",
  "outlook.com", "outlook.in", "outlook.co.uk", "outlook.com.au", "outlook.fr", "outlook.de",
  "hotmail.com", "hotmail.co.in", "hotmail.in", "hotmail.co.uk", "hotmail.com.au", "hotmail.fr", "hotmail.de",
  "live.com", "live.in", "live.co.uk", "live.com.au", "live.fr", "live.de", "msn.com",
  "icloud.com", "me.com", "mac.com", "aol.com",
  "proton.me", "protonmail.com", "pm.me", "tutanota.com", "tutamail.com", "tuta.io",
  "rediff.com", "rediffmail.com", "sify.com", "bol-online.in", "in.com", "airtel.in",
  "hey.com", "duck.com", "web.de", "mail.ru", "qq.com", "163.com", "126.com",
  "zoho.com", "zohomail.in", "zohomail.com", "yandex.com", "yandex.ru",
  "mail.com", "gmx.com", "gmx.net", "inbox.com", "fastmail.com",
]);

/* Throwaway inboxes: never a real company contact, whatever the website says. */
export const DISPOSABLE_MAIL_DOMAINS: ReadonlySet<string> = new Set([
  "mailinator.com", "guerrillamail.com", "guerrillamail.net", "guerrillamail.org", "guerrillamail.biz", "guerrillamail.de",
  "guerrillamailblock.com", "sharklasers.com", "grr.la", "spam4.me",
  "10minutemail.com", "10minutemail.net", "tempmail.com", "temp-mail.org", "temp-mail.io", "tempmail.net", "tempr.email",
  "yopmail.com", "yopmail.fr", "yopmail.net", "trashmail.com", "trashmail.net", "getnada.com", "nada.email",
  "maildrop.cc", "throwawaymail.com", "dispostable.com", "fakeinbox.com", "mailnesia.com", "mohmal.com", "emailondeck.com",
]);

export function emailDomain(email: string | null | undefined): string {
  if (!email || typeof email !== "string") return "";
  const at = email.lastIndexOf("@");
  if (at < 0) return "";
  return email.slice(at + 1).trim().toLowerCase();
}

export function isDisposableMailDomain(domain: string): boolean {
  return DISPOSABLE_MAIL_DOMAINS.has(domain.trim().toLowerCase());
}

/** True for free-mail and disposable providers alike: neither proves a company. */
export function isFreeMailDomain(domain: string): boolean {
  const d = domain.trim().toLowerCase();
  return FREE_MAIL_DOMAINS.has(d) || DISPOSABLE_MAIL_DOMAINS.has(d);
}

/** Registrable-ish host of a website string ("https://www.acme.co.in/x" -> "acme.co.in"). */
export function websiteHost(website: string | null | undefined): string {
  if (!website || typeof website !== "string") return "";
  const raw = website.trim();
  if (!raw) return "";
  try {
    const url = new URL(/^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`);
    return url.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function isEmployerTier(v: unknown): v is EmployerTier {
  return v === "basic" || v === "email_verified" || v === "verified";
}

/** Effective tier = the higher of the stored tier (admin/grandfathered) and what
 *  the confirmed sign-in email + website prove right now. Never lowers a stored tier. */
export function deriveEmployerTier(input: {
  storedTier: unknown;
  email: string | null | undefined;
  emailConfirmed: boolean;
  website: string | null | undefined;
}): EmployerTier {
  const stored: EmployerTier = isEmployerTier(input.storedTier) ? input.storedTier : "basic";
  let derived: EmployerTier = "basic";
  const domain = emailDomain(input.email);
  if (input.emailConfirmed && domain && !isFreeMailDomain(domain)) {
    derived = "email_verified";
    const host = websiteHost(input.website);
    if (host && (host === domain || host.endsWith(`.${domain}`) || domain.endsWith(`.${host}`))) {
      derived = "verified";
    }
  }
  return TIER_RANK[derived] > TIER_RANK[stored] ? derived : stored;
}

export function tierAtLeast(tier: EmployerTier, min: EmployerTier): boolean {
  return TIER_RANK[tier] >= TIER_RANK[min];
}

/** A suspended employer (admin action or 3+ independent candidate reports)
 *  keeps read access to their own data but cannot message, unlock or rematch. */
export function isSuspended(employer: { suspended_at?: string | null } | null | undefined): boolean {
  return !!employer?.suspended_at;
}

/** employers.suspended_reason stamped by delete-account on a soft delete. A soft-deleted
 *  employer reuses the suspension gate (every read/write/unlock/message path already
 *  enforces suspended_at), and this marker is how restore lifts ONLY its own block
 *  without un-suspending an account an admin or the report threshold suspended. */
export const DELETION_PENDING_REASON = "account_deletion_pending";

export function isDeletionPending(employer: { suspended_at?: string | null; suspended_reason?: string | null } | null | undefined): boolean {
  return !!employer?.suspended_at && employer.suspended_reason === DELETION_PENDING_REASON;
}

export const AUTO_SUSPEND_REPORT_THRESHOLD = 3;

/** True when this many independent candidates have reported the employer. */
export function shouldAutoSuspend(distinctReporters: number): boolean {
  return distinctReporters >= AUTO_SUSPEND_REPORT_THRESHOLD;
}

/** Whole-word masked name shown to employers before unlock — single source so
 *  messages, evidence and the requirement detail never diverge. */
export function maskedCandidateName(matchId: string): string {
  return `Candidate #${matchId.slice(0, 6)}`;
}
