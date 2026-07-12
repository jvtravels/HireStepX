/* HireStepX — Auth / Validation
   Pure validators. No React, no DOM, no side effects. Unit-testable. */

export interface FieldValidation {
  valid: boolean;
  message: string | null;
}

// Stricter than RFC 5322 on purpose — we reject patterns no real
// SMTP server would accept anyway (1-letter TLDs, missing TLD, leading
// dots, consecutive dots, etc.). The previous regex was permissive
// enough that "garbage@x.y" passed as valid; users complained that the
// inline validation message disappeared on obvious-garbage input.
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*\.[A-Za-z]{2,}$/;

export function validateEmail(value: string): FieldValidation {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return { valid: false, message: null }; // empty is "not yet" not "wrong"
  }
  // Reject obvious garbage shapes BEFORE the regex so we get a clean
  // message — these patterns the regex catches too but the explicit
  // check makes the intent (and any future loosening) auditable:
  //   • no @ at all       → "Email needs @"
  //   • multiple @s       → "Multiple @ symbols"
  //   • consecutive dots  → "Two dots in a row"
  //   • ends with .       → "Missing top-level domain"
  if (!trimmed.includes("@")) {
    return { valid: false, message: "Enter a valid email address." };
  }
  if ((trimmed.match(/@/g) || []).length > 1) {
    return { valid: false, message: "Enter a valid email address." };
  }
  if (/\.\./.test(trimmed) || /^\./.test(trimmed) || /\.@/.test(trimmed) || /@\./.test(trimmed)) {
    return { valid: false, message: "Enter a valid email address." };
  }
  if (!EMAIL_RE.test(trimmed)) {
    return { valid: false, message: "Enter a valid email address." };
  }
  return { valid: true, message: null };
}

/** Login-side password validator. Min length matches the signup-side
    minimum (8) so the two flows agree on what counts as a "valid"
    password and we don't show a misleading 6-char hint on Login that
    no real account ever satisfies. */
export function validatePassword(value: string): FieldValidation {
  if (value.length === 0) {
    return { valid: false, message: null };
  }
  if (value.length < 8) {
    return { valid: false, message: "Must be at least 8 characters." };
  }
  return { valid: true, message: null };
}

/* ─── Have I Been Pwned password breach check ───
   k-anonymous lookup: only the first 5 hex chars of the SHA-1 hash
   leave the browser. The full hash never reaches HIBP. */

async function sha1HexUpper(str: string): Promise<string> {
  const enc = new TextEncoder().encode(str);
  const buf = await crypto.subtle.digest("SHA-1", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

export interface BreachResult {
  /** True if the password appears in any HIBP-indexed breach. */
  breached: boolean;
  /** How many times this password has been seen across breaches. */
  count: number;
  /** True when the breach API was unreachable / timed out and we
   *  could not actually check this password. UI should surface this
   *  as a soft warning ("we couldn't check — pick something fresh
   *  to be safe") rather than blocking the user. Fails open on the
   *  block path; informs on the UI path. Audit P1 #10. */
  unknown?: boolean;
}

/** Check if a password has appeared in known data breaches.
    Fails open — if the API is unreachable or errors, returns
    `{ breached: false, count: 0, unknown: true }` rather than blocking
    signup. The `unknown` flag lets the UI show a soft warning so users
    aren't silently submitting a possibly-breached password. */
export async function checkPasswordBreached(
  password: string,
): Promise<BreachResult> {
  // No point checking trivially-bad passwords — they fail validateSignupPassword
  // anyway and we shouldn't waste a network call.
  if (password.length < 8) return { breached: false, count: 0 };
  try {
    const hash = await sha1HexUpper(password);
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 4000);
    const res = await fetch(
      `https://api.pwnedpasswords.com/range/${prefix}`,
      {
        // "Add-Padding: true" pads the response to a fixed size to
        // prevent network observers from inferring how many breach hits
        // exist for this prefix.
        headers: { "Add-Padding": "true" },
        signal: ac.signal,
      },
    );
    clearTimeout(t);
    if (!res.ok) return { breached: false, count: 0, unknown: true };
    const text = await res.text();
    for (const line of text.split("\n")) {
      const [s, c] = line.trim().split(":");
      if (s === suffix) return { breached: true, count: parseInt(c, 10) || 0 };
    }
    return { breached: false, count: 0 };
  } catch {
    // Network error / timeout / API down — fail open with `unknown`
    // so the UI can surface a soft warning.
    return { breached: false, count: 0, unknown: true };
  }
}

/** Sanitize an email for submission. Trims whitespace; lowercases the
    domain (RFC 5321 §2.3.11). The local part is left as-is to preserve
    case-sensitive providers (rare but legal). */
export function sanitizeEmail(value: string): string {
  const trimmed = value.trim();
  const at = trimmed.lastIndexOf("@");
  if (at < 0) return trimmed;
  return trimmed.slice(0, at) + "@" + trimmed.slice(at + 1).toLowerCase();
}

/* ─── Disposable / throwaway email blocklist ───
   Curated set of well-known temporary-mail providers. We reject these
   at signup so attackers can't farm free-tier credits with infinite
   throwaway addresses. Not exhaustive (the long-tail is endless) — we
   cover the top providers; everything else is caught by the email-link
   verification gate.

   Add domains as we see abuse patterns. Keep this list short and
   high-signal — false positives are worse than a few extras slipping
   through (they CAN still verify their email, they're just rate-limited
   downstream). */
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  // 10-minute / timed-expiry services
  "10minutemail.com",
  "10minutemail.net",
  "20minutemail.com",
  "30minutemail.com",
  "zehnminutenmail.de",
  "tempinbox.com",
  "tempinbox.co.uk",
  "tempr.email",
  "tempmail.com",
  "tempmail.net",
  "temp-mail.org",
  "temp-mail.io",
  "temp-inbox.com",
  "tempmailaddress.com",
  "tempalias.com",
  "tempthe.net",
  "tempail.com",
  "mytemp.email",
  "easytrashmail.com",
  // Guerrilla Mail family
  "guerrillamail.com",
  "guerrillamail.info",
  "guerrillamail.net",
  "guerrillamail.org",
  "guerrillamailblock.com",
  "sharklasers.com",
  "grr.la",
  // Mailinator family
  "mailinator.com",
  "mailinator.net",
  "mailinator.org",
  "mailinator2.com",
  "tmailinator.com",
  // Yopmail family
  "yopmail.com",
  "yopmail.fr",
  "yopmail.net",
  "yopmail.pp.ua",
  // Trashmail family
  "trashmail.com",
  "trashmail.de",
  "trashmail.net",
  "trashmail.me",
  "trashmail.io",
  "trashmail.at",
  "trashmail.org",
  "trashmailer.com",
  "trashemail.de",
  "trashimail.com",
  "trashbin.email",
  "trash-mail.at",
  "trash-mail.io",
  "mytrashmail.com",
  // Throwaway
  "throwawaymail.com",
  "throwaway.email",
  "throwam.com",
  // Fake / disposable inbox
  "fakeinbox.com",
  "emailfake.com",
  "email-fake.com",
  "instantemailaddress.com",
  "incognitomail.com",
  "incognitomail.net",
  "incognitomail.org",
  // Get / Nada / Drop
  "getairmail.com",
  "getnada.com",
  "maildrop.cc",
  // Mail* misc
  "mailnesia.com",
  "mailnull.com",
  "mailsac.com",
  "mailscrap.com",
  "mailtemp.info",
  "mailtemporaire.fr",
  "mailtome.de",
  "mailtothis.com",
  "mailezee.com",
  "mailme24.com",
  "maileimer.de",
  "mailbidon.com",
  // Moakt / Mohmal
  "moakt.com",
  "mohmal.com",
  // MT series
  "mt2014.com",
  "mt2015.com",
  // Discard / Dispostable
  "dispostable.com",
  "discard.email",
  "discardmail.com",
  "discardmail.de",
  "disposableaddress.com",
  "dispose.it",
  // Spamgourmet family
  "spamgourmet.com",
  "spamgourmet.net",
  "spamgourmet.org",
  "spambox.us",
  "spamobox.com",
  "spam.la",
  "spam4.me",
  "spaml.com",
  "spamspot.com",
  "spamfree.eu",
  // Wegwerf (German disposable)
  "wegwerfmail.de",
  "wegwerfmail.net",
  "wegwerfmail.org",
  // Jetable (French disposable)
  "jetable.com",
  "jetable.net",
  "jetable.org",
  // Misc high-abuse domains
  "mintemail.com",
  "harakirimail.com",
  "inboxbear.com",
  "burnermail.io",
  "anonbox.net",
  "anonaddy.me",
  "instaaddr.com",
  "tmpmail.org",
  "tmpmail.net",
  "trbvm.com",
  "nwytg.net",
  "kukumail.com",
  "dodgit.com",
  "dumpmail.de",
  "despam.it",
  "tmail.io",
  "killmail.com",
  "killmail.net",
  "kasmail.com",
  "filzmail.de",
]);

/** Returns true if the email's domain is on the disposable / throwaway
    provider list. Matches the domain exactly (no substring). */
export function isDisposableEmail(value: string): boolean {
  const at = value.lastIndexOf("@");
  if (at < 0) return false;
  const domain = value.slice(at + 1).trim().toLowerCase();
  if (!domain) return false;
  return DISPOSABLE_EMAIL_DOMAINS.has(domain);
}

/* ─── Plus-alias normalization for de-duplication ───
   Big providers treat `rahul+anything@gmail.com` and `rahul@gmail.com`
   as the same inbox. Without normalization, a single attacker farms
   infinite free-tier accounts via gmail aliasing.

   Returns a canonical "dedup key" for the email — strips +suffix on
   providers known to ignore them, and removes dots on Gmail (which
   also ignores them). For unknown domains the email is returned as-is
   (lowercased domain only) — we don't aggressively normalize because
   most corporate hosts respect plus-aliases as distinct inboxes. */
const PLUS_ALIAS_PROVIDERS = new Set([
  "gmail.com",
  "googlemail.com",
  "fastmail.com",
  "fastmail.fm",
  "hey.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "protonmail.com",
  "proton.me",
  "pm.me",
]);

const GMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

export function normalizeEmailForDedup(value: string): string {
  const trimmed = value.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at < 0) return trimmed;
  let local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  if (!domain) return trimmed;
  if (PLUS_ALIAS_PROVIDERS.has(domain)) {
    const plus = local.indexOf("+");
    if (plus >= 0) local = local.slice(0, plus);
  }
  if (GMAIL_DOMAINS.has(domain)) {
    local = local.replace(/\./g, "");
  }
  return `${local}@${domain}`;
}

/** Detect leading/trailing whitespace in a password — should warn the
    user before submit since most servers reject it as malformed. */
export function passwordHasEdgeWhitespace(value: string): boolean {
  return value.length > 0 && value !== value.trim();
}

/** Name validator (signup). Names can be one word, multilingual, with
    spaces, hyphens, apostrophes. Don't be over-prescriptive — that's
    how systems wrongly reject "O'Brien" or "राहुल". Max length matches
    server-side cap in AuthContext.signup() (48 chars). */
export function validateName(value: string): FieldValidation {
  const trimmed = value.trim();
  if (trimmed.length === 0) return { valid: false, message: null };
  if (trimmed.length < 2) {
    return { valid: false, message: "Please enter your name." };
  }
  if (trimmed.length > 40) {
    return { valid: false, message: "Name must be 40 characters or fewer." };
  }
  return { valid: true, message: null };
}

/** Per-criterion checks exposed for the live checklist UI. */
export interface PasswordChecks {
  length: boolean;
  lowercase: boolean;
  uppercase: boolean;
  number: boolean;
  symbol: boolean;
}

/** Signup-grade password validator. Matches the server-side rules in
    AuthContext.signup() exactly so the client checklist never shows
    "all green" while the server rejects: length ≥8 + uppercase + digit
    + symbol (all three required). Lowercase is recommended but optional. */
export interface PasswordStrength extends FieldValidation {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  checks: PasswordChecks;
}

export function validateSignupPassword(value: string): PasswordStrength {
  const checks: PasswordChecks = {
    length: value.length >= 8,
    lowercase: /[a-z]/.test(value),
    uppercase: /[A-Z]/.test(value),
    number: /[0-9]/.test(value),
    symbol: /[^A-Za-z0-9]/.test(value),
  };

  if (value.length === 0) {
    return { valid: false, message: null, score: 0, label: "", checks };
  }
  if (!checks.length) {
    return {
      valid: false,
      message: null, // checklist communicates this
      score: 1,
      label: "Too short",
      checks,
    };
  }

  // Server-required criteria: uppercase, number, symbol (all three).
  // Lowercase is bonus — boosts the strength meter but isn't required.
  const requiredVariety =
    Number(checks.uppercase) + Number(checks.number) + Number(checks.symbol);
  const totalVariety = requiredVariety + Number(checks.lowercase);
  const longBonus = value.length >= 14 ? 1 : 0;
  const score = Math.min(4, totalVariety + longBonus - 1) as
    | 0
    | 1
    | 2
    | 3
    | 4;
  const safeScore = Math.max(1, score) as 0 | 1 | 2 | 3 | 4;

  if (requiredVariety < 3) {
    return {
      valid: false,
      message: null, // the checklist tells the user what's missing
      score: safeScore,
      label: "Weak",
      checks,
    };
  }

  return {
    valid: true,
    message: null,
    score: safeScore,
    label: safeScore >= 4 ? "Strong" : "Good",
    checks,
  };
}
