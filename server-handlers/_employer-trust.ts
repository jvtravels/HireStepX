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

const FREE_MAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.in", "yahoo.co.in", "ymail.com", "outlook.com",
  "hotmail.com", "live.com", "msn.com", "icloud.com", "me.com", "aol.com", "proton.me", "protonmail.com",
  "rediffmail.com", "mail.com", "gmx.com", "zoho.com", "yandex.com", "tutanota.com", "pm.me", "inbox.com",
  "mailinator.com", "guerrillamail.com", "10minutemail.com", "tempmail.com", "yopmail.com",
]);

export function emailDomain(email: string | null | undefined): string {
  if (!email || typeof email !== "string") return "";
  const at = email.lastIndexOf("@");
  if (at < 0) return "";
  return email.slice(at + 1).trim().toLowerCase();
}

export function isFreeMailDomain(domain: string): boolean {
  return FREE_MAIL_DOMAINS.has(domain.trim().toLowerCase());
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
